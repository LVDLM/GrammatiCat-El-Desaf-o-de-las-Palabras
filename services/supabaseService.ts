
import { createClient } from '@supabase/supabase-js';
import { Level, LeaderboardEntry } from '../types';

export const debugLogs: string[] = [];
const addLog = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${isError ? '❌' : 'ℹ️'} ${msg}`);
  if (debugLogs.length > 30) debugLogs.shift();
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

// Intenta leer de process.env (Vercel Build) o de las variables públicas
const supabaseUrl = (process.env as any).NEXT_PUBLIC_SUPABASE_URL || (process.env as any).SUPABASE_URL || '';
const supabaseKey = (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env as any).SUPABASE_ANON_KEY || '';

if (!supabaseUrl) addLog("Falta SUPABASE_URL en la configuración.", true);
if (!supabaseKey) addLog("Falta SUPABASE_ANON_KEY en la configuración.", true);

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) addLog("Cliente Supabase inicializado correctamente.");

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) {
    addLog("Error: Supabase no configurado.", true);
    return { error: 'No Config' };
  }
  
  addLog(`Enviando nivel: ${level.title}...`);
  
  // No enviamos el ID para que la DB use su SERIAL/IDENTITY
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
    addLog(`SUPABASE ERROR [${error.code}]: ${error.message}`, true);
    if (error.hint) addLog(`Pista: ${error.hint}`, false);
  } else {
    addLog("¡Nivel guardado con éxito en la nube!");
  }

  return { data, error };
};

export const fetchCommunityLevels = async (): Promise<Level[]> => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('levels')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    addLog(`Error al descargar niveles: ${error.message}`, true);
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
};

export const saveScore = async (entry: LeaderboardEntry) => {
  if (!supabase) return { error: 'No Config' };
  
  addLog(`Enviando puntuación: ${entry.name} -> ${entry.score}...`);
  const { data, error } = await supabase
    .from('leaderboard')
    .insert([{
      name: entry.name,
      score: entry.score
    }]);
    
  if (error) {
    addLog(`ERROR RANKING [${error.code}]: ${error.message}`, true);
  } else {
    addLog("¡Puntuación registrada en el servidor!");
  }

  return { data, error };
};

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('score', { ascending: false })
    .limit(10);
    
  if (error) {
    addLog(`Error al descargar ranking: ${error.message}`, true);
    return [];
  }
  
  return data || [];
};
