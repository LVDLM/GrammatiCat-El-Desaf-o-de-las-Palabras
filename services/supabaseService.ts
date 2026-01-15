
import { createClient } from '@supabase/supabase-js';
import { Level, LeaderboardEntry } from '../types';

export const debugLogs: string[] = [];
export const addLog = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${isError ? '❌' : 'ℹ️'} ${msg}`);
  if (debugLogs.length > 50) debugLogs.shift();
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

/**
 * IMPORTANTE PARA VERCEL:
 * Para que las variables sean accesibles en el navegador (client-side),
 * deben estar definidas en el panel de Vercel con el prefijo NEXT_PUBLIC_
 * Ejemplo: NEXT_PUBLIC_SUPABASE_URL
 */

const getSupabaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 
         process.env.SUPABASE_URL || 
         (import.meta as any).env?.VITE_SUPABASE_URL ||
         (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
         '';
};

const getSupabaseKey = (): string => {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
         process.env.SUPABASE_ANON_KEY || 
         (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
         (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
         '';
};

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseKey();

addLog("--- INICIANDO DIAGNÓSTICO ---");
if (!supabaseUrl) {
  addLog("URL Supabase: NO DETECTADA. Revisa Vercel (debe usar NEXT_PUBLIC_).", true);
} else {
  addLog(`URL detectada: ${supabaseUrl.substring(0, 15)}...`);
}

if (!supabaseKey) {
  addLog("Key Supabase: NO DETECTADA. Revisa Vercel (debe usar NEXT_PUBLIC_).", true);
} else {
  addLog("Key detectada: OK");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) {
  addLog("✅ Supabase inicializado correctamente.");
}

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) {
    addLog("Error: Supabase no configurado. No se puede guardar.", true);
    return { error: 'No Config' };
  }
  
  addLog(`Guardando nivel online: "${level.title}"...`);
  
  try {
    const { data, error } = await supabase
      .from('levels')
      .insert([{
        title: level.title,
        text: level.text,
        target_category: level.targetCategory || 'Sustantivo',
        words: level.words,
        time_limit: level.timeLimit || 30
      }]);
      
    if (error) {
      addLog(`Error Supabase [${error.code}]: ${error.message}`, true);
    } else {
      addLog("¡Nivel publicado exitosamente!");
    }
    return { data, error };
  } catch (err: any) {
    addLog(`Excepción de red: ${err.message}`, true);
    return { error: err.message };
  }
};

export const fetchCommunityLevels = async (): Promise<Level[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('levels')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      addLog(`Carga niveles: ${error.message}`, true);
      return [];
    }
    return (data || []).map(d => ({
      id: d.id,
      title: d.title,
      text: d.text,
      targetCategory: d.target_category,
      words: d.words,
      timeLimit: d.time_limit
    }));
  } catch (e) {
    return [];
  }
};

export const saveScore = async (entry: LeaderboardEntry) => {
  if (!supabase) return { error: 'No Config' };
  addLog(`Guardando puntuación: ${entry.name}...`);
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{ name: entry.name, score: entry.score }]);
    if (error) addLog(`Error Leaderboard: ${error.message}`, true);
    else addLog("¡Puntuación guardada!");
    return { data, error };
  } catch (e: any) {
    addLog(`Error en envío: ${e.message}`, true);
    return { error: e.message };
  }
};

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);
    return data || [];
  } catch (e) {
    return [];
  }
};
