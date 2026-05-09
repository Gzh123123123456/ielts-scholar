import { MockProvider } from './providers/mockProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import {
  getDeepSeekFlashModel,
  getDeepSeekProModel,
  getDeepSeekStatus,
  getGeminiApiKey,
  getGeminiLimits,
  getGeminiModel,
  getProviderRouterMode,
  readEnv,
  routedAnalyzeSpeaking,
  routedAnalyzeWriting,
  routedAnalyzeWritingTask1,
  routedCoachWritingFramework,
  routedExtractWritingFramework,
} from './router';
export {
  safeAnalyzeSpeaking,
  safeAnalyzeWriting,
  safeAnalyzeWritingTask1,
  safeCoachWritingFramework,
  safeExtractWritingFramework,
} from './safety';
export {
  getApiUsageState,
  getGeminiLocalUsage,
  getRouterState,
  clearApiUsageState,
  API_USAGE_KEY,
  ROUTER_STATE_KEY,
} from './usage';
export {
  getDeepSeekFlashModel,
  getDeepSeekProModel,
  getDeepSeekStatus,
  getGeminiLimits,
  getGeminiModel,
  getProviderRouterMode,
  routedAnalyzeSpeaking,
  routedAnalyzeWriting,
  routedAnalyzeWritingTask1,
  routedCoachWritingFramework,
  routedExtractWritingFramework,
};

type ProviderConfig = 'mock' | 'gemini' | 'auto';

const normalizeProviderName = (value: string | undefined): ProviderConfig => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'gemini' || normalized === 'auto' ? normalized : 'mock';
};

export function getConfiguredAIProviderName(): ProviderConfig {
  return normalizeProviderName(readEnv('VITE_AI_PROVIDER') || readEnv('AI_PROVIDER'));
}

export function getAIProvider() {
  const configuredProvider = getConfiguredAIProviderName();
  const geminiApiKey = getGeminiApiKey();

  if (configuredProvider === 'gemini' && geminiApiKey) {
    return new GeminiProvider(geminiApiKey, getGeminiModel());
  }

  if (configuredProvider === 'auto' && readEnv('VITE_DEEPSEEK_API_KEY')) {
    return new DeepSeekProvider(
      readEnv('VITE_DEEPSEEK_API_KEY') || '',
      getDeepSeekFlashModel(),
      readEnv('VITE_DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1',
    );
  }

  return new MockProvider();
}

export function getAIProviderName() {
  const configuredProvider = getConfiguredAIProviderName();
  if (configuredProvider === 'gemini') {
    return getGeminiApiKey() ? 'gemini' : 'mock (gemini configured without VITE_GEMINI_API_KEY)';
  }
  if (configuredProvider === 'auto') {
    const gemini = getGeminiApiKey() ? 'gemini' : '';
    const deepseek = readEnv('VITE_DEEPSEEK_API_KEY') ? 'deepseek' : '';
    return [gemini, deepseek].filter(Boolean).length
      ? `auto (${[gemini, deepseek].filter(Boolean).join(' + ')})`
      : 'mock (auto configured without real provider keys)';
  }

  return 'mock';
}

export function isMockProviderActive() {
  return getAIProviderName().startsWith('mock');
}
