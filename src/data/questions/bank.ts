export interface SpeakingQuestion {
  id: string;
  part: number;
  topic: string;
  question: string;
  cueCard?: string;
}

export const speakingPart1: SpeakingQuestion[] = [
  { id: 'sp1_001', part: 1, topic: 'Hometown', question: 'Do you like your hometown?' },
  { id: 'sp1_002', part: 1, topic: 'Work/Study', question: 'Are you working or are you a student?' },
  { id: 'sp1_003', part: 1, topic: 'Daily Routine', question: 'What is your favorite time of the day?' },
];

export const speakingPart2: SpeakingQuestion[] = [
  { 
    id: 'sp2_001', 
    part: 2, 
    topic: 'A useful object', 
    question: 'Describe a useful object you use every day.',
    cueCard: 'Describe an object that you use every day. You should say what it is, how you use it, why it is useful, and explain how you would feel without it.' 
  },
];

export const speakingPart3: SpeakingQuestion[] = [
  { id: 'sp3_001', part: 3, topic: 'Technology', question: 'How has technology changed the way people communicate?' },
];

export interface WritingQuestion {
  id: string;
  type: string;
  question: string;
}

export const writingTask2: WritingQuestion[] = [
  { 
    id: 'wt2_001', 
    type: 'opinion', 
    question: 'Some people believe that university students should study whatever they like, while others believe they should only study subjects useful for the future. Discuss both views and give your own opinion.' 
  },
];
