import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Level, LeaderboardEntry } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection strictly at start
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// --- LOCAL STORAGE FALLBACKS ---
const USER_LEVELS_KEY = 'grammaticat_user_levels';
const LEADERBOARD_KEY = 'grammaticat_leaderboard';

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

export const saveScoreLocally = (entry: LeaderboardEntry): void => {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    let scores: LeaderboardEntry[] = data ? JSON.parse(data) : [];
    
    scores.push({ ...entry, created_at: entry.created_at || new Date().toISOString() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error("Error al guardar puntuación localmente", e);
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

// --- ERROR HANDLING AS PER SKILL MANDATE ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {}, // No auth configuration is enabled for custom logins, so authInfo is simple
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- ONLINE FIREBASE STORAGE IMPLEMENTATION ---

export const saveScore = async (entry: LeaderboardEntry) => {
  try {
    const scoreData = {
      name: (entry.name || 'Anónimo').trim().slice(0, 50) || 'Anónimo',
      score: Math.round(Number(entry.score) || 0),
      created_at: entry.created_at || new Date().toISOString()
    };
    await addDoc(collection(db, 'leaderboard'), scoreData);
    saveScoreLocally(entry);
    return { error: null };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, 'leaderboard');
    } catch (e) {
      console.error("Firestore submit error", e);
    }
    // save locally anyway as fallback
    saveScoreLocally(entry);
    return { error };
  }
};

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(20));
    const snap = await getDocs(q);
    const results: LeaderboardEntry[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        name: data.name,
        score: Number(data.score),
        created_at: data.created_at
      });
    });
    if (results.length > 0) {
      return results;
    }
    return getLocalLeaderboard();
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, 'leaderboard');
    } catch (e) {
      console.error("Firestore fetch error", e);
    }
    return getLocalLeaderboard();
  }
};

export const saveLevelOnline = async (level: Level) => {
  try {
    const levelData = {
      id: level.id,
      title: level.title,
      text: level.text,
      words: level.words.map(w => ({
        text: w.text,
        category: w.category,
        id: w.id
      })),
      timeLimit: level.timeLimit,
      categoryGroup: level.categoryGroup || 'Tus Niveles',
      created_at: new Date().toISOString()
    };
    await addDoc(collection(db, 'levels'), levelData);
    saveLevelLocally(level);
    return { error: null };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, 'levels');
    } catch (e) {
      console.error("Firestore level save error", e);
    }
    saveLevelLocally(level);
    return { error };
  }
};

export const fetchCommunityLevels = async (): Promise<Level[]> => {
  try {
    const snap = await getDocs(collection(db, 'levels'));
    const results: Level[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: Number(data.id),
        title: data.title,
        text: data.text,
        words: data.words,
        timeLimit: Number(data.timeLimit),
        categoryGroup: data.categoryGroup
      } as Level);
    });
    
    // Merge with local levels to ensure nothing is lost, while avoiding duplicates
    const local = getLocalLevels();
    const merged = [...results];
    local.forEach(loc => {
      if (!merged.some(m => m.id === loc.id)) {
        merged.push(loc);
      }
    });
    return merged;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, 'levels');
    } catch (e) {
      console.error("Firestore fetch levels error", e);
    }
    return getLocalLevels();
  }
};
