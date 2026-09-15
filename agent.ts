import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config"; // This automatically loads your hidden .env variables into memory
import * as fs from "fs"; //  Native tool to create files on your machine
import * as path from "path"; //  Native tool to manage safe folder structures

// 1. Initialize the AI client securely using your .env file
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Define the exact structure (Schema) we want the AI to reply with.
const taskSchema = {
    type: Type.OBJECT,
    properties: {
        taskName: { 
            type: Type.STRING, 
            description: "The main objective found in the text." 
        },
        priority: { 
            type: Type.STRING, 
            enum: ["HIGH", "MEDIUM", "LOW"],
            description: "The urgency level of the task." 
        },
        estimatedHours: { 
            type: Type.INTEGER, 
            description: "Estimated hours to finish the task." 
        },
        suggestedTools: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of technologies or software tools needed."
        }
    },
    required: ["taskName", "priority", "estimatedHours", "suggestedTools"],
};

async function runAutonomousParser() {
    const messyInput = "Hey team, we urgently need a responsive web landing page built using Next.js and Tailwind CSS for the new client project. It should probably take about 6 hours to get the initial draft done.";

    let response;
    
    console.log("📡 Sending data to the Primary AI Architect (gemini-3.6-flash)...");

    try {
        // Attempt Route 1: Primary latest infrastructure
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
        // If the primary server is busy (503), catch the error and execute fallback route instantly
        if (primaryError?.status === 503 || primaryError?.message?.includes("demand")) {
            console.warn("\n⚠️ Primary server is overloaded. Initiating automated failover script...");
            console.log("📡 Connecting to Backup Stable Engine (gemini-2.0-flash)...");
            
            try {
                // Attempt Route 2: Rock-solid fallback model
                response = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: messyInput,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: taskSchema,
                        systemInstruction: "You are an advanced data extraction agent. Convert messy text inputs into structured task data structures perfectly matching the requested schema."
                    }
                });
            } catch (fallbackError) {
                throw new Error(`Both primary and backup systems failed. Engine offline: ${fallbackError}`);
            }
        } else {
            // If it's a different error (like a wrong API key), pass it through normally
            throw primaryError;
        }
    }

    // ========================================================
    // 💾 FILE SYSTEM PROCESSOR (Runs smoothly regardless of model)
    // ========================================================
    try {
        if (!response || !response.text) {
            throw new Error("The AI engine returned an empty text payload.");
        }

        const cleanData = JSON.parse(response.text);

        console.log("\n🎯 Execution Success! Structured Object Received:");
        console.log(cleanData);
        
        const reportFolder = path.join(process.cwd(), "reports");
        if (!fs.existsSync(reportFolder)) {
            fs.mkdirSync(reportFolder);
        }

        const markdownLayout = `# 🤖 Autonomous Action Report
Generated on: ${new Date().toLocaleString()}

### 📋 Task Specifications
* **Task Name:** ${cleanData.taskName}
* **Priority Level:** ${cleanData.priority}
* **Estimated Execution Time:** ${cleanData.estimatedHours} Hours

### 🛠️ Required Technical Stack
${cleanData.suggestedTools.map((tool: string) => `- ${tool}`).join("\n")}

---
*System Status: Processed unsupervised by Autonomous Agent Engine v1.0*
`;

        const cleanFilename = `${cleanData.taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
        const finalPath = path.join(reportFolder, cleanFilename);

        fs.writeFileSync(finalPath, markdownLayout, "utf8");
        console.log(`\n💾 FILE SYSTEM SUCCESS! Report created at: .\\reports\\${cleanFilename}`);

    } catch (error) {
        console.error("❌ Critical Processing Error:", error);
    }
}


runAutonomousParser();
