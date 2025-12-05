import { GoogleGenAI, Type } from "@google/genai";
import { WaveComposition, EnemyType, TowerType, TowerEntity } from "../types";

// Note: Using 'gemini-2.5-flash' for speed and responsiveness in a game loop context
const MODEL_NAME = 'gemini-2.5-flash';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY is missing in environment variables");
        throw new Error("API Key missing");
    }
    return new GoogleGenAI({ apiKey });
}

export const generateWave = async (waveNumber: number, difficultyMod: number): Promise<WaveComposition> => {
    const ai = getClient();
    
    const prompt = `
      Generate a tower defense wave composition for Wave ${waveNumber}.
      Difficulty Multiplier: ${difficultyMod.toFixed(2)}.
      
      Available Enemy Types:
      - SCOUT: Fast, low HP
      - GRUNT: Average speed/HP
      - TANK: Slow, high HP
      - BOSS: Very slow, massive HP (Only for every 5th wave or high difficulty)

      Provide a brief tactical briefing (1 sentence) describing the threat.
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        briefing: { type: Type.STRING },
                        enemies: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: [EnemyType.SCOUT, EnemyType.grunt, EnemyType.TANK, EnemyType.BOSS] },
                                    count: { type: Type.INTEGER },
                                    interval: { type: Type.INTEGER, description: "Frames between spawns (60 = 1 sec)" },
                                    hpMultiplier: { type: Type.NUMBER }
                                },
                                required: ["type", "count", "interval", "hpMultiplier"]
                            }
                        }
                    },
                    required: ["briefing", "enemies"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        
        return JSON.parse(text) as WaveComposition;

    } catch (error) {
        console.error("Failed to generate wave:", error);
        // Fallback wave if AI fails
        return {
            briefing: "Communication relay offline. Hostiles detected on radar.",
            enemies: [
                { type: EnemyType.grunt, count: 5 + waveNumber, interval: 60, hpMultiplier: 1 + (waveNumber * 0.1) }
            ]
        };
    }
};

export const getTacticalAdvice = async (
    wave: number, 
    money: number, 
    lives: number, 
    towers: TowerEntity[]
): Promise<string> => {
    const ai = getClient();

    const towerSummary = towers.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const prompt = `
        You are a cynical, hardened sci-fi military commander AI.
        Current Status:
        - Wave: ${wave}
        - Credits: ${money}
        - Hull Integrity: ${lives}
        - Defenses: ${JSON.stringify(towerSummary)}

        Give a one-sentence piece of tactical advice or a sarcastic comment about our survival chances.
        Do not be too helpful, be flavorful.
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                maxOutputTokens: 60, // Keep it short
            }
        });
        return response.text || "Systems compromised. No tactical data.";
    } catch (e) {
        return "Tactical uplink offline.";
    }
};
