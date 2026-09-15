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
    // Simulated messy, unorganized real-world data incoming to your system
    const messyInput = "Hey team, we urgently need a responsive web landing page built using Next.js and Tailwind CSS for the new client project. It should probably take about 6 hours to get the initial draft done.";

    console.log("📡 Sending data to the AI Architect...");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: messyInput,
            config: {
                responseMimeType: "application/json",
                responseSchema: taskSchema,
                systemInstruction: "You are an advanced data extraction agent. Convert messy text inputs into structured task data structures perfectly matching the requested schema."
            }
        });

        // SAFETY CHECK: Ensure response.text actually contains a string
        if (!response.text) {
            throw new Error("The AI returned an empty response.");
        }

        // Now TypeScript knows for a fact that response.text is a valid string
        const cleanData = JSON.parse(response.text);

        console.log("\n🎯 Execution Success! Structured Object Received:");
        console.log(cleanData);
        
        console.log(`\n🤖 System Automated Action: Triggering workflow for "${cleanData.taskName}" with ${cleanData.priority} priority.`);

        // ==========================================
        // 💾 NEW AUTONOMOUS ACTION: CREATE FILE
        // ==========================================
        const reportFolder = path.join(process.cwd(), "reports");
        
        // If the 'reports' folder doesn't exist, create it instantly
        if (!fs.existsSync(reportFolder)) {
            fs.mkdirSync(reportFolder);
        }

        // Design a beautiful markdown layout using the AI's data variables
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

        // Turn the task name into a perfect, web-safe filename
        const cleanFilename = `${cleanData.taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
        const finalPath = path.join(reportFolder, cleanFilename);

        // Physically write the file to your hard drive
        fs.writeFileSync(finalPath, markdownLayout, "utf8");

        console.log(`\n💾 FILE SYSTEM SUCCESS! Report created at: .\\reports\\${cleanFilename}`);

    } catch (error) {
        console.error("❌ An error occurred during execution:", error);
    }
}

runAutonomousParser();
