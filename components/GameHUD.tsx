
import React from 'react';
import { GameState, WordClass } from '../types';
import { getPluralCategory } from '../App';

interface Props {
  state: GameState;
  target: WordClass;
}

export const GameHUD: React.FC<Props> = ({ state, target }) => {
  // Mostramos tantos corazones como vidas tenga el jugador (mínimo 3 espacios visibles)
  const heartsToRender = Math.max(3, state.lives);
  
  return (
    <div className="w-full max-w-4xl mx-auto mb-6 px-2">
      <div className="flex flex-wrap items-center justify-between bg-white/95 backdrop-blur-sm p-4 rounded-3xl shadow-xl border-4 border-indigo-200">
        <div id="hud-lives" className="flex items-center space-x-3 md:space-x-5 p-2 rounded-2xl transition-all">
          <div className="flex flex-col items-center px-3 py-2 bg-indigo-50 rounded-2xl min-w-[60px]">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Puntos</span>
            <span className="text-lg md:text-xl font-black text-indigo-700 leading-none">{state.score}</span>
          </div>
          
          <div className="flex flex-col items-start px-2">
            <div className="flex flex-wrap gap-1 max-w-[120px] md:max-w-none">
              {[...Array(heartsToRender)].map((_, i) => (
                <i 
                  key={i} 
                  className={`fas fa-heart text-xl md:text-2xl transition-all duration-500 transform ${i < state.lives ? 'text-rose-500 scale-110 drop-shadow-sm' : 'text-slate-200 scale-90 opacity-30'}`}
                />
              ))}
            </div>
            <span className="text-[9px] font-black text-rose-400 uppercase mt-1 tracking-tighter">
              {state.lives} VIDAS
            </span>
          </div>
        </div>

        <div id="hud-category" className="hidden sm:flex flex-1 flex-col items-center justify-center mx-2 md:mx-4 p-2">
           <div className="px-5 py-2 bg-yellow-400 rounded-full shadow-md border-b-4 border-yellow-600 animate-pulse">
              <span className="text-[9px] font-bold text-yellow-900 uppercase tracking-wider">Categoría:</span>
              <span className="ml-2 text-md md:text-lg font-black text-indigo-900 uppercase italic">{getPluralCategory(target)}</span>
           </div>
        </div>

        <div id="hud-timer" className="flex items-center ml-auto p-2">
          <div className={`flex items-center px-4 md:px-6 py-2 md:py-3 rounded-2xl border-4 transition-all duration-300 ${state.time < 10 ? 'bg-rose-100 border-rose-400 text-rose-600 animate-bounce' : 'bg-green-50 border-green-200 text-green-600'}`}>
            <i className="fas fa-clock mr-2 md:mr-3 text-lg"></i>
            <span className="text-xl md:text-2xl font-black font-mono leading-none">{state.time}s</span>
          </div>
        </div>
        
        {/* Móvil: Categoría debajo si es muy estrecho */}
        <div id="hud-category-mobile" className="w-full sm:hidden mt-4 flex justify-center p-1">
           <div className="px-6 py-1 bg-yellow-400 rounded-full border-b-2 border-yellow-600 shadow-sm">
              <span className="text-[9px] font-bold text-yellow-900 uppercase">Busca:</span>
              <span className="ml-2 text-sm font-black text-indigo-900 uppercase italic">{getPluralCategory(target)}</span>
           </div>
        </div>
      </div>
    </div>
  );
};
