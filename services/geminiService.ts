
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

export const analyzeTextWithAI = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza el siguiente texto en español y clasifica cada palabra según su clase gramatical (Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante). Ignora signos de puntuación.
    
    Texto: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              description: "Una de: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante"
            }
          },
          required: ["text", "category"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data;
  } catch (e) {
    console.error("Error parsing Gemini response", e);
    return [];
  }
};
