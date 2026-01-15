
import { createClient } from '@supabase/supabase-js';
import { Level, LeaderboardEntry } from '../types';

export const debugLogs: string[] = [];
const addLog = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${isError ? '❌' : 'ℹ️'} ${msg}`);
  if (debugLogs.length > 30) debugLogs.shift();
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

// Acceso directo: Vital para que Vercel/Vite/Webpack inyecten el valor en build-time
const supabaseUrl = process.env.SUPABASE_URL || (process.env as any).NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

addLog("--- DIAGNÓSTICO DE INICIO ---");
if (!supabaseUrl) {
  addLog("URL de Supabase no detectada. Verifica las Variables de Entorno en Vercel y REDESPLIEGA.", true);
} else {
  addLog(`URL detectada: ${supabaseUrl.substring(0, 20)}...`);
}

if (!supabaseKey) {
  addLog("Clave Anónima no detectada. Revisa la configuración de Vercel.", true);
} else {
  addLog("Clave detectada correctamente.");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) addLog("¡Cliente Supabase listo para la acción!");

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) {
    addLog("Error crítico: El cliente Supabase no está inicializado.", true);
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
      addLog(`Error DB [${error.code}]: ${error.message}`, true);
      console.error("Detalle error:", error);
    } else {
      addLog("¡Nivel guardado correctamente en la nube!");
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
  
  addLog(`Enviando récord: ${entry.name}...`);
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{
        name: entry.name,
        score: entry.score
      }]);
      
    if (error) addLog(`Error Ranking: ${error.message}`, true);
    else addLog("¡Puntuación registrada!");
    return { data, error };
  } catch (e: any) {
    addLog(`Fallo de conexión: ${e.message}`, true);
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
