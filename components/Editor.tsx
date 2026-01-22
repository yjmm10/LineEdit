
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserDocument, SuggestedChange, ModificationLevel } from '../types';
import { refineDocument } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';

interface EditorProps {
  document: UserDocument;
  onUpdate: (doc: UserDocument) => void;
  onTakeSnapshot: () => void;
}

// --- Icons ---
const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>
);
const XIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const RefreshIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
);

// --- Robust Diff Utility (Token-based LCS) ---
type DiffPart = { type: 'same' | 'add' | 'remove'; value: string };

const computeDiff = (text1: string, text2: string): DiffPart[] => {
  const t1 = text1.match(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/g) || [];
  const t2 = text2.match(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/g) || [];
  
  const matrix = Array(t1.length + 1).fill(null).map(() => Array(t2.length + 1).fill(0));

  for (let i = 1; i <= t1.length; i++) {
    for (let j = 1; j <= t2.length; j++) {
      if (t1[i - 1] === t2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const result: DiffPart[] = [];
  let i = t1.length;
  let j = t2.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && t1[i - 1] === t2[j - 1]) {
      result.unshift({ type: 'same', value: t1[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      result.unshift({ type: 'add', value: t2[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', value: t1[i - 1] });
      i--;
    }
  }
  return result;
};

// --- Component ---

export const Editor: React.FC<EditorProps> = ({ document, onUpdate, onTakeSnapshot }) => {
  const { showToast } = useToast();
  const { t, theme } = useSettings();
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCardIndex, setProcessingCardIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<'edit' | 'review'>('edit');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [modLevel, setModLevel] = useState<ModificationLevel>('refine');
  const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
  const [selection, setSelection] = useState<string>('');

  // Slash Command State
  const [showCommands, setShowCommands] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);

  // Dynamic Slash Commands based on language
  const slashCommands = useMemo(() => [
    { label: t('cmd.polish.label'), value: 'Polish this text for better flow, clarity, and professional tone.', desc: t('cmd.polish.desc') },
    { label: t('cmd.grammar.label'), value: 'Fix all grammar, spelling, and punctuation errors.', desc: t('cmd.grammar.desc') },
    { label: t('cmd.en.label'), value: 'Translate this text into fluent, natural English.', desc: t('cmd.en.desc') },
    { label: t('cmd.zh.label'), value: 'Translate this text into fluent, natural Chinese.', desc: t('cmd.zh.desc') },
    { label: t('cmd.concise.label'), value: 'Make this text more concise and direct, removing fluff.', desc: t('cmd.concise.desc') },
    { label: t('cmd.md.label'), value: 'Convert this text into structured Markdown format (headers, lists, bolding).', desc: t('cmd.md.desc') },
    { label: t('cmd.expand.label'), value: 'Expand on these points with more detail and context.', desc: t('cmd.expand.desc') },
  ], [t]);

  const [filteredCommands, setFilteredCommands] = useState(slashCommands);

  // Update filtered commands when commands list changes (lang switch)
  useEffect(() => {
    setFilteredCommands(slashCommands);
  }, [slashCommands]);

  // Refs for connector lines
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<{ [key: number]: HTMLSpanElement | null }>({});
  const targetRefs = useRef<{ [key: number]: HTMLElement | null }>({});
  const [lineCoords, setLineCoords] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  useEffect(() => {
    if (document.activeSuggestions && document.activeSuggestions.length > 0) {
      setMode('review');
    } else {
      setMode('edit');
    }
  }, [document.activeSuggestions]);

  // Update line coordinates
  useEffect(() => {
    const updateLine = () => {
      if (hoveredIndex === null || !containerRef.current) {
        setLineCoords(null);
        return;
      }

      const sourceEl = sourceRefs.current[hoveredIndex];
      const targetEl = targetRefs.current[hoveredIndex];

      if (sourceEl && targetEl) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        setLineCoords({
          x1: sourceRect.right - containerRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
          x2: targetRect.left - containerRect.left,
          y2: targetRect.top + targetRect.height / 2 - containerRect.top
        });
      }
    };

    updateLine();

    const container = containerRef.current;
    if(container) {
        window.addEventListener('resize', updateLine);
        const scrollables = container.querySelectorAll('.overflow-y-auto');
        scrollables.forEach(el => el.addEventListener('scroll', updateLine));
        
        return () => {
            window.removeEventListener('resize', updateLine);
            scrollables.forEach(el => el.removeEventListener('scroll', updateLine));
        };
    }
  }, [hoveredIndex, mode, document.activeSuggestions, viewMode]);


  const stats = useMemo(() => {
    const lines = document.content ? document.content.split('\n').length : 0;
    const chars = document.content.length;
    const words = document.content.trim() ? document.content.trim().split(/\s+/).length : 0;
    return { lines, chars, words };
  }, [document.content]);

  // --- Core Matching Logic (Memoized) ---
  const suggestionMatches = useMemo(() => {
    const currentText = document.content;
    const suggestions = document.activeSuggestions || [];
    const matches: { start: number; end: number; sugIndex: number }[] = [];
    
    suggestions.forEach((sug, idx) => {
      let searchPos = 0;
      while (true) {
        const foundIdx = currentText.indexOf(sug.originalText, searchPos);
        if (foundIdx === -1) break;
        
        const isOverlapping = matches.some(m => 
          (foundIdx >= m.start && foundIdx < m.end) || 
          (foundIdx + sug.originalText.length > m.start && foundIdx + sug.originalText.length <= m.end)
        );

        if (!isOverlapping) {
          matches.push({
            start: foundIdx,
            end: foundIdx + sug.originalText.length,
            sugIndex: idx
          });
          break;
        }
        searchPos = foundIdx + 1;
      }
    });

    return matches.sort((a, b) => a.start - b.start);
  }, [document.content, document.activeSuggestions]);

  // --- Full Modified Text Calculation ---
  const fullModifiedText = useMemo(() => {
    let text = '';
    let lastPos = 0;
    const currentText = document.content;
    const suggestions = document.activeSuggestions || [];

    suggestionMatches.forEach(m => {
       text += currentText.substring(lastPos, m.start);
       text += suggestions[m.sugIndex].modifiedText;
       lastPos = m.end;
    });
    text += currentText.substring(lastPos);
    return text;
  }, [document.content, document.activeSuggestions, suggestionMatches]);

  // --- Selection Handlers ---
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const text = target.value.substring(target.selectionStart, target.selectionEnd);
    if (text.trim().length > 0) {
      setSelection(text);
    } else {
      setSelection('');
    }
  };

  const handleReviewSelect = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      // Basic check to ensure we are selecting inside the editor
      if (containerRef.current && containerRef.current.contains(sel.anchorNode)) {
        setSelection(sel.toString());
      }
    } else {
        // Only clear if we are in review mode to avoid conflict with textarea
        if (mode === 'review') {
            setSelection('');
        }
    }
  };

  // --- Actions ---

  const handleLocalSnapshot = () => {
    onTakeSnapshot();
    showToast("Snapshot saved successfully", "success");
  }

  const handleAcceptChange = (index: number) => {
    const match = suggestionMatches.find(m => m.sugIndex === index);
    if (!match) return;

    const suggestion = document.activeSuggestions[index];
    const newContent = document.content.slice(0, match.start) + suggestion.modifiedText + document.content.slice(match.end);
    const newSuggestions = document.activeSuggestions.filter((_, i) => i !== index);

    onUpdate({
      ...document,
      content: newContent,
      activeSuggestions: newSuggestions,
      lastModified: Date.now()
    });
    setHoveredIndex(null);
    showToast("Suggestion applied", "success");
  };

  const handleRejectChange = (index: number) => {
    const newSuggestions = document.activeSuggestions.filter((_, i) => i !== index);
    onUpdate({
      ...document,
      activeSuggestions: newSuggestions,
      lastModified: Date.now()
    });
    setHoveredIndex(null);
  };

  const handleRetryChange = async (index: number) => {
    setProcessingCardIndex(index);
    const suggestion = document.activeSuggestions[index];
    
    // Construct a retry prompt
    const instruction = chatInput.trim() 
      ? `(Context: ${chatInput}) Regenerate this improvement.` 
      : "Improve this text again with the current strategy.";

    try {
      const result = await refineDocument(suggestion.originalText, instruction, modLevel);
      if (result.suggestions.length > 0) {
        // We use the first suggestion returned for the single sentence
        const newSug = result.suggestions[0];
        // Ensure originalText remains consistent with the document's current state
        newSug.originalText = suggestion.originalText;
        
        const newSuggestions = [...document.activeSuggestions];
        newSuggestions[index] = newSug;
        
        onUpdate({
          ...document,
          activeSuggestions: newSuggestions
        });
        showToast("Suggestion regenerated", "success");
      } else {
        showToast("No better suggestion found", "info");
      }
    } catch (err: any) {
      console.error("Retry failed", err);
      showToast("Retry failed: " + err.message, "error");
    } finally {
      setProcessingCardIndex(null);
    }
  };

  const handleCopyRightPanel = () => {
    navigator.clipboard.writeText(fullModifiedText);
    showToast("Full modified text copied to clipboard!", "success");
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({
      ...document,
      content: e.target.value,
      lastModified: Date.now(),
      activeSuggestions: [] 
    });
  };

  // Chat Input Logic
  const handleChatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChatInput(val);

    if (val.startsWith('/')) {
      const query = val.slice(1).toLowerCase();
      const filtered = slashCommands.filter(cmd => 
        cmd.label.toLowerCase().includes(query) || 
        cmd.value.toLowerCase().includes(query)
      );
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setCommandIndex(0); 
    } else {
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCommand(filteredCommands[commandIndex]);
      } else if (e.key === 'Escape') {
        setShowCommands(false);
      }
    }
  };

  const selectCommand = (cmd: typeof slashCommands[0]) => {
    setChatInput(cmd.value);
    setShowCommands(false);
  };

  const handleAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setShowCommands(false);
    
    // Determine content to send: Selection OR Full Document
    const contentToSend = selection.trim() ? selection : document.content;

    try {
      const response = await refineDocument(contentToSend, chatInput, modLevel);
      
      if (response.suggestions && response.suggestions.length > 0) {
         onUpdate({
            ...document,
            activeSuggestions: response.suggestions,
            lastModified: Date.now()
          });
          setChatInput('');
          setSelection(''); // Clear selection after processing
          setMode('review');
          showToast(`Generated ${response.suggestions.length} suggestions`, "success");
      } else {
         showToast("AI returned no suggestions for this input.", "info");
      }

    } catch (error: any) {
      console.error("AI Modification Error:", error);
      
      if (error.message === "NO_PROVIDER_CONFIGURED") {
        showToast("Config Error: No valid API Keys found (GEMINI or OPENAI)", "error");
      } else if (error.message === "MISSING_GEMINI_KEY") {
         showToast("Config Error: Missing GEMINI_API_KEY", "error");
      } else if (error.message === "MISSING_OPENAI_CONFIG") {
         showToast("Config Error: Missing OpenAI configuration", "error");
      } else {
        showToast(`AI Error: ${error.message || "Unknown error"}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Render Source
  const renderSourceContent = () => {
    if (mode === 'edit') {
      return (
        <textarea
          value={document.content}
          onChange={handleContentChange}
          onSelect={handleTextareaSelect}
          placeholder="Start typing or paste your content..."
          className="flex-1 p-8 text-sm leading-loose focus:outline-none resize-none bg-transparent font-sans text-black dark:text-gray-100 placeholder-black/30 dark:placeholder-white/30"
        />
      );
    }

    const currentText = document.content;
    const resultParts: React.ReactNode[] = [];
    let lastPos = 0;
    sourceRefs.current = {};

    suggestionMatches.forEach((match, i) => {
      if (match.start > lastPos) {
        resultParts.push(<span key={`text-${i}`}>{currentText.substring(lastPos, match.start)}</span>);
      }

      resultParts.push(
        <span 
          key={`match-${i}`}
          ref={el => { sourceRefs.current[match.sugIndex] = el }}
          onMouseEnter={() => setHoveredIndex(match.sugIndex)}
          onMouseLeave={() => setHoveredIndex(null)}
          className={`cursor-pointer transition-all duration-200 rounded-sm
            ${hoveredIndex === match.sugIndex 
              ? 'bg-yellow-200 text-black px-0.5 box-decoration-clone shadow-sm' 
              : 'border-b border-dashed border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white'}`}
        >
          {currentText.substring(match.start, match.end)}
        </span>
      );
      lastPos = match.end;
    });

    if (lastPos < currentText.length) {
      resultParts.push(<span key="text-end">{currentText.substring(lastPos)}</span>);
    }

    return (
      <div 
        className="flex-1 p-8 text-sm leading-loose whitespace-pre-wrap font-sans overflow-y-auto cursor-text select-text text-black dark:text-gray-100"
        onDoubleClick={() => setMode('edit')}
        onMouseUp={handleReviewSelect}
        title="Double-click to edit, select text to refine specific parts"
      >
        {resultParts.length > 0 ? resultParts : currentText}
      </div>
    );
  };

  // Render Preview
  const renderPreviewContent = () => {
     const currentText = document.content;
     const suggestions = document.activeSuggestions || [];
     const resultParts: React.ReactNode[] = [];
     let lastPos = 0;
     targetRefs.current = {};

     suggestionMatches.forEach((match, i) => {
       if (match.start > lastPos) {
         resultParts.push(<span key={`p-text-${i}`} className="text-black/60 dark:text-white/60">{currentText.substring(lastPos, match.start)}</span>);
       }
       
       const sug = suggestions[match.sugIndex];
       const isHovered = hoveredIndex === match.sugIndex;
       
       resultParts.push(
         <span 
           key={`p-match-${i}`}
           ref={el => { targetRefs.current[match.sugIndex] = el }}
           onMouseEnter={() => setHoveredIndex(match.sugIndex)}
           onMouseLeave={() => setHoveredIndex(null)}
           className={`cursor-pointer transition-all duration-200 rounded-sm relative group
             ${isHovered
               ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-0.5 box-decoration-clone shadow-sm' 
               : 'bg-green-50/50 dark:bg-green-900/30 text-black dark:text-white'}`}
         >
           {sug.modifiedText}
           
           {/* Popover Actions for Preview Mode */}
           {isHovered && (
             <span className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-black dark:border-white/20 shadow-lg p-2 min-w-[140px] rounded flex flex-col gap-2 pointer-events-auto">
               <div className="text-[10px] text-black/60 dark:text-white/60 italic leading-tight mb-1">{sug.reason}</div>
               <div className="flex items-center gap-1">
                 <button onClick={(e) => { e.stopPropagation(); handleAcceptChange(match.sugIndex); }} className="flex-1 bg-black text-white dark:bg-white dark:text-black p-1 rounded hover:opacity-80" title={t('editor.btn.accept')}>
                   <CheckIcon className="w-3 h-3 mx-auto"/>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); handleRetryChange(match.sugIndex); }} className="flex-1 border border-black/10 dark:border-white/10 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10" title={t('editor.btn.retry')}>
                    {processingCardIndex === match.sugIndex ? <div className="w-3 h-3 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"/> : <RefreshIcon className="w-3 h-3 mx-auto"/>}
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); handleRejectChange(match.sugIndex); }} className="flex-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title={t('editor.btn.reject')}>
                   <XIcon className="w-3 h-3 mx-auto"/>
                 </button>
               </div>
             </span>
           )}
         </span>
       );
       lastPos = match.end;
     });

     if (lastPos < currentText.length) {
       resultParts.push(<span key="p-text-end" className="text-black/60 dark:text-white/60">{currentText.substring(lastPos)}</span>);
     }

     return (
        <div className="p-8 text-sm leading-loose whitespace-pre-wrap font-sans pb-32">
           {resultParts}
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a] relative transition-colors">
      {/* Top Bar */}
      <div className="h-14 border-b border-black/10 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a] shrink-0 z-20">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={document.title} 
            onChange={(e) => onUpdate({...document, title: e.target.value})}
            className="font-bold text-sm tracking-tight border-none focus:outline-none focus:ring-0 w-64 bg-transparent text-black dark:text-white placeholder-black/30 dark:placeholder-white/30"
          />
          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10"></div>
          <div className="flex items-center gap-4 text-[10px] text-black/40 dark:text-white/40 font-mono">
            <span>{stats.lines} {t('editor.lines')}</span>
            <span>{stats.words} {t('editor.words')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-black/5 dark:bg-white/10 rounded p-0.5">
             <button 
               onClick={() => setMode('edit')}
               className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${
                 mode === 'edit' 
                  ? 'bg-white dark:bg-black shadow-sm text-black dark:text-white' 
                  : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
               }`}
             >
               {t('editor.mode.edit')}
             </button>
             <button 
               onClick={() => setMode('review')}
               className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${
                 mode === 'review' 
                  ? 'bg-white dark:bg-black shadow-sm text-black dark:text-white' 
                  : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
               }`}
             >
               {t('editor.mode.review')}
             </button>
          </div>
          <button 
            onClick={handleLocalSnapshot}
            className="px-4 py-1.5 border border-black dark:border-white text-[10px] font-bold text-black dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all line-art-shadow"
          >
            {t('editor.btn.snapshot')}
          </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden relative" ref={containerRef}>
        
        {/* SVG Connector Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible">
          {lineCoords && (
            <path 
              d={`M ${lineCoords.x1} ${lineCoords.y1} C ${lineCoords.x1 + 60} ${lineCoords.y1}, ${lineCoords.x2 - 60} ${lineCoords.y2}, ${lineCoords.x2} ${lineCoords.y2}`}
              fill="none"
              stroke={theme === 'dark' ? 'white' : 'black'}
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="animate-pulse opacity-50"
            />
          )}
          {lineCoords && (
             <>
                <circle cx={lineCoords.x1} cy={lineCoords.y1} r="3" fill={theme === 'dark' ? 'white' : 'black'} />
                <circle cx={lineCoords.x2} cy={lineCoords.y2} r="3" fill={theme === 'dark' ? 'white' : 'black'} />
             </>
          )}
        </svg>

        {/* LEFT PANEL */}
        <div className="flex-1 border-r border-black/10 dark:border-white/10 flex flex-col relative bg-white dark:bg-[#0a0a0a] z-10 transition-colors">
          <div className="absolute top-4 right-6 text-[10px] font-bold text-black/20 dark:text-white/20 pointer-events-none uppercase tracking-widest z-10">
            {mode === 'edit' ? t('editor.mode.editorLabel') : t('editor.mode.originalLabel')}
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-black/[0.02] dark:bg-white/[0.02] border-r border-black/5 dark:border-white/5 text-right p-4 text-[10px] font-mono text-black/20 dark:text-white/20 select-none overflow-hidden">
             {Array.from({ length: Math.max(stats.lines, 1) }).map((_, i) => (
                <div key={i} className="h-6 leading-6">{i + 1}</div>
              ))}
          </div>
          <div className="flex-1 flex pl-12 overflow-hidden relative">
            {renderSourceContent()}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#111] relative overflow-hidden z-10 transition-colors">
          
          {/* Right Panel Header */}
          <div className="h-10 border-b border-black/5 dark:border-white/5 flex items-center justify-between px-4 bg-slate-50/50 dark:bg-[#111]/50 backdrop-blur-sm z-20 shrink-0">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    viewMode === 'list' 
                      ? 'bg-black dark:bg-white text-white dark:text-black' 
                      : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t('editor.view.changes')}
                </button>
                <div className="w-[1px] h-3 bg-black/10 dark:bg-white/10"></div>
                <button 
                  onClick={() => setViewMode('preview')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    viewMode === 'preview' 
                      ? 'bg-black dark:bg-white text-white dark:text-black' 
                      : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t('editor.view.preview')}
                </button>
             </div>
             <button
               onClick={handleCopyRightPanel}
               title="Copy result"
               className="text-[10px] font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white uppercase tracking-wider flex items-center gap-1"
             >
               <span>{t('editor.btn.copy')}</span>
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {(!document.activeSuggestions || !document.activeSuggestions.length) ? (
               <div className="h-full flex flex-col items-center justify-center text-black/20 dark:text-white/20 space-y-4">
                  <div className="w-16 h-16 border-2 border-black/10 dark:border-white/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">AI</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium uppercase tracking-widest">{t('editor.empty.title')}</p>
                    <p className="text-[10px] mt-1 opacity-70">{t('editor.empty.desc')}</p>
                  </div>
               </div>
            ) : (
              <>
                 {viewMode === 'list' ? (
                   // LIST VIEW (Cards)
                   <div className="p-8 space-y-4 max-w-xl mx-auto pb-20">
                     {document.activeSuggestions.map((sug, idx) => (
                       <div 
                         key={idx}
                         ref={el => { targetRefs.current[idx] = el }}
                         onMouseEnter={() => setHoveredIndex(idx)}
                         onMouseLeave={() => setHoveredIndex(null)}
                         className={`transition-all duration-300 ${
                           hoveredIndex === idx 
                             ? 'translate-x-2' 
                             : ''
                         }`}
                       >
                         <div className={`p-5 border transition-all relative ${
                           hoveredIndex === idx 
                             ? 'bg-white dark:bg-[#1a1a1a] border-black dark:border-white line-art-shadow shadow-xl z-20' 
                             : 'bg-white dark:bg-[#161616] border-black/5 dark:border-white/10 shadow-sm opacity-80 hover:opacity-100 hover:border-black/20 dark:hover:border-white/30'
                         }`}>
                           
                           <div>
                             <p className="text-sm font-medium leading-relaxed text-black dark:text-gray-100">
                               {sug.modifiedText}
                             </p>
                           </div>

                           <div className={`overflow-hidden transition-all duration-300 ease-in-out ${hoveredIndex === idx ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-black/5 dark:border-white/5' : 'max-h-0 opacity-0'}`}>
                              <div className="grid gap-4">
                                 <div>
                                     <p className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase mb-1 tracking-wider">{t('editor.card.analysis')}</p>
                                     <p className="text-xs text-black/70 dark:text-white/70 leading-relaxed italic">
                                     "{sug.reason}"
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-1 tracking-wider">{t('editor.card.diff')}</p>
                                     <div className="text-xs leading-relaxed text-black/80 dark:text-white/80 font-mono bg-black/[0.02] dark:bg-white/[0.05] p-2 rounded whitespace-pre-wrap">
                                       {computeDiff(sug.originalText, sug.modifiedText).map((part, i) => (
                                         <span 
                                           key={i} 
                                           className={`${
                                             part.type === 'add' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                                             part.type === 'remove' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300 line-through' :
                                             'text-gray-500 dark:text-gray-400'
                                           }`}
                                         >
                                           {part.value}
                                         </span>
                                       ))}
                                     </div>
                                 </div>
                                 
                                 {/* ACTIONS (List View) */}
                                 <div className="flex items-center gap-2 pt-2">
                                    <button onClick={() => handleAcceptChange(idx)} className="flex-1 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
                                      <CheckIcon className="w-3 h-3" /> {t('editor.btn.accept')}
                                    </button>
                                    <button onClick={() => handleRetryChange(idx)} disabled={processingCardIndex === idx} className="px-3 py-2 bg-transparent border border-black/10 dark:border-white/10 text-black dark:text-white text-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                      {processingCardIndex === idx ? <div className="w-3 h-3 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"/> : <RefreshIcon className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => handleRejectChange(idx)} className="px-3 py-2 bg-transparent border border-red-100 dark:border-red-900 text-red-500 dark:text-red-400 text-[10px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                      <XIcon className="w-3 h-3" />
                                    </button>
                                 </div>
                              </div>
                           </div>

                         </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   // PREVIEW VIEW (Full Text)
                   renderPreviewContent()
                 )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Console */}
      <div className="p-6 border-t border-black/10 dark:border-white/10 bg-white dark:bg-[#0a0a0a] z-20 relative transition-colors">
        <form onSubmit={handleAIChat} className="max-w-3xl mx-auto flex flex-col gap-4 relative">
          
          {/* Selection Indicator */}
          {selection && (
            <div className="absolute bottom-full mb-4 left-0 right-0 flex justify-center">
              <div className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-xs font-medium flex items-center gap-3 shadow-lg animate-bounce-in">
                <span className="max-w-[200px] truncate">{t('editor.target.selection')}: "{selection}"</span>
                <button type="button" onClick={() => setSelection('')} className="hover:text-red-300 dark:hover:text-red-500">
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Slash Command Menu */}
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2 w-full max-w-lg bg-white dark:bg-[#1a1a1a] border border-black dark:border-white/20 shadow-lg rounded-t-lg overflow-hidden z-50">
              <div className="bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                {t('editor.menu.commands')}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    onMouseEnter={() => setCommandIndex(index)}
                    className={`w-full text-left px-4 py-3 border-b border-black/5 dark:border-white/5 last:border-b-0 flex flex-col transition-colors ${
                      index === commandIndex 
                        ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs font-bold text-black dark:text-white">{cmd.label}</span>
                    <span className="text-[10px] text-black/50 dark:text-white/50">{cmd.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <input 
              type="text"
              value={chatInput}
              onChange={handleChatChange}
              onKeyDown={handleKeyDown}
              placeholder={selection ? t('editor.input.selection') : t('editor.input.placeholder')}
              className="flex-1 px-4 py-3 bg-white dark:bg-[#111] border border-black dark:border-white/20 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-black dark:text-white text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] transition-shadow placeholder:text-black/30 dark:placeholder:text-white/30"
              disabled={isProcessing}
              autoComplete="off"
            />
             <div className="flex items-stretch border border-black dark:border-white/20 bg-white dark:bg-[#111] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]">
              {(['preserve', 'refine', 'elevate'] as ModificationLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setModLevel(level)}
                  className={`px-4 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-black dark:border-white/20 last:border-r-0 ${
                    modLevel === level 
                      ? 'bg-gray-100 dark:bg-white/10 text-black dark:text-white shadow-inner' 
                      : 'bg-white dark:bg-transparent text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  disabled={isProcessing}
                  title={t(`strategy.${level}.desc` as any)}
                >
                  {t(`strategy.${level}` as any)}
                </button>
              ))}
            </div>
            <button 
              type="submit"
              disabled={isProcessing}
              className="px-6 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] disabled:opacity-50"
            >
              {isProcessing ? t('editor.btn.thinking') : t('editor.btn.run')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
