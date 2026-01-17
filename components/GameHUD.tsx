
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
    <div className="w-full max-w-7xl mx-auto mb-2 lg:mb-6 px-1 lg:px-4">
      <div className="flex items-center justify-between bg-white/95 backdrop-blur-sm p-2 md:p-3 lg:p-6 rounded-xl md:rounded-2xl lg:rounded-[3rem] shadow-2xl border-2 lg:border-4 border-indigo-100 transition-all duration-500">
        
        {/* LIVES & SCORE */}
        <div id="hud-lives" className="flex items-center space-x-2 md:space-x-4 lg:space-x-8">
          <div className="flex flex-col items-center px-2 py-1 md:px-3 md:py-1.5 lg:px-8 lg:py-4 bg-indigo-50 rounded-lg md:rounded-xl lg:rounded-[2rem] min-w-[50px] md:min-w-[70px] lg:min-w-[140px] shadow-inner">
            <span className="text-[6px] md:text-[8px] lg:text-sm font-black text-indigo-400 uppercase leading-none tracking-widest">Ptos</span>
            <span className="text-sm md:text-xl lg:text-4xl font-black text-indigo-700 leading-none mt-0.5 lg:mt-2">{state.score}</span>
          </div>
          
          <div className="flex flex-col items-start">
            <div className="flex gap-0.5 lg:gap-2">
              {[...Array(heartsToRender)].map((_, i) => (
                <i 
                  key={i} 
                  className={`fas fa-heart text-xs md:text-2xl lg:text-5xl transition-all duration-500 transform ${i < state.lives ? 'text-rose-500 scale-110 drop-shadow-md' : 'text-slate-200 scale-90 opacity-20'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* TARGET CATEGORY - Always visible and centered */}
        <div id="hud-category" className="flex flex-1 flex-col items-center justify-center mx-2 lg:mx-8">
           <div className="px-4 py-1.5 md:px-6 md:py-3 lg:px-12 lg:py-6 bg-yellow-400 rounded-full shadow-xl border-b-4 lg:border-b-8 border-yellow-600 animate-pulse flex items-center transform hover:scale-105 transition-transform">
              <span className="text-[10px] md:text-xl lg:text-4xl font-black text-indigo-900 uppercase italic whitespace-nowrap tracking-tighter">{getPluralCategory(target)}</span>
           </div>
        </div>

        {/* TIMER */}
        <div id="hud-timer" className="flex items-center">
          <div className={`flex items-center px-2 py-1.5 md:px-4 md:py-2 lg:px-10 lg:py-6 rounded-lg md:rounded-xl lg:rounded-[2.5rem] border-2 lg:border-4 transition-all duration-300 shadow-lg ${state.time < 10 ? 'bg-rose-100 border-rose-400 text-rose-600 animate-bounce' : 'bg-green-50 border-green-200 text-green-600'}`}>
            <i className="fas fa-clock mr-1 md:mr-2 lg:mr-4 text-xs md:text-xl lg:text-4xl"></i>
            <span className="text-sm md:text-2xl lg:text-5xl font-black font-mono leading-none">{state.time}s</span>
          </div>
        </div>
        
      </div>
    </div>
  );
};
