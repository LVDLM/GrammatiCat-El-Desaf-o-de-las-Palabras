
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

const logToDebug = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  const fullMsg = `[${timestamp}] ${isError ? '❌ IA:' : 'ℹ️ IA:'} ${msg}`;
  (window as any).debugLogs = (window as any).debugLogs || [];
  (window as any).debugLogs.push(fullMsg);
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

export const analyzeTextWithAI = async (text: string) => {
  // Acceso directo para que el compilador lo detecte
  const apiKey = process.env.API_KEY || (window as any).process?.env?.API_KEY;
  
  if (!apiKey) {
    logToDebug("No se detectó la clave API_KEY. Revisa Vercel.", true);
    throw new Error("Falta API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    logToDebug("Llamando a Gemini para análisis...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Clasifica gramaticalmente CADA palabra de este texto: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante. 
      Devuelve solo un JSON array de objetos {"text": "palabra", "category": "Clase"}.
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
                enum: ["Sustantivo", "Adjetivo", "Verbo", "Adverbio", "Pronombre", "Preposición", "Conjunción", "Determinante"]
              }
            },
            required: ["text", "category"]
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("Sin respuesta del modelo");
    
    logToDebug("Análisis completado.");
    return JSON.parse(textOutput);
  } catch (e: any) {
    logToDebug(`Fallo en IA: ${e.message}`, true);
    throw e;
  }
};
