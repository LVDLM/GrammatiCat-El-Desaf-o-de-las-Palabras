
import React from 'react';
import { GameState, WordClass } from '../types';
import { getPluralCategory } from '../App';

interface Props {
  state: GameState;
  target: WordClass;
}

export const GameHUD: React.FC<Props> = ({ state, target }) => {
  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      <div className="flex flex-wrap items-center justify-between bg-white/90 backdrop-blur-sm p-4 rounded-3xl shadow-xl border-4 border-indigo-200">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col items-center px-4 py-2 bg-indigo-50 rounded-2xl">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Puntos</span>
            <span className="text-2xl font-bold text-indigo-700">{state.score}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <i 
                  key={i} 
                  className={`fas fa-heart text-2xl transition-all duration-300 ${i < state.lives ? 'text-rose-500' : 'text-gray-300 scale-90'}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-rose-300 uppercase mt-1">Vidas</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
           <div className="px-8 py-2 bg-yellow-400 rounded-full shadow-inner border-b-4 border-yellow-600 animate-pulse">
              <span className="text-sm font-bold text-yellow-900 uppercase tracking-wider">Busca:</span>
              <span className="ml-2 text-xl font-black text-indigo-900 uppercase">{getPluralCategory(target)}</span>
           </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className={`flex items-center px-6 py-3 rounded-2xl border-4 transition-colors ${state.time < 10 ? 'bg-rose-100 border-rose-400 text-rose-600 animate-bounce' : 'bg-green-50 border-green-200 text-green-600'}`}>
            <i className="fas fa-clock mr-3 text-xl"></i>
            <span className="text-2xl font-black font-mono">{state.time}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
