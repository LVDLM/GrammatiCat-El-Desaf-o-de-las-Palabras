
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
        setTokens(result.map((w: any, i: number) => ({
          ...w,
          id: `ai-${i}-${Date.now()}`
        })));
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
      alert("Etiqueta al menos una palabra.");
      return;
    }

    const newLevel: Level = {
      id: Date.now(),
      title: title || "Texto de Usuario",
      text: tokens.map(t => t.text).join(' '),
      words: tokens,
      timeLimit: 30,
      targetCategory: taggedTokens[0].category
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-indigo-950/90 backdrop-blur-xl p-2 md:p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-6xl rounded-[2.5rem] md:rounded-[3rem] overflow-hidden flex flex-col h-[95vh] md:h-[90vh] shadow-2xl border-4 md:border-8 ${isMidnight ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-400'}`}>
        
        <div className={`p-4 md:p-6 flex justify-between items-center text-white ${isMidnight ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-2xl flex items-center justify-center"><i className="fas fa-pen-nib"></i></div>
            <div>
              <h2 className="text-xl font-black italic uppercase leading-tight">CREADOR DE NIVELES</h2>
              <p className="text-[10px] font-bold opacity-70 uppercase">Crea, guarda localmente o exporta el código</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-black/20 w-10 h-10 rounded-full transition-colors flex items-center justify-center"><i className="fas fa-times"></i></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-6 space-y-4">
          {step === 'INPUT' ? (
            <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-left duration-500">
              <input value={title} onChange={e => setTitle(e.target.value)} className={`w-full p-3 rounded-xl border-2 outline-none font-bold ${isMidnight ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50 border-indigo-100'}`} placeholder="Título del texto..." />
              <textarea value={text} onChange={e => setText(e.target.value)} className={`flex-1 w-full p-4 rounded-2xl border-2 outline-none font-medium leading-relaxed resize-none ${isMidnight ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50 border-indigo-100'} ${isTooLong ? 'border-rose-400' : ''}`} placeholder="Escribe el texto aquí (máx 50 palabras)..." />
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className={isTooLong ? 'text-rose-500' : 'text-slate-400'}>{wordCount}/{MAX_WORDS} palabras</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleAISuggestion} disabled={isAnalyzing || !text.trim() || isTooLong} className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black disabled:opacity-50">
                  {isAnalyzing ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-magic mr-2"></i>}
                  ANÁLISIS IA
                </button>
                <button onClick={prepareTagging} disabled={!text.trim() || isTooLong} className="py-4 bg-slate-200 text-slate-700 rounded-xl font-black hover:bg-slate-300 transition-colors">ETIQUETADO MANUAL</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-right duration-500 overflow-hidden">
              <div className="flex flex-wrap gap-1.5 justify-center p-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
                {Object.values(WordClass).map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeCategory === cat ? `${CATEGORY_COLORS[cat]} text-white scale-105 shadow-md` : 'bg-white text-slate-500'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className={`flex-1 overflow-y-auto p-4 rounded-[2rem] border-2 shadow-inner ${isMidnight ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center">
                  {tokens.map((token, index) => (
                    <span key={token.id} onClick={() => toggleWordCategory(token.id)} className={`cursor-pointer px-3 py-1 rounded-xl text-lg font-black transition-all ${token.category ? `${CATEGORY_COLORS[token.category]} text-white` : isMidnight ? 'text-white' : 'text-slate-700 hover:bg-indigo-200'}`}>
                      {token.text}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <button onClick={() => setStep('INPUT')} className="text-indigo-500 text-xs font-black"><i className="fas fa-arrow-left mr-1"></i> VOLVER AL TEXTO</button>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(true)} className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${copied ? 'bg-green-500 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}>
                    <i className={`fas ${copied ? 'fa-check' : 'fa-code'} mr-2`}></i>
                    {copied ? '¡COPIADO!' : 'EXPORTAR JSON'}
                  </button>
                  <button onClick={() => handleSave(false)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shadow-lg">
                    GUARDAR Y JUGAR
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
