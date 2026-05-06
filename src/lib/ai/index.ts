import { MockProvider } from './providers/mockProvider';

export function getAIProvider() {
  const providerType = process.env.AI_PROVIDER || 'mock';
  
  if (providerType === 'mock') {
    return new MockProvider();
  }
  
  // Placeholders for V2
  return new MockProvider();
}
