
import { createClient } from '@supabase/supabase-js';
import { Level, LeaderboardEntry } from '../types';

const supabaseUrl = (process.env as any).SUPABASE_URL || '';
const supabaseKey = (process.env as any).SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const saveLevelOnline = async (level: Level) => {
  if (!supabase) return { error: 'Supabase no configurado' };
  
  const { data, error } = await supabase
    .from('levels')
    .insert([{
      title: level.title,
      text: level.text,
      target_category: level.targetCategory,
      words: level.words,
      time_limit: level.timeLimit
    }]);
    
  return { data, error };
};

export const fetchCommunityLevels = async (): Promise<Level[]> => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('levels')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error fetching levels:", error);
    return [];
  }
  
  return data.map(d => ({
    id: d.id,
    title: d.title,
    text: d.text,
    targetCategory: d.target_category,
    words: d.words,
    timeLimit: d.time_limit
  }));
};

export const saveScore = async (entry: LeaderboardEntry) => {
  if (!supabase) return { error: 'Supabase no configurado' };
  
  const { data, error } = await supabase
    .from('leaderboard')
    .insert([entry]);
    
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
    console.error("Error fetching leaderboard:", error);
    return [];
  }
  
  return data;
};