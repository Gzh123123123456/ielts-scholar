import { MockProvider } from './providers/mockProvider';
import { GeminiProvider } from './providers/geminiProvider';
export { safeAnalyzeSpeaking, safeAnalyzeWriting, safeExtractWritingFramework } from './safety';

type ProviderConfig = 'mock' | 'gemini';

const readEnv = (key: string): string | undefined => {
  const viteValue = import.meta.env[key];
  if (typeof viteValue === 'string') return viteValue;

  if (typeof process !== 'undefined') {
    const processValue = process.env?.[key];
    if (typeof processValue === 'string') return processValue;
  }

  return undefined;
};

const normalizeProviderName = (value: string | undefined): ProviderConfig => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'gemini' ? 'gemini' : 'mock';
};

export function getConfiguredAIProviderName(): ProviderConfig {
  return normalizeProviderName(readEnv('VITE_AI_PROVIDER') || readEnv('AI_PROVIDER'));
}

export function getGeminiApiKey() {
  return readEnv('VITE_GEMINI_API_KEY') || readEnv('GEMINI_API_KEY') || '';
}

export function getAIProvider() {
  const configuredProvider = getConfiguredAIProviderName();
  const geminiApiKey = getGeminiApiKey();

  if (configuredProvider === 'gemini' && geminiApiKey) {
    return new GeminiProvider(geminiApiKey);
  }

  return new MockProvider();
}

export function getAIProviderName() {
  const configuredProvider = getConfiguredAIProviderName();
  if (configuredProvider === 'gemini') {
    return getGeminiApiKey() ? 'gemini' : 'mock (gemini configured without VITE_GEMINI_API_KEY)';
  }

  return 'mock';
}

export function isMockProviderActive() {
  return getAIProviderName() !== 'gemini';
}
