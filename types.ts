
export interface DocumentSnapshot {
  id: string;
  timestamp: number;
  content: string;
  suggestions: SuggestedChange[];
}

export interface SuggestedChange {
  originalText: string;
  modifiedText: string;
  reason: string;
}

export interface UserDocument {
  id: string;
  title: string;
  content: string;
  lastModified: number;
  snapshots: DocumentSnapshot[];
  activeSuggestions: SuggestedChange[];
}

export interface AIResponse {
  summary: string;
  suggestions: SuggestedChange[];
}

export type ModificationLevel = 'preserve' | 'refine' | 'elevate';
