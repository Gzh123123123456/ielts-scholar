export type SpeakingBankId = "speaking-v1-original" | "speaking-2026-05-08";

export type SpeakingRegion = "mainland_cn" | "non_mainland";

export type SpeakingBankStatus = "new" | "reused" | "evergreen" | "non_mainland";

export type SpeakingCompleteness = "complete" | "partial";

export type SpeakingPromptPart = 1 | 2 | 3;

export interface SpeakingPrompt {
  id: string;
  bankId: SpeakingBankId;
  season?: string;
  region?: SpeakingRegion;
  status?: SpeakingBankStatus;
  part: SpeakingPromptPart;
  topic: string;
  titleCn?: string;
  question?: string;
  cueCard?: {
    prompt: string;
    points: string[];
  };
  followUps?: string[];
  tags: string[];
  priority: number;
  completeness: SpeakingCompleteness;
}

export interface SpeakingBankMeta {
  bankId: SpeakingBankId;
  season: string;
  label: string;
  labelCn: string;
  isLatest: boolean;
}
