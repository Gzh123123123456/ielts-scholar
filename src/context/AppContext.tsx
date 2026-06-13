import React, { createContext, useContext, useState, useEffect } from 'react';
import { speakingPart1, writingTask2 } from '../data/questions/bank';
import { ProviderDiagnostic } from '../lib/ai/schemas';

interface UserProfile {
  totalSessions: number;
  estimatedBandHistory: { date: string; band: number }[];
  errorTags: Record<string, number>;
  lastPracticed: string | null;
  masteredExpressions: MasteredExpressionMemory[];
}

export interface MasteredExpressionMemory {
  id: string;
  expression: string;
  source: 'part2_signal' | 'part3_language_bank' | 'part3_discussion_frame' | 'manual';
  signal?: string;
  module?: string;
  part?: number;
  createdAt: string;
  updatedAt: string;
  count: number;
}

interface BrowserCapabilities {
  speechRecognition: boolean;
  webkitSpeechRecognition: boolean;
  mediaRecorder: boolean;
  getUserMedia: boolean;
  microphonePermission: PermissionState | 'unknown';
}

interface AppContextType {
  profile: UserProfile;
  saveSession: (data: any) => void;
  sessions: any[];
  debugLogs: string[];
  addDebugLog: (log: string) => void;
  markMasteredExpression: (item: {
    expression: string;
    source?: MasteredExpressionMemory['source'];
    signal?: string;
    module?: string;
    part?: number;
  }) => void;
  forgetMasteredExpression: (item: { expression: string; signal?: string }) => void;
  providerDiagnostic: ProviderDiagnostic | null;
  setProviderDiagnostic: (diagnostic: ProviderDiagnostic | null) => void;
  providerDiagnostics: ProviderDiagnostic[];
  capabilities: BrowserCapabilities;
  setCapabilities: (caps: Partial<BrowserCapabilities>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultProfile = (): UserProfile => ({
  totalSessions: 0,
  estimatedBandHistory: [],
  errorTags: {},
  lastPracticed: null,
  masteredExpressions: [],
});

const profileExpressionKey = (expression: string, signal?: string) =>
  `${signal || 'any'}:${expression.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const sanitizeProfile = (value: unknown): UserProfile => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultProfile();
  const source = value as Partial<UserProfile>;
  return {
    totalSessions: typeof source.totalSessions === 'number' ? source.totalSessions : 0,
    estimatedBandHistory: Array.isArray(source.estimatedBandHistory)
      ? source.estimatedBandHistory.filter(item => (
        item &&
        typeof item === 'object' &&
        typeof (item as { date?: unknown }).date === 'string' &&
        typeof (item as { band?: unknown }).band === 'number'
      )) as UserProfile['estimatedBandHistory']
      : [],
    errorTags: source.errorTags && typeof source.errorTags === 'object' && !Array.isArray(source.errorTags)
      ? source.errorTags
      : {},
    lastPracticed: typeof source.lastPracticed === 'string' ? source.lastPracticed : null,
    masteredExpressions: Array.isArray(source.masteredExpressions)
      ? source.masteredExpressions
        .filter(item => (
          item &&
          typeof item === 'object' &&
          typeof (item as { expression?: unknown }).expression === 'string'
        ))
        .map((item): MasteredExpressionMemory => {
          const record = item as Partial<MasteredExpressionMemory>;
          const expression = record.expression?.trim() || '';
          const signal = typeof record.signal === 'string' ? record.signal : undefined;
          const now = new Date().toISOString();
          return {
            id: typeof record.id === 'string' && record.id ? record.id : profileExpressionKey(expression, signal),
            expression,
            source: record.source === 'manual' ||
              record.source === 'part2_signal' ||
              record.source === 'part3_language_bank' ||
              record.source === 'part3_discussion_frame'
              ? record.source
              : 'part2_signal',
            signal,
            module: typeof record.module === 'string' ? record.module : undefined,
            part: typeof record.part === 'number' ? record.part : undefined,
            createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
            count: typeof record.count === 'number' && record.count > 0 ? record.count : 1,
          };
        })
        .filter(item => item.expression)
        .slice(0, 100)
      : [],
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() =>
    sanitizeProfile(readJson<unknown>('ielts_profile', null))
  );

  const [sessions, setSessions] = useState<any[]>([]);

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [providerDiagnostic, setProviderDiagnostic] = useState<ProviderDiagnostic | null>(null);
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [capabilities, setCapabilitiesState] = useState<BrowserCapabilities>({
    speechRecognition: false,
    webkitSpeechRecognition: false,
    mediaRecorder: false,
    getUserMedia: false,
    microphonePermission: 'unknown'
  });

  const setCapabilities = (caps: Partial<BrowserCapabilities>) => {
    setCapabilitiesState(prev => ({ ...prev, ...caps }));
  };

  const addDebugLog = (log: string) => {
    setDebugLogs(prev => [new Date().toISOString() + ': ' + log, ...prev].slice(0, 50));
  };

  const recordProviderDiagnostic = (diagnostic: ProviderDiagnostic | null) => {
    setProviderDiagnostic(diagnostic);
    setProviderDiagnostics(prev => diagnostic ? [diagnostic, ...prev].slice(0, 12) : []);
  };

  const markMasteredExpression: AppContextType['markMasteredExpression'] = ({
    expression,
    source = 'part2_signal',
    signal,
    module,
    part,
  }) => {
    const cleanExpression = expression.replace(/\s+/g, ' ').trim();
    if (!cleanExpression) return;
    const key = profileExpressionKey(cleanExpression, signal);
    const now = new Date().toISOString();
    setProfile(prev => {
      const existing = prev.masteredExpressions.find(item =>
        profileExpressionKey(item.expression, item.signal) === key
      );
      if (existing) {
        return {
          ...prev,
          masteredExpressions: [
            {
              ...existing,
              updatedAt: now,
              count: existing.count + 1,
            },
            ...prev.masteredExpressions.filter(item => item !== existing),
          ].slice(0, 100),
        };
      }
      return {
        ...prev,
        masteredExpressions: [
          {
            id: key,
            expression: cleanExpression,
            source,
            signal,
            module,
            part,
            createdAt: now,
            updatedAt: now,
            count: 1,
          },
          ...prev.masteredExpressions,
        ].slice(0, 100),
      };
    });
  };

  const forgetMasteredExpression: AppContextType['forgetMasteredExpression'] = ({ expression, signal }) => {
    const key = profileExpressionKey(expression, signal);
    setProfile(prev => ({
      ...prev,
      masteredExpressions: prev.masteredExpressions.filter(item =>
        profileExpressionKey(item.expression, item.signal) !== key
      ),
    }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('ielts_profile', JSON.stringify(profile));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[ielts] localStorage quota exceeded saving profile.');
      }
    }
  }, [profile]);

  useEffect(() => {
    // Check initial capabilities
    const hasSpeech = !!(window as any).SpeechRecognition;
    const hasWebkitSpeech = !!(window as any).webkitSpeechRecognition;
    const hasMediaRecorder = !!(window.MediaRecorder);
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    setCapabilities({
      speechRecognition: hasSpeech,
      webkitSpeechRecognition: hasWebkitSpeech,
      mediaRecorder: hasMediaRecorder,
      getUserMedia: hasGetUserMedia
    });
    
    if (navigator.permissions && (navigator.permissions as any).query) {
      navigator.permissions.query({ name: 'microphone' as any }).then(status => {
        setCapabilities({ microphonePermission: status.state });
        status.onchange = () => {
          setCapabilities({ microphonePermission: status.state });
        };
      });
    }
  }, []);

  const saveSession = (event: { id: string; module?: string; part?: number; task?: string; band?: number }) => {
    setSessions(prev => [{ date: new Date().toISOString(), ...event }, ...prev].slice(0, 20));
    setProfile(prev => ({
      ...prev,
      totalSessions: prev.totalSessions + 1,
      lastPracticed: new Date().toISOString(),
      estimatedBandHistory: typeof event.band === 'number'
        ? [...prev.estimatedBandHistory, { date: new Date().toISOString(), band: event.band }]
        : prev.estimatedBandHistory,
    }));
    addDebugLog(`Session completed: ${event.id}`);
  };

  return (
    <AppContext.Provider value={{
      profile,
      saveSession,
      sessions,
      debugLogs,
      addDebugLog,
      markMasteredExpression,
      forgetMasteredExpression,
      providerDiagnostic,
      setProviderDiagnostic: recordProviderDiagnostic,
      providerDiagnostics,
      capabilities,
      setCapabilities,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
