
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameView, GameState, WordClass, Level, WordData, Achievement, LeaderboardEntry } from './types';
import { INITIAL_LEVELS, LITERARY_LEVELS, KONAMI_CODE, INITIAL_ACHIEVEMENTS } from './constants';
import { GameHUD } from './components/GameHUD';
import { Editor } from './components/Editor';
import { AchievementsModal } from './components/AchievementsModal';
import { Leaderboard } from './components/Leaderboard';
import { fetchCommunityLevels, saveScore, debugLogs, addLog } from './services/supabaseService';

// Helper for pluralization
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

// Componente de Consola de Debug
const DebugConsole: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([...debugLogs]);

  useEffect(() => {
    const handleUpdate = () => setLogs([...debugLogs]);
    window.addEventListener('grammaticat-debug-update', handleUpdate);
    return () => window.removeEventListener('grammaticat-debug-update', handleUpdate);
  }, []);

  return (
    <div className="fixed bottom-20 right-4 z-[200] w-80 max-h-96 bg-black/90 text-green-400 font-mono text-[10px] p-4 rounded-2xl border-2 border-green-500/30 shadow-2xl flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-2 border-b border-green-500/20 pb-2">
        <span className="font-bold uppercase tracking-widest"><i className="fas fa-bug mr-2"></i>SISTEMA LOGS</span>
        <button onClick={onClose} className="hover:text-white"><i className="fas fa-times"></i></button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
        {logs.length === 0 ? <p className="opacity-40 italic">Esperando eventos...</p> : 
          logs.map((log, i) => <div key={i} className="leading-tight break-words">{log}</div>)
        }
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.MENU);
  const [showDebug, setShowDebug] = useState(false);
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedStats = localStorage.getItem('grammaticat_stats');
    const stats = savedStats ? JSON.parse(savedStats) : { nounsFound: 0, levelsCompleted: 0 };
    return {
      score: 0,
      lives: 3,
      time: 0,
      levelIndex: 0,
      isPlaying: false,
      isGameOver: false,
      targetCategory: null,
      mode: null,
      powerups: { hints: 2, shields: 1, cleaners: 1 },
      stats
    };
  });

  const [playerName, setPlayerName] = useState('');
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [levels, setLevels] = useState<Level[]>(INITIAL_LEVELS);
  const [literaryLevels] = useState<Level[]>(LITERARY_LEVELS);
  const [communityLevels, setCommunityLevels] = useState<Level[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
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

  // Sincronizar clase konami-active con el body para que el Editor lo detecte
  useEffect(() => {
    if (showKonamiEffect) {
      document.body.classList.add('konami-active');
    } else {
      document.body.classList.remove('konami-active');
    }
  }, [showKonamiEffect]);

  const gameFontSize = useMemo(() => {
    if (!currentLevel) return 'text-3xl md:text-5xl';
    const count = currentLevel.words.length;
    if (count > 40) return 'text-xl md:text-3xl';
    if (count > 25) return 'text-2xl md:text-4xl';
    return 'text-3xl md:text-5xl';
  }, [currentLevel]);

  useEffect(() => {
    localStorage.setItem('grammaticat_stats', JSON.stringify(gameState.stats));
  }, [gameState.stats]);

  useEffect(() => {
    localStorage.setItem('grammaticat_achievements', JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    if (view === GameView.LEVEL_SELECT || view === GameView.MENU) {
      const loadCommunity = async () => {
        setIsLoadingCommunity(true);
        try {
          const onlineLevels = await fetchCommunityLevels();
          setCommunityLevels(onlineLevels);
        } catch (e) {
          console.error("Failed to load community levels", e);
        } finally {
          setIsLoadingCommunity(false);
        }
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
    setCurrentLevel(level);
    setGameState(prev => ({
      ...prev,
      lives: resetSession || mode === 'PRACTICE' ? 3 : prev.lives,
      score: resetSession ? 0 : prev.score,
      time: level.timeLimit || 30,
      targetCategory: category,
      mode,
      isPlaying: true,
      isGameOver: false,
    }));
    setFoundWords([]);
    setErrorWords([]);
    setHighlightedWords([]);
    setCleanedWords([]);
    setLastReward(null);
    setScoreSaved(false);
    setView(GameView.PLAYING);
  };

  const startRandomChallenge = useCallback(async (isTransition: boolean = false) => {
    const allAvailable = [...levels, ...literaryLevels, ...communityLevels];
    if (allAvailable.length === 0) return;

    const randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
    const categories = Array.from(new Set(randomLevel.words.map(w => w.category)));
    const randomCategory = (categories[Math.floor(Math.random() * categories.length)] as WordClass) || WordClass.SUSTANTIVO;
    
    startGame(randomLevel, randomCategory, 'CHALLENGE', !isTransition);
  }, [levels, literaryLevels, communityLevels]);

  const handleSaveScore = async () => {
    if (!playerName.trim()) return;
    setIsSavingScore(true);
    const { error } = await saveScore({ name: playerName, score: gameState.score });
    setIsSavingScore(false);
    if (!error) {
      setScoreSaved(true);
    }
  };

  const usePowerup = (type: 'hint' | 'clean' | 'shield') => {
    if (!gameState.isPlaying || !currentLevel || !gameState.targetCategory) return;

    if (type === 'hint' && gameState.powerups.hints > 0) {
      const remainingTargetWords = currentLevel.words.filter(
        w => w.category === gameState.targetCategory && !foundWords.includes(w.id) && !highlightedWords.includes(w.id)
      );
      if (remainingTargetWords.length > 0) {
        const randomWord = remainingTargetWords[Math.floor(Math.random() * remainingTargetWords.length)];
        setHighlightedWords(prev => [...prev, randomWord.id]);
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, hints: prev.powerups.hints - 1 } }));
      }
    } else if (type === 'clean' && gameState.powerups.cleaners > 0) {
      const incorrectWords = currentLevel.words.filter(
        w => w.category !== gameState.targetCategory && !cleanedWords.includes(w.id)
      );
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
          if (prev.time <= 1) {
            handleGameOver();
            return { ...prev, time: 0 };
          }
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
      setGameState(prev => ({ 
        ...prev, 
        score: prev.score + 10,
        stats: { ...prev.stats, nounsFound: prev.stats.nounsFound + 1 }
      }));

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

          return { 
            ...prev, 
            isPlaying: false, 
            lives: newLives,
            powerups: newPowerups,
            stats: { ...prev.stats, levelsCompleted: prev.stats.levelsCompleted + 1 }
          };
        });
        
        unlockAchievement('first_steps');
        setTimeout(() => {
          if (gameState.mode === 'CHALLENGE') {
            startRandomChallenge(true); 
          } else {
            setView(GameView.LEVEL_SELECT);
          }
        }, 3000); 
      }
    } else {
      setErrorWords(prev => [...prev, word.id]);

      if (gameState.mode === 'PRACTICE') {
        setGameState(prev => ({ ...prev, time: Math.max(1, prev.time - 5) }));
      } else {
        if (gameState.powerups.shields > 0) {
          setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, shields: prev.powerups.shields - 1 } }));
        } else {
          setGameState(prev => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
              handleGameOver();
              return { ...prev, lives: 0, time: 0 };
            }
            return { ...prev, lives: newLives, time: Math.max(1, prev.time - 5) };
          });
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si se está escribiendo en un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      setKonamiProgress(prev => {
        const next = [...prev, e.key];
        const matchLength = next.length;
        
        // Comparación insensible a mayúsculas para 'a' y 'b'
        const expected = KONAMI_CODE.slice(0, matchLength);
        const isMatch = next.every((key, idx) => {
           const exp = expected[idx];
           if (exp.length === 1) return key.toLowerCase() === exp.toLowerCase();
           return key === exp;
        });
        
        if (isMatch) {
          addLog(`Konami: Tecla correcta (${matchLength}/${KONAMI_CODE.length})`);
          if (matchLength === KONAMI_CODE.length) {
            addLog("¡CÓDIGO KONAMI ACTIVADO!");
            unlockAchievement('hidden_discoverer');
            setShowKonamiEffect(true);
            setView(GameView.EDITOR);
            return [];
          }
          return next;
        }
        
        if (next.length > 0) addLog("Konami: Secuencia rota. Reiniciando...");
        return [];
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const LevelCard = ({ level }: { level: Level }) => {
    const cats = Array.from(new Set(level.words.map(w => w.category))) as WordClass[];
    return (
      <div className={`rounded-3xl p-6 shadow-xl border-b-4 transition-all hover:-translate-y-1 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-indigo-100'}`}>
         <h3 className={`text-xl font-black mb-2 truncate ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>{level.title}</h3>
         <p className="text-slate-400 text-xs line-clamp-2 mb-4 italic leading-relaxed">"{level.text}"</p>
         <div className="flex flex-wrap gap-2">
            {cats.map(cat => (
              <button 
                key={cat} 
                onClick={() => startGame(level, cat, 'PRACTICE', true)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 ${showKonamiEffect ? 'bg-slate-700 hover:bg-indigo-600 text-indigo-300 hover:text-white' : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600'}`}
              >
                {getPluralCategory(cat)}
              </button>
            ))}
         </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-2 md:p-4 transition-all duration-1000 ${showKonamiEffect ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 konami-active konami-unlock-flash' : 'bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500'}`}>
      
      {/* Botón flotante Debug */}
      <button 
        onClick={() => setShowDebug(!showDebug)}
        className="fixed bottom-4 right-4 z-[200] w-12 h-12 bg-black/80 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-black transition-all border border-white/10"
      >
        <i className={`fas fa-bug ${showDebug ? 'text-green-400' : 'opacity-40'}`}></i>
      </button>

      {showDebug && <DebugConsole onClose={() => setShowDebug(false)} />}

      {lastUnlocked && (
        <div className="fixed top-8 right-8 z-[100] bg-white p-4 rounded-2xl shadow-2xl border-4 border-yellow-400 animate-in slide-in-from-right duration-500 flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center text-indigo-900 text-xl"><i className={`fas ${lastUnlocked.icon}`}></i></div>
          <div><span className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest text-nowrap">¡Logro!</span><span className="block text-lg font-black text-indigo-900 text-nowrap">{lastUnlocked.title}</span></div>
        </div>
      )}

      {view === GameView.MENU && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700 w-full max-w-4xl">
          <div className="relative mb-8 md:mb-12 floating text-center">
            <h1 className="text-6xl md:text-9xl font-black text-white italic drop-shadow-[0_15px_15px_rgba(0,0,0,0.3)] tracking-tighter select-none">
              GRAMMA<span className="text-yellow-300">CAT</span>
            </h1>
            <div className={`absolute -top-12 -right-12 text-6xl text-white rotate-12 transition-opacity ${showKonamiEffect ? 'opacity-60 text-purple-400' : 'opacity-20 hidden md:block'}`}><i className="fas fa-cat"></i></div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            <button 
              onClick={() => setView(GameView.LEVEL_SELECT)}
              className={`group relative w-full md:w-72 h-40 md:h-72 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}
            >
              <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <i className="fas fa-graduation-cap text-5xl md:text-7xl text-indigo-500 mb-2 md:mb-4 group-hover:rotate-12 transition-transform"></i>
              <span className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>PRÁCTICA</span>
            </button>

            <button 
              onClick={() => startRandomChallenge(false)}
              className={`group relative w-full md:w-72 h-40 md:h-72 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-8 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden ${showKonamiEffect ? 'bg-purple-900 border-purple-950 shadow-purple-900/40' : 'bg-yellow-400 border-yellow-600'}`}
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <i className={`fas fa-fire text-5xl md:text-7xl mb-2 md:mb-4 group-hover:scale-125 transition-transform animate-pulse ${showKonamiEffect ? 'text-yellow-400' : 'text-indigo-900'}`}></i>
              <span className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>RETO</span>
            </button>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <button onClick={() => setView(GameView.LEADERBOARD)} className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 rounded-2xl font-black border-2 border-yellow-500 transition-all flex items-center shadow-lg text-sm">
              <i className="fas fa-list-ol mr-2"></i> RANKING
            </button>
            <button onClick={() => setView(GameView.ACHIEVEMENTS)} className="px-6 py-3 bg-white/20 hover:bg-white/40 text-white rounded-2xl font-black border-2 border-white/30 transition-all flex items-center text-sm">
              <i className="fas fa-trophy mr-2"></i> LOGROS
            </button>
          </div>
        </div>
      )}

      {view === GameView.LEVEL_SELECT && (
        <div className="w-full max-w-6xl flex flex-col items-center animate-in slide-in-from-right duration-500 overflow-y-auto max-h-[95vh] custom-scrollbar p-2 md:p-6">
          <div className="w-full flex justify-between items-center mb-6 md:mb-10 sticky top-0 bg-transparent z-10 backdrop-blur-sm py-2 md:py-4 px-4">
            <button onClick={() => setView(GameView.MENU)} className="p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-all shadow-lg"><i className="fas fa-arrow-left text-xl md:text-2xl"></i></button>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">PRÁCTICA</h2>
            <div className="w-10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
            <div className="space-y-6 lg:col-span-1">
               <h3 className={`text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center drop-shadow-md px-4 ${showKonamiEffect ? 'text-cyan-400' : 'text-yellow-300'}`}>
                 <i className="fas fa-graduation-cap mr-3"></i> Entrenamiento
               </h3>
               <div className="px-4 space-y-4">
                 {levels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
               </div>
               
               <h3 className={`text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center drop-shadow-md pt-8 px-4 ${showKonamiEffect ? 'text-purple-400' : 'text-cyan-300'}`}>
                 <i className="fas fa-cloud mr-3"></i> Comunidad
               </h3>
               <div className="px-4 space-y-4 pb-8">
                 {isLoadingCommunity ? <div className="text-white text-center py-10 animate-pulse"><i className="fas fa-spinner fa-spin text-4xl mb-2 block"></i> Cargando...</div> : (
                   communityLevels.length > 0 ? communityLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />) : 
                   <p className="text-white/40 italic text-center py-10 bg-black/10 rounded-3xl border-2 border-dashed border-white/10">No hay textos online.</p>
                 )}
               </div>
            </div>

            <div className="space-y-6 lg:col-span-2">
               <h3 className={`text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center drop-shadow-md px-4 ${showKonamiEffect ? 'text-rose-400' : 'text-white'}`}>
                 <i className="fas fa-feather-alt mr-3"></i> Literatura Clásica
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 px-4 pb-8">
                {literaryLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
               </div>
            </div>
          </div>
        </div>
      )}

      {view === GameView.PLAYING && currentLevel && gameState.targetCategory && (
        <div className="w-full h-full flex flex-col items-center justify-start md:justify-center animate-in zoom-in duration-500 overflow-hidden py-4">
          <GameHUD state={gameState} target={gameState.targetCategory} />
          
          <div className={`w-full max-w-6xl rounded-[3rem] md:rounded-[5rem] p-6 md:p-12 shadow-2xl border-b-8 flex flex-col justify-center relative flex-1 overflow-hidden mx-2 ${showKonamiEffect ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
            <div className={`relative z-10 flex flex-wrap justify-center items-center gap-x-2 md:gap-x-4 gap-y-3 md:gap-y-6 font-black leading-tight h-full content-center ${gameFontSize} ${showKonamiEffect ? 'text-white' : 'text-slate-800'}`}>
              {currentLevel.words.map((w) => (
                <span 
                  key={w.id} 
                  onClick={() => handleWordClick(w)} 
                  className={`cursor-pointer px-3 md:px-5 py-1 md:py-2 rounded-2xl md:rounded-[2rem] transition-all duration-300 transform select-none
                    ${foundWords.includes(w.id) ? 'bg-green-500 text-white shadow-[0_5px_0_rgb(22,163,74)] -rotate-2 scale-105 pointer-events-none' : ''}
                    ${errorWords.includes(w.id) ? 'bg-rose-500 text-white shadow-lg rotate-2 scale-105 opacity-40 pointer-events-none' : ''}
                    ${cleanedWords.includes(w.id) ? 'opacity-20 grayscale pointer-events-none scale-90' : ''}
                    ${highlightedWords.includes(w.id) && !foundWords.includes(w.id) ? 'ring-4 md:ring-8 ring-yellow-400 animate-pulse shadow-yellow-200' : ''}
                    ${!foundWords.includes(w.id) && !errorWords.includes(w.id) && !cleanedWords.includes(w.id) ? (showKonamiEffect ? 'hover:bg-slate-800 hover:text-cyan-400' : 'hover:bg-indigo-50 hover:text-indigo-600') : ''}
                  `}
                >
                  {w.text}
                </span>
              ))}
            </div>

            {!gameState.isPlaying && !gameState.isGameOver && lastReward && (
              <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-500 rounded-[3rem] md:rounded-[5rem]">
                <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-b-[8px] md:border-b-[12px] border-green-500 text-center scale-100 md:scale-110 transform md:rotate-[-2deg] mx-4">
                   <h2 className="text-2xl md:text-5xl font-black text-indigo-900 mb-4 md:mb-6 italic tracking-tighter uppercase">¡NIVEL COMPLETADO!</h2>
                   <div className="bg-indigo-50 p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border-4 border-dashed border-indigo-200 mb-4 flex flex-col items-center">
                      <div className={`text-4xl md:text-7xl mb-2 md:mb-4 animate-bounce ${lastReward.color}`}>
                        <i className={`fas ${lastReward.icon}`}></i>
                      </div>
                      <span className={`text-xl md:text-4xl font-black italic tracking-tight ${lastReward.color}`}>
                        {lastReward.label}
                      </span>
                   </div>
                   <p className="text-slate-400 font-bold animate-pulse text-sm">Cargando siguiente reto...</p>
                </div>
              </div>
            )}
          </div>

          {/* Powerups compactos en movil */}
          <div className="mt-4 md:mt-8 flex gap-3 md:gap-8 flex-wrap justify-center px-4 pb-4">
            {[
              { type: 'hint' as const, icon: 'fa-lightbulb', label: 'PISTA', count: gameState.powerups.hints, color: 'cyan' },
              { type: 'clean' as const, icon: 'fa-broom', label: 'LIMPIAR', count: gameState.powerups.cleaners, color: 'rose' },
              { type: 'shield' as const, icon: 'fa-shield-alt', label: 'ESCUDO', count: gameState.powerups.shields, color: 'lime' },
            ].map((p) => (
              <button 
                key={p.type}
                onClick={() => p.type !== 'shield' ? usePowerup(p.type) : null}
                disabled={p.count <= 0}
                className={`group relative w-16 h-16 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[1.5rem] md:rounded-[2rem] shadow-lg border-b-4 md:border-b-8 transition-all active:scale-95
                  ${p.count > 0 ? (showKonamiEffect ? `bg-${p.color}-600 border-${p.color}-800` : `bg-${p.color}-300 border-${p.color}-500 hover:bg-${p.color}-200`) : 'bg-slate-700 border-slate-800 opacity-50'}
                `}
              >
                <i className={`fas ${p.icon} text-xl md:text-4xl mb-0.5 md:mb-1 ${showKonamiEffect ? `text-${p.color}-200` : `text-${p.color}-800`}`}></i>
                <span className={`text-[8px] md:text-xs font-black uppercase ${showKonamiEffect ? 'text-white' : `text-${p.color}-900`}`}>{p.label} ({p.count})</span>
              </button>
            ))}
            
            <button 
              onClick={() => setView(GameView.MENU)}
              className={`w-16 h-16 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[1.5rem] md:rounded-[2rem] shadow-lg border-b-4 md:border-b-8 transition-all active:scale-95 ${showKonamiEffect ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
            >
              <i className="fas fa-home text-xl md:text-4xl text-indigo-400 mb-0.5 md:mb-1"></i>
              <span className={`text-[8px] md:text-xs font-black uppercase ${showKonamiEffect ? 'text-white' : 'text-indigo-900'}`}>SALIR</span>
            </button>
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
                <input 
                  type="text" 
                  value={playerName} 
                  onChange={(e) => setPlayerName(e.target.value.substring(0, 15))} 
                  placeholder="Escribe tu nombre..."
                  className="w-full p-3 rounded-xl border-2 border-indigo-200 outline-none focus:border-indigo-500 font-bold text-center"
                />
                <button 
                  onClick={handleSaveScore}
                  disabled={!playerName.trim() || isSavingScore}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingScore ? <i className="fas fa-spinner fa-spin mr-2"></i> : 'GUARDAR PUNTUACIÓN'}
                </button>
              </div>
            )}
            {scoreSaved && (
              <div className="text-green-500 font-black flex items-center mt-4">
                <i className="fas fa-check-circle mr-2"></i> PUNTUACIÓN REGISTRADA
              </div>
            )}
          </div>
          <button onClick={() => setView(GameView.MENU)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xl font-black shadow-lg transition-all active:scale-95">MENÚ PRINCIPAL</button>
        </div>
      )}

      {view === GameView.ACHIEVEMENTS && <AchievementsModal achievements={achievements} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.LEADERBOARD && <Leaderboard isMidnight={showKonamiEffect} onClose={() => setView(GameView.MENU)} />}
      {view === GameView.EDITOR && (
        <Editor onClose={() => setView(GameView.MENU)} onSave={(newLevel) => {
          setLevels(prev => [newLevel, ...prev]);
          setView(GameView.MENU);
        }} />
      )}
    </div>
  );
};

export default App;
