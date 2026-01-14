import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameView, GameState, WordClass, Level, WordData, Achievement } from './types';
import { INITIAL_LEVELS, LITERARY_LEVELS, KONAMI_CODE, INITIAL_ACHIEVEMENTS } from './constants';
import { GameHUD } from './components/GameHUD';
import { Editor } from './components/Editor';
import { AchievementsModal } from './components/AchievementsModal';
import { fetchCommunityLevels } from './services/supabaseService';

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

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.MENU);
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

  const startGame = (level: Level, category: WordClass, mode: 'PRACTICE' | 'CHALLENGE') => {
    setCurrentLevel(level);
    setGameState(prev => ({
      ...prev,
      time: level.timeLimit || 30,
      targetCategory: category,
      mode,
      isPlaying: true,
      isGameOver: false,
      score: mode === 'CHALLENGE' ? prev.score : 0, // Keep score in challenge series
    }));
    setFoundWords([]);
    setErrorWords([]);
    setHighlightedWords([]);
    setCleanedWords([]);
    setLastReward(null);
    setView(GameView.PLAYING);
  };

  const startRandomChallenge = useCallback(async () => {
    const allAvailable = [...levels, ...literaryLevels, ...communityLevels];
    if (allAvailable.length === 0) return;

    const randomLevel = allAvailable[Math.floor(Math.random() * allAvailable.length)];
    const categories = Array.from(new Set(randomLevel.words.map(w => w.category)));
    const randomCategory = (categories[Math.floor(Math.random() * categories.length)] as WordClass) || WordClass.SUSTANTIVO;
    
    startGame(randomLevel, randomCategory, 'CHALLENGE');
  }, [levels, literaryLevels, communityLevels]);

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

      // Check if 100 words achievement
      if (gameState.stats.nounsFound + 1 >= 100) unlockAchievement('noun_expert');

      const targetWordsCount = currentLevel.words.filter(w => w.category === gameState.targetCategory).length;
      if (newFound.length === targetWordsCount) {
        // Speedster achievement
        if (gameState.time > (currentLevel.timeLimit || 30) / 2) unlockAchievement('speedster');
        
        const rewardRoll = Math.random();
        let reward: Reward;
        
        if (rewardRoll < 0.25) reward = { type: 'hint', label: '+1 Pista', icon: 'fa-lightbulb', color: 'text-cyan-500' };
        else if (rewardRoll < 0.50) reward = { type: 'cleaner', label: '+1 Limpiar', icon: 'fa-broom', color: 'text-rose-500' };
        else if (rewardRoll < 0.75) reward = { type: 'shield', label: '+1 Escudo', icon: 'fa-shield-alt', color: 'text-lime-500' };
        else reward = { type: 'life', label: '+1 Vida Extra', icon: 'fa-heart', color: 'text-rose-600' };

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
            startRandomChallenge();
          } else {
            setView(GameView.LEVEL_SELECT);
          }
        }, 3000); 
      }
    } else {
      // Penalty: lose time
      if (gameState.powerups.shields > 0) {
        setGameState(prev => ({ ...prev, powerups: { ...prev.powerups, shields: prev.powerups.shields - 1 } }));
        setErrorWords(prev => [...prev, word.id]);
      } else {
        setErrorWords(prev => [...prev, word.id]);
        setGameState(prev => {
          const newLives = prev.lives - 1;
          if (newLives <= 0) {
            handleGameOver();
            return { ...prev, lives: 0, time: 0 };
          }
          return { ...prev, lives: newLives, time: Math.max(0, prev.time - 5) };
        });
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKonamiProgress(prev => {
        const next = [...prev, e.key];
        const matchLength = next.length;
        const expected = KONAMI_CODE.slice(0, matchLength);
        
        if (JSON.stringify(next) === JSON.stringify(expected)) {
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

  const LevelCard = ({ level }: { level: Level }) => {
    const cats = Array.from(new Set(level.words.map(w => w.category))) as WordClass[];
    return (
      <div className="bg-white rounded-3xl p-6 shadow-xl border-b-4 border-indigo-100 hover:shadow-2xl transition-all hover:-translate-y-1">
         <h3 className="text-xl font-black text-indigo-900 mb-2 truncate">{level.title}</h3>
         <p className="text-slate-400 text-xs line-clamp-2 mb-4 italic leading-relaxed">"{level.text}"</p>
         <div className="flex flex-wrap gap-2">
            {cats.map(cat => (
              <button 
                key={cat} 
                onClick={() => startGame(level, cat, 'PRACTICE')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95"
              >
                {getPluralCategory(cat)}
              </button>
            ))}
         </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500 overflow-hidden transition-all duration-1000 ${showKonamiEffect ? 'konami-active' : ''}`}>
      
      {lastUnlocked && (
        <div className="fixed top-8 right-8 z-[100] bg-white p-4 rounded-2xl shadow-2xl border-4 border-yellow-400 animate-in slide-in-from-right duration-500 flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center text-indigo-900 text-xl"><i className={`fas ${lastUnlocked.icon}`}></i></div>
          <div><span className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest">¡Logro!</span><span className="block text-lg font-black text-indigo-900">{lastUnlocked.title}</span></div>
        </div>
      )}

      {view === GameView.MENU && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
          <div className="relative mb-12 floating">
            <h1 className="text-7xl md:text-9xl font-black text-white italic drop-shadow-[0_15px_15px_rgba(0,0,0,0.3)] tracking-tighter select-none">
              GRAMMA<span className="text-yellow-300">CAT</span>
            </h1>
            <div className="absolute -top-12 -right-12 text-6xl text-white opacity-20 rotate-12"><i className="fas fa-cat"></i></div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-10">
            <button 
              onClick={() => setView(GameView.LEVEL_SELECT)}
              className="group relative w-72 h-72 bg-white rounded-[3rem] shadow-2xl border-b-8 border-indigo-200 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <i className="fas fa-graduation-cap text-7xl text-indigo-500 mb-4 group-hover:rotate-12 transition-transform"></i>
              <span className="text-3xl font-black text-indigo-900 uppercase italic tracking-tighter">PRÁCTICA</span>
              <p className="text-xs font-bold text-slate-400 mt-2">Explora y elige textos</p>
            </button>

            <button 
              onClick={startRandomChallenge}
              className="group relative w-72 h-72 bg-yellow-400 rounded-[3rem] shadow-2xl border-b-8 border-yellow-600 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <i className="fas fa-fire text-7xl text-indigo-900 mb-4 group-hover:scale-125 transition-transform animate-pulse"></i>
              <span className="text-3xl font-black text-indigo-900 uppercase italic tracking-tighter">RETO</span>
              <p className="text-xs font-bold text-indigo-800/60 mt-2">¡Partida rápida aleatoria!</p>
            </button>
          </div>

          <div className="mt-16 flex gap-4">
            <button onClick={() => setView(GameView.ACHIEVEMENTS)} className="px-8 py-3 bg-white/20 hover:bg-white/40 text-white rounded-2xl font-black border-2 border-white/30 transition-all flex items-center">
              <i className="fas fa-trophy mr-3"></i> LOGROS
            </button>
            <div className="text-white/40 text-xs flex items-center italic">
              <i className="fas fa-keyboard mr-2"></i> Konami Code para Editor
            </div>
          </div>
        </div>
      )}

      {view === GameView.LEVEL_SELECT && (
        <div className="w-full max-w-6xl flex flex-col items-center animate-in slide-in-from-right duration-500 overflow-y-auto max-h-[90vh] custom-scrollbar p-6">
          <div className="w-full flex justify-between items-center mb-10 sticky top-0 bg-transparent z-10 backdrop-blur-sm py-4">
            <button onClick={() => setView(GameView.MENU)} className="p-4 bg-white/20 text-white rounded-full hover:bg-white/40 transition-all shadow-lg"><i className="fas fa-arrow-left text-2xl"></i></button>
            <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">MODO PRÁCTICA</h2>
            <div className="w-12"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            <div className="space-y-6 lg:col-span-1">
               <h3 className="text-2xl font-black text-yellow-300 uppercase tracking-tighter flex items-center drop-shadow-md">
                 <i className="fas fa-graduation-cap mr-3"></i> Entrenamiento
               </h3>
               {levels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
               
               <h3 className="text-2xl font-black text-cyan-300 uppercase tracking-tighter flex items-center drop-shadow-md pt-8">
                 <i className="fas fa-cloud mr-3"></i> Comunidad
               </h3>
               {isLoadingCommunity ? <div className="text-white text-center py-10 animate-pulse"><i className="fas fa-spinner fa-spin text-4xl mb-2 block"></i> Cargando...</div> : (
                 communityLevels.length > 0 ? communityLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />) : 
                 <p className="text-white/40 italic text-center py-10 bg-black/10 rounded-3xl border-2 border-dashed border-white/10">No hay textos online.</p>
               )}
            </div>

            <div className="space-y-6 lg:col-span-2">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center drop-shadow-md">
                 <i className="fas fa-feather-alt mr-3 text-rose-300"></i> Literatura Clásica
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {literaryLevels.map(lvl => <LevelCard key={lvl.id} level={lvl} />)}
               </div>
            </div>
          </div>
        </div>
      )}

      {view === GameView.PLAYING && currentLevel && gameState.targetCategory && (
        <div className="w-full flex flex-col items-center justify-center animate-in zoom-in duration-500">
          <GameHUD state={gameState} target={gameState.targetCategory} />
          
          <div className="w-full max-w-5xl bg-white rounded-[5rem] p-8 md:p-20 shadow-2xl border-b-8 border-indigo-200 min-h-[450px] flex flex-col justify-center relative">
            <div className="relative z-10 flex flex-wrap justify-center items-center gap-x-4 md:gap-x-6 gap-y-6 md:gap-y-8 text-3xl md:text-5xl font-black text-slate-800 leading-normal">
              {currentLevel.words.map((w) => (
                <span 
                  key={w.id} 
                  onClick={() => handleWordClick(w)} 
                  className={`cursor-pointer px-4 md:px-6 py-1 md:py-2 rounded-[2rem] transition-all duration-300 transform select-none
                    ${foundWords.includes(w.id) ? 'bg-green-500 text-white shadow-[0_8px_0_rgb(22,163,74)] -rotate-3 scale-110 pointer-events-none' : ''}
                    ${errorWords.includes(w.id) ? 'bg-rose-500 text-white shadow-lg rotate-3 scale-110 opacity-40 pointer-events-none' : ''}
                    ${cleanedWords.includes(w.id) ? 'opacity-20 grayscale pointer-events-none scale-90' : ''}
                    ${highlightedWords.includes(w.id) && !foundWords.includes(w.id) ? 'ring-8 ring-yellow-400 animate-pulse shadow-yellow-200' : ''}
                    ${!foundWords.includes(w.id) && !errorWords.includes(w.id) && !cleanedWords.includes(w.id) ? 'hover:bg-indigo-50 hover:text-indigo-600' : ''}
                  `}
                >
                  {w.text}
                </span>
              ))}
            </div>

            {!gameState.isPlaying && !gameState.isGameOver && lastReward && (
              <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-500 rounded-[5rem]">
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-b-[12px] border-green-500 text-center scale-110 transform rotate-[-2deg]">
                   <h2 className="text-4xl md:text-6xl font-black text-indigo-900 mb-6 italic tracking-tighter uppercase">¡NIVEL COMPLETADO!</h2>
                   
                   <div className="bg-indigo-50 p-6 md:p-8 rounded-[2.5rem] border-4 border-dashed border-indigo-200 mb-6 flex flex-col items-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-300 to-transparent opacity-50"></div>
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Recompensa Obtenida</span>
                      
                      <div className={`text-5xl md:text-7xl mb-4 animate-bounce ${lastReward.color}`}>
                        <i className={`fas ${lastReward.icon}`}></i>
                      </div>
                      
                      <span className={`text-2xl md:text-4xl font-black italic tracking-tight ${lastReward.color}`}>
                        {lastReward.label}
                      </span>
                   </div>
                   
                   <p className="text-slate-400 font-bold animate-pulse">Preparando siguiente desafío...</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 flex gap-4 md:gap-8 flex-wrap justify-center">
            <button 
              onClick={() => usePowerup('hint')}
              disabled={gameState.powerups.hints <= 0}
              className={`group relative w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[2rem] shadow-xl border-b-8 transition-all active:scale-95
                ${gameState.powerups.hints > 0 ? 'bg-cyan-300 border-cyan-500 hover:bg-cyan-200' : 'bg-slate-200 border-slate-300 opacity-50'}
              `}
            >
              <i className="fas fa-lightbulb text-3xl md:text-4xl text-cyan-800 mb-1"></i>
              <span className="text-[10px] md:text-xs font-black text-cyan-900 uppercase">PISTA ({gameState.powerups.hints})</span>
            </button>

            <button 
              onClick={() => usePowerup('clean')}
              disabled={gameState.powerups.cleaners <= 0}
              className={`group relative w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[2rem] shadow-xl border-b-8 transition-all active:scale-95
                ${gameState.powerups.cleaners > 0 ? 'bg-rose-300 border-rose-500 hover:bg-rose-200' : 'bg-slate-200 border-slate-300 opacity-50'}
              `}
            >
              <i className="fas fa-broom text-3xl md:text-4xl text-rose-800 mb-1"></i>
              <span className="text-[10px] md:text-xs font-black text-rose-900 uppercase">LIMPIAR ({gameState.powerups.cleaners})</span>
            </button>

            <div className={`w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[2rem] shadow-xl border-b-8 transition-all
                ${gameState.powerups.shields > 0 ? 'bg-lime-300 border-lime-500 ring-4 ring-lime-400/50' : 'bg-slate-200 border-slate-300 opacity-50'}
              `}
            >
              <i className="fas fa-shield-alt text-3xl md:text-4xl text-lime-800 mb-1"></i>
              <span className="text-[10px] md:text-xs font-black text-lime-900 uppercase">ESCUDO ({gameState.powerups.shields})</span>
            </div>
            
            <button 
              onClick={() => setView(GameView.MENU)}
              className="w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center rounded-[2rem] shadow-xl border-b-8 bg-white border-slate-300 transition-all hover:bg-slate-50 active:scale-95"
            >
              <i className="fas fa-home text-3xl md:text-4xl text-indigo-400 mb-1"></i>
              <span className="text-[10px] md:text-xs font-black text-indigo-900 uppercase">SALIR</span>
            </button>
          </div>
        </div>
      )}

      {view === GameView.GAME_OVER && (
        <div className="text-center bg-white p-12 md:p-16 rounded-[4rem] shadow-2xl border-x-8 border-b-8 border-rose-500 animate-in zoom-in duration-300 w-full max-w-md mx-4">
          <i className="fas fa-skull text-8xl text-rose-500 mb-6 block"></i>
          <h2 className="text-6xl md:text-7xl font-black text-slate-900 italic tracking-tighter mb-4">GAME OVER</h2>
          <div className="mb-8">
            <span className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Puntuación Final</span>
            <span className="text-5xl font-black text-indigo-600">{gameState.score}</span>
          </div>
          <p className="text-xl font-bold text-slate-400 mb-10 italic">¡No te rindas, vuelve a intentarlo!</p>
          <button onClick={() => setView(GameView.MENU)} className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl text-3xl font-black shadow-lg transition-all active:scale-95">MENÚ PRINCIPAL</button>
        </div>
      )}

      {view === GameView.ACHIEVEMENTS && <AchievementsModal achievements={achievements} onClose={() => setView(GameView.MENU)} />}
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