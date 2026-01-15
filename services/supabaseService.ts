
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
 * IMPORTANTE: Vercel busca estas cadenas exactas durante el build.
 * No uses variables intermedias o acceso dinámico por corchetes.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Logs de diagnóstico mejorados
addLog("--- INICIANDO CONEXIÓN SUPABASE ---");
if (!supabaseUrl) {
  addLog("URL: ⚠️ VACÍA. Comprueba que las variables en Vercel tengan el prefijo NEXT_PUBLIC_.", true);
} else {
  addLog(`URL: Detectada ok (${supabaseUrl.substring(0, 10)}...)`);
}

if (!supabaseKey) {
  addLog("KEY: ⚠️ VACÍA. Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY.", true);
} else {
  addLog("KEY: Detectada ok.");
}

// Inicialización del cliente
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) {
  addLog("✅ Cliente Supabase instanciado correctamente.");
}

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) {
    addLog("Error: Supabase no disponible por falta de configuración.", true);
    return { error: 'No Config' };
  }
  
  addLog(`Subiendo: "${level.title}"...`);
  
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
      addLog(`Error API: ${error.message}`, true);
    } else {
      addLog("¡Publicación exitosa!");
    }
    return { data, error };
  } catch (err: any) {
    addLog(`Fallo: ${err.message}`, true);
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
      addLog(`Error carga: ${error.message}`, true);
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
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{ name: entry.name, score: entry.score }]);
    if (error) addLog(`Error ranking: ${error.message}`, true);
    return { data, error };
  } catch (e: any) {
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
