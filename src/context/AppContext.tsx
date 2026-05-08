import React, { createContext, useContext, useState, useEffect } from 'react';
import { speakingPart1, writingTask2 } from '../data/questions/bank';
import { ProviderDiagnostic } from '../lib/ai/schemas';

interface UserProfile {
  totalSessions: number;
  estimatedBandHistory: { date: string; band: number }[];
  errorTags: Record<string, number>;
  lastPracticed: string | null;
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
  providerDiagnostic: ProviderDiagnostic | null;
  setProviderDiagnostic: (diagnostic: ProviderDiagnostic | null) => void;
  capabilities: BrowserCapabilities;
  setCapabilities: (caps: Partial<BrowserCapabilities>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultProfile = (): UserProfile => ({
  totalSessions: 0,
  estimatedBandHistory: [],
  errorTags: {},
  lastPracticed: null,
});

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
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() =>
    sanitizeProfile(readJson<unknown>('ielts_profile', null))
  );

  const [sessions, setSessions] = useState<any[]>(() => {
    const saved = readJson<unknown>('ielts_sessions', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [providerDiagnostic, setProviderDiagnostic] = useState<ProviderDiagnostic | null>(null);
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

  useEffect(() => {
    localStorage.setItem('ielts_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('ielts_sessions', JSON.stringify(sessions));
  }, [sessions]);

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

  const saveSession = (session: any) => {
    setSessions(prev => [session, ...prev]);
    setProfile(prev => ({
      ...prev,
      totalSessions: prev.totalSessions + 1,
      lastPracticed: new Date().toISOString(),
      estimatedBandHistory: [...prev.estimatedBandHistory, { date: new Date().toISOString(), band: session.feedback?.bandEstimateExcludingPronunciation || session.feedback?.scores?.taskResponse || 0 }]
    }));
    addDebugLog(`Session saved: ${session.id}`);
  };

  return (
    <AppContext.Provider value={{
      profile,
      saveSession,
      sessions,
      debugLogs,
      addDebugLog,
      providerDiagnostic,
      setProviderDiagnostic,
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
