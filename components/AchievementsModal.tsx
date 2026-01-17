
import React from 'react';
import { Achievement } from '../types';

interface Props {
  achievements: Achievement[];
  onClose: () => void;
}

export const AchievementsModal: React.FC<Props> = ({ achievements, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border-8 border-indigo-400">
        <div className="p-8 lg:p-12 bg-indigo-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase">Sala de Trofeos</h2>
            <p className="text-indigo-200 font-bold text-lg lg:text-2xl italic">Tus hitos en GrammatiCat</p>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/40 w-12 h-12 lg:w-16 lg:h-16 rounded-full transition-colors flex items-center justify-center">
            <i className="fas fa-times text-2xl lg:text-4xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {achievements.map((ach) => (
            <div 
              key={ach.id} 
              className={`relative p-8 lg:p-10 rounded-3xl lg:rounded-[3rem] border-4 transition-all ${ach.unlocked ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 grayscale opacity-60'}`}
            >
              <div className="flex items-start space-x-6 lg:space-x-8">
                <div className={`w-20 h-20 lg:w-28 lg:h-28 rounded-2xl lg:rounded-[2rem] flex items-center justify-center text-4xl lg:text-6xl shadow-inner ${ach.unlocked ? 'bg-yellow-400 text-indigo-900' : 'bg-slate-200 text-slate-400'}`}>
                  <i className={`fas ${ach.icon}`}></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-indigo-900 text-xl lg:text-3xl leading-tight mb-2">{ach.title}</h3>
                  <p className="text-base lg:text-xl text-slate-500 font-medium leading-tight">{ach.description}</p>
                  
                  {ach.goal && !ach.unlocked && (
                    <div className="mt-4 lg:mt-6">
                      <div className="flex justify-between text-xs lg:text-base font-bold text-indigo-400 mb-1.5 lg:mb-2">
                        <span>Progreso</span>
                        <span>{ach.progress} / {ach.goal}</span>
                      </div>
                      <div className="w-full h-3 lg:h-5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (ach.progress || 0) / ach.goal * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {ach.unlocked && ach.unlockedAt && (
                    <div className="mt-3 lg:mt-5 text-xs lg:text-base font-bold text-green-500 uppercase tracking-wide">
                      Desbloqueado el {new Date(ach.unlockedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              {!ach.unlocked && <i className="fas fa-lock absolute top-6 right-6 lg:top-8 lg:right-8 text-slate-300 text-xl lg:text-3xl"></i>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
