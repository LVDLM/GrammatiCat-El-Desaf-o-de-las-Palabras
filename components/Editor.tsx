import React, { useState, useMemo } from 'react';
import { WordClass, Level, WordData } from '../types';
import { analyzeTextWithAI } from '../services/geminiService';
import { saveLevelOnline, supabase } from '../services/supabaseService';

interface Props {
  onSave: (level: Level) => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  [WordClass.SUSTANTIVO]: 'bg-blue-500',
  [WordClass.ADJETIVO]: 'bg-yellow-500',
  [WordClass.VERBO]: 'bg-red-500',
  [WordClass.ADVERBIO]: 'bg-purple-500',
  [WordClass.PRONOMBRE]: 'bg-pink-500',
  [WordClass.PREPOSICION]: 'bg-green-500',
  [WordClass.CONJUNCION]: 'bg-orange-500',
  [WordClass.DETERMINANTE]: 'bg-cyan-500',
};

export const Editor: React.FC<Props> = ({ onSave, onClose }) => {
  const [step, setStep] = useState<'INPUT' | 'TAGGING'>('INPUT');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [tokens, setTokens] = useState<WordData[]>([]);
  const [activeCategory, setActiveCategory] = useState<WordClass | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const isMidnight = document.body.classList.contains('konami-active');

  const prepareTagging = () => {
    if (!text.trim()) return;
    const words = text.trim().split(/\s+/).map((w, i) => ({
      text: w,
      category: null as any, // Sin categoría inicial
      id: `manual-${i}-${Date.now()}`
    }));
    setTokens(words);
    setStep('TAGGING');
  };

  const handleAISuggestion = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeTextWithAI(text);
      if (result && result.length > 0) {
        setTokens(result.map((w: any, i: number) => ({
          ...w,
          id: `ai-${i}-${Date.now()}`
        })));
        setStep('TAGGING');
      } else {
        alert("La IA no pudo procesar el texto. Intenta etiquetarlo manualmente.");
        prepareTagging();
      }
    } catch (e) {
      alert("Error en la conexión con la IA.");
      prepareTagging();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleWordCategory = (tokenId: string) => {
    if (!activeCategory) return;
    setTokens(prev => prev.map(t => 
      t.id === tokenId 
        ? { ...t, category: t.category === activeCategory ? null as any : activeCategory } 
        : t
    ));
  };

  const handleSave = async (online: boolean) => {
    const taggedTokens = tokens.filter(t => t.category !== null);
    if (taggedTokens.length === 0) {
      alert("Debes etiquetar al menos una palabra antes de guardar.");
      return;
    }

    const newLevel: Level = {
      id: Date.now(),
      title: title || "Nivel Personalizado",
      text,
      words: tokens,
      timeLimit: 30
    };

    setIsSaving(true);
    if (online && supabase) {
      const { error } = await saveLevelOnline(newLevel);
      if (error) alert("Error online: " + (error as any).message);
    }
    onSave(newLevel);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-indigo-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-5xl rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border-8 ${isMidnight ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-400'}`}>
        
        {/* Cabecera */}
        <div className={`p-6 flex justify-between items-center text-white ${isMidnight ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="fas fa-pen-nib text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase">EDITOR MAESTRO</h2>
              <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">
                {step === 'INPUT' ? '1. Escribe el texto' : '2. Etiqueta las categorías'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-black/20 w-10 h-10 rounded-full transition-colors flex items-center justify-center">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Cuerpo del Editor */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 md:p-8 space-y-6">
          
          {step === 'INPUT' ? (
            <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-left duration-500">
              <div className="space-y-2">
                <label className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-indigo-400' : 'text-indigo-500'}`}>Título del desafío</label>
                <input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-xl transition-all ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
                  placeholder="Ej: Don Quijote, Capítulo I..." 
                />
              </div>

              <div className="flex-1 space-y-2 flex flex-col">
                <label className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-indigo-400' : 'text-indigo-500'}`}>Texto para el juego</label>
                <textarea 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  className={`flex-1 w-full p-6 rounded-3xl border-2 outline-none font-medium text-lg leading-relaxed shadow-inner transition-all resize-none ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
                  placeholder="Introduce aquí el texto que quieres que los alumnos analicen..." 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleAISuggestion} 
                  disabled={isAnalyzing || !text.trim()} 
                  className={`py-4 rounded-2xl text-white font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${isAnalyzing ? 'bg-slate-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-[1.02] active:scale-95'}`}
                >
                  {isAnalyzing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-robot"></i>}
                  AUTODETECCIÓN IA
                </button>
                <button 
                  onClick={prepareTagging} 
                  disabled={!text.trim()} 
                  className="py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-lg shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  ETIQUETADO MANUAL
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-right duration-500">
              
              {/* Barra de Categorías */}
              <div className="flex flex-wrap gap-2 justify-center p-4 bg-slate-100 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-indigo-200">
                {Object.values(WordClass).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-b-4 
                      ${activeCategory === cat ? `${CATEGORY_COLORS[cat]} text-white border-black/20 scale-110 shadow-lg` : `bg-white dark:bg-slate-700 ${isMidnight ? 'text-indigo-300' : 'text-slate-600'} hover:bg-indigo-50`}
                    `}
                  >
                    <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[cat]}`}></div>
                    {cat}
                  </button>
                ))}
                <button 
                  onClick={() => {setTokens(tokens.map(t => ({...t, category: null as any}))); setActiveCategory(null);}}
                  className="px-4 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-200 transition-colors"
                >
                  <i className="fas fa-trash-alt mr-2"></i> LIMPIAR TODO
                </button>
              </div>

              {/* Área de Etiquetado Interactivo */}
              <div className={`flex-1 overflow-y-auto p-8 rounded-3xl border-2 custom-scrollbar shadow-inner ${isMidnight ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-wrap gap-x-3 gap-y-4 justify-center items-center">
                  {tokens.map((token) => (
                    <span
                      key={token.id}
                      onClick={() => toggleWordCategory(token.id)}
                      className={`cursor-pointer px-4 py-1.5 rounded-xl text-2xl font-bold transition-all transform active:scale-90 select-none
                        ${token.category ? `${CATEGORY_COLORS[token.category]} text-white shadow-md -rotate-1 scale-105` : `${isMidnight ? 'text-white hover:bg-slate-700' : 'text-slate-700 hover:bg-white'}`}
                        ${activeCategory && !token.category ? 'hover:ring-4 hover:ring-indigo-300' : ''}
                      `}
                    >
                      {token.text}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center px-4">
                 <button onClick={() => setStep('INPUT')} className="text-indigo-500 font-black flex items-center gap-2 hover:underline">
                    <i className="fas fa-arrow-left"></i> VOLVER AL TEXTO
                 </button>
                 <div className="flex gap-4">
                    <button onClick={() => handleSave(false)} className={`px-8 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 ${isMidnight ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>LOCAL</button>
                    <button 
                      onClick={() => handleSave(true)} 
                      disabled={isSaving}
                      className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                    >
                      {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-globe"></i>}
                      PUBLICAR NIVEL
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};