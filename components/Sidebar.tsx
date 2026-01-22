
import React from 'react';
import { UserDocument, DocumentSnapshot } from '../types';
import { Logo } from './Logo';
import { useSettings } from '../contexts/SettingsContext';

interface SidebarProps {
  documents: UserDocument[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onRestoreSnapshot: (docId: string, snapshot: DocumentSnapshot) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ documents, activeDocId, onSelectDoc, onNewDoc, onRestoreSnapshot }) => {
  const activeDoc = documents.find(d => d.id === activeDocId);
  const { t, language, setLanguage, theme, setTheme } = useSettings();

  return (
    <div className="w-64 bg-white dark:bg-[#111] h-full flex flex-col shrink-0 border-r border-black/10 dark:border-white/10 transition-colors">
      <div className="p-6 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3 mb-8">
           <Logo className="w-6 h-6 text-black dark:text-white" />
           <span className="text-sm font-bold tracking-tight text-black dark:text-white">{t('app.title')}</span>
        </div>
        <button 
          onClick={onNewDoc}
          className="w-full py-2 border border-black dark:border-white bg-white dark:bg-transparent text-black dark:text-white text-[10px] font-bold hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all"
        >
          {t('sidebar.newDoc')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-[10px] font-bold text-black/30 dark:text-white/30 mb-4 px-2 tracking-widest uppercase">{t('sidebar.files')}</h3>
          <div className="space-y-1">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => onSelectDoc(doc.id)}
                className={`w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-between ${
                  doc.id === activeDocId 
                    ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' 
                    : 'text-black/60 dark:text-white/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.05]'
                }`}
              >
                <span className="truncate">{doc.title}</span>
                {doc.id === activeDocId && <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>}
              </button>
            ))}
          </div>
        </div>

        {activeDoc && activeDoc.snapshots.length > 0 && (
          <div className="p-4 border-t border-black/5 dark:border-white/5 mt-4">
            <h3 className="text-[10px] font-bold text-black/30 dark:text-white/30 mb-4 px-2 tracking-widest uppercase">{t('sidebar.snapshots')}</h3>
            <div className="space-y-2">
              {activeDoc.snapshots.slice().reverse().map(snap => (
                <button
                  key={snap.id}
                  onClick={() => onRestoreSnapshot(activeDoc.id, snap)}
                  className="w-full group p-2 border border-black/5 dark:border-white/10 hover:border-black dark:hover:border-white transition-all text-left rounded-sm"
                >
                  <div className="text-[10px] font-bold text-black dark:text-white">{new Date(snap.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</div>
                  <div className="text-[8px] text-black/40 dark:text-white/40 truncate mt-1">
                    {snap.content.substring(0, 30)}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-black/5 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-black dark:text-white">JD</div>
          <div>
            <div className="text-[10px] font-bold uppercase text-black dark:text-white">{t('sidebar.user')}</div>
            <div className="text-[8px] text-black/40 dark:text-white/40">{t('sidebar.plan')}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="py-1.5 border border-black/10 dark:border-white/10 text-[10px] font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 uppercase transition-colors"
            >
                {language === 'en' ? 'English' : '中文'}
            </button>
            <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="py-1.5 border border-black/10 dark:border-white/10 text-[10px] font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 uppercase transition-colors"
            >
                {theme === 'light' ? 'Light' : 'Dark'}
            </button>
        </div>
      </div>
    </div>
  );
};
