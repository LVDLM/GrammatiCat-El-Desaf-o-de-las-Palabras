
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

const logToDebug = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  const fullMsg = `[${timestamp}] ${isError ? '❌ IA:' : 'ℹ️ IA:'} ${msg}`;
  (window as any).debugLogs = (window as any).debugLogs || [];
  (window as any).debugLogs.push(fullMsg);
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

const getApiKey = (): string => {
  return process.env.NEXT_PUBLIC_API_KEY || 
         process.env.API_KEY || 
         (import.meta as any).env?.VITE_API_KEY ||
         (import.meta as any).env?.NEXT_PUBLIC_API_KEY ||
         '';
};

export const analyzeTextWithAI = async (text: string) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    logToDebug("No se encontró NEXT_PUBLIC_API_KEY en el entorno.", true);
    throw new Error("Falta API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    logToDebug("Enviando texto a Gemini...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza gramaticalmente CADA palabra del texto: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante. 
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
    if (!textOutput) throw new Error("Respuesta de IA vacía.");
    
    logToDebug("Análisis de IA recibido.");
    return JSON.parse(textOutput);
  } catch (e: any) {
    logToDebug(`Error IA: ${e.message}`, true);
    throw e;
  }
};
