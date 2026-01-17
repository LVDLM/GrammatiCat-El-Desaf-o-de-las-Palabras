
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTextWithAI = async (text: string) => {
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

export const getTutorExplanation = async (text: string, targetCategory: string, missedWords: string[], wrongWords: string[]) => {
  try {
    const prompt = `Eres GrammatiCat, un experto lingüista. 
    En la frase: "${text}"
    El jugador buscaba: ${targetCategory}.
    Palabras que olvidó marcar: [${missedWords.join(', ')}].
    Palabras que marcó por error: [${wrongWords.join(', ')}].
    
    Explica de forma muy breve (máximo 3 frases), con un tono amable y felino, por qué esas palabras pertenecen o no a la categoría buscada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text;
  } catch (e) {
    return "¡Miau! Hubo un problema con mi bola de cristal gramatical. Básicamente, revisa bien la función de cada palabra en la oración.";
  }
};
