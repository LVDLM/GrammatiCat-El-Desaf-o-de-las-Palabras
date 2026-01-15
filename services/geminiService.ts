
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

export const analyzeTextWithAI = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Actúa como un experto en lingüística española. Analiza el texto proporcionado y clasifica CADA palabra o unidad léxica en una de estas categorías: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante.
    
    REGLAS CRÍTICAS DE AGRUPACIÓN:
    1. Agrupa los TIEMPOS VERBALES COMPUESTOS como una sola unidad (ej: "he comido", "había saltado", "hubiéramos ido", "has estado").
    2. Agrupa las PERÍFRASIS VERBALES si es posible (ej: "tengo que ir", "voy a cantar").
    3. No omitas ninguna palabra del texto original.
    4. Mantén los signos de puntuación pegados a la última palabra de la unidad (ej: "comido.").
    
    Devuelve EXCLUSIVAMENTE un array JSON de objetos: {"text": "palabra o grupo", "category": "Categoría"}.
    
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
    // Limpieza de posibles markdown antes de parsear
    const cleanedJson = textOutput.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (e) {
    console.error("Error parsing Gemini response", e);
    return [];
  }
};