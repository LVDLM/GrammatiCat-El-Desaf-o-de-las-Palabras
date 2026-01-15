
import { Level, LeaderboardEntry } from '../types';

// Sistema de logs local
export const debugLogs: string[] = [];
export const addLog = (msg: string, isError: boolean = false) => {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${isError ? '❌' : 'ℹ️'} ${msg}`);
  if (debugLogs.length > 50) debugLogs.shift();
  window.dispatchEvent(new CustomEvent('grammaticat-debug-update'));
};

// --- GESTIÓN DE NIVELES LOCALES ---
const USER_LEVELS_KEY = 'grammaticat_user_levels';

export const saveLevelLocally = (level: Level): void => {
  try {
    const existing = getLocalLevels();
    const updated = [level, ...existing];
    localStorage.setItem(USER_LEVELS_KEY, JSON.stringify(updated));
    addLog(`Nivel "${level.title}" guardado en el navegador.`);
  } catch (e) {
    addLog("Error al guardar nivel localmente", true);
  }
};

export const getLocalLevels = (): Level[] => {
  try {
    const data = localStorage.getItem(USER_LEVELS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

// --- GESTIÓN DE RANKING LOCAL ---
const LEADERBOARD_KEY = 'grammaticat_leaderboard';

export const saveScoreLocally = (entry: LeaderboardEntry): void => {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    let scores: LeaderboardEntry[] = data ? JSON.parse(data) : [];
    
    scores.push({ ...entry, created_at: new Date().toISOString() });
    // Ordenar por puntuación y quedar con los 10 mejores
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
    addLog(`Puntuación de ${entry.name} guardada localmente.`);
  } catch (e) {
    addLog("Error al guardar puntuación", true);
  }
};

export const getLocalLeaderboard = (): LeaderboardEntry[] => {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

// Exportamos nombres antiguos para no romper App.tsx pero con lógica local
export const fetchCommunityLevels = async () => getLocalLevels();
export const saveLevelOnline = async (l: Level) => { saveLevelLocally(l); return { error: null }; };
export const saveScore = async (e: LeaderboardEntry) => { saveScoreLocally(e); return { error: null }; };
export const fetchLeaderboard = async () => getLocalLeaderboard();
export const supabase = null; 
