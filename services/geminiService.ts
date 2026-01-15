
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

export const analyzeTextWithAI = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Actúa como un experto en lingüística española. Analiza el texto proporcionado y clasifica CADA palabra en una de estas categorías: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante.
    
    REGLAS ESTRICTAS:
    1. No omitas ninguna palabra.
    2. Si una palabra tiene un signo de puntuación pegado (ej: "casa."), inclúyelo en el campo 'text'.
    3. Devuelve EXCLUSIVAMENTE un array JSON de objetos con el formato: {"text": "palabra", "category": "Categoría"}.
    
    Texto a analizar: "${text}"`,
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
              enum: ["Sustantivo", "Adjetivo", "Verbo", "Adverbio", "Pronombre", "Preposición", "Conjunción", "Determinante"]
            }
          },
          required: ["text", "category"]
        }
      }
    }
  });

  try {
    const textOutput = response.text;
    if (!textOutput) return [];
    return JSON.parse(textOutput);
  } catch (e) {
    console.error("Error parsing Gemini response", e);
    // Fallback simple por si falla el JSON
    return [];
  }
};