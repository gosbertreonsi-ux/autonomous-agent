import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import express from "express"; // Import Express web server framework
import * as fs from "fs";
import * as path from "path";
import { db } from "./src/prisma/db"; // Clean extensionless TypeScript module loader path mapping

const app = express();
const PORT = 3000;

// Enable Express server to automatically read incoming JSON payloads
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
        // Route 1: Try latest model
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
        if (primaryError?.status === 503 || primaryError?.message?.includes("demand")) {
            console.warn("⚠️ Primary model overloaded. Activating gemini-2.0-flash failover mechanism...");
            try {
                // Route 2: Fallback stability model
                response = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: messyInput,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: taskSchema,
                        systemInstruction: "You are an advanced data extraction agent."
                    }
                });
            } catch (fallbackError) {
                return res.status(500).json({ error: "Both primary and backup models failed.", details: fallbackError });
            }
        } else {
            return res.status(500).json({ error: "API authentication or processing failure.", details: primaryError });
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

        // 🗄️ PERFECTED PRISMA 8 CLOUD INSERT ENGINE PIPELINE
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
  try {
    // 🧠 Perfected Prisma 8 Native Query Engine Functional Sort Layout
    const allLogs = await db.orm.public.AgentLog
      .orderBy((log) => log.createdAt.desc())
      .all();

    return res.json({
      success: true,
      totalCount: allLogs.length,
      logs: allLogs
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

// Start the server infrastructure
app.listen(PORT, () => {
    console.log(`\n🚀 AUTONOMOUS ENGINE SERVER ONLINE!`);
    console.log(`📡 Listening for web triggers at: http://localhost:${PORT}/run-agent`);
    console.log(`🔎 View your continuous historical cloud records data feed at: http://localhost:${PORT}/logs\n`);
});
