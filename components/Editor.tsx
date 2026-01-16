
import React, { useState, useMemo } from 'react';
import { WordClass, Level, WordData } from '../types';
import { analyzeTextWithAI } from '../services/geminiService';
import { saveLevelLocally } from '../services/supabaseService';

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

const MAX_WORDS = 50;

export const Editor: React.FC<Props> = ({ onSave, onClose }) => {
  const [step, setStep] = useState<'INPUT' | 'TAGGING'>('INPUT');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [tokens, setTokens] = useState<WordData[]>([]);
  const [activeCategory, setActiveCategory] = useState<WordClass | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isMidnight = document.body.classList.contains('konami-active');

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  const isTooLong = wordCount > MAX_WORDS;

  const prepareTagging = () => {
    if (!text.trim() || isTooLong) return;
    const words = text.trim().split(/\s+/).map((w, i) => ({
      text: w,
      category: null as any,
      id: `manual-${i}-${Date.now()}`
    }));
    setTokens(words);
    setStep('TAGGING');
  };

  const handleAISuggestion = async () => {
    if (!text.trim() || isTooLong) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeTextWithAI(text);
      if (result && result.length > 0) {
        // Obtenemos las palabras originales del texto de entrada
        const originalWords = text.trim().split(/\s+/);
        
        // Mapeamos los resultados de la IA a las palabras originales que sí tienen puntuación
        const mappedTokens = originalWords.map((origWord, i) => {
          // Intentamos encontrar la palabra correspondiente en el resultado de la IA (por índice)
          const suggestion = result[i];
          
          return {
            text: origWord, // IMPORTANTE: Usamos la palabra original con su puntuación
            category: suggestion ? suggestion.category as WordClass : null as any,
            id: `ai-${i}-${Date.now()}`
          };
        });
        
        setTokens(mappedTokens);
        setStep('TAGGING');
      } else {
        prepareTagging();
      }
    } catch (e: any) {
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

  const handleSave = (shouldExport: boolean = false) => {
    const taggedTokens = tokens.filter(t => t.category !== null);
    if (taggedTokens.length === 0) {
      alert("Debes etiquetar al menos una palabra antes de guardar.");
      return;
    }

    const newLevel: Level = {
      id: Date.now(),
      title: title || "Texto Personalizado",
      text: tokens.map(t => t.text).join(' '),
      words: tokens,
      timeLimit: 35,
      targetCategory: taggedTokens[0].category,
      categoryGroup: 'Tus Niveles'
    };

    if (shouldExport) {
      const code = JSON.stringify(newLevel, null, 2);
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    saveLevelLocally(newLevel);
    onSave(newLevel);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-indigo-950/90 backdrop-blur-xl p-2 md:p-4 animate-in fade-in duration-300 overflow-y-auto">
      <div className={`w-full max-w-6xl rounded-[2.5rem] md:rounded-[3rem] overflow-hidden flex flex-col min-h-[90vh] max-h-[95vh] shadow-2xl border-4 md:border-8 ${isMidnight ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-400'}`}>
        
        <div className={`p-4 md:p-6 flex justify-between items-center text-white ${isMidnight ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl md:text-2xl shadow-inner"><i className="fas fa-pen-nib"></i></div>
            <div>
              <h2 className="text-lg md:text-xl font-black italic uppercase leading-tight tracking-tight">EDITOR DE TEXTOS</h2>
              <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Conserva automáticamente comas y puntos</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-black/20 w-10 h-10 rounded-full transition-colors flex items-center justify-center"><i className="fas fa-times"></i></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-8 space-y-6">
          {step === 'INPUT' ? (
            <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-left duration-500">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Título de la obra</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-lg shadow-sm transition-all focus:ring-4 focus:ring-indigo-100 ${isMidnight ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50 border-indigo-100'}`} placeholder="Ej: Don Quijote de la Mancha..." />
              </div>
              <div className="flex-1 flex flex-col space-y-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Cuerpo del texto</label>
                <textarea value={text} onChange={e => setText(e.target.value)} className={`flex-1 w-full p-6 rounded-[2rem] border-2 outline-none font-medium leading-relaxed resize-none text-xl ${isMidnight ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50 border-indigo-100'} ${isTooLong ? 'border-rose-400 ring-4 ring-rose-50' : ''}`} placeholder="Escribe o pega el texto. No te preocupes por los signos de puntuación, se mantendrán intactos..." />
              </div>
              <div className="flex justify-between items-center px-2">
                <span className={`font-black text-sm uppercase tracking-tighter ${isTooLong ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>{wordCount} / {MAX_WORDS} PALABRAS</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <button onClick={handleAISuggestion} disabled={isAnalyzing || !text.trim() || isTooLong} className="py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black disabled:opacity-50 shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center text-lg italic tracking-tighter">
                  {isAnalyzing ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-magic mr-3"></i>}
                  ANÁLISIS MÁGICO CON IA
                </button>
                <button onClick={prepareTagging} disabled={!text.trim() || isTooLong} className="py-5 bg-slate-200 text-slate-700 rounded-[1.5rem] font-black hover:bg-slate-300 transition-colors shadow-md active:scale-95 text-lg italic tracking-tighter">ETIQUETADO MANUAL</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-right duration-500 overflow-hidden">
              <div className="flex flex-wrap gap-2 justify-center p-4 bg-slate-100 dark:bg-slate-800/80 rounded-[2rem] border-2 border-indigo-50 shadow-inner">
                {Object.values(WordClass).map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase transition-all shadow-md active:scale-95 ${activeCategory === cat ? `${CATEGORY_COLORS[cat]} text-white scale-110 ring-4 ring-indigo-200 z-10` : 'bg-white text-slate-500 hover:bg-indigo-50'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className={`flex-1 overflow-y-auto p-8 rounded-[2.5rem] border-2 shadow-inner custom-scrollbar ${isMidnight ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-wrap gap-x-3 gap-y-5 justify-center content-start">
                  {tokens.map((token) => (
                    <span key={token.id} onClick={() => toggleWordCategory(token.id)} className={`cursor-pointer px-4 py-2 rounded-2xl text-xl md:text-3xl font-black transition-all transform hover:scale-110 active:scale-90 select-none ${token.category ? `${CATEGORY_COLORS[token.category]} text-white shadow-xl -rotate-1` : isMidnight ? 'text-white' : 'text-slate-700 hover:bg-white hover:shadow-lg'}`}>
                      {token.text}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-2">
                <button onClick={() => setStep('INPUT')} className="text-indigo-600 text-sm font-black hover:underline uppercase tracking-widest flex items-center transition-all hover:gap-3"><i className="fas fa-arrow-left mr-2"></i> VOLVER A ESCRIBIR</button>
                <div className="flex gap-4 w-full md:w-auto">
                  <button onClick={() => handleSave(true)} className={`flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center ${copied ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                    <i className={`fas ${copied ? 'fa-check' : 'fa-code'} mr-2`}></i>
                    {copied ? '¡COPIADO!' : 'EXPORTAR'}
                  </button>
                  <button onClick={() => handleSave(false)} className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 active:scale-95 transition-all tracking-tighter italic">
                    GUARDAR Y JUGAR YA
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
