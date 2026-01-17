
import React from 'react';

export const LineArtBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
      <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M-50 400C150 200 450 600 720 400C990 200 1290 600 1490 400" stroke="black" strokeWidth="1" className="drawing-line" />
        <circle cx="1200" cy="150" r="80" stroke="black" strokeWidth="1" strokeDasharray="5 5" />
        <rect x="100" y="550" width="200" height="150" stroke="black" strokeWidth="1" strokeDasharray="10 2" />
        <path d="M0 700L1440 700" stroke="black" strokeWidth="0.5" />
        <path d="M200 0V800" stroke="black" strokeWidth="0.5" />
        <path d="M1200 0V800" stroke="black" strokeWidth="0.5" />
      </svg>
    </div>
  );
};
