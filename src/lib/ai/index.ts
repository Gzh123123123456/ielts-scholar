import { MockProvider } from './providers/mockProvider';
export { safeAnalyzeSpeaking, safeAnalyzeWriting } from './safety';

export function getAIProvider() {
  const providerType = getAIProviderName();
  
  if (providerType === 'mock') {
    return new MockProvider();
  }
  
  // Placeholders for V2
  return new MockProvider();
}

export function getAIProviderName() {
  return process.env.AI_PROVIDER || 'mock';
}
