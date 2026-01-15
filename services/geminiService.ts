
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

// Importamos addLog indirectamente mediante eventos para no crear dependencias circulares
const logToDebug = (msg: string, isError: boolean = false) => {
  console.log(msg); // También a la consola real
  // Usamos el sistema de logs existente mediante dispatch
  const timestamp = new Date().toLocaleTimeString();
  const fullMsg = `[${timestamp}] ${isError ? '❌ IA:' : 'ℹ️ IA:'} ${msg}`;
  (window as any).debugLogs = (window as any).debugLogs || [];
  (window as any).debugLogs.push(fullMsg);
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

export const analyzeTextWithAI = async (text: string) => {
  const apiKey = process.env.API_KEY || (process.env as any).NEXT_PUBLIC_API_KEY;
  
  if (!apiKey) {
    logToDebug("No se encontró API_KEY para Gemini.", true);
    throw new Error("Falta API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    logToDebug("Iniciando análisis gramatical con Gemini...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza este texto y clasifica CADA palabra: Sustantivo, Adjetivo, Verbo, Adverbio, Pronombre, Preposición, Conjunción, Determinante. 
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
    if (!textOutput) throw new Error("Respuesta vacía de la IA");
    
    logToDebug("Análisis completado con éxito.");
    return JSON.parse(textOutput);
  } catch (e: any) {
    logToDebug(e.message || "Error desconocido en la llamada a la IA", true);
    throw e;
  }
};
