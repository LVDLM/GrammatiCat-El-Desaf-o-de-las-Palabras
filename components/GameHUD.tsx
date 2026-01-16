
import React from 'react';
import { GameState, WordClass } from '../types';
import { getPluralCategory } from '../App';

interface Props {
  state: GameState;
  target: WordClass;
}

export const GameHUD: React.FC<Props> = ({ state, target }) => {
  const heartsToRender = Math.max(3, state.lives);
  
  return (
    <div className="w-full max-w-6xl mx-auto mb-2 md:mb-4 px-2">
      <div className="flex items-center justify-between bg-white/95 backdrop-blur-sm p-2 md:p-3 rounded-2xl md:rounded-3xl shadow-xl border-2 md:border-4 border-indigo-200">
        
        {/* LIVES & SCORE */}
        <div id="hud-lives" className="flex items-center space-x-2 md:space-x-4">
          <div className="flex flex-col items-center px-2 py-1 md:px-3 md:py-2 bg-indigo-50 rounded-xl md:rounded-2xl min-w-[50px] md:min-w-[70px]">
            <span className="text-[7px] md:text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Puntos</span>
            <span className="text-sm md:text-xl font-black text-indigo-700 leading-none">{state.score}</span>
          </div>
          
          <div className="flex flex-col items-start">
            <div className="flex gap-0.5 md:gap-1">
              {[...Array(heartsToRender)].map((_, i) => (
                <i 
                  key={i} 
                  className={`fas fa-heart text-sm md:text-2xl transition-all duration-500 transform ${i < state.lives ? 'text-rose-500 scale-110' : 'text-slate-200 scale-90 opacity-30'}`}
                />
              ))}
            </div>
            <span className="text-[7px] md:text-[9px] font-black text-rose-400 uppercase mt-0.5 tracking-tighter">
              {state.lives} VIDAS
            </span>
          </div>
        </div>

        {/* TARGET CATEGORY - Always visible and centered */}
        <div id="hud-category" className="flex flex-1 flex-col items-center justify-center mx-2">
           <div className="px-3 py-1 md:px-5 md:py-2 bg-yellow-400 rounded-full shadow-md border-b-2 md:border-b-4 border-yellow-600 animate-pulse flex items-center">
              <span className="hidden xs:inline text-[7px] md:text-[9px] font-bold text-yellow-900 uppercase tracking-wider mr-2">Busca:</span>
              <span className="text-[10px] md:text-lg font-black text-indigo-900 uppercase italic whitespace-nowrap">{getPluralCategory(target)}</span>
           </div>
        </div>

        {/* TIMER */}
        <div id="hud-timer" className="flex items-center">
          <div className={`flex items-center px-3 py-1 md:px-6 md:py-3 rounded-xl md:rounded-2xl border-2 md:border-4 transition-all duration-300 ${state.time < 10 ? 'bg-rose-100 border-rose-400 text-rose-600 animate-bounce' : 'bg-green-50 border-green-200 text-green-600'}`}>
            <i className="fas fa-clock mr-1 md:mr-3 text-sm md:text-lg"></i>
            <span className="text-sm md:text-2xl font-black font-mono leading-none">{state.time}s</span>
          </div>
        </div>
        
      </div>
    </div>
  );
};
