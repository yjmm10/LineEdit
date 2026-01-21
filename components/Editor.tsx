
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserDocument, SuggestedChange, ModificationLevel } from '../types';
import { refineDocument } from '../services/geminiService';

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

// --- Slash Commands Data ---
const SLASH_COMMANDS = [
  { label: 'Polish / Improve', value: 'Polish this text for better flow, clarity, and professional tone.', desc: 'Enhance writing quality' },
  { label: 'Fix Grammar', value: 'Fix all grammar, spelling, and punctuation errors.', desc: 'Strict corrections only' },
  { label: 'Translate to English', value: 'Translate this text into fluent, natural English.', desc: 'Language conversion' },
  { label: 'Translate to Chinese', value: 'Translate this text into fluent, natural Chinese.', desc: 'Language conversion' },
  { label: 'Make Concise', value: 'Make this text more concise and direct, removing fluff.', desc: 'Shorten content' },
  { label: 'To Markdown', value: 'Convert this text into structured Markdown format (headers, lists, bolding).', desc: 'Format conversion' },
  { label: 'Expand / Elaborate', value: 'Expand on these points with more detail and context.', desc: 'Add depth' },
];

// --- Component ---

export const Editor: React.FC<EditorProps> = ({ document, onUpdate, onTakeSnapshot }) => {
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
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);

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
      }
    } catch (err: any) {
      console.error("Retry failed", err);
      alert("Retry failed: " + err.message);
    } finally {
      setProcessingCardIndex(null);
    }
  };

  const handleCopyRightPanel = () => {
    navigator.clipboard.writeText(fullModifiedText);
    alert("Full modified text copied to clipboard!");
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
      const filtered = SLASH_COMMANDS.filter(cmd => 
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

  const selectCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
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
      onUpdate({
        ...document,
        activeSuggestions: response.suggestions,
        lastModified: Date.now()
      });
      setChatInput('');
      setSelection(''); // Clear selection after processing
      setMode('review');
      
      if (response.suggestions.length === 0) {
         // Provide feedback if AI returned success but no changes
         alert("AI processing complete, but no changes were suggested for this text/strategy.");
      }
    } catch (error: any) {
      console.error("AI Modification Error:", error);
      
      if (error.message === "NO_PROVIDER_CONFIGURED") {
        alert("Configuration Error: No AI Provider found.\n\nPlease set GEMINI_API_KEY or (BASE_URL + API_KEY) in your environment variables.");
      } else if (error.message === "MISSING_GEMINI_KEY") {
         alert("Configuration Error: GEMINI_API_KEY is missing in your environment.");
      } else if (error.message === "MISSING_OPENAI_CONFIG") {
         alert("Configuration Error: BASE_URL or API_KEY is missing for OpenAI compatible endpoint.");
      } else {
        alert(`AI Request Failed: ${error.message || "Unknown error"}\n\nPlease check your internet connection or API keys.`);
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
          className="flex-1 p-8 text-sm leading-loose focus:outline-none resize-none bg-transparent font-sans"
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
              : 'border-b border-dashed border-black/30 hover:border-black'}`}
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
        className="flex-1 p-8 text-sm leading-loose whitespace-pre-wrap font-sans overflow-y-auto cursor-text select-text"
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
         resultParts.push(<span key={`p-text-${i}`} className="text-black/60">{currentText.substring(lastPos, match.start)}</span>);
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
               ? 'bg-green-100 text-green-800 px-0.5 box-decoration-clone shadow-sm' 
               : 'bg-green-50/50 text-black'}`}
         >
           {sug.modifiedText}
           
           {/* Popover Actions for Preview Mode */}
           {isHovered && (
             <span className="absolute left-0 top-full mt-1 z-50 bg-white border border-black shadow-lg p-2 min-w-[140px] rounded flex flex-col gap-2 pointer-events-auto">
               <div className="text-[10px] text-black/60 italic leading-tight mb-1">{sug.reason}</div>
               <div className="flex items-center gap-1">
                 <button onClick={(e) => { e.stopPropagation(); handleAcceptChange(match.sugIndex); }} className="flex-1 bg-black text-white p-1 rounded hover:bg-gray-800" title="Accept">
                   <CheckIcon className="w-3 h-3 mx-auto"/>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); handleRetryChange(match.sugIndex); }} className="flex-1 border border-black/10 p-1 rounded hover:bg-gray-100" title="Retry">
                    {processingCardIndex === match.sugIndex ? <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto"/> : <RefreshIcon className="w-3 h-3 mx-auto"/>}
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); handleRejectChange(match.sugIndex); }} className="flex-1 border border-red-200 text-red-600 p-1 rounded hover:bg-red-50" title="Reject">
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
       resultParts.push(<span key="p-text-end" className="text-black/60">{currentText.substring(lastPos)}</span>);
     }

     return (
        <div className="p-8 text-sm leading-loose whitespace-pre-wrap font-sans pb-32">
           {resultParts}
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Top Bar */}
      <div className="h-14 border-b border-black/10 flex items-center justify-between px-6 bg-white shrink-0 z-20">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={document.title} 
            onChange={(e) => onUpdate({...document, title: e.target.value})}
            className="font-bold text-sm tracking-tight border-none focus:outline-none focus:ring-0 w-64 bg-transparent"
          />
          <div className="h-4 w-[1px] bg-black/10"></div>
          <div className="flex items-center gap-4 text-[10px] text-black/40 font-mono">
            <span>{stats.lines} LINES</span>
            <span>{stats.words} WORDS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-black/5 rounded p-0.5">
             <button 
               onClick={() => setMode('edit')}
               className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${mode === 'edit' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
             >
               EDIT
             </button>
             <button 
               onClick={() => setMode('review')}
               className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${mode === 'review' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
             >
               REVIEW
             </button>
          </div>
          <button 
            onClick={onTakeSnapshot}
            className="px-4 py-1.5 border border-black text-[10px] font-bold hover:bg-black hover:text-white transition-all line-art-shadow"
          >
            SNAPSHOT
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
              stroke="black"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          )}
          {lineCoords && (
             <>
                <circle cx={lineCoords.x1} cy={lineCoords.y1} r="3" fill="black" />
                <circle cx={lineCoords.x2} cy={lineCoords.y2} r="3" fill="black" />
             </>
          )}
        </svg>

        {/* LEFT PANEL */}
        <div className="flex-1 border-r border-black/10 flex flex-col relative bg-white z-10">
          <div className="absolute top-4 right-6 text-[10px] font-bold text-black/20 pointer-events-none uppercase tracking-widest z-10">
            {mode === 'edit' ? 'Editor Mode' : 'Original Text'}
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-black/[0.02] border-r border-black/5 text-right p-4 text-[10px] font-mono text-black/20 select-none overflow-hidden">
             {Array.from({ length: Math.max(stats.lines, 1) }).map((_, i) => (
                <div key={i} className="h-6 leading-6">{i + 1}</div>
              ))}
          </div>
          <div className="flex-1 flex pl-12 overflow-hidden relative">
            {renderSourceContent()}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden z-10">
          
          {/* Right Panel Header */}
          <div className="h-10 border-b border-black/5 flex items-center justify-between px-4 bg-slate-50/50 backdrop-blur-sm z-20 shrink-0">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}
                >
                  Changes Only
                </button>
                <div className="w-[1px] h-3 bg-black/10"></div>
                <button 
                  onClick={() => setViewMode('preview')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${viewMode === 'preview' ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}
                >
                  Full Preview
                </button>
             </div>
             <button
               onClick={handleCopyRightPanel}
               title="Copy result"
               className="text-[10px] font-bold text-black/40 hover:text-black uppercase tracking-wider flex items-center gap-1"
             >
               <span>COPY</span>
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {(!document.activeSuggestions || !document.activeSuggestions.length) ? (
               <div className="h-full flex flex-col items-center justify-center text-black/20 space-y-4">
                  <div className="w-16 h-16 border-2 border-black/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">AI</span>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-widest">No Active Suggestions</p>
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
                         <div className={`bg-white p-5 border transition-all relative ${
                           hoveredIndex === idx 
                             ? 'border-black line-art-shadow shadow-xl z-20' 
                             : 'border-black/5 shadow-sm opacity-80 hover:opacity-100 hover:border-black/20'
                         }`}>
                           
                           <div>
                             <p className="text-sm font-medium leading-relaxed text-black">
                               {sug.modifiedText}
                             </p>
                           </div>

                           <div className={`overflow-hidden transition-all duration-300 ease-in-out ${hoveredIndex === idx ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-black/5' : 'max-h-0 opacity-0'}`}>
                              <div className="grid gap-4">
                                 <div>
                                     <p className="text-[9px] font-bold text-blue-500 uppercase mb-1 tracking-wider">Analysis</p>
                                     <p className="text-xs text-black/70 leading-relaxed italic">
                                     "{sug.reason}"
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-[9px] font-bold text-purple-600 uppercase mb-1 tracking-wider">Text Diff</p>
                                     <div className="text-xs leading-relaxed text-black/80 font-mono bg-black/[0.02] p-2 rounded whitespace-pre-wrap">
                                       {computeDiff(sug.originalText, sug.modifiedText).map((part, i) => (
                                         <span 
                                           key={i} 
                                           className={`${
                                             part.type === 'add' ? 'bg-green-100 text-green-700' :
                                             part.type === 'remove' ? 'bg-red-100 text-red-600 line-through' :
                                             'text-gray-500'
                                           }`}
                                         >
                                           {part.value}
                                         </span>
                                       ))}
                                     </div>
                                 </div>
                                 
                                 {/* ACTIONS (List View) */}
                                 <div className="flex items-center gap-2 pt-2">
                                    <button onClick={() => handleAcceptChange(idx)} className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors">
                                      <CheckIcon className="w-3 h-3" /> Accept
                                    </button>
                                    <button onClick={() => handleRetryChange(idx)} disabled={processingCardIndex === idx} className="px-3 py-2 bg-white border border-black/10 text-black text-[10px] hover:bg-black/5 transition-colors">
                                      {processingCardIndex === idx ? <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"/> : <RefreshIcon className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => handleRejectChange(idx)} className="px-3 py-2 bg-white border border-red-100 text-red-500 text-[10px] hover:bg-red-50 transition-colors">
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
      <div className="p-6 border-t border-black/10 bg-white z-20 relative">
        <form onSubmit={handleAIChat} className="max-w-3xl mx-auto flex flex-col gap-4 relative">
          
          {/* Selection Indicator */}
          {selection && (
            <div className="absolute bottom-full mb-4 left-0 right-0 flex justify-center">
              <div className="bg-black text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-3 shadow-lg animate-bounce-in">
                <span className="max-w-[200px] truncate">Targeting Selection: "{selection}"</span>
                <button type="button" onClick={() => setSelection('')} className="hover:text-red-300">
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Slash Command Menu */}
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2 w-full max-w-lg bg-white border border-black shadow-lg rounded-t-lg overflow-hidden z-50">
              <div className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                Commands
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    onMouseEnter={() => setCommandIndex(index)}
                    className={`w-full text-left px-4 py-3 border-b border-black/5 last:border-b-0 flex flex-col transition-colors ${
                      index === commandIndex ? 'bg-yellow-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-black">{cmd.label}</span>
                    <span className="text-[10px] text-black/50">{cmd.desc}</span>
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
              placeholder={selection ? "Instructions for selection..." : "Type '/' for commands or ask AI..."}
              className="flex-1 px-4 py-3 bg-white border border-black focus:outline-none focus:ring-1 focus:ring-black text-black text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow placeholder:text-black/30"
              disabled={isProcessing}
              autoComplete="off"
            />
             <div className="flex items-stretch border border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
              {(['preserve', 'refine', 'elevate'] as ModificationLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setModLevel(level)}
                  className={`px-4 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-black last:border-r-0 ${
                    modLevel === level 
                      ? 'bg-gray-100 text-black shadow-inner' 
                      : 'bg-white text-black/50 hover:text-black hover:bg-black/5'
                  }`}
                  disabled={isProcessing}
                  title={level === 'preserve' ? 'Minimal Changes' : level === 'elevate' ? 'Rewrite & Polish' : 'Balanced Editing'}
                >
                  {level}
                </button>
              ))}
            </div>
            <button 
              type="submit"
              disabled={isProcessing}
              className="px-6 bg-black text-white font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] disabled:opacity-50"
            >
              {isProcessing ? 'Thinking...' : 'Run AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
