import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import express from "express"; 
import * as fs from "fs";
import * as path from "path";
import { db } from "./src/prisma/db.js";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// 🎯 THE FIX: Force cross-platform environment variable detection.
// This grabs your token even if Windows reads it as lowercase or wraps it in strings.
const activeApiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key || "";

if (!activeApiKey) {
    console.error("⚠️ CRITICAL WARNING: No Gemini API Key detected inside your local .env file setup!");
}

// Instantiate the AI engine with the verified active key string directly
const ai = new GoogleGenAI({ apiKey: activeApiKey });


const taskSchema = {
    type: Type.OBJECT,
    properties: {
        taskName: { type: Type.STRING, description: "The main objective found in the text." },
        priority: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"], description: "The urgency level." },
        estimatedHours: { type: Type.INTEGER, description: "Estimated hours to finish." },
        suggestedTools: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Software tools needed." }
    },
    required: ["taskName", "priority", "estimatedHours", "suggestedTools"],
};

// 🎯 ROUTE 1: Trigger Autonomous Processing and Cloud Database Insertion
app.get("/run-agent", async (req, res) => {
    const messyInput = (req.query.text as string) || 
        "Hey team, we urgently need a responsive web landing page built using Next.js and Tailwind CSS for the new client project. It should probably take about 6 hours to get the initial draft done.";

    console.log(`\n📡 Web Request Received! Processing text: "${messyInput.substring(0, 40)}..."`);
    let response;

    try {
        // 🎯 FIX 1: Change your primary model target string here to gemini-3.6-flash
        response = await ai.models.generateContent({
            model: "gemini-3.6-flash", 
            contents: messyInput,
            config: {
                responseMimeType: "application/json",
                responseSchema: taskSchema,
                systemInstruction: "You are an advanced data extraction agent. Convert messy text inputs into structured task data structures perfectly matching the requested schema."
            }
        });
    } catch (primaryError: any) {
        // Check if the error is due to hitting Google's rate limits (429) or model overload
        if (primaryError?.status === 429 || primaryError?.status === 503 || primaryError?.message?.includes("quota")) {
            console.warn("⚠️ Primary model quota exhausted. Activating gemini-3.5-flash-lite backup pipeline...");
            try {
                // 🎯 THE FIX: Target the distinct Flash-Lite model tier to bypass the 20-request constraint
                response = await ai.models.generateContent({
                    model: "gemini-3.5-flash-lite", 
                    contents: messyInput,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: taskSchema,
                        systemInstruction: "You are an advanced data extraction agent. Convert messy text inputs into structured task data structures perfectly matching the requested schema."
                    }
                });
            } catch (fallbackError) {
                return res.status(500).json({ error: "Both primary and fallback quota channels are fully exhausted.", details: fallbackError });
            }
        } else {
            console.error("❌ Google Engine Error Details:", primaryError.message);
            return res.status(500).json({ error: "API authentication or processing failure.", details: primaryError.message });
        }
    }




    try {
        if (!response || !response.text) {
            throw new Error("Empty payload from AI engine.");
        }

        const cleanData = JSON.parse(response.text);
        const reportFolder = path.join(process.cwd(), "reports");
        
        if (!fs.existsSync(reportFolder)) {
            fs.mkdirSync(reportFolder);
        }

        const markdownLayout = `# 🤖 Autonomous Web-Triggered Report
Generated on: ${new Date().toLocaleString()}

### 📋 Parsed Specifications
* **Task Name:** ${cleanData.taskName}
* **Priority Level:** ${cleanData.priority}
* **Estimated Execution Time:** ${cleanData.estimatedHours} Hours

### 🛠️ Required Technical Stack
${cleanData.suggestedTools.map((tool: string) => `- ${tool}`).join("\n")}
`;

        const cleanFilename = `${cleanData.taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
        const finalPath = path.join(reportFolder, cleanFilename);

        fs.writeFileSync(finalPath, markdownLayout, "utf8");
        console.log(`💾 File System Automation Success: .\\reports\\${cleanFilename}`);

        // 🗄️ PRISMA 8 PIPELINE MUTATION
        const savedDatabaseRecord = await db.orm.public.AgentLog.create({
            rawInputText: messyInput,
            taskName: cleanData.taskName,
            priority: cleanData.priority,
            estimatedHours: Number(cleanData.estimatedHours),
            generatedFile: cleanFilename
        });

        console.log(`☁️ Cloud Sync Success! Pushed record sequence row hash ID: ${savedDatabaseRecord.id}`);

        return res.json({
            status: "SUCCESS",
            message: `Report asset generated cleanly at .\\reports\\${cleanFilename}`,
            cloudRecordId: savedDatabaseRecord.id,
            extractedData: cleanData
        });

    } catch (error: any) {
        console.error("❌ Processing error:", error);
        return res.status(500).json({ error: "Failed to parse data or write report asset.", details: error.message });
    }
});

/**
 * 🔍 ROUTE 2: Fetch and View All Historical Agent Logs
 * Target URL: http://localhost:3000/logs
 */
app.get('/logs', async (req, res) => {
  const searchKeyword = req.query.search as string;

  try {
    // Fetch all logs ordered by creation date natively
    const allLogs = await db.orm.public.AgentLog
      .orderBy((log) => log.createdAt.desc())
      .all();

    // 🎯 STABLE ENGINE FILTERING: If a search keyword exists, we filter the array 
    // safely in memory. This completely bypasses the Prisma 8 database compiler bugs!
    const filteredLogs = searchKeyword
      ? allLogs.filter(log => log.taskName.toLowerCase().includes(searchKeyword.toLowerCase()))
      : allLogs;

    return res.json({
      success: true,
      totalCount: filteredLogs.length,
      logs: filteredLogs
    });

  } catch (error: any) {
    console.error("Cloud Database Retrieval Failed:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve records from the cloud database.",
      details: error.message 
    });
  }
});


app.listen(PORT, () => {
    console.log(`\n🚀 FULL-STACK AUTONOMOUS SYSTEMS PORTAL ONLINE!`);
    console.log(`🖥️ Open dashboard interface directly at: http://localhost:${PORT}\n`);
});
