import type { SpeakingBankMeta, SpeakingPrompt, SpeakingPromptPart } from "./speakingPromptTypes";

/** The currently active latest seasonal speaking bank ID */
export const LATEST_SPEAKING_BANK_ID = "speaking-2026-05-08" as const;

/** All known speaking bank metadata */
export const speakingBanks: SpeakingBankMeta[] = [
  {
    bankId: "speaking-2026-05-08",
    season: "2026-05_to_2026-08",
    label: "Speaking 2026 May–Aug",
    labelCn: "口语 2026 年 5-8 月题库",
    isLatest: true,
  },
  {
    bankId: "speaking-v1-original",
    season: "v1-original",
    label: "Speaking V1 Original",
    labelCn: "口语 V1 原始题库",
    isLatest: false,
  },
];

/**
 * Priority tiers for prompt sorting within a bank.
 *
 * latest mainland new > latest mainland reused > evergreen > V1 original > non-mainland
 */
const STATUS_PRIORITY: Record<string, number> = {
  new: 100,
  reused: 80,
  evergreen: 60,
  non_mainland: 20,
};

/** Returns a comparable priority value for sorting prompts across banks. */
export function getSpeakingBankPriority(prompt: SpeakingPrompt): number {
  const base = prompt.priority ?? 0;
  const statusBonus = STATUS_PRIORITY[prompt.status ?? "reused"] ?? 0;
  const isLatest = prompt.bankId === LATEST_SPEAKING_BANK_ID ? 1000 : 0;
  const isMainland = prompt.region !== "non_mainland" ? 500 : 0;
  return isLatest + isMainland + statusBonus + base;
}

/**
 * Filter the latest mainland prompts by part.
 * Returns prompts sorted by priority descending.
 */
export function getLatestSpeakingPromptsByPart(
  prompts: SpeakingPrompt[],
  part: SpeakingPromptPart,
): SpeakingPrompt[] {
  return prompts
    .filter(
      (p) =>
        p.bankId === LATEST_SPEAKING_BANK_ID &&
        p.region !== "non_mainland" &&
        p.part === part,
    )
    .sort((a, b) => getSpeakingBankPriority(b) - getSpeakingBankPriority(a));
}

/**
 * Extract the latest mainland Part 1 & Part 2 prompts from a flat list.
 * Non-mainland prompts are excluded.
 */
export function latestMainlandSpeakingPrompts(
  prompts: SpeakingPrompt[],
): SpeakingPrompt[] {
  return prompts
    .filter(
      (p) =>
        p.bankId === LATEST_SPEAKING_BANK_ID &&
        p.region !== "non_mainland",
    )
    .sort((a, b) => getSpeakingBankPriority(b) - getSpeakingBankPriority(a));
}

/**
 * Extract optional non-mainland prompts from a flat list.
 */
export function optionalNonMainlandSpeakingPrompts(
  prompts: SpeakingPrompt[],
): SpeakingPrompt[] {
  return prompts
    .filter(
      (p) =>
        p.bankId === LATEST_SPEAKING_BANK_ID &&
        p.region === "non_mainland",
    )
    .sort((a, b) => getSpeakingBankPriority(b) - getSpeakingBankPriority(a));
}
