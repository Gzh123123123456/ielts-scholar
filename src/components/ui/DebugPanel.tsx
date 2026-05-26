import React, { useState } from 'react';
import { useApp } from '@/src/context/AppContext';
import { PaperCard } from './PaperCard';
import { SerifButton } from './SerifButton';
import { X, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getAIProviderName } from '@/src/lib/ai';
import type { ProviderDiagnostic } from '@/src/lib/ai/schemas';
import { resolveTargetState } from '@/src/lib/scoreLayer';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scoreLine = (diagnostic: ProviderDiagnostic) => {
  const parsed = isRecord(diagnostic.parsedJson) ? diagnostic.parsedJson : {};
  const scores = isRecord(parsed.scores) ? parsed.scores : {};
  if (diagnostic.operation === 'speaking_analysis' || diagnostic.operation === 'speaking_score_only') {
    return typeof parsed.bandEstimateExcludingPronunciation === 'number'
      ? `score ${parsed.bandEstimateExcludingPronunciation.toFixed(1)}`
      : 'score n/a';
  }
  if (diagnostic.operation === 'writing_analysis') {
    const values = [
      scores.taskResponse,
      scores.coherenceCohesion,
      scores.lexicalResource,
      scores.grammaticalRangeAccuracy,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (values.length === 4) {
      return `score ${(values.reduce((sum, value) => sum + value, 0) / 4).toFixed(1)}`;
    }
    return 'score n/a';
  }
  const validationScores = Object.entries(scores)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${key}:${Number(value).toFixed(1)}`);
  return validationScores.length ? validationScores.join(' ') : 'score n/a';
};

const normalizedTargetState = (diagnostic: ProviderDiagnostic) =>
  diagnostic.normalizedFields
    ?.map(item => item.match(/^targetState:(.+)$/)?.[1])
    .find(Boolean);

const targetLine = (diagnostic: ProviderDiagnostic) => {
  const parsed = isRecord(diagnostic.parsedJson) ? diagnostic.parsedJson : {};
  const request = isRecord(diagnostic.requestPayload) ? diagnostic.requestPayload : {};
  if (request.sessionKind === 'part1_topic_thread' || parsed.sessionKind === 'part1_topic_thread') {
    return 'part1 topic-thread session analysis';
  }
  const scores = isRecord(parsed.scores) ? parsed.scores : undefined;
  const currentScore = typeof parsed.bandEstimateExcludingPronunciation === 'number'
    ? parsed.bandEstimateExcludingPronunciation
    : typeof request.originalCurrentScore === 'number'
      ? request.originalCurrentScore
      : undefined;
  const normalizedState = normalizedTargetState(diagnostic);
  const finalTargetState = (() => {
    if (typeof parsed.targetState === 'string') return parsed.targetState;
    if (normalizedState) return normalizedState;
    if (
      diagnostic.operation === 'speaking_analysis' &&
      typeof parsed.upgradedAnswer === 'string' &&
      parsed.upgradedAnswer.trim()
    ) {
      return 'generated_target';
    }
    return typeof currentScore === 'number'
      ? resolveTargetState({
          currentScore,
          targetLayer: typeof parsed.targetAnswerLayer === 'string'
            ? parsed.targetAnswerLayer as never
            : typeof request.targetLayer === 'string'
              ? request.targetLayer as never
              : undefined,
          targetFloor: typeof parsed.targetAnswerFloor === 'number'
            ? parsed.targetAnswerFloor
            : typeof request.targetFloor === 'number'
              ? request.targetFloor
              : undefined,
          targetStatus: typeof parsed.status === 'string'
            ? parsed.status as never
            : typeof parsed.targetAnswerStatus === 'string'
              ? parsed.targetAnswerStatus as never
              : undefined,
          validationScores: scores as never,
          hasTargetText: true,
        })
      : undefined;
  })();
  const parts = [
    diagnostic.operation === 'speaking_score_only' && 'blind score-only',
    typeof parsed.targetAnswerLayer === 'string' && `layer ${parsed.targetAnswerLayer}`,
    typeof parsed.targetAnswerStatus === 'string' && `target ${parsed.targetAnswerStatus}`,
    typeof parsed.status === 'string' && `status ${parsed.status}`,
    finalTargetState && `final ${finalTargetState}`,
    typeof request.targetAttempt === 'number' && `attempt ${request.targetAttempt}`,
    typeof request.targetRepairFocus === 'string' && request.targetRepairFocus.trim() && `repair ${request.targetRepairFocus.trim()}`,
    typeof parsed.repairFocusZh === 'string' && parsed.repairFocusZh.trim() && `repair ${parsed.repairFocusZh.trim()}`,
  ].filter(Boolean);
  return parts.join(' | ');
};

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(true);
  const { debugLogs, sessions, profile, capabilities, providerDiagnostic, providerDiagnostics } = useApp();
  const location = useLocation();

  const exportState = () => {
    const data = {
      profile,
      sessions,
      logs: debugLogs,
      capabilities,
      provider: getAIProviderName(),
      providerDiagnostic,
      providerDiagnostics,
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
        className="fixed bottom-4 left-4 p-2 bg-paper-ink/5 hover:bg-paper-ink/10 rounded-full transition-colors z-50 text-paper-ink/20 notranslate"
        translate="no"
        title="Open Debug Panel"
      >
        <Bug className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-paper-50 border-r border-paper-ink/20 shadow-2xl z-50 flex flex-col font-sans text-[10px] notranslate" translate="no">
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
            <p>AI Provider: {getAIProviderName()}</p>
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
          <button
            onClick={() => setIsProviderOpen(prev => !prev)}
            className="w-full flex items-center justify-between font-bold mb-2 text-paper-ink/60 border-b border-paper-ink/5 uppercase tracking-tighter"
          >
            <span>Provider Diagnostic</span>
            {isProviderOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isProviderOpen && (
            <div className="bg-paper-100 p-2 rounded border border-paper-ink/5 space-y-2 font-mono">
              {providerDiagnostic ? (
                <>
                  <p><span className="opacity-50">Module:</span> {providerDiagnostic.module}</p>
                  <p><span className="opacity-50">Operation:</span> {providerDiagnostic.operation}</p>
                  <p><span className="opacity-50">Provider:</span> {providerDiagnostic.providerName}</p>
                  <p><span className="opacity-50">Model:</span> {providerDiagnostic.modelName || 'not recorded'}</p>
                  <p><span className="opacity-50">Timestamp:</span> {providerDiagnostic.timestamp}</p>
                  <p>
                    <span className="opacity-50">Fallback Used:</span>{' '}
                    <span className={providerDiagnostic.fallbackUsed ? 'text-red-800 font-bold' : 'text-green-800 font-bold'}>
                      {providerDiagnostic.fallbackUsed ? 'YES' : 'NO'}
                    </span>
                  </p>
                  {providerDiagnostic.failureKind && (
                    <p><span className="opacity-50">Failure Kind:</span> {providerDiagnostic.failureKind}</p>
                  )}
                  {providerDiagnostic.normalizedFields && providerDiagnostic.normalizedFields.length > 0 && (
                    <p><span className="opacity-50">Normalized Fields:</span> {providerDiagnostic.normalizedFields.join(', ')}</p>
                  )}
                  {providerDiagnostics.length > 0 && (
                    <div>
                      <p className="font-bold text-paper-ink/50">Target Pipeline</p>
                      <ol className="mt-1 space-y-1">
                        {[...providerDiagnostics].reverse().map((item, index) => (
                          <li key={`${item.timestamp}-${item.operation}-${index}`} className="border border-paper-ink/10 bg-paper-50 p-2 rounded">
                            <p>
                              <span className="opacity-50">#{index + 1}</span> {item.operation} | {scoreLine(item)}
                            </p>
                            <p className={item.fallbackUsed ? 'text-red-800 font-bold' : 'text-green-800 font-bold'}>
                              {item.providerName}{item.modelName ? ` / ${item.modelName}` : ''} | fallback {item.fallbackUsed ? 'YES' : 'NO'}
                            </p>
                            {targetLine(item) && <p className="text-paper-ink/60 break-words">{targetLine(item)}</p>}
                            {item.failureKind && <p className="text-red-800">failure {item.failureKind}</p>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {providerDiagnostic.parseError && (
                    <div>
                      <p className="text-red-800 font-bold">Parse Error</p>
                      <pre className="whitespace-pre-wrap break-words bg-red-50/60 p-2 rounded">{providerDiagnostic.parseError}</pre>
                    </div>
                  )}
                  {providerDiagnostic.validationErrors.length > 0 && (
                    <div>
                      <p className="text-red-800 font-bold">Validation Errors</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {providerDiagnostic.validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer font-bold text-paper-ink/50">Request Payload</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-words bg-paper-50 p-2 rounded">
                      {JSON.stringify(providerDiagnostic.requestPayload, null, 2)}
                    </pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer font-bold text-paper-ink/50">Raw Response</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-words bg-paper-50 p-2 rounded">
                      {JSON.stringify(providerDiagnostic.rawResponse, null, 2)}
                    </pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer font-bold text-paper-ink/50">Parsed JSON</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-words bg-paper-50 p-2 rounded">
                      {JSON.stringify(providerDiagnostic.parsedJson, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <p className="opacity-30 italic">No provider diagnostic yet...</p>
              )}
            </div>
          )}
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
