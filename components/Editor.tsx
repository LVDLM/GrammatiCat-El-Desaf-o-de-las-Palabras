import React, { useState } from 'react';
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
      category: null as any,
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
        alert("La IA no devolvió resultados válidos. Iniciando etiquetado manual...");
        prepareTagging();
      }
    } catch (e) {
      alert("Error al conectar con el servicio de IA. Verifica tu conexión.");
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

  const mergeTokens = (index: number) => {
    if (index >= tokens.length - 1) return;
    
    const newTokens = [...tokens];
    const first = newTokens[index];
    const second = newTokens[index + 1];
    
    newTokens[index] = {
      ...first,
      text: `${first.text} ${second.text}`,
      category: first.category || second.category // Mantiene la categoría si alguno la tenía
    };
    
    newTokens.splice(index + 1, 1);
    setTokens(newTokens);
  };

  const handleSave = async (online: boolean) => {
    const taggedTokens = tokens.filter(t => t.category !== null);
    if (taggedTokens.length === 0) {
      alert("Etiqueta al menos una palabra clave para que el nivel sea jugable.");
      return;
    }

    const newLevel: Level = {
      id: Date.now(),
      title: title || "Texto de Usuario",
      text: tokens.map(t => t.text).join(' '),
      words: tokens,
      timeLimit: 30
    };

    setIsSaving(true);
    if (online && supabase) {
      try {
        const { error } = await saveLevelOnline(newLevel);
        if (error) throw error;
        alert("¡Nivel publicado con éxito!");
      } catch (e) {
        alert("Error al publicar. Se guardará solo localmente.");
      }
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
                {step === 'INPUT' ? 'Fase 1: Preparación del texto' : 'Fase 2: Estructura Gramatical'}
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
                <label className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-indigo-400' : 'text-indigo-500'}`}>Nombre del Desafío</label>
                <input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-xl transition-all ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
                  placeholder="Ej: El cantar de mio Cid..." 
                />
              </div>

              <div className="flex-1 space-y-2 flex flex-col">
                <label className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-indigo-400' : 'text-indigo-500'}`}>Contenido Literario</label>
                <textarea 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  className={`flex-1 w-full p-6 rounded-3xl border-2 outline-none font-medium text-lg leading-relaxed shadow-inner transition-all resize-none ${isMidnight ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus:border-indigo-400'}`} 
                  placeholder="Pega aquí el texto. La IA agrupará tiempos compuestos automáticamente." 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleAISuggestion} 
                  disabled={isAnalyzing || !text.trim()} 
                  className={`py-5 rounded-2xl text-white font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3 ${isAnalyzing ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:scale-[1.02] active:scale-95'}`}
                >
                  {isAnalyzing ? <i className="fas fa-cat fa-spin"></i> : <i className="fas fa-magic"></i>}
                  {isAnalyzing ? 'PROCESANDO TEXTO...' : 'ANALIZAR CON IA'}
                </button>
                <button 
                  onClick={prepareTagging} 
                  disabled={!text.trim()} 
                  className="py-5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  PREPARAR MANUALMENTE
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-right duration-500">
              
              {/* Barra de Herramientas */}
              <div className="flex flex-wrap gap-2 justify-center p-5 bg-slate-100 dark:bg-slate-800/80 rounded-3xl border-2 border-dashed border-indigo-300">
                {Object.values(WordClass).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-b-4 
                      ${activeCategory === cat ? `${CATEGORY_COLORS[cat]} text-white border-black/20 scale-110 shadow-lg` : `bg-white dark:bg-slate-700 ${isMidnight ? 'text-indigo-300' : 'text-slate-600'} hover:bg-indigo-50 shadow-sm`}
                    `}
                  >
                    <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[cat]}`}></div>
                    {cat}
                  </button>
                ))}
                <div className="w-px h-8 bg-slate-300 mx-2 hidden md:block"></div>
                <button 
                  onClick={() => {setTokens(tokens.map(t => ({...t, category: null as any}))); setActiveCategory(null);}}
                  className="px-4 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-200 transition-colors shadow-sm"
                >
                  <i className="fas fa-undo mr-2"></i> RESET
                </button>
              </div>

              {/* Área de Trabajo */}
              <div className={`flex-1 overflow-y-auto p-10 rounded-[3rem] border-2 custom-scrollbar shadow-inner ${isMidnight ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-wrap gap-x-2 gap-y-6 justify-center items-center">
                  {tokens.map((token, index) => (
                    <React.Fragment key={token.id}>
                      <span
                        onClick={() => toggleWordCategory(token.id)}
                        className={`cursor-pointer px-5 py-2 rounded-2xl text-2xl font-black transition-all transform active:scale-90 select-none
                          ${token.category ? `${CATEGORY_COLORS[token.category]} text-white shadow-[0_5px_0_rgba(0,0,0,0.1)] -rotate-1 scale-105` : `${isMidnight ? 'text-white hover:bg-slate-700' : 'text-slate-700 hover:bg-white border-2 border-transparent hover:border-indigo-200'}`}
                        `}
                      >
                        {token.text}
                      </span>
                      {index < tokens.length - 1 && (
                        <button 
                          onClick={() => mergeTokens(index)}
                          title="Unir con la siguiente palabra"
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-100 hover:scale-125 hover:bg-indigo-500 hover:text-white ${isMidnight ? 'text-indigo-400' : 'text-indigo-300'}`}
                        >
                          <i className="fas fa-link text-xs"></i>
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2">
                 <button onClick={() => setStep('INPUT')} className="text-indigo-500 font-black flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
                    <i className="fas fa-chevron-left"></i> EDITAR TEXTO
                 </button>
                 <div className="flex gap-4">
                    <button onClick={() => handleSave(false)} className={`px-8 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 ${isMidnight ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>LOCAL</button>
                    <button 
                      onClick={() => handleSave(true)} 
                      disabled={isSaving}
                      className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-3"
                    >
                      {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                      {isSaving ? 'GUARDANDO...' : 'PUBLICAR ONLINE'}
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
        
        {step === 'TAGGING' && (
          <div className="p-4 bg-yellow-50 border-t-2 border-yellow-100 text-center">
            <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-widest">
              <i className="fas fa-info-circle mr-2"></i> Consejo: Usa el botón <i className="fas fa-link mx-1"></i> entre palabras para unir tiempos compuestos como "he saltado".
            </p>
          </div>
        )}
      </div>
    </div>
  );
};