
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameView, GameState, WordClass, Level, WordData, Achievement, LevelGroup } from './types';
import { INITIAL_LEVELS, LITERARY_ES_LEVELS, LITERARY_UNIVERSAL_LEVELS, KONAMI_CODE, INITIAL_ACHIEVEMENTS } from './constants';
import { GameHUD } from './components/GameHUD';
import { Editor } from './components/Editor';
import { AchievementsModal } from './components/AchievementsModal';
import { Leaderboard } from './components/Leaderboard';
import { fetchCommunityLevels, saveScore } from './services/supabaseService';

export const getPluralCategory = (cat: WordClass): string => {
  switch (cat) {
    case WordClass.PREPOSICION: return 'Preposiciones';
    case WordClass.CONJUNCION: return 'Conjunciones';
    default: return `${cat}s`;
  }
};

interface Reward {
  type: 'hint' | 'cleaner' | 'shield' | 'life';
  label: string;
  icon: string;
  color: string;
}

const TutorialSign: React.FC<{ 
  text: string; 
  onNext: () => void; 
  position: 'category' | 'time' | 'lives' | 'items' | 'words';
  isMidnight: boolean;
}> = ({ text, onNext, position, isMidnight }) => {
  const [coords, setCoords] = useState<{ top: number; left: number; arrow: 'up' | 'down' }>({ top: -1000, left: -1000, arrow: 'up' });

  useEffect(() => {
    const updatePosition = () => {
      const targetId = {
        category: 'hud-category',
        time: 'hud-timer',
        lives: 'hud-lives',
        items: 'powerups-bar',
        words: 'game-board'
      }[position];

      let targetEl = document.getElementById(targetId);
      
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let arrow: 'up' | 'down' = 'down';
        let top = rect.top - 120; // Ajustado para estar más cerca
        let left = rect.left + rect.width / 2;

        if (position === 'words') {
          top = rect.top + rect.height / 2 - 60;
          arrow = 'down';
        } else if (position === 'items') {
          top = rect.top - 110;
          arrow = 'down';
        }
        
        // Evitar que el cartel se salga por los bordes laterales
        const boxHalfWidth = Math.min(viewportWidth * 0.4, 150);
        if (left - boxHalfWidth < 10) left = boxHalfWidth + 10;
        if (left + boxHalfWidth > viewportWidth - 10) left = viewportWidth - boxHalfWidth - 10;

        // Evitar que se salga por arriba
        if (top < 10) {
          top = rect.bottom + 20;
          arrow = 'up';
        }
        
        setCoords({ top, left, arrow });
      }
    };

    const timer = setTimeout(updatePosition, 150);
    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [position]);

  return (
    <div 
      className="fixed z-[150] w-[85%] max-w-[280px] transition-all duration-500 animate-in fade-in zoom-in cursor-pointer"
      style={{ top: coords.top, left: coords.left, transform: 'translateX(-50%)' }}
      onClick={onNext}
    >
      <div className={`relative p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 md:border-4 shadow-2xl ${isMidnight ? 'bg-slate-800 border-indigo-500 text-white' : 'bg-white border-yellow-400 text-indigo-900'}`}>
        <div className={`absolute w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent left-1/2 -translate-x-1/2 ${coords.arrow === 'up' ? 'bottom-full border-b-[15px] ' + (isMidnight ? 'border-b-indigo-500' : 'border-b-yellow-400') : 'top-full border-t-[15px] ' + (isMidnight ? 'border-t-indigo-500' : 'border-t-yellow-400')}`}></div>
        <p className="text-sm md:text-base font-black leading-tight mb-3 text-center">{text}</p>
        <div className="flex justify-center">
          <button className="px-5 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg animate-pulse">
            SIGUIENTE <i className="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.MENU);
  const [expandedCategory, setExpandedCategory] = useState<LevelGroup | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedStats = localStorage.getItem('grammaticat_stats');
    const defaultStats = { 
      nounsFound: 0, 
      levelsCompleted: 0, 
      totalTextsSuccessful: 0, 
      challengeTextsCount: 0,
      tutorialCompleted: false,
      completedLevels: {} 
    };
    
    // Merge robusto de estadísticas para evitar propiedades undefined
    const stats = savedStats ? { ...defaultStats, ...JSON.parse(savedStats) } : defaultStats;
    if (!stats.completedLevels) stats.completedLevels = {};
    
    return {
      score: 0, lives: 3, time: 0, levelIndex: 0, isPlaying: false, isGameOver: false,
      targetCategory: null, mode: null, powerups: { hints: 2, cleaners: 1, shields: 1 }, stats
    };
  });

  const [playerName, setPlayerName] = useState('');
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [communityLevels, setCommunityLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [errorWords, setErrorWords] = useState<string[]>([]);
  const [highlightedWords, setHighlightedWords] = useState<string[]>([]);
  const [cleanedWords, setCleanedWords] = useState<string[]>([]);
  const [lastReward, setLastReward] = useState<Reward | null>(null);
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [showKonamiEffect, setShowKonamiEffect] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const saved = localStorage.getItem('grammaticat_achievements');
    return saved ? JSON.parse(saved) : INITIAL_ACHIEVEMENTS;
  });
  const [lastUnlocked, setLastUnlocked] = useState<Achievement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (showKonamiEffect) document.body.classList.add('konami-active');
    else document.body.classList.remove('konami-active');
  }, [showKonamiEffect]);

  useEffect(() => { localStorage.setItem('grammaticat_stats', JSON.stringify(gameState.stats)); }, [gameState.stats]);
  useEffect(() => { localStorage.setItem('grammaticat_achievements', JSON.stringify(achievements)); }, [achievements]);

  useEffect(() => {
    if (view === GameView.LEVEL_SELECT || view === GameView.MENU) {
      const loadCommunity = async () => {
        try {
          const localUserLevels = await fetchCommunityLevels();
          setCommunityLevels(localUserLevels || []);
        } catch (e) { console.error("Failed to load levels", e); }
      };
      loadCommunity();
    }
  }, [view]);

  const unlockAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      const ach = prev.find(a => a.id === id);
      if (ach && !ach.unlocked) {
        const updated = prev.map(a => a.id === id ? { ...a, unlocked: true, unlockedAt: Date.now() } : a);
        setLastUnlocked({ ...ach, unlocked: true });
        setTimeout(() => setLastUnlocked(null), 4000);
        return updated;
      }
      return prev;
    });
  }, []);

  const checkAchievements = useCallback((updatedStats: GameState['stats']) => {
    if (updatedStats.tutorialCompleted) unlockAchievement('tutorial_hero');
    if (updatedStats.totalTextsSuccessful >= 5) unlockAchievement('first_steps');
    if (updatedStats.challengeTextsCount >= 10) unlockAchievement('challenge_10');
    if (updatedStats.challengeTextsCount >= 25) unlockAchievement('challenge_25');
    if (updatedStats.challengeTextsCount >= 35) unlockAchievement('challenge_35');
    if (updatedStats.challengeTextsCount >= 50) unlockAchievement('challenge_50');

    const totalSpanish = LITERARY_ES_LEVELS.length;
    const totalUniversal = LITERARY_UNIVERSAL_LEVELS.length;
    
    // Uso de encadenamiento opcional para evitar errores de lectura sobre undefined
    const spanishDoneIdsCount = LITERARY_ES_LEVELS.filter(l => l?.id && updatedStats.completedLevels?.[l.id]?.length > 0).length;
    const universalDoneIdsCount = LITERARY_UNIVERSAL_LEVELS.filter(l => l?.id && updatedStats.completedLevels?.[l.id]?.length > 0).length;

    if (spanishDoneIdsCount >= totalSpanish / 2 && universalDoneIdsCount >= totalUniversal / 2) unlockAchievement('half_world');
    if (spanishDoneIdsCount === totalSpanish || universalDoneIdsCount === totalUniversal) unlockAchievement('max_knowledge');
    if (spanishDoneIdsCount === totalSpanish && universalDoneIdsCount === totalUniversal) unlockAchievement('absolute_knowledge');

    if (currentLevel) {
      const availableCats = Array.from(new Set(currentLevel.words.map(w => w.category)));
      const completedCats = updatedStats.completedLevels?.[currentLevel.id] || [];
      if (availableCats.every(cat => completedCats.includes(cat))) {
        unlockAchievement('all_categories_single');
      }
    }

    const allPredefined = [...LITERARY_ES_LEVELS, ...LITERARY_UNIVERSAL_LEVELS];
    const isMaster = allPredefined.every(level => {
      if (!level || !level.words) return true;
      const availableCats = Array.from(new Set(level.words.map(w => w.category)));
      const completedCats = updatedStats.completedLevels?.[level.id] || [];
      return availableCats.every(cat => completedCats.includes(cat));
    });
    if (isMaster) unlockAchievement('all_categories_all_texts');
  }, [unlockAchievement, currentLevel]);

  const startGame = (level: Level, category: WordClass, mode: 'PRACTICE' | 'CHALLENGE', resetSession: boolean = true) => {
    if (!level) return;
    const isTutorial = level.categoryGroup === 'Tutorial';
    setCurrentLevel(level);
    setGameState(prev => ({
      ...prev,
      lives: resetSession || mode === 'PRACTICE' ? 3 : prev.lives,
      score: resetSession ? 0 : prev.score,
      time: level.timeLimit || 30,
      targetCategory: category,
      mode,
      isPlaying: !isTutorial, 
      isGameOver: false,
      isTutorialMode: isTutorial,
      powerups: resetSession ? { hints: 2, cleaners: 1, shields: 1 } : prev.powerups
    }));
    setFoundWords([]); setErrorWords([]); setHighlightedWords([]); setCleanedWords([]); setLastReward(null); setScoreSaved(false);
    setView(GameView.PLAYING);
    if (isTutorial) setTutorialStep(0); else setTutorialStep(null);
  };

  const nextTutorialStep = () => {
    if (tutorialStep === null) return;
    if (tutorialStep < 4) setTutorialStep(tutorialStep + 1);
    else {
      setTutorialStep(null);
      setGameState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const handleWordClick = (word: WordData) => {
    if (!gameState.isPlaying || !currentLevel || !gameState.targetCategory) return;
    if (foundWords.includes(word.id) || errorWords.includes(word.id) || cleanedWords.includes(word.id)) return;
    
    if (word.category === gameState.targetCategory) {
      const newFound = [...foundWords, word.id];
      setFoundWords(newFound);
      setGameState(prev => ({ ...prev, score: prev.score + 10, stats: { ...prev.stats, nounsFound: (prev.stats?.nounsFound || 0) + (word.category === WordClass.SUSTANTIVO ? 1 : 0) } }));
      
      const targetWordsCount = currentLevel.words.filter(w => w.category === gameState.targetCategory).length;
      if (newFound.length === targetWordsCount) {
        setGameState(prev => {
          const newStats = { ...prev.stats };
          if (prev.isTutorialMode) newStats.tutorialCompleted = true;
          else {
            newStats.totalTextsSuccessful = (newStats.totalTextsSuccessful || 0) + 1;
            if (prev.mode === 'CHALLENGE') newStats.challengeTextsCount = (newStats.challengeTextsCount || 0) + 1;
            const levelId = currentLevel.id;
            const alreadyDone = newStats.completedLevels?.[levelId] || [];
            if (!alreadyDone.includes(gameState.targetCategory!)) {
              newStats.completedLevels[levelId] = [...alreadyDone, gameState.targetCategory!];
            }
          }
          checkAchievements(newStats);
          
          const rewardRoll = Math.random();
          let reward: Reward;
          if (rewardRoll < 0.25) reward = { type: 'hint', label: '+1 Pista', icon: 'fa-lightbulb', color: 'text-cyan-400' };
          else if (rewardRoll < 0.50) reward = { type: 'cleaner', label: '+1 Limpiar', icon: 'fa-broom', color: 'text-rose-400' };
          else if (rewardRoll < 0.75) reward = { type: 'shield', label: '+1 Escudo', icon: 'fa-shield-alt', color: 'text-lime-400' };
          else reward = { type: 'life', label: '+1 Vida Extra', icon: 'fa-heart', color: 'text-rose-500' };
          
          setLastReward(reward);
          const newPowerups = { ...prev.powerups };
          let newLives = prev.lives;
          if (reward.type === 'hint') newPowerups.hints += 1;
          else if (reward.type === 'cleaner') newPowerups.cleaners += 1;
          else if (reward.type === 'shield') newPowerups.shields += 1;
          else if (reward.type === 'life') {
            newLives = Math.min(5, prev.lives + 1);
            if (newLives === 5) unlockAchievement('unstoppable');
          }
          return { ...prev, isPlaying: false, lives: newLives, powerups: newPowerups, stats: newStats };
        });
        if (errorWords.length === 0 && !gameState.isTutorialMode) unlockAchievement('perfectionist');
        setTimeout(() => { 
          if (gameState.mode === 'CHALLENGE') startRandomChallenge(true); 
          else setView(GameView.LEVEL_SELECT); 
        }, 3000); 
      }
    } else {
      setErrorWords(prev => [...prev, word.id]);
      if (gameState.mode === 'PRACTICE' || gameState.isTutorialMode) {
        setGameState(prev => ({ ...prev, time: Math.max(1, prev.time - 5) }));
      } else {
        if (gameState.powerups.shields > 0) setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, shields: prev.powerups.shields - 1 } }));
        else setGameState(prev => {
          const newLives = prev.lives - 1;
          if (newLives <= 0) { handleGameOver(); return { ...prev, lives: 0, time: 0 }; }
          return { ...prev, lives: newLives, time: Math.max(1, prev.time - 5) };
        });
      }
    }
  };

  const startRandomChallenge = useCallback(async (isTransition: boolean = false) => {
    const allAvailable = [...LITERARY_ES_LEVELS, ...LITERARY_UNIVERSAL_LEVELS, ...communityLevels].filter(l => l && l.words);
    if (allAvailable.length === 0) return;
    const randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
    const categories = Array.from(new Set(randomLevel.words.map(w => w.category))) as WordClass[];
    const randomCategory = (categories[Math.floor(Math.random() * categories.length)] as WordClass) || WordClass.SUSTANTIVO;
    startGame(randomLevel, randomCategory, 'CHALLENGE', !isTransition);
  }, [communityLevels]);

  const handleGameOver = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setView(GameView.GAME_OVER);
    setGameState(prev => ({ ...prev, isPlaying: false, isGameOver: true }));
  };

  useEffect(() => {
    if (gameState.isPlaying && gameState.time > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.time <= 1) { handleGameOver(); return { ...prev, time: 0 }; }
          return { ...prev, time: prev.time - 1 };
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState.isPlaying, gameState.time]);

  const usePowerup = (type: 'hint' | 'clean' | 'shield') => {
    if (!gameState.isPlaying || !currentLevel || !gameState.targetCategory) return;
    if (type === 'hint' && gameState.powerups.hints > 0) {
      const remainingTargetWords = currentLevel.words.filter(w => w.category === gameState.targetCategory && !foundWords.includes(w.id) && !highlightedWords.includes(w.id));
      if (remainingTargetWords.length > 0) {
        const randomWord = remainingTargetWords[Math.floor(Math.random() * remainingTargetWords.length)];
        setHighlightedWords(prev => [...prev, randomWord.id]);
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, hints: prev.powerups.hints - 1 } }));
      }
    } else if (type === 'clean' && gameState.powerups.cleaners > 0) {
      const incorrectWords = currentLevel.words.filter(w => w.category !== gameState.targetCategory && !cleanedWords.includes(w.id));
      if (incorrectWords.length > 0) {
        const toClean = incorrectWords.sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.id);
        setCleanedWords(prev => [...prev, ...toClean]);
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, cleaners: prev.powerups.cleaners - 1 } }));
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      setKonamiProgress(prev => {
        const next = [...prev, e.key];
        const matchLength = next.length;
        const expected = KONAMI_CODE.slice(0, matchLength);
        const isMatch = next.every((k, idx) => k.toLowerCase() === expected[idx].toLowerCase());
        if (isMatch) {
          if (matchLength === KONAMI_CODE.length) {
            setShowKonamiEffect(true); setView(GameView.EDITOR); return [];
          }
          return next;
        }
        return [];
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const LevelCard: React.FC<{ level: Level }> = ({ level }) => {
    if (!level || !level.words) return null;
    const cats = Array.from(new Set(level.words.map(w => w.category))) as WordClass[];
    const doneCats = gameState.stats.completedLevels?.[level.id] || [];
    return (
      <div className={`rounded-xl md:rounded-2xl p-3 md:p-4 shadow-md border-b-2 transition-all hover:bg-indigo-50/50 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-indigo-50'}`}>
         <div className="flex justify-between items-start mb-2">
           <h3 className={`text-[10px] md:text-sm font-black truncate max-w-[80%] uppercase italic ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>{level.title}</h3>
           {doneCats.length === cats.length && <i className="fas fa-check-circle text-green-500 text-[10px] md:text-xs"></i>}
         </div>
         <div className="flex flex-wrap gap-1 md:gap-1.5">
            {cats.map(cat => (
              <button 
                key={cat} onClick={() => startGame(level, cat, 'PRACTICE', true)}
                className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg text-[7px] md:text-[9px] font-black uppercase transition-all shadow-sm active:scale-95 ${doneCats.includes(cat) ? 'bg-green-100 text-green-700 border border-green-200' : showKonamiEffect ? 'bg-slate-700 text-indigo-300' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
              >
                {getPluralCategory(cat)}
              </button>
            ))}
         </div>
      </div>
    );
  };

  const AccordionSection = ({ id, title, icon, levels, color }: { id: LevelGroup, title: string, icon: string, levels: Level[], color: string }) => {
    const isExpanded = expandedCategory === id;
    const filteredLevels = levels.filter(l => l && l.words);
    const completedCount = filteredLevels.filter(l => {
      const done = gameState.stats.completedLevels?.[l.id];
      return done && done.length > 0;
    }).length;

    return (
      <div className={`w-full rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-300 border-2 md:border-4 ${isExpanded ? `bg-white shadow-xl ${showKonamiEffect ? 'border-indigo-800 bg-slate-900' : 'border-indigo-400'}` : `bg-white/10 border-transparent hover:bg-white/20`}`}>
        <button onClick={() => setExpandedCategory(isExpanded ? null : id)} className={`w-full flex items-center justify-between p-4 md:p-8 text-left transition-colors ${isExpanded ? (showKonamiEffect ? 'text-white' : 'text-indigo-900') : 'text-white'}`}>
          <div className="flex items-center gap-4 md:gap-6">
            <div className={`w-10 h-10 md:w-20 md:h-20 rounded-xl md:rounded-3xl flex items-center justify-center text-xl md:text-5xl shadow-lg ${color} text-white`}>
              <i className={`fas ${icon}`}></i>
            </div>
            <div>
              <h3 className="text-sm md:text-3xl font-black uppercase italic tracking-tighter leading-none">{title}</h3>
              <p className="text-[8px] md:text-sm font-bold opacity-70 mt-1">{completedCount}/{filteredLevels.length} textos con algún progreso</p>
            </div>
          </div>
          <i className={`fas fa-chevron-down text-lg md:text-4xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
        </button>
        {isExpanded && (
          <div className="p-4 md:p-6 pt-0 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filteredLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-2 md:p-4 transition-all duration-1000 ${showKonamiEffect ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 konami-active' : 'bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500'} overflow-hidden`}>
      {lastUnlocked && (
        <div className="fixed top-4 right-4 z-[100] bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-2xl border-2 md:border-4 border-yellow-400 animate-in slide-in-from-right duration-500 flex items-center space-x-3 md:space-x-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-400 rounded-lg md:rounded-xl flex items-center justify-center text-indigo-900 text-lg"><i className={`fas ${lastUnlocked.icon}`}></i></div>
          <div><span className="block text-[8px] md:text-[10px] font-black text-yellow-600 uppercase tracking-widest text-nowrap">¡Logro!</span><span className="block text-sm md:text-lg font-black text-indigo-900 text-nowrap">{lastUnlocked.title}</span></div>
        </div>
      )}

      {view === GameView.MENU && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700 w-full max-w-4xl text-center px-4">
          <div className="relative mb-8 md:mb-16 floating">
            <h1 className="text-4xl sm:text-6xl md:text-9xl font-black text-white italic drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)] tracking-tighter select-none uppercase">GRAMMA<span className="text-yellow-300">CAT</span></h1>
            <div className={`absolute -top-8 -right-8 text-4xl text-white rotate-12 opacity-20 hidden sm:block`}><i className="fas fa-cat"></i></div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 md:gap-8 w-full justify-center mb-8 md:mb-12">
            <button onClick={() => setView(GameView.LEVEL_SELECT)} className={`group relative flex-1 sm:max-w-[240px] h-32 sm:h-56 rounded-2xl md:rounded-[2.5rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <i className="fas fa-graduation-cap text-3xl sm:text-6xl text-indigo-500 mb-1 md:mb-3 group-hover:rotate-12 transition-transform"></i>
              <span className={`text-xl sm:text-2xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>PRÁCTICA</span>
            </button>
            <button onClick={() => startRandomChallenge(false)} className={`group relative flex-1 sm:max-w-[240px] h-32 sm:h-56 rounded-2xl md:rounded-[2.5rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-purple-900 border-purple-950' : 'bg-yellow-400 border-yellow-600'}`}>
              <i className={`fas fa-fire text-3xl sm:text-6xl mb-1 md:mb-3 group-hover:scale-125 transition-transform animate-pulse ${showKonamiEffect ? 'text-yellow-400' : 'text-indigo-900'}`}></i>
              <span className={`text-xl sm:text-2xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>RETO</span>
            </button>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 md:gap-6">
            <button onClick={() => setView(GameView.LEADERBOARD)} className="px-5 py-3 md:px-10 md:py-5 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 rounded-2xl md:rounded-[1.5rem] font-black border-2 md:border-4 border-yellow-500 shadow-xl text-xs md:text-xl transition-all hover:scale-110 active:scale-95 flex items-center"><i className="fas fa-list-ol mr-2 md:mr-3"></i> RÁNKING</button>
            <button onClick={() => setView(GameView.ACHIEVEMENTS)} className="px-5 py-3 md:px-10 md:py-5 bg-white/20 hover:bg-white/40 text-white rounded-2xl md:rounded-[1.5rem] font-black border-2 md:border-4 border-white/30 text-xs md:text-xl shadow-xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 flex items-center"><i className="fas fa-trophy mr-2 md:mr-3"></i> LOGROS</button>
          </div>
        </div>
      )}

      {view === GameView.LEVEL_SELECT && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in slide-in-from-bottom duration-500 overflow-y-auto max-h-[95vh] custom-scrollbar p-3 md:p-6">
          <div className="w-full flex justify-between items-center mb-4 md:mb-8 sticky top-0 bg-transparent z-10 backdrop-blur-sm py-2">
            <button onClick={() => setView(GameView.MENU)} className="p-2 md:p-3 bg-white/20 text-white rounded-full hover:bg-white/40 shadow-lg"><i className="fas fa-arrow-left text-sm md:text-xl"></i></button>
            <h2 className="text-xl md:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">ELIGE TU DESAFÍO</h2>
            <div className="w-8 md:w-10"></div>
          </div>
          <div className="flex flex-col gap-3 md:gap-6 w-full pb-10">
            <AccordionSection id="Tutorial" title="Tutorial" icon="fa-chalkboard-teacher" color="bg-emerald-500" levels={INITIAL_LEVELS} />
            <AccordionSection id="Literatura en español" title="Español" icon="fa-feather-alt" color="bg-amber-500" levels={LITERARY_ES_LEVELS} />
            <AccordionSection id="Literatura universal" title="Universal" icon="fa-globe-americas" color="bg-indigo-500" levels={LITERARY_UNIVERSAL_LEVELS} />
            <AccordionSection id="Tus Niveles" title="Tus Niveles" icon="fa-user-edit" color="bg-purple-500" levels={communityLevels} />
          </div>
        </div>
      )}

      {view === GameView.PLAYING && currentLevel && gameState.targetCategory && (
        <div className="w-full h-full flex flex-col items-center p-2 transition-all duration-300 overflow-hidden relative">
          {tutorialStep !== null && <TutorialSign text={["¡Hola! Aquí verás qué palabra buscas.", "Controla tu tiempo, ¡vuela!", "Pierdes vida si fallas.", "¡Usa tus potenciadores!", "¡Suerte! Toca las palabras correctas."][tutorialStep]} onNext={nextTutorialStep} position={['category', 'time', 'lives', 'items', 'words'][tutorialStep] as any} isMidnight={showKonamiEffect} />}
          
          <GameHUD state={gameState} target={gameState.targetCategory} />
          
          <div className="w-full max-w-7xl flex flex-1 flex-col md:flex-row items-stretch justify-center gap-2 overflow-hidden">
            <div id="game-board" className={`flex-1 rounded-2xl md:rounded-[4rem] p-4 md:p-10 shadow-2xl border-b-4 md:border-b-8 flex flex-col justify-center transition-all overflow-y-auto custom-scrollbar ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <div className={`relative flex flex-wrap justify-center items-center gap-1.5 md:gap-4 font-black content-center text-xl sm:text-3xl md:text-5xl ${showKonamiEffect ? 'text-white' : 'text-slate-800'}`}>
                {currentLevel.words.map((w) => (
                  <span key={w.id} onClick={() => handleWordClick(w)} className={`cursor-pointer px-2 md:px-5 py-1 md:py-2 rounded-xl md:rounded-[2rem] transition-all duration-300 transform select-none ${foundWords.includes(w.id) ? 'bg-green-500 text-white shadow-lg -rotate-2 scale-105 pointer-events-none' : ''} ${errorWords.includes(w.id) ? 'bg-rose-500 text-white opacity-40 pointer-events-none' : ''} ${cleanedWords.includes(w.id) ? 'opacity-20 grayscale pointer-events-none scale-90' : ''} ${highlightedWords.includes(w.id) && !foundWords.includes(w.id) ? 'ring-2 md:ring-4 ring-yellow-400 animate-pulse' : ''} ${!foundWords.includes(w.id) && !errorWords.includes(w.id) && !cleanedWords.includes(w.id) ? (showKonamiEffect ? 'hover:bg-slate-800 hover:text-cyan-400' : 'hover:bg-indigo-50 hover:text-indigo-600') : ''}`}>{w.text}</span>
                ))}
              </div>
            </div>

            <div id="powerups-bar" className="flex md:flex-col gap-2 md:gap-3 justify-center items-center py-1 md:px-4">
              {[ 
                { type: 'hint' as const, icon: 'fa-lightbulb', label: 'PISTA', count: gameState.powerups.hints, color: 'cyan' }, 
                { type: 'clean' as const, icon: 'fa-broom', label: 'LIMPIAR', count: gameState.powerups.cleaners, color: 'rose' }, 
                { type: 'shield' as const, icon: 'fa-shield-alt', label: 'ESCUDO', count: gameState.powerups.shields, color: 'lime' } 
              ].map((p) => (
                <button 
                  key={p.type} onClick={() => usePowerup(p.type as any)} disabled={p.count <= 0} 
                  className={`w-12 h-12 md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl md:rounded-3xl shadow-lg border-b-2 md:border-b-4 transition-all active:scale-95 ${p.count > 0 ? (showKonamiEffect ? `bg-${p.color}-600 border-${p.color}-800` : `bg-${p.color}-300 border-${p.color}-500`) : 'opacity-40 grayscale pointer-events-none'}`}
                >
                  <i className={`fas ${p.icon} text-sm md:text-3xl mb-0.5 md:mb-1`}></i>
                  <span className="text-[6px] md:text-[10px] font-black uppercase">{p.label} ({p.count})</span>
                </button>
              ))}
              <button 
                onClick={() => setView(GameView.MENU)} 
                className="w-12 h-12 md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl md:rounded-3xl shadow-lg border-b-2 md:border-b-4 bg-white border-slate-300"
              >
                <i className="fas fa-home text-sm md:text-3xl text-indigo-400 mb-0.5 md:mb-1"></i>
                <span className="text-[6px] md:text-[10px] font-black uppercase">SALIR</span>
              </button>
            </div>
          </div>

          <p className={`mt-2 text-[8px] md:text-xs font-black uppercase italic opacity-40 ${showKonamiEffect ? 'text-indigo-300' : 'text-indigo-900'}`}>{currentLevel.title}</p>
          
          {!gameState.isPlaying && !gameState.isGameOver && lastReward && (
            <div className="fixed inset-0 flex items-center justify-center z-[200] animate-in zoom-in duration-500 p-4">
              <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm"></div>
              <div className="relative bg-white p-6 md:p-14 rounded-[2rem] md:rounded-[4.5rem] shadow-2xl border-4 md:border-[12px] border-indigo-500 text-center max-w-md w-full">
                 <h2 className="text-3xl md:text-6xl font-black text-indigo-900 mb-3 md:mb-6 italic uppercase">¡GENIAL!</h2>
                 <div className="bg-indigo-50 p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] border-2 md:border-4 border-dashed border-indigo-200 mb-4 md:mb-6 flex flex-col items-center">
                    <div className={`text-6xl md:text-9xl mb-2 md:mb-4 animate-bounce ${lastReward.color}`}><i className={`fas ${lastReward.icon}`}></i></div>
                    <span className={`text-2xl md:text-5xl font-black italic ${lastReward.color} uppercase`}>{lastReward.label}</span>
                 </div>
                 <div className="mt-2 w-32 md:w-48 h-2 md:h-3 bg-slate-100 rounded-full overflow-hidden mx-auto">
                   <div className="h-full bg-indigo-500 animate-[loading_3s_linear]"></div>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === GameView.GAME_OVER && (
        <div className={`text-center p-6 md:p-16 rounded-[2rem] md:rounded-[4rem] shadow-2xl border-b-4 md:border-b-8 border-rose-500 animate-in zoom-in w-full max-w-lg mx-4 ${showKonamiEffect ? 'bg-slate-900' : 'bg-white'}`}>
          <i className="fas fa-skull text-5xl md:text-8xl text-rose-500 mb-4 md:mb-6 block"></i>
          <h2 className="text-4xl md:text-7xl font-black italic mb-3 md:mb-4">GAME OVER</h2>
          <div className="mb-6 md:mb-8 p-4 md:p-6 bg-indigo-50 rounded-2xl md:rounded-[2rem] border-2 border-indigo-100">
            <span className="text-4xl md:text-6xl font-black text-indigo-600 mb-1">{gameState.score}</span>
            <span className="text-[8px] md:text-[10px] font-bold text-slate-400 block uppercase">PUNTOS ACUMULADOS</span>
            {gameState.score > 0 && !scoreSaved && (
              <div className="mt-4 md:mt-6 flex flex-col gap-3 md:gap-4">
                <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Tu nombre..." className="p-2 md:p-3 rounded-lg md:rounded-xl border-2 border-indigo-200 text-center font-bold text-sm" />
                <button onClick={async () => { setIsSavingScore(true); await saveScore({ name: playerName, score: gameState.score }); setScoreSaved(true); setIsSavingScore(false); }} disabled={!playerName || isSavingScore} className="py-2 md:py-3 bg-indigo-600 text-white rounded-lg md:rounded-xl font-black text-sm uppercase">GUARDAR</button>
              </div>
            )}
          </div>
          <button onClick={() => setView(GameView.MENU)} className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-lg md:text-xl font-black uppercase italic tracking-tighter">VOLVER AL MENÚ</button>
        </div>
      )}
      
      {view === GameView.ACHIEVEMENTS && <AchievementsModal achievements={achievements} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.LEADERBOARD && <Leaderboard isMidnight={showKonamiEffect} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.EDITOR && <Editor onClose={() => setView(GameView.MENU)} onSave={(newLevel) => { unlockAchievement('architect'); setCommunityLevels(prev => [newLevel, ...prev]); setView(GameView.MENU); }} />}
    </div>
  );
};

export default App;
