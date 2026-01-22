import React, { useState, useEffect } from 'react';
// import { Analytics } from '@vercel/analytics/react';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { UserDocument, DocumentSnapshot } from './types';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';

const STORAGE_KEY = 'lineedit_docs_data';

const INITIAL_DOC: UserDocument = {
  id: 'default',
  title: 'Untitled Masterpiece',
  content: '一款面向创作者的极简设计引擎。具有高冲击力的排版、精准的控制以及精致的线条艺术美感。',
  lastModified: Date.now(),
  snapshots: [],
  activeSuggestions: []
};

const AppContent: React.FC = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [documents, setDocuments] = useState<UserDocument[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [INITIAL_DOC];
  });
  const [activeDocId, setActiveDocId] = useState<string>(documents[0]?.id || 'default');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  const activeDoc = documents.find(d => d.id === activeDocId) || documents[0];

  const handleUpdateDoc = (updatedDoc: UserDocument) => {
    setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
  };

  const handleNewDoc = () => {
    const newDoc: UserDocument = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Document',
      content: '',
      lastModified: Date.now(),
      snapshots: [],
      activeSuggestions: []
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveDocId(newDoc.id);
  };

  const handleTakeSnapshot = () => {
    if (!activeDoc) return;
    const newSnapshot: DocumentSnapshot = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      content: activeDoc.content,
      suggestions: [...(activeDoc.activeSuggestions || [])]
    };
    handleUpdateDoc({
      ...activeDoc,
      snapshots: [...activeDoc.snapshots, newSnapshot]
    });
  };

  const handleRestoreSnapshot = (docId: string, snapshot: DocumentSnapshot) => {
    if (!window.confirm("Are you sure you want to restore this snapshot? Current unsaved changes will be lost.")) {
      return;
    }
    
    setDocuments(prev => prev.map(d => d.id === docId ? {
      ...d,
      content: snapshot.content,
      activeSuggestions: snapshot.suggestions || [], 
      lastModified: Date.now()
    } : d));
  };

  if (showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0a0a0a] text-black dark:text-gray-100 selection:bg-yellow-200 selection:text-black">
      <Sidebar 
        documents={documents}
        activeDocId={activeDocId}
        onSelectDoc={setActiveDocId}
        onNewDoc={handleNewDoc}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
      <main className="flex-1 overflow-hidden">
        {activeDoc && (
          <Editor 
            document={activeDoc} 
            onUpdate={handleUpdateDoc}
            onTakeSnapshot={handleTakeSnapshot}
          />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;