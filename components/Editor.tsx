import React, { useState } from 'react';
import { WordClass, Level, WordData } from '../types';
import { analyzeTextWithAI } from '../services/geminiService';
import { saveLevelOnline, supabase } from '../services/supabaseService';

interface Props {
  onSave: (level: Level) => void;
  onClose: () => void;
}

export const Editor: React.FC<Props> = ({ onSave, onClose }) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analyzedWords, setAnalyzedWords] = useState<WordData[]>([]);
  
  // Detect midnight mode based on body class
  const isMidnight = document.body.classList.contains('konami-active');

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    const result = await analyzeTextWithAI(text);
    const formatted = result.map((w: any, idx: number) => ({
      ...w,
      id: `custom-${idx}-${Date.now()}`
    }));
    setAnalyzedWords(formatted);
    setIsAnalyzing(false);
  };

  const handleSave = async (online: boolean) => {
    if (analyzedWords.length === 0) {
      alert("Primero debes analizar el texto para identificar las categorías.");
      return;
    }

    const newLevel: Level = {
      id: Date.now(),
      title: title || "Nivel Personalizado",
      text,
      words: analyzedWords,
      timeLimit: 30
    };

    if (online) {
      if (!supabase) {
        alert("Configuración de Supabase no encontrada. Guardando localmente...");
        onSave(newLevel);
        return;
      }
      setIsSaving(true);
      const { error } = await saveLevelOnline(newLevel);
      setIsSaving(false);
      if (error) {
        alert("Error al guardar online: " + (error as any).message);
      } else {
        alert("¡Nivel guardado en la nube!");
      }
    }

    onSave(newLevel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/80 backdrop-blur-md p-4">
      <div className={`w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border-8 ${isMidnight ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-400'}`}>
        <div className={`p-6 flex justify-between items-center text-white ${isMidnight ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">EDITOR <span className="text-yellow-400">MAESTRO</span></h2>
          <button onClick={onClose} className="hover:bg-black/20 p-2 rounded-full transition-colors">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-widest ${isMidnight ? 'text-indigo-300' : 'text-indigo-400'}`}>Nombre del Nivel</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className={`w-full p-4 rounded-xl border-2 outline-none font-bold text-xl transition-colors ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
              placeholder="Ej: Crónica de una muerte anunciada..." 
            />
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-widest ${isMidnight ? 'text-indigo-300' : 'text-indigo-400'}`}>Cuerpo del Texto</label>
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)} 
              className={`w-full h-40 p-6 rounded-2xl border-2 outline-none font-medium text-lg leading-relaxed shadow-inner transition-colors ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
              placeholder="Pega aquí tu fragmento literario..." 
            />
          </div>

          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !text} 
            className={`w-full py-5 rounded-2xl text-white font-black text-2xl shadow-xl transition-all ${isAnalyzing ? 'bg-slate-600' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:scale-[1.01] active:scale-95'}`}
          >
            {isAnalyzing ? <><i className="fas fa-cat fa-spin mr-3"></i>ANALIZANDO GRAMÁTICA...</> : 'ANALIZAR CON INTELIGENCIA ARTIFICIAL'}
          </button>

          {analyzedWords.length > 0 && (
            <div className={`p-6 rounded-3xl border-2 ${isMidnight ? 'bg-slate-800/50 border-indigo-500/30' : 'bg-green-50 border-green-100'}`}>
              <h3 className={`text-sm font-bold uppercase mb-4 text-center tracking-widest ${isMidnight ? 'text-indigo-300' : 'text-green-600'}`}>¡Análisis Completado! Texto mapeado correctamente.</h3>
              <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto p-2 custom-scrollbar">
                {analyzedWords.map((w, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-xl border flex items-center shadow-sm ${isMidnight ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-green-200 text-slate-700'}`}>
                    <span className="font-bold mr-2">{w.text}</span>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${isMidnight ? 'bg-indigo-900 text-indigo-300' : 'bg-green-100 text-green-700'}`}>{w.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`p-8 border-t flex flex-col sm:flex-row gap-4 items-center justify-between ${isMidnight ? 'bg-slate-950 border-slate-800' : 'bg-slate-50'}`}>
           <div className="flex items-center text-slate-400 italic text-sm">
             <i className="fas fa-info-circle mr-2"></i>
             Se guardarán las etiquetas gramaticales automáticamente.
           </div>
           <div className="flex gap-4">
              <button onClick={() => handleSave(false)} className="px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95">LOCAL</button>
              <button onClick={() => handleSave(true)} disabled={isSaving} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center">
                {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                PUBLICAR
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};