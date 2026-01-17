
import React from 'react';
import { UserDocument, DocumentSnapshot } from '../types';

interface SidebarProps {
  documents: UserDocument[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onRestoreSnapshot: (docId: string, snapshot: DocumentSnapshot) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ documents, activeDocId, onSelectDoc, onNewDoc, onRestoreSnapshot }) => {
  const activeDoc = documents.find(d => d.id === activeDocId);

  return (
    <div className="w-64 bg-white h-full flex flex-col shrink-0">
      <div className="p-6 border-b border-black/10">
        <div className="flex items-center gap-2 mb-8">
           <div className="w-6 h-6 border border-black flex items-center justify-center font-bold text-[10px]">L</div>
           <span className="text-sm font-bold tracking-tight">LINEEDIT</span>
        </div>
        <button 
          onClick={onNewDoc}
          className="w-full py-2 border border-black bg-white text-black text-[10px] font-bold hover:bg-black hover:text-white transition-all"
        >
          + NEW DOCUMENT
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-[10px] font-bold text-black/30 mb-4 px-2 tracking-widest uppercase">Files</h3>
          <div className="space-y-1">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => onSelectDoc(doc.id)}
                className={`w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-between ${doc.id === activeDocId ? 'bg-black/5 text-black' : 'text-black/60 hover:bg-black/[0.02]'}`}
              >
                <span className="truncate">{doc.title}</span>
                {doc.id === activeDocId && <div className="w-1.5 h-1.5 bg-black rounded-full"></div>}
              </button>
            ))}
          </div>
        </div>

        {activeDoc && activeDoc.snapshots.length > 0 && (
          <div className="p-4 border-t border-black/5 mt-4">
            <h3 className="text-[10px] font-bold text-black/30 mb-4 px-2 tracking-widest uppercase">Snapshots</h3>
            <div className="space-y-2">
              {activeDoc.snapshots.slice().reverse().map(snap => (
                <button
                  key={snap.id}
                  onClick={() => onRestoreSnapshot(activeDoc.id, snap)}
                  className="w-full group p-2 border border-black/5 hover:border-black transition-all text-left"
                >
                  <div className="text-[10px] font-bold text-black">{new Date(snap.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</div>
                  <div className="text-[8px] text-black/40 truncate mt-1">
                    {snap.content.substring(0, 30)}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-black/10 bg-black/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black/5 flex items-center justify-center text-[10px] font-bold">JD</div>
          <div>
            <div className="text-[10px] font-bold uppercase">John Doe</div>
            <div className="text-[8px] text-black/40">FREE PLAN</div>
          </div>
        </div>
      </div>
    </div>
  );
};
