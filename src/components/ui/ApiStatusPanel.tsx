import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import {
  getApiUsageState,
  getDeepSeekFlashModel,
  getDeepSeekProModel,
  getDeepSeekStatus,
  getGeminiLimits,
  getGeminiLocalUsage,
  getGeminiModel,
  getProviderRouterMode,
  getRouterState,
} from '@/src/lib/ai';

const formatCooldown = (until?: string) => {
  if (!until) return 'none';
  const remaining = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
  return remaining > 0 ? `about ${remaining}s` : 'none';
};

export const ApiStatusPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => refresh(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  const usage = getApiUsageState();
  const router = getRouterState();
  const geminiUsage = getGeminiLocalUsage();
  const limits = getGeminiLimits();
  const deepseekStatus = getDeepSeekStatus();
  const mode = getProviderRouterMode();
  const lastCall = [...usage.calls].reverse()[0];
  const lastDeepSeekProblem = [...usage.calls]
    .reverse()
    .find(call => call.provider === 'deepseek' && call.status !== 'ok');

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-12 p-2 bg-paper-ink/5 hover:bg-paper-ink/10 rounded-full transition-colors z-50 text-paper-ink/30"
        title="Open API Status"
      >
        <Activity className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-paper-50 border-r border-paper-ink/20 shadow-2xl z-50 flex flex-col font-sans text-xs">
      <div className="p-3 border-b border-paper-ink/10 flex justify-between items-center bg-paper-200">
        <h3 className="font-bold uppercase tracking-widest text-accent-terracotta">API Status</h3>
        <button onClick={() => setIsOpen(false)} className="hover:text-accent-terracotta">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <section className="space-y-1">
          <h4 className="font-bold uppercase tracking-widest text-paper-ink/50">Router</h4>
          <p>Mode: {mode}</p>
          <p>
            {mode === 'auto'
              ? 'Auto router active: Gemini is reserved for final feedback, DeepSeek handles fallback/intermediate work when configured.'
              : mode === 'gemini'
                ? 'Gemini-only mode: auto DeepSeek fallback is inactive.'
                : 'Mock mode: no real provider routing is active.'}
          </p>
          <p>Last operation: {router.lastOperation || lastCall?.operation || 'none'}</p>
          <p>Last used: {router.lastEffectiveProvider || lastCall?.provider || 'none'} {router.lastEffectiveModel || lastCall?.model ? `/ ${router.lastEffectiveModel || lastCall?.model}` : ''}</p>
          <p>Last reason: {router.lastLearnerReason || router.lastFallbackReason || 'No routed request yet.'}</p>
        </section>

        <section className="space-y-1 border-t border-paper-ink/10 pt-4">
          <h4 className="font-bold uppercase tracking-widest text-paper-ink/50">Gemini</h4>
          <p>Model: {getGeminiModel()}</p>
          <p>Today: {geminiUsage.requestsToday} / {limits.rpd} local requests</p>
          <p>Current minute: {geminiUsage.requestsLastMinute} / {limits.rpm} local requests</p>
          <p>Token estimate: {geminiUsage.estimatedInputTokensLastMinute} / {limits.tpm} local input tokens</p>
          <p>Reserve: {limits.reserve} daily requests kept for high-value feedback</p>
          <p>Cooldown: {formatCooldown(router.geminiCooldownUntil)}</p>
          <p className="text-paper-ink/50 leading-5">Official remaining quota must be checked in Google AI Studio; this app only keeps a local estimate.</p>
        </section>

        <section className="space-y-1 border-t border-paper-ink/10 pt-4">
          <h4 className="font-bold uppercase tracking-widest text-paper-ink/50">DeepSeek</h4>
          <p>Status: {deepseekStatus.configured ? 'configured' : 'not configured'}</p>
          <p>Fallback: {mode === 'auto' && deepseekStatus.configured ? 'available in auto mode' : 'unavailable'}</p>
          <p>Flash: {getDeepSeekFlashModel()}</p>
          <p>Pro: {getDeepSeekProModel()}</p>
          <p>Balance: {deepseekStatus.balance}</p>
          <p>Last provider problem: {lastDeepSeekProblem ? lastDeepSeekProblem.status : 'none recorded'}</p>
        </section>
      </div>
    </div>
  );
};
