import { ProviderOperation } from './schemas';

export const API_USAGE_KEY = 'ielts_api_usage_v1';
export const ROUTER_STATE_KEY = 'ielts_provider_router_state_v1';

export interface ApiUsageCall {
  timestamp: string;
  provider: string;
  model: string;
  operation: ProviderOperation;
  success: boolean;
  status: string;
  estimatedInputTokens?: number;
}

export interface ApiUsageState {
  calls: ApiUsageCall[];
  lastProvider?: string;
  lastModel?: string;
  lastOperation?: ProviderOperation;
  lastStatus?: string;
  lastFallbackReason?: string;
  lastUpdated?: string;
}

export interface RouterState {
  lastOperation?: ProviderOperation;
  geminiCooldownUntil?: string;
  geminiCooldownReason?: string;
  lastEffectiveProvider?: string;
  lastEffectiveModel?: string;
  lastFallbackReason?: string;
  lastLearnerReason?: string;
  lastDebugReason?: string;
  lastUpdated?: string;
}

const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const estimateTokensFromText = (text: string) => Math.max(1, Math.ceil(text.length / 4));

export const getApiUsageState = (): ApiUsageState => {
  const value = readJson<ApiUsageState>(API_USAGE_KEY, { calls: [] });
  return {
    ...value,
    calls: Array.isArray(value.calls) ? value.calls.slice(-300) : [],
  };
};

export const saveApiUsageState = (state: ApiUsageState) => {
  writeJson(API_USAGE_KEY, { ...state, calls: state.calls.slice(-300) });
};

export const getRouterState = (): RouterState => readJson<RouterState>(ROUTER_STATE_KEY, {});

export const saveRouterState = (state: RouterState) => {
  writeJson(ROUTER_STATE_KEY, state);
};

export const setGeminiCooldown = (seconds: number, reason: string) => {
  const until = new Date(Date.now() + seconds * 1000).toISOString();
  saveRouterState({
    ...getRouterState(),
    geminiCooldownUntil: until,
    geminiCooldownReason: reason,
    lastFallbackReason: reason,
    lastUpdated: new Date().toISOString(),
  });
};

export const recordApiCall = (call: Omit<ApiUsageCall, 'timestamp'>) => {
  const state = getApiUsageState();
  const timestamp = new Date().toISOString();
  saveApiUsageState({
    ...state,
    calls: [...state.calls, { ...call, timestamp }],
    lastProvider: call.provider,
    lastModel: call.model,
    lastOperation: call.operation,
    lastStatus: call.status,
    lastUpdated: timestamp,
  });
};

export const recordRouterResult = (patch: Partial<RouterState>) => {
  saveRouterState({
    ...getRouterState(),
    ...patch,
    lastUpdated: new Date().toISOString(),
  });
};

export const getGeminiLocalUsage = () => {
  const calls = getApiUsageState().calls.filter(call => call.provider === 'gemini');
  const now = Date.now();
  const today = todayKey();
  const todayCalls = calls.filter(call => call.timestamp.slice(0, 10) === today);
  const minuteCalls = calls.filter(call => now - new Date(call.timestamp).getTime() <= 60_000);
  const tokensLastMinute = minuteCalls.reduce((total, call) => total + (call.estimatedInputTokens || 0), 0);
  return {
    requestsToday: todayCalls.length,
    requestsLastMinute: minuteCalls.length,
    estimatedInputTokensLastMinute: tokensLastMinute,
  };
};

export const clearApiUsageState = () => {
  localStorage.removeItem(API_USAGE_KEY);
  localStorage.removeItem(ROUTER_STATE_KEY);
};
