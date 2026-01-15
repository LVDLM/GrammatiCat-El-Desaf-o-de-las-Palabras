
import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';
import { fetchLeaderboard } from '../services/supabaseService';

interface Props {
  onClose: () => void;
  isMidnight: boolean;
}

export const Leaderboard: React.FC<Props> = ({ onClose, isMidnight }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchLeaderboard();
      setEntries(data);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-2xl rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border-8 ${isMidnight ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-400'}`}>
        <div className={`p-8 flex justify-between items-center ${isMidnight ? 'bg-indigo-900' : 'bg-indigo-600'} text-white`}>
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase">RÁNKING GLOBAL</h2>
            <p className="text-indigo-200 font-bold text-sm">Los maestros de la gramática</p>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/40 w-12 h-12 rounded-full transition-colors flex items-center justify-center">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <i className="fas fa-cat fa-spin text-5xl text-indigo-400 mb-4"></i>
              <span className="text-indigo-400 font-black uppercase tracking-widest">Cargando puntuaciones...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <i className="fas fa-ghost text-6xl text-slate-300 mb-4"></i>
              <p className="text-slate-400 font-bold italic">Nadie ha reclamado el trono aún...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div 
                  key={index} 
                  className={`flex items-center p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                    index === 0 ? (isMidnight ? 'bg-yellow-950/30 border-yellow-500/50' : 'bg-yellow-50 border-yellow-200') : 
                    isMidnight ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black mr-4 ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-slate-300 text-slate-700' :
                    index === 2 ? 'bg-orange-300 text-orange-800' :
                    isMidnight ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <span className={`text-xl font-black tracking-tight ${isMidnight ? 'text-white' : 'text-slate-800'}`}>{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-black text-indigo-500">{entry.score}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">PUNTOS</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`p-6 text-center italic text-xs ${isMidnight ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          <i className="fas fa-info-circle mr-2"></i> Las puntuaciones se actualizan en tiempo real
        </div>
      </div>
    </div>
  );
};