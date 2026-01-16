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
  const positionClasses = {
    category: 'top-28 md:top-36 left-1/2 -translate-x-1/2',
    time: 'top-28 md:top-36 right-2 md:right-10',
    lives: 'top-28 md:top-36 left-2 md:left-10',
    items: 'bottom-32 md:bottom-48 left-1/2 -translate-x-1/2',
    words: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
  };

  const arrowClasses = {
    category: 'top-full left-1/2 -translate-x-1/2 border-t-[20px]',
    time: 'top-full right-10 border-t-[20px]',
    lives: 'top-full left-10 border-t-[20px]',
    items: 'bottom-full left-1/2 -translate-x-1/2 border-b-[20px]',
    words: 'hidden'
  };

  const arrowThemeClass = isMidnight ? (position === 'items' ? 'border-b-slate-800' : 'border-t-slate-800') : (position === 'items' ? 'border-b-white' : 'border-t-white');

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-[150] w-[90%] max-w-sm animate-in zoom-in duration-300 cursor-pointer`}
      onClick={onNext}
    >
      <div className={`relative p-6 rounded-[2rem] border-4 shadow-2xl ${isMidnight ? 'bg-slate-800 border-indigo-500 text-white' : 'bg-white border-yellow-400 text-indigo-900'}`}>
        <div className={`absolute w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent ${arrowClasses[position]} ${arrowThemeClass}`}></div>
        <p className="text-lg font-black leading-tight mb-4 text-center">{text}</p>
        <div className="flex justify-center">
          <span className="px-4 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse">Siguiente <i className="fas fa-chevron-right ml-1"></i></span>
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
    const stats = savedStats ? JSON.parse(savedStats) : { nounsFound: 0, levelsCompleted: 0 };
    return {
      score: 0, lives: 3, time: 0, levelIndex: 0, isPlaying: false, isGameOver: false,
      targetCategory: null, mode: null, powerups: { hints: 2, shields: 1, cleaners: 1 }, stats
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

  const gameFontSize = useMemo(() => {
    if (!currentLevel) return 'text-3xl md:text-5xl';
    const count = currentLevel.words.length;
    if (count > 40) return 'text-xl md:text-3xl';
    if (count > 25) return 'text-2xl md:text-4xl';
    return 'text-3xl md:text-5xl';
  }, [currentLevel]);

  useEffect(() => { localStorage.setItem('grammaticat_stats', JSON.stringify(gameState.stats)); }, [gameState.stats]);
  useEffect(() => { localStorage.setItem('grammaticat_achievements', JSON.stringify(achievements)); }, [achievements]);

  useEffect(() => {
    if (view === GameView.LEVEL_SELECT || view === GameView.MENU) {
      const loadCommunity = async () => {
        try {
          const localUserLevels = await fetchCommunityLevels();
          setCommunityLevels(localUserLevels);
        } catch (e) { console.error("Failed to load local levels", e); }
      };
      loadCommunity();
    }
  }, [view]);

  const unlockAchievement = (id: string) => {
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
  };

  const startGame = (level: Level, category: WordClass, mode: 'PRACTICE' | 'CHALLENGE', resetSession: boolean = true) => {
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
      isTutorialMode: isTutorial
    }));
    setFoundWords([]);
    setErrorWords([]);
    setHighlightedWords([]);
    setCleanedWords([]);
    setLastReward(null);
    setScoreSaved(false);
    setView(GameView.PLAYING);
    if (isTutorial) setTutorialStep(0);
    else setTutorialStep(null);
  };

  const tutorialSteps = [
    { text: "Aquí verás qué clase de palabra debes localizar en el texto.", position: 'category' as const },
    { text: "Debes encontrar todas las palabras antes de que acabe el tiempo.", position: 'time' as const },
    { text: "Cada vez que marques una palabra que no es de la categoría que se pide, se marcará de rojo y perderás una vida.", position: 'lives' as const },
    { text: "Usa tus ítems: PISTA resalta una palabra, LIMPIAR borra errores y ESCUDO bloquea un fallo.", position: 'items' as const },
    { text: "¡Genial! Ahora pulsa sobre las palabras de la categoría que se muestra para ganar puntos.", position: 'words' as const }
  ];

  const nextTutorialStep = () => {
    if (tutorialStep === null) return;
    if (tutorialStep < tutorialSteps.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setTutorialStep(null);
      setGameState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const startRandomChallenge = useCallback(async (isTransition: boolean = false) => {
    const allAvailable = [...LITERARY_ES_LEVELS, ...LITERARY_UNIVERSAL_LEVELS, ...communityLevels];
    if (allAvailable.length === 0) return;
    const randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
    const categories = Array.from(new Set(randomLevel.words.map(w => w.category)));
    const randomCategory = (categories[Math.floor(Math.random() * categories.length)] as WordClass) || WordClass.SUSTANTIVO;
    startGame(randomLevel, randomCategory, 'CHALLENGE', !isTransition);
  }, [communityLevels]);

  const handleSaveScore = async () => {
    if (!playerName.trim()) return;
    setIsSavingScore(true);
    await saveScore({ name: playerName, score: gameState.score });
    setIsSavingScore(false);
    setScoreSaved(true);
  };

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

  const handleWordClick = (word: WordData) => {
    if (!gameState.isPlaying || !currentLevel || !gameState.targetCategory) return;
    if (foundWords.includes(word.id) || errorWords.includes(word.id) || cleanedWords.includes(word.id)) return;
    if (word.category === gameState.targetCategory) {
      const newFound = [...foundWords, word.id];
      setFoundWords(newFound);
      setGameState(prev => ({ ...prev, score: prev.score + 10, stats: { ...prev.stats, nounsFound: prev.stats.nounsFound + 1 } }));
      if (gameState.stats.nounsFound + 1 >= 100) unlockAchievement('noun_expert');
      const targetWordsCount = currentLevel.words.filter(w => w.category === gameState.targetCategory).length;
      if (newFound.length === targetWordsCount) {
        if (gameState.time > (currentLevel.timeLimit || 30) / 2) unlockAchievement('speedster');
        const rewardRoll = Math.random();
        let reward: Reward;
        if (rewardRoll < 0.25) reward = { type: 'hint', label: '+1 Pista', icon: 'fa-lightbulb', color: 'text-cyan-400' };
        else if (rewardRoll < 0.50) reward = { type: 'cleaner', label: '+1 Limpiar', icon: 'fa-broom', color: 'text-rose-400' };
        else if (rewardRoll < 0.75) reward = { type: 'shield', label: '+1 Escudo', icon: 'fa-shield-alt', color: 'text-lime-400' };
        else reward = { type: 'life', label: '+1 Vida Extra', icon: 'fa-heart', color: 'text-rose-500' };
        setLastReward(reward);
        setGameState(prev => {
          const newPowerups = { ...prev.powerups };
          let newLives = prev.lives;
          if (reward.type === 'hint') newPowerups.hints += 1;
          else if (reward.type === 'cleaner') newPowerups.cleaners += 1;
          else if (reward.type === 'shield') newPowerups.shields += 1;
          else if (reward.type === 'life') newLives = Math.min(5, prev.lives + 1);
          return { ...prev, isPlaying: false, lives: newLives, powerups: newPowerups, stats: { ...prev.stats, levelsCompleted: prev.stats.levelsCompleted + 1 } };
        });
        unlockAchievement('first_steps');
        setTimeout(() => { if (gameState.mode === 'CHALLENGE') startRandomChallenge(true); else setView(GameView.LEVEL_SELECT); }, 3000); 
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      setKonamiProgress(prev => {
        const next = [...prev, key];
        const matchLength = next.length;
        const expected = KONAMI_CODE.slice(0, matchLength);
        const isMatch = next.every((k, idx) => {
           const targetKey = expected[idx];
           if (targetKey.length === 1) return k.toLowerCase() === targetKey.toLowerCase();
           return k === targetKey;
        });
        if (isMatch) {
          if (matchLength === KONAMI_CODE.length) {
            unlockAchievement('hidden_discoverer');
            setShowKonamiEffect(true);
            setView(GameView.EDITOR);
            return [];
          }
          return next;
        }
        return [];
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fixed: LevelCard defined as a proper React.FC to prevent TypeScript errors regarding the 'key' prop in list rendering.
  const LevelCard: React.FC<{ level: Level }> = ({ level }) => {
    const cats = Array.from(new Set(level.words.map(w => w.category))) as WordClass[];
    return (
      <div className={`rounded-2xl p-4 shadow-md border-b-2 transition-all hover:bg-indigo-50/50 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-indigo-50'}`}>
         <h3 className={`text-md font-black mb-2 truncate ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>{level.title}</h3>
         <div className="flex flex-wrap gap-1.5">
            {cats.map(cat => (
              <button 
                key={cat} onClick={() => startGame(level, cat, 'PRACTICE', true)}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm active:scale-95 ${showKonamiEffect ? 'bg-slate-700 hover:bg-indigo-600 text-indigo-300 hover:text-white' : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600'}`}
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
    return (
      <div className={`w-full rounded-3xl overflow-hidden transition-all duration-300 border-4 ${isExpanded ? `bg-white shadow-xl ${showKonamiEffect ? 'border-indigo-800 bg-slate-900' : 'border-indigo-400'}` : `bg-white/10 border-transparent hover:bg-white/20`}`}>
        <button onClick={() => setExpandedCategory(isExpanded ? null : id)} className={`w-full flex items-center justify-between p-6 md:p-8 text-left transition-colors ${isExpanded ? (showKonamiEffect ? 'text-white' : 'text-indigo-900') : 'text-white'}`}>
          <div className="flex items-center gap-6">
            <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-3xl md:text-5xl shadow-lg transition-transform ${isExpanded ? 'scale-110' : ''} ${color} text-white`}>
              <i className={`fas ${icon}`}></i>
            </div>
            <div>
              <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter leading-none">{title}</h3>
              <p className={`text-xs md:text-sm font-bold opacity-70 mt-1 ${isExpanded ? 'opacity-50' : ''}`}>{levels.length} textos disponibles</p>
            </div>
          </div>
          <i className={`fas fa-chevron-down text-2xl md:text-4xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
        </button>
        {isExpanded && (
          <div className="p-6 pt-0 animate-in slide-in-from-top duration-300">
            {levels.length === 0 ? <div className="text-center py-10 opacity-40 italic font-bold">No hay textos aún.</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {levels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-2 md:p-4 transition-all duration-1000 ${showKonamiEffect ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 konami-active konami-unlock-flash' : 'bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500'}`}>
      {lastUnlocked && (
        <div className="fixed top-8 right-8 z-[100] bg-white p-4 rounded-2xl shadow-2xl border-4 border-yellow-400 animate-in slide-in-from-right duration-500 flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center text-indigo-900 text-xl"><i className={`fas ${lastUnlocked.icon}`}></i></div>
          <div><span className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest text-nowrap">¡Logro!</span><span className="block text-lg font-black text-indigo-900 text-nowrap">{lastUnlocked.title}</span></div>
        </div>
      )}
      {view === GameView.MENU && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700 w-full max-w-4xl text-center">
          <div className="relative mb-8 md:mb-12 floating">
            <h1 className="text-6xl md:text-9xl font-black text-white italic drop-shadow-[0_15px_15px_rgba(0,0,0,0.3)] tracking-tighter select-none">GRAMMA<span className="text-yellow-300">CAT</span></h1>
            <div className={`absolute -top-12 -right-12 text-6xl text-white rotate-12 transition-opacity ${showKonamiEffect ? 'opacity-60 text-purple-400' : 'opacity-20 hidden md:block'}`}><i className="fas fa-cat"></i></div>
          </div>
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            <button onClick={() => setView(GameView.LEVEL_SELECT)} className={`group relative w-full md:w-72 h-40 md:h-72 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <i className="fas fa-graduation-cap text-5xl md:text-7xl text-indigo-500 mb-2 md:mb-4 group-hover:rotate-12 transition-transform"></i>
              <span className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>APRENDER</span>
            </button>
            <button onClick={() => startRandomChallenge(false)} className={`group relative w-full md:w-72 h-40 md:h-72 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-purple-900 border-purple-950' : 'bg-yellow-400 border-yellow-600'}`}>
              <i className={`fas fa-fire text-5xl md:text-7xl mb-2 md:mb-4 group-hover:scale-125 transition-transform animate-pulse ${showKonamiEffect ? 'text-yellow-400' : 'text-indigo-900'}`}></i>
              <span className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>RETO</span>
            </button>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <button onClick={() => setView(GameView.LEADERBOARD)} className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 rounded-2xl font-black border-2 border-yellow-500 shadow-lg text-sm"><i className="fas fa-list-ol mr-2"></i> RANKING</button>
            <button onClick={() => setView(GameView.ACHIEVEMENTS)} className="px-6 py-3 bg-white/20 hover:bg-white/40 text-white rounded-2xl font-black border-2 border-white/30 text-sm"><i className="fas fa-trophy mr-2"></i> LOGROS</button>
          </div>
        </div>
      )}
      {view === GameView.LEVEL_SELECT && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in slide-in-from-bottom duration-500 overflow-y-auto max-h-[95vh] custom-scrollbar p-4 md:p-6">
          <div className="w-full flex justify-between items-center mb-8 md:mb-12 sticky top-0 bg-transparent z-10 backdrop-blur-sm py-2">
            <button onClick={() => setView(GameView.MENU)} className="p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-all shadow-lg"><i className="fas fa-arrow-left text-xl md:text-2xl"></i></button>
            <h2 className="text-3xl md:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-md text-center">ELÍGE TU DESAFÍO</h2>
            <div className="w-10"></div>
          </div>
          <div className="flex flex-col gap-6 w-full pb-10">
            <AccordionSection id="Tutorial" title="Tutorial" icon="fa-chalkboard-teacher" color="bg-emerald-500" levels={INITIAL_LEVELS} />
            <AccordionSection id="Literatura en español" title="Literatura en español" icon="fa-feather-alt" color="bg-amber-500" levels={LITERARY_ES_LEVELS} />
            <AccordionSection id="Literatura universal" title="Literatura universal" icon="fa-globe-americas" color="bg-indigo-500" levels={LITERARY_UNIVERSAL_LEVELS} />
            <AccordionSection id="Tus Niveles" title="Tus Niveles" icon="fa-user-edit" color="bg-purple-500" levels={communityLevels} />
          </div>
        </div>
      )}
      {view === GameView.PLAYING && currentLevel && gameState.targetCategory && (
        <div className={`w-full h-full flex flex-col items-center justify-start md:justify-center animate-in zoom-in duration-500 overflow-hidden relative ${tutorialStep !== null ? 'pt-32 md:pt-40' : 'py-4'}`}>
          {tutorialStep !== null && (
            <TutorialSign 
              text={tutorialSteps[tutorialStep].text} 
              onNext={nextTutorialStep} 
              position={tutorialSteps[tutorialStep].position} 
              isMidnight={showKonamiEffect}
            />
          )}
          
          <GameHUD state={gameState} target={gameState.targetCategory} />
          <div className="w-full max-w-6xl relative flex-1 mx-2 flex flex-col items-center justify-center">
            <div className={`w-full h-full rounded-[3rem] md:rounded-[5rem] p-8 md:p-16 shadow-2xl border-b-8 flex flex-col justify-center overflow-hidden transition-all ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
              <div className={`relative z-10 flex flex-wrap justify-center items-center gap-x-2 md:gap-x-4 gap-y-3 md:gap-y-6 font-black leading-tight h-full content-center ${gameFontSize} ${showKonamiEffect ? 'text-white' : 'text-slate-800'}`}>
                {currentLevel.words.map((w) => (
                  <span key={w.id} onClick={() => handleWordClick(w)} className={`cursor-pointer px-3 md:px-5 py-1 md:py-2 rounded-2xl md:rounded-[2rem] transition-all duration-300 transform select-none ${foundWords.includes(w.id) ? 'bg-green-500 text-white shadow-[0_5px_0_rgb(22,163,74)] -rotate-2 scale-105 pointer-events-none' : ''} ${errorWords.includes(w.id) ? 'bg-rose-500 text-white shadow-lg rotate-2 scale-105 opacity-40 pointer-events-none' : ''} ${cleanedWords.includes(w.id) ? 'opacity-20 grayscale pointer-events-none scale-90' : ''} ${highlightedWords.includes(w.id) && !foundWords.includes(w.id) ? 'ring-4 md:ring-8 ring-yellow-400 animate-pulse shadow-yellow-200' : ''} ${!foundWords.includes(w.id) && !errorWords.includes(w.id) && !cleanedWords.includes(w.id) ? (showKonamiEffect ? 'hover:bg-slate-800 hover:text-cyan-400' : 'hover:bg-indigo-50 hover:text-indigo-600') : ''}`}>{w.text}</span>
                ))}
              </div>
            </div>
            {!gameState.isPlaying && !gameState.isGameOver && lastReward && (
              <div className="fixed inset-0 flex items-center justify-center z-[200] animate-in fade-in zoom-in duration-500 px-4 py-10 overflow-y-auto">
                <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm pointer-events-auto"></div>
                <div className="relative bg-white p-8 md:p-14 rounded-[3.5rem] md:rounded-[4.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.5)] border-[8px] md:border-[12px] border-indigo-500 text-center scale-100 transform rotate-[-1deg] max-w-full my-auto flex flex-col items-center pointer-events-auto">
                   <h2 className="text-3xl md:text-6xl font-black text-indigo-900 mb-6 italic tracking-tighter uppercase leading-none">¡GENIAL!</h2>
                   <div className="bg-indigo-50 p-6 md:p-10 rounded-[2.5rem] border-4 border-dashed border-indigo-200 mb-6 flex flex-col items-center min-w-[240px] md:min-w-[280px]">
                      <div className={`text-6xl md:text-9xl mb-4 animate-bounce ${lastReward.color}`}><i className={`fas ${lastReward.icon}`}></i></div>
                      <span className={`text-2xl md:text-5xl font-black italic tracking-tight ${lastReward.color} uppercase`}>{lastReward.label}</span>
                   </div>
                   <div className="flex flex-col items-center w-full">
                      <p className="text-slate-400 font-black animate-pulse text-[10px] md:text-sm uppercase tracking-widest">Siguiente reto en camino...</p>
                      <div className="mt-4 w-40 md:w-48 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 animate-[loading_3s_linear]"></div>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 md:mt-8 flex gap-3 md:gap-8 flex-wrap justify-center px-4 pb-4">
            {[ { type: 'hint' as const, icon: 'fa-lightbulb', label: 'PISTA', count: gameState.powerups.hints, color: 'cyan' }, { type: 'clean' as const, icon: 'fa-broom', label: 'LIMPIAR', count: gameState.powerups.cleaners, color: 'rose' }, { type: 'shield' as const, icon: 'fa-shield-alt', label: 'ESCUDO', count: gameState.powerups.shields, color: 'lime' }, ].map((p) => (
              <button key={p.type} onClick={() => p.type !== 'shield' ? usePowerup(p.type) : null} disabled={p.count <= 0} className={`group relative w-16 h-16 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[1.5rem] md:rounded-[2rem] shadow-lg border-b-4 md:border-b-8 transition-all active:scale-95 ${p.count > 0 ? (showKonamiEffect ? `bg-${p.color}-600 border-${p.color}-800` : `bg-${p.color}-300 border-${p.color}-500 hover:bg-${p.color}-200`) : 'bg-slate-700 border-slate-800 opacity-50'}`}><i className={`fas ${p.icon} text-xl md:text-4xl mb-0.5 md:mb-1 ${showKonamiEffect ? `text-${p.color}-200` : `text-${p.color}-800`}`}></i><span className={`text-[8px] md:text-xs font-black uppercase ${showKonamiEffect ? 'text-white' : `text-${p.color}-900`}`}>{p.label} ({p.count})</span></button>
            ))}
            <button onClick={() => setView(GameView.MENU)} className={`w-16 h-16 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[1.5rem] md:rounded-[2rem] shadow-lg border-b-4 md:border-b-8 transition-all active:scale-95 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}><i className="fas fa-home text-xl md:text-4xl text-indigo-400 mb-0.5 md:mb-1"></i><span className={`text-[8px] md:text-xs font-black uppercase ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>SALIR</span></button>
          </div>
        </div>
      )}
      {view === GameView.GAME_OVER && (
        <div className={`text-center p-8 md:p-16 rounded-[3rem] md:rounded-[4rem] shadow-2xl border-x-4 md:border-x-8 border-b-4 md:border-b-8 border-rose-500 animate-in zoom-in duration-300 w-full max-w-lg mx-4 ${showKonamiEffect ? 'bg-slate-900' : 'bg-white'}`}>
          <i className="fas fa-skull text-6xl md:text-8xl text-rose-500 mb-6 block"></i>
          <h2 className={`text-5xl md:text-7xl font-black italic tracking-tighter mb-4 ${showKonamiEffect ? 'text-white' : 'text-slate-900'}`}>GAME OVER</h2>
          <div className="mb-8 p-4 md:p-6 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 flex flex-col items-center">
            <span className="text-4xl md:text-6xl font-black text-indigo-600 mb-2">{gameState.score}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PUNTOS ACUMULADOS</span>
            {gameState.score > 0 && !scoreSaved && (
              <div className="w-full flex flex-col items-center space-y-4 animate-in slide-in-from-bottom duration-500 mt-6">
                <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value.substring(0, 15))} placeholder="Escribe tu nombre..." className="w-full p-3 rounded-xl border-2 border-indigo-200 outline-none focus:border-indigo-500 font-bold text-center" />
                <button onClick={handleSaveScore} disabled={!playerName.trim() || isSavingScore} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50">GUARDAR PUNTUACIÓN</button>
              </div>
            )}
            {scoreSaved && <div className="text-green-500 font-black flex items-center mt-4"><i className="fas fa-check-circle mr-2"></i> PUNTUACIÓN REGISTRADA</div>}
          </div>
          <button onClick={() => setView(GameView.MENU)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xl font-black shadow-lg transition-all active:scale-95">MENÚ PRINCIPAL</button>
        </div>
      )}
      {view === GameView.ACHIEVEMENTS && <AchievementsModal achievements={achievements} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.LEADERBOARD && <Leaderboard isMidnight={showKonamiEffect} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.EDITOR && <Editor onClose={() => setView(GameView.MENU)} onSave={(newLevel) => { setCommunityLevels(prev => [newLevel, ...prev]); setView(GameView.MENU); }} />}
    </div>
  );
};

export default App;