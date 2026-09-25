export {
  saveLevelLocally,
  getLocalLevels,
  saveScoreLocally,
  getLocalLeaderboard,
  saveScore,
  fetchLeaderboard,
  saveLevelOnline,
  fetchCommunityLevels
} from './firebaseService';

// Keep old exports in case of any unreferenced types or direct uses
export const debugLogs: string[] = [];
export const addLog = (msg: string, isError: boolean = false) => {};
export const supabase = null;
