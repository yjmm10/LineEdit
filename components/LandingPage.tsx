
import React from 'react';
import { LineArtBackground } from './LineArtBackground';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-white">
      <LineArtBackground />
      
      <header className="fixed top-0 w-full p-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 border-2 border-black flex items-center justify-center font-bold">L</div>
          <span className="text-xl font-bold tracking-tighter">LINEEDIT AI</span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <a href="#" className="hover:underline">Features</a>
          <a href="#" className="hover:underline">Pricing</a>
          <a href="#" className="hover:underline">About</a>
        </nav>
      </header>

      <main className="max-w-4xl text-center space-y-8 z-10">
        <div className="inline-block px-4 py-1 border border-black/10 rounded-full text-xs font-semibold tracking-widest text-black/60 uppercase">
          Revolutionize Your Writing
        </div>
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] text-black">
          Precise Edits.<br/><span className="text-black/30">AI Powered.</span>
        </h1>
        <p className="text-lg md:text-xl text-black/60 max-w-2xl mx-auto leading-relaxed">
          The minimalist editor that transforms your drafts into masterpieces. Real-time suggestions, version snapshots, and intelligent document analysis.
        </p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
          <button 
            onClick={onStart}
            className="px-8 py-4 bg-black text-white text-lg font-bold border-2 border-black hover:bg-white hover:text-black transition-all duration-300 line-art-shadow"
          >
            Launch Editor
          </button>
          <button className="px-8 py-4 bg-transparent text-black text-lg font-bold border-2 border-black hover:bg-black/5 transition-all">
            View Demo
          </button>
        </div>
      </main>

      <footer className="fixed bottom-0 w-full p-8 flex justify-center text-[10px] text-black/40 uppercase tracking-[0.2em]">
        Designed for thinkers &middot; Built with precision &middot; © 2024 LineEdit
      </footer>
    </div>
  );
};
