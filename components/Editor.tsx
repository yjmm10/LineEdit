
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserDocument, SuggestedChange, ModificationLevel } from '../types';
import { refineDocument } from '../services/geminiService';

interface EditorProps {
  document: UserDocument;
  onUpdate: (doc: UserDocument) => void;
  onTakeSnapshot: () => void;
}

// --- Robust Diff Utility (Token-based LCS) ---
type DiffPart = { type: 'same' | 'add' | 'remove'; value: string };

const computeDiff = (text1: string, text2: string): DiffPart[] => {
  // Tokenize by word, whitespace, or punctuation to ensure granular diffs
  const t1 = text1.match(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/g) || [];
  const t2 = text2.match(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/g) || [];
  
  // Standard LCS Dynamic Programming
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

  // Backtrack to generate Diff
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
  const [mode, setMode] = useState<'edit' | 'review'>('edit');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [modLevel, setModLevel] = useState<ModificationLevel>('refine');

  // Slash Command State
  const [showCommands, setShowCommands] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);

  // Refs for connector lines
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<{ [key: number]: HTMLSpanElement | null }>({});
  const targetRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [lineCoords, setLineCoords] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  // Automatically manage mode based on suggestions
  useEffect(() => {
    if (document.activeSuggestions && document.activeSuggestions.length > 0) {
      setMode('review');
    } else {
      // If no suggestions (e.g. restored clean snapshot), switch to edit mode
      setMode('edit');
    }
  }, [document.activeSuggestions]);

  // Update line coordinates when hover changes or scroll happens
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

    // Add listeners to update line on scroll/resize
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
  }, [hoveredIndex, mode, document.activeSuggestions]);


  const stats = useMemo(() => {
    const lines = document.content ? document.content.split('\n').length : 0;
    const chars = document.content.length;
    const words = document.content.trim() ? document.content.trim().split(/\s+/).length : 0;
    return { lines, chars, words };
  }, [document.content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({
      ...document,
      content: e.target.value,
      lastModified: Date.now(),
      activeSuggestions: [] // Clear suggestions on edit
    });
  };

  // Chat Input Logic with Slash Commands
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
      setCommandIndex(0); // Reset selection
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
    // Optional: Focus back or auto-submit? Let's keep it as fill-in for now so user can edit.
  };

  const handleAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setShowCommands(false); // Ensure menu is closed
    try {
      const response = await refineDocument(document.content, chatInput, modLevel);
      onUpdate({
        ...document,
        activeSuggestions: response.suggestions,
        lastModified: Date.now()
      });
      setChatInput('');
      setMode('review');
    } catch (error) {
      console.error("AI Modification Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to render the Left Panel content (Interactive Review Mode)
  const renderSourceContent = () => {
    if (mode === 'edit') {
      return (
        <textarea
          value={document.content}
          onChange={handleContentChange}
          placeholder="Start typing or paste your content..."
          className="flex-1 p-8 text-sm leading-loose focus:outline-none resize-none bg-transparent font-sans"
        />
      );
    }

    // Review Mode: Render text with interactive spans
    const currentText = document.content;
    const resultParts: React.ReactNode[] = [];
    let lastPos = 0;

    // Reset refs map
    sourceRefs.current = {};

    const matches: { start: number; end: number; sugIndex: number }[] = [];
    
    // Ensure activeSuggestions exists
    const suggestions = document.activeSuggestions || [];
    
    suggestions.forEach((sug, idx) => {
      let searchPos = 0;
      // Simplistic matching: find first non-overlapping occurrence
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
          break; // Only match the first occurrence for this specific suggestion index to avoid confusion
        }
        searchPos = foundIdx + 1;
      }
    });

    matches.sort((a, b) => a.start - b.start);

    matches.forEach((match, i) => {
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
        title="Double-click to edit"
      >
        {resultParts.length > 0 ? resultParts : currentText}
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

        {/* LEFT PANEL: Source Document */}
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

        {/* RIGHT PANEL: Modification Suggestions */}
        <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden z-10">
          <div className="absolute top-4 right-6 text-[10px] font-bold text-black/20 pointer-events-none uppercase tracking-widest z-10">
            Suggested Revisions
          </div>
          
          <div className="flex-1 overflow-y-auto p-8">
            {(!document.activeSuggestions || !document.activeSuggestions.length) ? (
               <div className="h-full flex flex-col items-center justify-center text-black/20 space-y-4">
                  <div className="w-16 h-16 border-2 border-black/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">AI</span>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-widest">No Active Suggestions</p>
               </div>
            ) : (
              <div className="space-y-4 max-w-xl mx-auto pt-8 pb-20">
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
                      
                      {/* Default View: Just the modified sentence */}
                      <div>
                        <p className="text-sm font-medium leading-relaxed text-black">
                          {sug.modifiedText}
                        </p>
                      </div>

                      {/* Hover View: Reveal Analysis and Diff */}
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
                         </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Console */}
      <div className="p-6 border-t border-black/10 bg-white z-20 relative">
        <form onSubmit={handleAIChat} className="max-w-3xl mx-auto flex flex-col gap-4 relative">
          
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
              placeholder="Type '/' for commands or ask AI..."
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
