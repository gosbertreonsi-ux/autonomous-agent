import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config"; //  This automatically loads your hidden .env variables into memory
// 1. Initialize the AI client. It automatically searches for your API key.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


// 2. Define the exact structure (Schema) we want the AI to reply with.
// This ensures the AI cannot reply with random paragraphs.
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

    } catch (error) {
        console.error("❌ An error occurred during execution:", error);
    }
}

runAutonomousParser();
