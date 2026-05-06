import React, { useState } from 'react';
import { useApp } from '@/src/context/AppContext';
import { PaperCard } from './PaperCard';
import { SerifButton } from './SerifButton';
import { X, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { debugLogs, sessions, profile, capabilities } = useApp();
  const location = useLocation();

  const exportState = () => {
    const data = {
      profile,
      sessions,
      logs: debugLogs,
      capabilities,
      provider: process.env.AI_PROVIDER || 'mock',
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-debug-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 p-2 bg-paper-ink/5 hover:bg-paper-ink/10 rounded-full transition-colors z-50 text-paper-ink/20"
        title="Open Debug Panel"
      >
        <Bug className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-paper-50 border-r border-paper-ink/20 shadow-2xl z-50 flex flex-col font-sans text-[10px]">
      <div className="p-3 border-b border-paper-ink/10 flex justify-between items-center bg-paper-200">
        <h3 className="font-bold uppercase tracking-widest text-accent-terracotta">Internal Debug</h3>
        <button onClick={() => setIsOpen(false)} className="hover:text-accent-terracotta">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <section>
          <h4 className="font-bold mb-2 text-paper-ink/60 border-b border-paper-ink/5 uppercase tracking-tighter">Capabilities</h4>
          <div className="bg-paper-100 p-2 rounded border border-paper-ink/5 space-y-1 font-mono">
            <p>SpeechRecognition: {capabilities.speechRecognition ? '✅' : '❌'}</p>
            <p>webkitSpeechReg: {capabilities.webkitSpeechRecognition ? '✅' : '❌'}</p>
            <p>getUserMedia: {capabilities.getUserMedia ? '✅' : '❌'}</p>
            <p>MediaRecorder: {capabilities.mediaRecorder ? '✅' : '❌'}</p>
            <p>Mic Permission: {capabilities.microphonePermission}</p>
            <p>AI Provider: {process.env.AI_PROVIDER || 'mock'}</p>
          </div>
        </section>

        <section>
          <h4 className="font-bold mb-2 text-paper-ink/60 border-b border-paper-ink/5 uppercase tracking-tighter">Application</h4>
          <div className="bg-paper-100 p-2 rounded border border-paper-ink/5 space-y-1">
            <p><span className="opacity-50">Route:</span> {location.pathname}</p>
            <p><span className="opacity-50">Saved Sessions:</span> {sessions.length}</p>
          </div>
        </section>

        <section>
          <h4 className="font-bold mb-2 text-paper-ink/60 border-b border-paper-ink/5">Recent Logs</h4>
          <div className="space-y-1">
            {debugLogs.map((log, i) => (
              <div key={i} className="p-1 border-b border-paper-ink/5 last:border-0 font-mono text-[10px]">
                {log}
              </div>
            ))}
            {debugLogs.length === 0 && <p className="opacity-30 italic">No logs yet...</p>}
          </div>
        </section>

        <section>
          <SerifButton onClick={exportState} className="w-full text-xs py-1" variant="outline">
            Export Debug JSON
          </SerifButton>
        </section>
      </div>
    </div>
  );
};
