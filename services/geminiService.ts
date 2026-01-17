
import { GoogleGenAI, Type } from "@google/genai";

export const analyzeTextWithAI = async (text: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analiza gramaticalmente cada palabra de este texto: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante. 
      Devuelve estrictamente un JSON array de objetos {"text": "palabra", "category": "Clase"}.
      Texto: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["text", "category"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (e: any) {
    throw e;
  }
};
