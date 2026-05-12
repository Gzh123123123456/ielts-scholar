// Re-export existing V1 original speaking prompt bank.
// Future: normalize to SpeakingPrompt type when migration is ready.
// Do NOT delete the original src/data/questions/bank.ts exports.
export {
  speakingPart1,
  speakingPart2,
  speakingPart3,
  type SpeakingQuestion,
  type SpeakingTopicCategory,
} from "../questions/bank";
