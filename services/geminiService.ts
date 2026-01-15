
import { GoogleGenAI, Type } from "@google/genai";
import { WordClass } from "../types";

const logToDebug = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  const fullMsg = `[${timestamp}] ${isError ? '❌ IA:' : 'ℹ️ IA:'} ${msg}`;
  // Intentar usar el array global de logs si existe
  const target = (window as any).debugLogs || [];
  target.push(fullMsg);
  if (target.length > 50) target.shift();
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

const getApiKey = (): string => {
  return (process.env as any).NEXT_PUBLIC_API_KEY || 
         process.env.API_KEY || 
         (import.meta as any).env?.VITE_API_KEY ||
         (import.meta as any).env?.NEXT_PUBLIC_API_KEY ||
         '';
};

export const analyzeTextWithAI = async (text: string) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    logToDebug("ERROR: API_KEY no encontrada. Configúrala en Vercel con el prefijo NEXT_PUBLIC_.", true);
    throw new Error("Falta API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    logToDebug(`Enviando a analizar: "${text.substring(0, 20)}..."`);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    // Diagnóstico profundo si la respuesta falla
    if (!response.candidates || response.candidates.length === 0) {
      logToDebug("La IA no devolvió candidatos. Posible bloqueo de seguridad.", true);
      throw new Error("IA sin candidatos");
    }

    const finishReason = response.candidates[0].finishReason;
    if (finishReason !== 'STOP') {
      logToDebug(`La IA terminó de forma inusual: ${finishReason}`, true);
    }

    const textOutput = response.text;
    if (!textOutput) {
      logToDebug("La propiedad .text está vacía. Revisa la consola del navegador.", true);
      console.dir(response);
      throw new Error("Respuesta de IA vacía");
    }
    
    logToDebug("¡Análisis recibido correctamente!");
    return JSON.parse(textOutput);
  } catch (e: any) {
    logToDebug(`Fallo crítico en IA: ${e.message}`, true);
    throw e;
  }
};
