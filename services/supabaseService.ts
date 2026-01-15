
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
 * IMPORTANTE: Para que Vercel inyecte estas variables en el navegador,
 * la referencia debe ser estática y con el prefijo NEXT_PUBLIC_.
 */
const getSupabaseConfig = () => {
  // 1. Intento estático (Lo más fiable en Vercel/Vite)
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // 2. Intento vía import.meta.env (Para entornos ESM/Vite modernos)
  if (!url) {
    url = (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL || 
          (import.meta as any).env?.VITE_SUPABASE_URL || '';
  }
  if (!key) {
    key = (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
          (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  }

  // 3. Fallback dinámico
  if (!url) url = (process.env as any).SUPABASE_URL || '';
  if (!key) key = (process.env as any).SUPABASE_ANON_KEY || '';

  return { url, key };
};

const config = getSupabaseConfig();
const supabaseUrl = config.url;
const supabaseKey = config.key;

addLog("--- DIAGNÓSTICO DE CONEXIÓN ---");
if (!supabaseUrl || supabaseUrl === '') {
  addLog("URL: ⚠️ VACÍA. Haz REDEPLOY en Vercel para aplicar cambios.", true);
} else {
  addLog(`URL: Detectada (${supabaseUrl.substring(0, 15)}...)`);
}

if (!supabaseKey || supabaseKey === '') {
  addLog("KEY: ⚠️ VACÍA. Haz REDEPLOY en Vercel para aplicar cambios.", true);
} else {
  addLog("KEY: Detectada OK");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) {
  addLog("✅ Cliente Supabase listo.");
}

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) {
    addLog("Error: Supabase no configurado. Revisa variables y despliegue.", true);
    return { error: 'No Config' };
  }
  
  addLog(`Publicando: "${level.title}"...`);
  
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
      addLog(`Error Supabase: ${error.message}`, true);
    } else {
      addLog("¡Nivel guardado correctamente!");
    }
    return { data, error };
  } catch (err: any) {
    addLog(`Fallo crítico: ${err.message}`, true);
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
