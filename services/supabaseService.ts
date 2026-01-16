
import { Level, LeaderboardEntry } from '../types';

// --- GESTIÓN DE NIVELES LOCALES ---
const USER_LEVELS_KEY = 'grammaticat_user_levels';

export const saveLevelLocally = (level: Level): void => {
  try {
    const existing = getLocalLevels();
    const updated = [level, ...existing];
    localStorage.setItem(USER_LEVELS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error al guardar nivel localmente", e);
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
  } catch (e) {
    console.error("Error al guardar puntuación", e);
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

// Exportamos nombres para compatibilidad local
export const fetchCommunityLevels = async () => getLocalLevels();
export const saveLevelOnline = async (l: Level) => { saveLevelLocally(l); return { error: null }; };
export const saveScore = async (e: LeaderboardEntry) => { saveScoreLocally(e); return { error: null }; };
export const fetchLeaderboard = async () => getLocalLeaderboard();
export const debugLogs: string[] = [];
export const addLog = (msg: string, isError: boolean = false) => {};
export const supabase = null;
