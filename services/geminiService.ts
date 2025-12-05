import { GoogleGenAI, Type } from "@google/genai";
import { WaveComposition, EnemyType, TowerEntity } from "../types";

// Note: Using 'gemini-2.5-flash' for speed and responsiveness in a game loop context
const MODEL_NAME = 'gemini-2.5-flash';

// Safe access to process.env to prevent crashes in browsers/static hosts where process is undefined
const getApiKey = (): string | undefined => {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            const key = process.env.API_KEY;
            // Ensure key is not just whitespace or empty
            if (key.trim().length > 0) {
                return key;
            }
        }
    } catch (e) {
        // Ignore errors if process is not defined
    }
    return undefined;
};

const getClient = (): GoogleGenAI | null => {
    const apiKey = getApiKey();
    if (!apiKey) {
        return null;
    }
    return new GoogleGenAI({ apiKey });
}

export const isAIOnline = (): boolean => {
    return !!getApiKey();
};

const generateFallbackWave = (waveNumber: number): WaveComposition => {
    const enemies: WaveComposition['enemies'] = [];
    
    // Simple procedural generation logic for offline mode
    const difficultyMult = 1 + (waveNumber * 0.2);
    
    // Always spawn grunts
    enemies.push({
        type: EnemyType.grunt,
        count: Math.floor(5 * difficultyMult),
        interval: Math.max(20, 60 - waveNumber * 2),
        hpMultiplier: difficultyMult
    });

    // Add scouts from wave 2
    if (waveNumber >= 2) {
        enemies.push({
            type: EnemyType.SCOUT,
            count: Math.floor(3 * difficultyMult),
            interval: 40,
            hpMultiplier: difficultyMult * 0.8
        });
    }

    // Add tanks from wave 4, every 2 waves
    if (waveNumber >= 4 && waveNumber % 2 === 0) {
        enemies.push({
            type: EnemyType.TANK,
            count: Math.floor(1 + waveNumber / 5),
            interval: 100,
            hpMultiplier: difficultyMult * 1.5
        });
    }

    // Add boss every 10 waves
    if (waveNumber % 10 === 0) {
        enemies.push({
            type: EnemyType.BOSS,
            count: 1,
            interval: 200,
            hpMultiplier: difficultyMult * 4
        });
    }

    return {
        briefing: `[SIMULATION MODE] Neural uplink offline. Wave ${waveNumber} generated via local combat algorithms.`,
        enemies
    };
};

export const generateWave = async (waveNumber: number, difficultyMod: number): Promise<WaveComposition> => {
    const ai = getClient();
    
    // If no AI client, use fallback immediately
    if (!ai) {
        return generateFallbackWave(waveNumber);
    }
    
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
        return generateFallbackWave(waveNumber);
    }
};

export const getTacticalAdvice = async (
    wave: number, 
    money: number, 
    lives: number, 
    towers: TowerEntity[]
): Promise<string> => {
    const ai = getClient();

    if (!ai) {
        const fallbackQuotes = [
            "Simulation Mode: Rely on standard combat protocols.",
            "Neural Link Offline: Commander, proceed with manual targeting.",
            "Pattern Analysis: Enemy density increasing.",
            "Resource Alert: Optimize spending for maximum efficiency.",
            "Local Sensors: Hostiles approaching from the vector."
        ];
        return fallbackQuotes[wave % fallbackQuotes.length];
    }

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
        return "Tactical uplink unstable.";
    }
};