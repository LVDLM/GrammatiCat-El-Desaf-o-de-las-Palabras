
export enum WordClass {
  SUSTANTIVO = 'Sustantivo',
  ADJETIVO = 'Adjetivo',
  VERBO = 'Verbo',
  ADVERBIO = 'Adverbio',
  PRONOMBRE = 'Pronombre',
  PREPOSICION = 'Preposición',
  CONJUNCION = 'Conjunción',
  DETERMINANTE = 'Determinante'
}

export interface WordData {
  text: string;
  category: WordClass;
  id: string;
}

export interface Level {
  id: number;
  title: string;
  text: string;
  words: WordData[];
  timeLimit: number;
  targetCategory?: WordClass;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
  goal?: number;
}

export interface LeaderboardEntry {
  id?: string;
  name: string;
  score: number;
  created_at?: string;
}

export interface GameState {
  score: number;
  lives: number;
  time: number;
  levelIndex: number;
  isPlaying: boolean;
  isGameOver: boolean;
  targetCategory: WordClass | null;
  mode: 'PRACTICE' | 'CHALLENGE' | null;
  powerups: {
    hints: number;
    shields: number;
    cleaners: number;
  };
  stats: {
    nounsFound: number;
    levelsCompleted: number;
  };
}

export enum GameView {
  MENU = 'MENU',
  LEVEL_SELECT = 'LEVEL_SELECT',
  PLAYING = 'PLAYING',
  EDITOR = 'EDITOR',
  GAME_OVER = 'GAME_OVER',
  ACHIEVEMENTS = 'ACHIEVEMENTS',
  LEADERBOARD = 'LEADERBOARD'
}