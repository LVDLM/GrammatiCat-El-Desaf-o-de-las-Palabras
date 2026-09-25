
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameView, GameState, WordClass, Level, WordData, Achievement, LevelGroup } from './types';
import { INITIAL_LEVELS, LITERARY_ES_LEVELS, LITERARY_UNIVERSAL_LEVELS, KONAMI_CODE, INITIAL_ACHIEVEMENTS } from './constants';
import { GameHUD } from './components/GameHUD';
import { Editor } from './components/Editor';
import { AchievementsModal } from './components/AchievementsModal';
import { Leaderboard } from './components/Leaderboard';
import { fetchCommunityLevels, saveScore } from './services/firebaseService';

export const getPluralCategory = (cat: WordClass): string => {
  switch (cat) {
    case WordClass.PREPOSICION: return 'Preposiciones';
    case WordClass.CONJUNCION: return 'Conjunciones';
    default: return `${cat}s`;
  }
};

const CHALLENGE_PROGRESSION: WordClass[] = [
  WordClass.SUSTANTIVO,
  WordClass.ADJETIVO,
  WordClass.VERBO,
  WordClass.ADVERBIO,
  WordClass.DETERMINANTE,
  WordClass.PRONOMBRE,
  WordClass.PREPOSICION,
  WordClass.CONJUNCION
];

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
        const isDesktop = viewportWidth > 1024;
        
        let arrow: 'up' | 'down' = 'down';
        let top = rect.top - (isDesktop ? 180 : 100);
        let left = rect.left + rect.width / 2;

        if (position === 'words') {
          top = rect.top + rect.height / 2 - (isDesktop ? 80 : 40);
          arrow = 'down';
        } else if (position === 'items') {
          top = rect.top - (isDesktop ? 160 : 90);
          arrow = 'down';
        }
        
        const boxWidth = isDesktop ? 400 : 250;
        const boxHalfWidth = boxWidth / 2;
        
        if (left - boxHalfWidth < 20) left = boxHalfWidth + 20;
        if (left + boxHalfWidth > viewportWidth - 20) left = viewportWidth - boxHalfWidth - 20;

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
      className="fixed z-[150] w-[85%] max-w-[280px] lg:max-w-[450px] transition-all duration-500 animate-in fade-in zoom-in cursor-pointer"
      style={{ top: coords.top, left: coords.left, transform: 'translateX(-50%)' }}
      onClick={onNext}
    >
      <div className={`relative p-4 lg:p-10 rounded-[2rem] lg:rounded-[3.5rem] border-4 lg:border-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${isMidnight ? 'bg-slate-800 border-indigo-500 text-white' : 'bg-white border-yellow-400 text-indigo-900'}`}>
        <div className={`absolute w-0 h-0 border-l-[12px] lg:border-l-[20px] border-l-transparent border-r-[12px] lg:border-r-[20px] border-r-transparent left-1/2 -translate-x-1/2 ${coords.arrow === 'up' ? 'bottom-full border-b-[20px] lg:border-b-[30px] ' + (isMidnight ? 'border-b-indigo-500' : 'border-b-yellow-400') : 'top-full border-t-[20px] lg:border-t-[30px] ' + (isMidnight ? 'border-t-indigo-500' : 'border-t-yellow-400')}`}></div>
        <p className="text-sm lg:text-2xl font-black leading-tight mb-4 lg:mb-8 text-center">{text}</p>
        <div className="flex justify-center">
          <button className="px-6 py-2 lg:px-12 lg:py-4 bg-indigo-600 text-white text-[10px] lg:text-xl font-black rounded-full uppercase shadow-lg hover:scale-105 transition-transform">
            OK <i className="fas fa-check ml-2"></i>
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [konamiProgress, setKonamiProgress] = useState(0);
  
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
    
    const stats = savedStats ? { ...defaultStats, ...JSON.parse(savedStats) } : defaultStats;
    if (!stats.completedLevels) stats.completedLevels = {};
    
    return {
      score: 0, lives: 3, time: 0, levelIndex: 0, isPlaying: false, isGameOver: false,
      targetCategory: null, mode: null, challengeStep: 0, powerups: { hints: 2, cleaners: 1, shields: 1 }, stats
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
  const [showKonamiEffect, setShowKonamiEffect] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const saved = localStorage.getItem('grammaticat_achievements');
    return saved ? JSON.parse(saved) : INITIAL_ACHIEVEMENTS;
  });
  const [lastUnlocked, setLastUnlocked] = useState<Achievement | null>(null);
  const timerRef = useRef<any>(null);

  // Konami Code Implementation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const expectedKey = KONAMI_CODE[konamiProgress];

      if (key.toLowerCase() === expectedKey.toLowerCase()) {
        const nextProgress = konamiProgress + 1;
        if (nextProgress === KONAMI_CODE.length) {
          setShowKonamiEffect(true);
          setView(GameView.EDITOR);
          setKonamiProgress(0);
        } else {
          setKonamiProgress(nextProgress);
        }
      } else {
        setKonamiProgress(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiProgress]);

  useEffect(() => {
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsHandler);
    return () => document.removeEventListener('fullscreenchange', fsHandler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

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
        } catch (e) { console.error("Failed to load niveles", e); }
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
  }, [unlockAchievement]);

  const startGame = (level: Level, category: WordClass, mode: GameState['mode'], resetSession: boolean = true) => {
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
      challengeStep: mode === 'CHALLENGE_PROGRESSIVE' ? (resetSession ? 0 : prev.challengeStep) : 0,
      isPlaying: !isTutorial, 
      isGameOver: false,
      isTutorialMode: isTutorial,
      powerups: resetSession ? { hints: 2, cleaners: 1, shields: 1 } : prev.powerups
    }));
    setFoundWords([]); setErrorWords([]); setHighlightedWords([]); setCleanedWords([]); setLastReward(null); setScoreSaved(false);
    setView(GameView.PLAYING);
    if (isTutorial) setTutorialStep(0); else setTutorialStep(null);
  };

  const handleWordClick = (word: WordData) => {
    if (!gameState.isPlaying || !currentLevel || !gameState.targetCategory) return;
    if (foundWords.includes(word.id) || errorWords.includes(word.id) || cleanedWords.includes(word.id)) return;
    
    const cleanWord = word.text.toLowerCase().replace(/[.,;:!?]/g, '');
    const isContraction = cleanWord === 'al' || cleanWord === 'del';
    const isCorrect = word.category === gameState.targetCategory || 
                     (isContraction && (gameState.targetCategory === WordClass.PREPOSICION || gameState.targetCategory === WordClass.DETERMINANTE));

    if (isCorrect) {
      const newFound = [...foundWords, word.id];
      setFoundWords(newFound);
      setGameState(prev => ({ ...prev, score: prev.score + 10, stats: { ...prev.stats, nounsFound: (prev.stats?.nounsFound || 0) + (word.category === WordClass.SUSTANTIVO ? 1 : 0) } }));
      
      const targetWordsCount = currentLevel.words.filter(w => {
          const wClean = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
          const wIsContr = wClean === 'al' || wClean === 'del';
          return w.category === gameState.targetCategory || (wIsContr && (gameState.targetCategory === WordClass.PREPOSICION || gameState.targetCategory === WordClass.DETERMINANTE));
      }).length;

      if (newFound.length === targetWordsCount) {
        setGameState(prev => {
          const newStats = { ...prev.stats };
          if (prev.isTutorialMode) newStats.tutorialCompleted = true;
          else {
            newStats.totalTextsSuccessful = (newStats.totalTextsSuccessful || 0) + 1;
            if (prev.mode?.startsWith('CHALLENGE')) newStats.challengeTextsCount = (newStats.challengeTextsCount || 0) + 1;
            const alreadyDone = newStats.completedLevels?.[currentLevel.id] || [];
            if (!alreadyDone.includes(gameState.targetCategory!)) {
              newStats.completedLevels[currentLevel.id] = [...alreadyDone, gameState.targetCategory!];
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
          else if (reward.type === 'life') newLives = Math.min(5, prev.lives + 1);
          
          return { 
            ...prev, 
            isPlaying: false, 
            lives: newLives, 
            powerups: newPowerups, 
            stats: newStats,
            challengeStep: prev.mode === 'CHALLENGE_PROGRESSIVE' ? prev.challengeStep + 1 : prev.challengeStep
          };
        });
        setTimeout(() => { 
          if (gameState.mode?.startsWith('CHALLENGE')) startChallenge(gameState.mode as any, true); 
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

  const startChallenge = useCallback(async (mode: 'CHALLENGE_RANDOM' | 'CHALLENGE_PROGRESSIVE', isTransition: boolean = false) => {
    const allAvailable = [...LITERARY_ES_LEVELS, ...LITERARY_UNIVERSAL_LEVELS, ...communityLevels].filter(l => l && l.words);
    if (allAvailable.length === 0) return;
    
    let randomLevel: Level;
    let category: WordClass;
    
    const hasCategory = (level: Level, cat: WordClass) => {
       return level.words.some(w => {
          const wClean = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
          const wIsContr = wClean === 'al' || wClean === 'del';
          return w.category === cat || (wIsContr && (cat === WordClass.PREPOSICION || cat === WordClass.DETERMINANTE));
       });
    };

    if (mode === 'CHALLENGE_PROGRESSIVE') {
      const step = isTransition ? gameState.challengeStep + 1 : 0;
      category = CHALLENGE_PROGRESSION[step % CHALLENGE_PROGRESSION.length];
      const validLevels = allAvailable.filter(l => hasCategory(l, category));
      
      if (validLevels.length > 0) {
        randomLevel = validLevels[Math.floor(Math.random() * validLevels.length)];
      } else {
        randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
        const availableCats = Array.from(new Set(randomLevel.words.map(w => w.category))) as WordClass[];
        category = availableCats[0];
      }
    } else {
      randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
      const categoriesInLevel = Array.from(new Set(randomLevel.words.map(w => w.category))) as WordClass[];
      const hasContr = randomLevel.words.some(w => {
         const wc = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
         return wc === 'al' || wc === 'del';
      });
      
      if (hasContr) {
        if (!categoriesInLevel.includes(WordClass.PREPOSICION)) categoriesInLevel.push(WordClass.PREPOSICION);
        if (!categoriesInLevel.includes(WordClass.DETERMINANTE)) categoriesInLevel.push(WordClass.DETERMINANTE);
      }
      category = categoriesInLevel[Math.floor(Math.random() * categoriesInLevel.length)] || WordClass.SUSTANTIVO;
    }
    startGame(randomLevel, category, mode, !isTransition);
  }, [communityLevels, gameState.challengeStep]);

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
      const remainingTargetWords = currentLevel.words.filter(w => {
         const wClean = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
         const wIsContr = wClean === 'al' || wClean === 'del';
         const matchesCat = w.category === gameState.targetCategory || (wIsContr && (gameState.targetCategory === WordClass.PREPOSICION || gameState.targetCategory === WordClass.DETERMINANTE));
         return matchesCat && !foundWords.includes(w.id) && !highlightedWords.includes(w.id);
      });
      if (remainingTargetWords.length > 0) {
        const randomWord = remainingTargetWords[Math.floor(Math.random() * remainingTargetWords.length)];
        setHighlightedWords(prev => [...prev, randomWord.id]);
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, hints: prev.powerups.hints - 1 } }));
      }
    } else if (type === 'clean' && gameState.powerups.cleaners > 0) {
      const incorrectWords = currentLevel.words.filter(w => {
         const wClean = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
         const wIsContr = wClean === 'al' || wClean === 'del';
         const matchesCat = w.category === gameState.targetCategory || (wIsContr && (gameState.targetCategory === WordClass.PREPOSICION || gameState.targetCategory === WordClass.DETERMINANTE));
         return !matchesCat && !cleanedWords.includes(w.id);
      });
      if (incorrectWords.length > 0) {
        const toClean = incorrectWords.sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.id);
        setCleanedWords(prev => [...prev, ...toClean]);
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, cleaners: prev.powerups.cleaners - 1 } }));
      }
    }
  };

  const LevelCard: React.FC<{ level: Level }> = ({ level }) => {
    if (!level || !level.words) return null;
    const cats = Array.from(new Set(level.words.map(w => w.category))) as WordClass[];
    const doneCats = gameState.stats.completedLevels?.[level.id] || [];
    return (
      <div className={`rounded-xl p-3 md:p-4 lg:p-5 shadow-md border-b-2 transition-all hover:bg-indigo-50/50 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-indigo-50'}`}>
         <div className="flex justify-between items-start mb-2 lg:mb-3">
           <h3 className={`text-[12px] md:text-base lg:text-xl font-black truncate max-w-[80%] uppercase italic ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>{level.title}</h3>
           {doneCats.length === cats.length && <i className="fas fa-check-circle text-green-500 text-[12px] lg:text-lg"></i>}
         </div>
         <div className="flex flex-wrap gap-1.5 lg:gap-3">
            {cats.map(cat => (
              <button 
                key={cat} onClick={() => startGame(level, cat, 'PRACTICE', true)}
                className={`px-2 py-1 lg:px-4 lg:py-2 rounded-md lg:rounded-xl text-[10px] md:text-[13px] lg:text-lg font-black uppercase transition-all shadow-sm active:scale-95 ${doneCats.includes(cat) ? 'bg-green-100 text-green-700 border border-green-200' : showKonamiEffect ? 'bg-slate-700 text-indigo-300' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
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
    const filteredLevels = (levels || []).filter(l => l && l.words);
    const completedCount = filteredLevels.filter(l => {
      const done = gameState.stats.completedLevels?.[l.id];
      return done && done.length > 0;
    }).length;

    return (
      <div className={`w-full rounded-2xl md:rounded-3xl lg:rounded-[3rem] overflow-hidden transition-all duration-300 border-2 ${isExpanded ? `bg-white shadow-xl ${showKonamiEffect ? 'border-indigo-800 bg-slate-900' : 'border-indigo-400'}` : `bg-white/10 border-transparent hover:bg-white/20`}`}>
        <button onClick={() => setExpandedCategory(isExpanded ? null : id)} className={`w-full flex items-center justify-between p-4 md:p-8 lg:p-10 text-left transition-colors ${isExpanded ? (showKonamiEffect ? 'text-white' : 'text-indigo-900') : 'text-white'}`}>
          <div className="flex items-center gap-4 md:gap-6 lg:gap-8">
            <div className={`w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-xl lg:rounded-3xl flex items-center justify-center text-2xl md:text-3xl lg:text-4xl shadow-lg ${color} text-white`}>
              <i className={`fas ${icon}`}></i>
            </div>
            <div>
              <h3 className="text-base md:text-2xl lg:text-4xl font-black uppercase italic tracking-tighter leading-none">{title}</h3>
              <p className="text-[11px] md:text-sm lg:text-xl font-bold opacity-70 mt-1 lg:mt-2">{completedCount}/{filteredLevels.length} textos</p>
            </div>
          </div>
          <i className={`fas fa-chevron-down text-lg md:text-2xl lg:text-3xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
        </button>
        {isExpanded && (
          <div className="p-4 lg:p-10 pt-0 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
              {filteredLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getMissedWords = () => {
    if (!currentLevel || !gameState.targetCategory) return [];
    return currentLevel.words.filter(w => {
      const wClean = w.text.toLowerCase().replace(/[.,;:!?]/g, '');
      const wIsContr = wClean === 'al' || wClean === 'del';
      const isMatch = w.category === gameState.targetCategory || (wIsContr && (gameState.targetCategory === WordClass.PREPOSICION || gameState.targetCategory === WordClass.DETERMINANTE));
      return isMatch && !foundWords.includes(w.id);
    });
  };

  const missedWords = getMissedWords();
  const categoryLabel = gameState.targetCategory ? getPluralCategory(gameState.targetCategory) : '';
  const verb = missedWords.length === 1 ? 'es' : 'son';
  const missedWordsHeader = `También ${verb} ${categoryLabel}:`;

  return (
    <div className={`min-h-[100dvh] w-full flex flex-col items-center justify-start py-4 md:py-8 lg:py-12 p-2 md:p-4 transition-all duration-1000 ${showKonamiEffect ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 konami-active' : 'bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500'} relative overflow-x-hidden`}>
      {lastUnlocked && (
        <div className="fixed top-4 right-4 z-[100] bg-white p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] shadow-2xl border-4 border-yellow-400 animate-in slide-in-from-right duration-500 flex items-center space-x-4">
          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-yellow-400 rounded-xl lg:rounded-3xl flex items-center justify-center text-indigo-900 text-xl lg:text-4xl shadow-lg"><i className={`fas ${lastUnlocked.icon}`}></i></div>
          <div><span className="block text-[10px] lg:text-sm font-black text-yellow-600 uppercase tracking-widest">¡Logro!</span><span className="block text-sm lg:text-2xl font-black text-indigo-900 whitespace-nowrap">{lastUnlocked.title}</span></div>
        </div>
      )}

      {view === GameView.MENU && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700 w-full max-w-6xl text-center px-4 pb-10">
          <div className="relative mb-6 md:mb-10 lg:mb-16 xl:mb-20 floating">
            <h1 className="main-title text-5xl sm:text-6xl md:text-7xl lg:text-9xl xl:text-[11rem] font-black text-white italic drop-shadow-[0_15px_15px_rgba(0,0,0,0.4)] tracking-tighter select-none uppercase leading-none">GRAMMA<span className="text-yellow-300">CAT</span></h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 md:gap-8 lg:gap-16 w-full justify-center mb-8 lg:mb-16">
            <button onClick={() => setView(GameView.LEVEL_SELECT)} className={`menu-btn-container group relative flex-1 sm:max-w-[220px] lg:max-w-[400px] h-24 sm:h-48 lg:h-72 rounded-3xl lg:rounded-[4rem] shadow-2xl border-b-8 lg:border-b-[16px] hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <i className="fas fa-graduation-cap text-3xl md:text-5xl lg:text-8xl text-indigo-500 mb-1 lg:mb-4 group-hover:rotate-12 transition-transform"></i>
              <span className={`text-xl md:text-2xl lg:text-5xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>PRÁCTICA</span>
            </button>
            
            <div className="flex-1 flex flex-col gap-4">
               <button onClick={() => startChallenge('CHALLENGE_PROGRESSIVE')} className={`menu-btn-container group relative flex-1 rounded-3xl lg:rounded-[4rem] shadow-2xl border-b-8 lg:border-b-[16px] hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-emerald-900 border-emerald-950' : 'bg-emerald-400 border-emerald-600'}`}>
                <i className={`fas fa-layer-group text-3xl md:text-5xl lg:text-8xl mb-1 lg:mb-4 group-hover:scale-110 transition-transform ${showKonamiEffect ? 'text-emerald-300' : 'text-white'}`}></i>
                <span className={`text-sm md:text-xl lg:text-4xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>RETO PROGRESIVO</span>
              </button>
              <button onClick={() => startChallenge('CHALLENGE_RANDOM')} className={`menu-btn-container group relative flex-1 rounded-3xl lg:rounded-[4rem] shadow-2xl border-b-8 lg:border-b-[16px] hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-purple-900 border-purple-950' : 'bg-yellow-400 border-yellow-600'}`}>
                <i className={`fas fa-dice text-3xl md:text-5xl lg:text-8xl mb-1 lg:mb-4 group-hover:rotate-45 transition-transform ${showKonamiEffect ? 'text-yellow-400' : 'text-indigo-900'}`}></i>
                <span className={`text-sm md:text-xl lg:text-4xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>RETO ALEATORIO</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 lg:gap-10 max-w-5xl items-center">
            <button onClick={() => setView(GameView.LEADERBOARD)} className="px-6 py-4 lg:px-12 lg:py-6 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 rounded-2xl lg:rounded-[2.5rem] font-black border-2 lg:border-4 border-yellow-500 shadow-xl text-xs md:text-sm lg:text-xl flex items-center"><i className="fas fa-list-ol mr-2 lg:mr-4"></i> RÁNKING</button>
            <button onClick={() => setView(GameView.ACHIEVEMENTS)} className="px-6 py-4 lg:px-12 lg:py-6 bg-white/20 hover:bg-white/40 text-white rounded-2xl lg:rounded-[2.5rem] font-black border-2 lg:border-4 border-white/30 text-xs md:text-sm lg:text-xl shadow-xl backdrop-blur-md flex items-center"><i className="fas fa-trophy mr-2 lg:mr-4"></i> LOGROS</button>
            <button onClick={toggleFullscreen} className="px-6 py-4 lg:px-12 lg:py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl lg:rounded-[2.5rem] font-black border-2 lg:border-4 border-indigo-700 text-xs md:text-sm lg:text-xl flex items-center shadow-xl">
              <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'} mr-2 lg:mr-4`}></i> {isFullscreen ? 'NORMAL' : 'FULLSCREEN'}
            </button>
            <button onClick={() => setView(GameView.ABOUT)} className="px-5 py-3 lg:px-10 lg:py-5 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-2xl lg:rounded-[2.5rem] font-black border-2 lg:border-4 border-indigo-700 text-[10px] md:text-xs lg:text-lg flex items-center shadow-lg"><i className="fas fa-info-circle mr-2 lg:mr-4"></i> SOBRE ESTE JUEGO</button>
          </div>
        </div>
      )}

      {view === GameView.LEVEL_SELECT && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in slide-in-from-bottom duration-500 p-3 pb-20">
          <div className="w-full flex justify-between items-center mb-10 sticky top-0 bg-transparent z-10 py-4">
            <button onClick={() => setView(GameView.MENU)} className="p-3 lg:p-6 bg-white/20 text-white rounded-full hover:bg-white/40 shadow-lg"><i className="fas fa-arrow-left text-sm md:text-xl lg:text-3xl"></i></button>
            <h2 className="text-xl md:text-4xl lg:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">ELIGE TEXTO</h2>
            <div className="w-12 lg:w-20"></div>
          </div>
          <div className="flex flex-col gap-4 lg:gap-8 w-full">
            <AccordionSection id="Tutorial" title="Tutorial" icon="fa-chalkboard-teacher" color="bg-emerald-500" levels={INITIAL_LEVELS} />
            <AccordionSection id="Literatura en español" title="Español" icon="fa-feather-alt" color="bg-amber-500" levels={LITERARY_ES_LEVELS} />
            <AccordionSection id="Literatura universal" title="Universal" icon="fa-globe-americas" color="bg-indigo-500" levels={LITERARY_UNIVERSAL_LEVELS} />
            <AccordionSection id="Tus Niveles" title="Tus Niveles" icon="fa-user-edit" color="bg-purple-500" levels={communityLevels} />
          </div>
        </div>
      )}

      {view === GameView.PLAYING && currentLevel && gameState.targetCategory && (
        <div className="w-full h-full flex flex-col items-center p-1 md:p-2 lg:p-8 transition-all duration-300 overflow-hidden relative">
          {tutorialStep !== null && <TutorialSign text={["¡Hola! Aquí verás qué palabra buscas.", "Controla tu tiempo, ¡vuela!", "Pierdes vida si fallas.", "¡Usa tus potenciadores!", "¡Suerte! Toca las palabras correctas."][tutorialStep]} onNext={() => setTutorialStep(tutorialStep < 4 ? tutorialStep + 1 : null)} position={['category', 'time', 'lives', 'items', 'words'][tutorialStep] as any} isMidnight={showKonamiEffect} />}
          
          <div className="hud-container w-full max-w-7xl">
            <GameHUD state={gameState} target={gameState.targetCategory} levelTitle={currentLevel.title} />
          </div>
          
          <div className="w-full flex flex-1 flex-col items-stretch justify-center gap-2 md:gap-4 lg:gap-10 overflow-hidden px-2 lg:px-10">
            <div id="game-board" className={`flex-1 rounded-[1.5rem] md:rounded-[2rem] lg:rounded-[5rem] p-2 md:p-4 lg:p-14 shadow-2xl border-b-4 lg:border-b-12 flex flex-col justify-center transition-all overflow-y-auto custom-scrollbar ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <div className={`relative flex flex-wrap justify-center items-center gap-1 md:gap-2.5 lg:gap-5 font-black content-center text-lg md:text-2xl lg:text-4xl xl:text-6xl leading-tight ${showKonamiEffect ? 'text-white' : 'text-slate-800'}`}>
                {currentLevel.words.map((w) => (
                  <span key={w.id} onClick={() => handleWordClick(w)} className={`word-bubble cursor-pointer px-1.5 py-1 md:px-3 md:py-2 lg:px-7 lg:py-3.5 rounded-lg md:rounded-2xl lg:rounded-[2.5rem] transition-all duration-300 transform select-none shadow-sm hover:shadow-xl ${foundWords.includes(w.id) ? 'bg-green-500 text-white shadow-2xl -rotate-2 scale-110 pointer-events-none' : ''} ${errorWords.includes(w.id) ? 'bg-rose-500 text-white opacity-30 pointer-events-none scale-95' : ''} ${cleanedWords.includes(w.id) ? 'opacity-10 grayscale pointer-events-none scale-90' : ''} ${highlightedWords.includes(w.id) && !foundWords.includes(w.id) ? 'ring-2 md:ring-4 lg:ring-8 ring-yellow-400 animate-pulse shadow-[0_0_30px_rgba(250,204,21,0.5)]' : ''} ${!foundWords.includes(w.id) && !errorWords.includes(w.id) && !cleanedWords.includes(w.id) ? (showKonamiEffect ? 'hover:text-cyan-400' : 'hover:bg-indigo-50 hover:text-indigo-600') : ''}`}>{w.text}</span>
                ))}
              </div>
            </div>

            <div id="powerups-bar" className="flex flex-row gap-2 md:gap-4 lg:gap-10 justify-center items-center py-1 md:py-3 lg:py-6">
              {[ 
                { type: 'hint' as const, icon: 'fa-lightbulb', label: 'PISTA', count: gameState.powerups.hints, color: 'cyan' }, 
                { type: 'clean' as const, icon: 'fa-broom', label: 'LIMPIAR', count: gameState.powerups.cleaners, color: 'rose' }, 
                { type: 'shield' as const, icon: 'fa-shield-alt', label: 'ESCUDO', count: gameState.powerups.shields, color: 'lime' } 
              ].map((p) => (
                <button key={p.type} onClick={() => usePowerup(p.type as any)} disabled={p.count <= 0} className={`powerup-btn w-10 h-10 md:w-16 md:h-16 lg:w-36 lg:h-36 flex flex-col items-center justify-center rounded-xl md:rounded-2xl lg:rounded-[2.5rem] shadow-xl border-b-2 md:border-b-4 lg:border-b-8 transition-all active:scale-95 hover:scale-105 ${p.count > 0 ? (showKonamiEffect ? `bg-${p.color}-600 border-${p.color}-800` : `bg-${p.color}-300 border-${p.color}-500`) : 'opacity-40 grayscale pointer-events-none'}`}>
                  <i className={`fas ${p.icon} text-xs md:text-xl lg:text-5xl mb-0.5 md:mb-1.5 lg:mb-3`}></i>
                  <span className="text-[6px] md:text-[8px] lg:text-lg font-black uppercase">{p.label} <span className="hidden md:inline">({p.count})</span></span>
                </button>
              ))}
              <button onClick={() => setView(GameView.MENU)} className="powerup-btn w-10 h-10 md:w-16 md:h-16 lg:w-36 lg:h-36 flex flex-col items-center justify-center rounded-xl md:rounded-2xl lg:rounded-[2.5rem] shadow-xl border-b-2 md:border-b-4 lg:border-b-8 bg-white border-slate-300 hover:scale-105 transition-all">
                <i className="fas fa-home text-xs md:text-xl lg:text-5xl text-indigo-400 mb-0.5 md:mb-1.5 lg:mb-3"></i>
                <span className="text-[6px] md:text-[8px] lg:text-lg font-black uppercase">MENU</span>
              </button>
            </div>
          </div>
          
          {!gameState.isPlaying && !gameState.isGameOver && lastReward && (
            <div className="fixed inset-0 flex items-center justify-center z-[200] animate-in zoom-in duration-500 p-4">
              <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm"></div>
              <div className="relative bg-white p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[4rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-4 lg:border-8 border-indigo-500 text-center max-w-md lg:max-w-3xl w-full max-h-[85dvh] overflow-y-auto flex flex-col justify-center">
                 <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-indigo-900 mb-4 lg:mb-8 italic uppercase tracking-tighter">¡MUY BIEN!</h2>
                 <div className="bg-indigo-50 p-6 lg:p-8 rounded-[2rem] lg:rounded-[3.5rem] border-4 lg:border-8 border-dashed border-indigo-200 mb-6 flex flex-col items-center shadow-inner">
                    <div className={`text-6xl md:text-8xl lg:text-[8rem] mb-4 lg:mb-6 animate-bounce ${lastReward.color}`}><i className={`fas ${lastReward.icon}`}></i></div>
                    <span className={`text-2xl md:text-4xl lg:text-6xl font-black italic ${lastReward.color} uppercase tracking-tighter`}>{lastReward.label}</span>
                 </div>
                 <div className="mt-2 lg:mt-4 w-48 lg:w-96 h-3 lg:h-6 bg-slate-100 rounded-full overflow-hidden mx-auto shadow-inner relative">
                   <div className="h-full bg-indigo-500 animate-[loading_3s_linear_forwards]"></div>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === GameView.GAME_OVER && (
        <div className={`flex flex-col items-center justify-center w-full h-[100dvh] p-2 md:p-4 transition-all duration-300`}>
          <div className={`text-center p-4 md:p-6 lg:p-12 rounded-[2rem] lg:rounded-[4rem] shadow-2xl border-b-4 lg:border-b-8 border-rose-500 animate-in zoom-in w-full max-w-lg lg:max-w-6xl flex flex-col ${showKonamiEffect ? 'bg-slate-900 text-white' : 'bg-white'}`}>
            
            <div className="mb-2 md:mb-4 lg:mb-8">
               <i className="fas fa-skull text-3xl md:text-5xl lg:text-7xl text-rose-500 mb-1 lg:mb-4 block drop-shadow-lg animate-bounce"></i>
               <h2 className="text-2xl md:text-4xl lg:text-6xl font-black italic uppercase tracking-tighter leading-none">FIN DEL JUEGO</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4 lg:gap-8 items-stretch flex-1">
              {/* SCORE BOX */}
              <div className="p-3 md:p-6 lg:p-10 bg-indigo-50 rounded-2xl md:rounded-[2.5rem] lg:rounded-[3rem] border-2 lg:border-4 border-indigo-100 shadow-inner flex flex-col justify-center items-center">
                <span className="text-[10px] md:text-xs lg:text-xl font-bold text-slate-400 block uppercase tracking-[0.2em] mb-1">PUNTOS</span>
                <span className="text-3xl md:text-5xl lg:text-8xl font-black text-indigo-600 mb-2 leading-none">{gameState.score}</span>
                
                {gameState.score > 0 && !scoreSaved && (
                  <div className="flex flex-col gap-1.5 md:gap-3 w-full max-w-[280px]">
                    <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Tu nombre..." className="w-full p-2 lg:p-4 rounded-xl border-2 lg:border-4 border-indigo-200 text-center font-black text-xs md:text-sm lg:text-xl outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-indigo-900" />
                    <button onClick={async () => { setIsSavingScore(true); await saveScore({ name: playerName, score: gameState.score }); setScoreSaved(true); setIsSavingScore(false); }} disabled={!playerName || isSavingScore} className="w-full py-2 lg:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[10px] md:text-sm lg:text-lg uppercase tracking-widest shadow-lg transition-all">GUARDAR</button>
                  </div>
                )}
                {scoreSaved && <span className="text-emerald-500 font-black text-[10px] md:text-sm lg:text-lg uppercase animate-pulse">¡GUARDADO!</span>}
              </div>

              {/* MISSED WORDS BOX */}
              <div className={`p-3 md:p-6 lg:p-10 rounded-2xl md:rounded-[2.5rem] lg:rounded-[3rem] border-2 lg:border-4 flex flex-col transition-all overflow-hidden ${missedWords.length > 0 ? (showKonamiEffect ? 'bg-indigo-950/20 border-indigo-900' : 'bg-indigo-50 border-indigo-100') : 'bg-emerald-50 border-emerald-100'}`}>
                <h3 className="text-[9px] md:text-xs lg:text-2xl font-black text-indigo-400 uppercase tracking-wider mb-2 lg:mb-6">
                  {missedWords.length > 0 ? missedWordsHeader : '¡PERFECTO!'}
                </h3>
                
                <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-4 justify-center items-center overflow-y-auto custom-scrollbar flex-1 content-center p-1">
                  {missedWords.length > 0 ? (
                    missedWords.map((word) => (
                      <div key={word.id} className="bg-indigo-600 text-white px-2 py-1 md:px-4 md:py-2 lg:px-8 lg:py-4 rounded-lg md:rounded-xl lg:rounded-3xl font-black text-[9px] md:text-xs lg:text-2xl shadow-md">
                        {word.text}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-check-circle text-2xl md:text-4xl lg:text-7xl text-emerald-400 mb-1 lg:mb-4"></i>
                      <p className="text-[8px] md:text-[10px] lg:text-xl font-bold text-emerald-600 italic">¡Todas correctas!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setView(GameView.MENU)} className="w-full mt-3 md:mt-4 lg:mt-10 py-3 md:py-4 lg:py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl md:rounded-2xl lg:rounded-[2.5rem] text-sm md:text-xl lg:text-3xl font-black uppercase italic tracking-tighter shadow-xl transition-all active:scale-95">MENÚ PRINCIPAL</button>
          </div>
        </div>
      )}
      
      {view === GameView.ABOUT && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-500">
          <div className={`w-full max-w-4xl rounded-[3rem] lg:rounded-[5rem] overflow-hidden flex flex-col max-h-[90vh] shadow-[0_40px_100px_rgba(0,0,0,0.6)] border-8 ${showKonamiEffect ? 'bg-slate-900 border-indigo-900' : 'bg-white border-indigo-400'}`}>
            <div className={`p-8 lg:p-14 ${showKonamiEffect ? 'bg-indigo-950' : 'bg-indigo-600'} text-white flex justify-between items-center relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 scale-150"><i className="fas fa-book-open text-9xl"></i></div>
              <div className="relative z-10">
                <h2 className="text-4xl lg:text-7xl font-black italic tracking-tighter uppercase leading-none">SOBRE EL JUEGO</h2>
                <p className="text-indigo-200 font-bold text-lg lg:text-2xl mt-2 italic">GrammatiCat: Pedagogía y Diversión</p>
              </div>
              <button onClick={() => setView(GameView.MENU)} className="bg-white/20 hover:bg-white/40 w-12 h-12 lg:w-20 lg:h-20 rounded-full transition-colors flex items-center justify-center relative z-10">
                <i className="fas fa-times text-2xl lg:text-5xl"></i>
              </button>
            </div>
            
            <div className={`flex-1 overflow-y-auto p-6 md:p-10 lg:p-20 custom-scrollbar ${showKonamiEffect ? 'text-indigo-100' : 'text-slate-800'}`}>
              <div className="space-y-12 lg:space-y-20">
                
                {/* MODOS DE JUEGO */}
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white text-xl lg:text-3xl shadow-lg"><i className="fas fa-gamepad"></i></div>
                    <h3 className="text-2xl lg:text-5xl font-black uppercase italic tracking-tighter">Modos de Juego para el Aula</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                    <div className={`p-6 lg:p-10 rounded-[2rem] border-2 shadow-inner ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                      <h4 className="font-black text-indigo-500 text-lg lg:text-2xl uppercase mb-2">Modo Práctica</h4>
                      <p className="text-sm lg:text-xl font-medium leading-relaxed opacity-80">Ideal para el refuerzo específico. El docente puede asignar un texto concreto (ej. Pedro Páramo) y una categoría para trabajar en gran grupo o de forma individual.</p>
                    </div>
                    <div className={`p-6 lg:p-10 rounded-[2rem] border-2 shadow-inner ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                      <h4 className="font-black text-indigo-500 text-lg lg:text-2xl uppercase mb-2">Reto Progresivo</h4>
                      <p className="text-sm lg:text-xl font-medium leading-relaxed opacity-80">Itinerario pedagógico que guía al alumno por todas las categorías, desde las más sencillas hasta las complejas, aumentando la dificultad paso a paso.</p>
                    </div>
                    <div className={`p-6 lg:p-10 rounded-[2rem] border-2 shadow-inner ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                      <h4 className="font-black text-indigo-500 text-lg lg:text-2xl uppercase mb-2">Reto Aleatorio</h4>
                      <p className="text-sm lg:text-xl font-medium leading-relaxed opacity-80">Perfecto para sesiones de repaso rápido o "warm-ups", donde el sistema elige texto y categoría al azar para probar la agilidad mental.</p>
                    </div>
                    <div className={`p-6 lg:p-10 rounded-[2rem] border-2 shadow-inner ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                      <h4 className="font-black text-indigo-500 text-lg lg:text-2xl uppercase mb-2">Editor de Niveles</h4>
                      <p className="text-sm lg:text-xl font-medium leading-relaxed opacity-80">Herramienta potente donde los estudiantes traen sus propios textos y crean retos para sus compañeros, fomentando el aprendizaje entre iguales.</p>
                    </div>
                  </div>
                </section>

                {/* INTENCION DIDACTICA */}
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white text-xl lg:text-3xl shadow-lg"><i className="fas fa-graduation-cap"></i></div>
                    <h3 className="text-2xl lg:text-5xl font-black uppercase italic tracking-tighter">Intención Didáctica y Beneficios</h3>
                  </div>
                  <div className="space-y-6 lg:space-y-8">
                    {[
                      { title: "Aprendizaje en Contexto", text: "No se analizan palabras aisladas. El alumno debe distinguir la función de la palabra según el sentido de la frase literaria.", icon: "fa-font" },
                      { title: "Feedback Inmediato", text: "El juego detecta y muestra visualmente las palabras omitidas, permitiendo una metacognición instantánea tras cada partida.", icon: "fa-eye" },
                      { title: "Gamificación Intrínseca", text: "Sistemas de vidas, potenciadores y logros mantienen la motivación alta sin perder nunca el foco estrictamente académico.", icon: "fa-trophy" },
                      { title: "Fomento de la Lectura", text: "Al interactuar con textos de Unamuno, Borges o Cortázar, los alumnos se familiarizan con la prosa clásica de manera lúdica.", icon: "fa-book" },
                      { title: "Competencia Digital", text: "Entorno ultra-responsivo ideal para cualquier dispositivo, perfecto para modelos de aula 1:1 o BYOD.", icon: "fa-tablet-alt" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4 lg:gap-8">
                        <i className={`fas ${item.icon} text-amber-500 text-xl lg:text-3xl mt-1`}></i>
                        <div>
                          <h4 className="font-black text-lg lg:text-3xl leading-none mb-1 uppercase tracking-tighter">{item.title}</h4>
                          <p className="text-sm lg:text-xl font-medium opacity-70 leading-snug">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ATRIBUCIÓN */}
                <div className="pt-6 border-t border-slate-200/40 text-center text-xs lg:text-base">
                  <a 
                    href="https://es.vecteezy.com/vectores-gratis/cat" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-600 hover:underline font-semibold"
                  >
                    Cat Vectores por Vecteezy
                  </a>
                </div>

              </div>
            </div>

            <div className={`p-6 lg:p-10 text-center ${showKonamiEffect ? 'bg-slate-950 border-t border-slate-800' : 'bg-slate-50 border-t border-slate-100'}`}>
              <button onClick={() => setView(GameView.MENU)} className="px-12 py-4 lg:py-6 bg-indigo-600 text-white rounded-2xl lg:rounded-[3rem] font-black uppercase italic tracking-tighter text-sm lg:text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">¡ENTENDIDO!</button>
            </div>
          </div>
        </div>
      )}
      
      {view === GameView.ACHIEVEMENTS && <AchievementsModal achievements={achievements} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.LEADERBOARD && <Leaderboard isMidnight={showKonamiEffect} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.EDITOR && <Editor onClose={() => setView(GameView.MENU)} onSave={(newLevel) => { unlockAchievement('architect'); setCommunityLevels(prev => [newLevel, ...prev]); setView(GameView.MENU); }} />}
    </div>
  );
};

export default App;
