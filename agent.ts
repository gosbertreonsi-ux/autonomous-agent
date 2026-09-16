import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import express from "express"; 
import * as fs from "fs";
import * as path from "path";
import cron from "node-cron"; // 🎯 INITIAL ADDITION: Import the background scheduler tool
import { db } from "./src/prisma/db.js"; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

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

/**
 * 🛠️ THE CORE PIPELINE WORKER
 * Reusable function that processes messy text, generates markdown files, and logs to PostgreSQL
 */
async function processMessyTask(messyInput: string, source: string) {
    console.log(`\n🤖 [${source}] Processing text: "${messyInput.substring(0, 40)}..."`);
    let response;

    try {
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
        if (primaryError?.status === 429 || primaryError?.status === 503 || primaryError?.message?.includes("quota")) {
            console.warn("⚠️ [Failover] Primary model quota exhausted. Activating gemini-3.5-flash backup pipeline...");
            try {
                // 🎯 THE PERMANENT FIX: Target the fully supported gemini-3.5-flash alternate quota bucket
                response = await ai.models.generateContent({
                    model: "gemini-3.5-flash", 
                    contents: messyInput,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: taskSchema,
                        systemInstruction: "You are an advanced data extraction agent. Convert messy text inputs into structured task data structures perfectly matching the requested schema."
                    }
                });
            } catch (fallbackError) {
                console.error("❌ Both models failed in background execution loop:", fallbackError);
                return null;
            }
        } else {
            console.error("❌ API execution breakdown:", primaryError.message);
            return null;
        }
    }


    try {
        if (!response || !response.text) throw new Error("Empty payload from AI engine.");

        const cleanData = JSON.parse(response.text);
        const reportFolder = path.join(process.cwd(), "reports");
        
        if (!fs.existsSync(reportFolder)) fs.mkdirSync(reportFolder);

        const markdownLayout = `# 🤖 Autonomous Generated Report\nGenerated on: ${new Date().toLocaleString()}\nTrigger Source: ${source}\n\n### 📋 Parsed Specifications\n* **Task Name:** ${cleanData.taskName}\n* **Priority Level:** ${cleanData.priority}\n* **Estimated Execution Time:** ${cleanData.estimatedHours} Hours\n`;

        const cleanFilename = `${cleanData.taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
        const finalPath = path.join(reportFolder, cleanFilename);

        fs.writeFileSync(finalPath, markdownLayout, "utf8");
        console.log(`💾 File System Automation Success: .\\reports\\${cleanFilename}`);

        // Prisma 8 Mutation Log Entry
        const savedDatabaseRecord = await db.orm.public.AgentLog.create({
            rawInputText: messyInput,
            taskName: cleanData.taskName,
            priority: cleanData.priority,
            estimatedHours: Number(cleanData.estimatedHours),
            generatedFile: cleanFilename
        });

        console.log(`☁️ Cloud Sync Success! Pushed record ID: ${savedDatabaseRecord.id}`);
        return savedDatabaseRecord;

    } catch (error: any) {
        console.error("❌ Processing error inside worker pipeline:", error.message);
        return null;
    }
}

// 🎯 ROUTE 1: Web Request Trigger (Manual Dashboard Overrides)
app.get("/run-agent", async (req, res) => {
    const textInput = (req.query.text as string);
    if (!textInput) return res.status(400).json({ error: "Missing text parameters." });

    const result = await processMessyTask(textInput, "Web Dashboard Override");
    if (result) {
        return res.json({ status: "SUCCESS", cloudRecordId: result.id });
    } else {
        return res.status(500).json({ error: "API processing breakdown." });
    }
});

// 🎯 ROUTE 2: Fetch and View All Historical Agent Logs
app.get('/logs', async (req, res) => {
  const searchKeyword = req.query.search as string;
  try {
    let queryChain = db.orm.public.AgentLog.orderBy((log) => log.createdAt.desc());

    if (searchKeyword && searchKeyword.trim() !== '') {
        queryChain = queryChain.where((log) => log.taskName.ilike(`%${searchKeyword}%`));
    }

    const compiledLogs = await queryChain.all();
    return res.json({ success: true, totalCount: compiledLogs.length, logs: compiledLogs });
  } catch (error: any) {
    return res.status(500).json({ success: false, details: error.message });
  }
});

// =========================================================
// ⏳ THE AUTONOMOUS CRON SCHEDULER LAYER
// =========================================================
// Array simulating messy business items streaming into your system from external sources
const simulatedTaskQueue = [
    "URGENT: Deploy an automated Python algorithmic crypto-trading bot script for Bitcoin pairs.",
    "Hey, we need to optimize our slow database caching layers using Redis memory stores immediately.",
    "Low priority task: Update the security audit documentation for the serverless edge functions.",
    "Could someone write a TypeScript webhook processor pipeline for incoming Stripe payment events?"
];

// Cron Expression: '* * * * *' tells the server to execute this block exactly every 60 seconds
cron.schedule('* * * * *', async () => {
    console.log(`\n⏰ [CRON INTERVAL] Initiating automated background infrastructure sweep...`);
    
    // Grab a random messy instruction sentence out of our simulated stream queue
    const randomTask = simulatedTaskQueue[Math.floor(Math.random() * simulatedTaskQueue.length)];
    
    // Fire the entire core AI-to-DB pipeline process unsupervised!
    await processMessyTask(randomTask, "Autonomous Background Cron Job");
});


app.listen(PORT, () => {
    console.log(`\n🚀 FULL-STACK SYSTEM LIVE WITH AUTONOMOUS BACKGROUND SCHEDULER!`);
    console.log(`🖥️ Frontend Control Room Interface: http://localhost:${PORT}`);
    console.log(`⏳ Background scheduler active: Checking for tasks automatically every 60 seconds...\n`);
});
