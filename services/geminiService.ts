import { GoogleGenAI, Type } from "@google/genai";

// Use gemini-3-pro-preview for complex text analysis tasks like linguistic parsing.
export const analyzeTextWithAI = async (text: string) => {
  // Always use a named parameter and obtain the API key exclusively from process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
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
              text: { 
                type: Type.STRING,
                description: 'La palabra extraída del texto.'
              },
              category: { 
                type: Type.STRING,
                description: 'La categoría gramatical: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, o Determinante.'
              }
            },
            required: ["text", "category"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("Respuesta de IA vacía");
    }
    
    // Access the .text property directly and trim whitespace before parsing JSON.
    return JSON.parse(response.text.trim());
  } catch (e: any) {
    throw e;
  }
};