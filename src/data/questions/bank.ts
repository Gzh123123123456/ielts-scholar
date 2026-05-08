export type SpeakingTopicCategory =
  | 'Work & Study'
  | 'Home & Hometown'
  | 'Family & People'
  | 'Daily Life'
  | 'Hobbies & Free Time'
  | 'Books & Reading'
  | 'Technology'
  | 'Travel & Places'
  | 'Food & Health'
  | 'Culture & Media'
  | 'Nature & Environment'
  | 'Objects & Memories';

export type WritingTask2TopicCategory =
  | 'Education'
  | 'Technology'
  | 'Work & Employment'
  | 'Environment & Resources'
  | 'Health'
  | 'Government & Society'
  | 'Crime & Law'
  | 'Culture & Media'
  | 'Family & Children'
  | 'Globalization'
  | 'Transport & Cities'
  | 'Economy & Consumerism';

export const speakingTopicCategories: SpeakingTopicCategory[] = [
  'Work & Study',
  'Home & Hometown',
  'Family & People',
  'Daily Life',
  'Hobbies & Free Time',
  'Books & Reading',
  'Technology',
  'Travel & Places',
  'Food & Health',
  'Culture & Media',
  'Nature & Environment',
  'Objects & Memories',
];

export const writingTask2TopicCategories: WritingTask2TopicCategory[] = [
  'Education',
  'Technology',
  'Work & Employment',
  'Environment & Resources',
  'Health',
  'Government & Society',
  'Crime & Law',
  'Culture & Media',
  'Family & Children',
  'Globalization',
  'Transport & Cities',
  'Economy & Consumerism',
];

export interface SpeakingQuestion {
  id: string;
  part: number;
  topic: string;
  question: string;
  cueCard?: string;
  topicCategory?: SpeakingTopicCategory;
  tags?: SpeakingTopicCategory[];
}

const addSpeakingMetadata = (question: Omit<SpeakingQuestion, 'topicCategory' | 'tags'>): SpeakingQuestion => {
  const categoryByTopic: Record<string, SpeakingTopicCategory> = {
    'Hometown': 'Home & Hometown',
    'Work/Study': 'Work & Study',
    'Daily Routine': 'Daily Life',
    'Food': 'Food & Health',
    'Travel': 'Travel & Places',
    'Weather': 'Nature & Environment',
    'Music': 'Hobbies & Free Time',
    'Reading': 'Books & Reading',
    'Technology': 'Technology',
    'Friends': 'Family & People',
    'Sports': 'Hobbies & Free Time',
    'Person': 'Family & People',
    'Place': 'Travel & Places',
    'Object': 'Objects & Memories',
    'Event': 'Culture & Media',
    'Experience': 'Objects & Memories',
    'Skill': 'Work & Study',
    'Decision': 'Daily Life',
    'Media': 'Culture & Media',
    'Routine': 'Daily Life',
    'Study/Work': 'Work & Study',
    'Change': 'Daily Life',
    'Helping Others': 'Family & People',
    'Cities and Places': 'Travel & Places',
    'Objects and Consumption': 'Objects & Memories',
    'Events': 'Culture & Media',
    'Skills and Learning': 'Work & Study',
    'Decisions': 'Family & People',
    'Routines': 'Daily Life',
    'Work and Study': 'Work & Study',
  };
  const topicCategory = categoryByTopic[question.topic] || 'Daily Life';
  return { ...question, topicCategory, tags: [topicCategory] };
};

export const speakingPart1: SpeakingQuestion[] = [
  { id: 'sp1_hometown_001', part: 1, topic: 'Hometown', question: 'Do you like your hometown?' },
  { id: 'sp1_hometown_002', part: 1, topic: 'Hometown', question: 'What is your hometown famous for?' },
  { id: 'sp1_hometown_003', part: 1, topic: 'Hometown', question: 'Has your hometown changed much in recent years?' },
  { id: 'sp1_hometown_004', part: 1, topic: 'Hometown', question: 'Would you like to live in your hometown in the future?' },

  { id: 'sp1_work_study_001', part: 1, topic: 'Work/Study', question: 'Are you working or are you a student?' },
  { id: 'sp1_work_study_002', part: 1, topic: 'Work/Study', question: 'What do you like most about your work or studies?' },
  { id: 'sp1_work_study_003', part: 1, topic: 'Work/Study', question: 'Is there anything difficult about your work or studies?' },
  { id: 'sp1_work_study_004', part: 1, topic: 'Work/Study', question: 'What kind of job would you like to do in the future?' },

  { id: 'sp1_daily_routine_001', part: 1, topic: 'Daily Routine', question: 'What is your favorite time of the day?' },
  { id: 'sp1_daily_routine_002', part: 1, topic: 'Daily Routine', question: 'Do you usually have the same routine every day?' },
  { id: 'sp1_daily_routine_003', part: 1, topic: 'Daily Routine', question: 'What do you normally do in the evening?' },

  { id: 'sp1_food_001', part: 1, topic: 'Food', question: 'What kind of food do you enjoy eating?' },
  { id: 'sp1_food_002', part: 1, topic: 'Food', question: 'Do you prefer eating at home or in restaurants?' },
  { id: 'sp1_food_003', part: 1, topic: 'Food', question: 'Can you cook well?' },
  { id: 'sp1_food_004', part: 1, topic: 'Food', question: 'Is there any food you disliked as a child but enjoy now?' },

  { id: 'sp1_travel_001', part: 1, topic: 'Travel', question: 'Do you like travelling?' },
  { id: 'sp1_travel_002', part: 1, topic: 'Travel', question: 'What kind of places do you like to visit?' },
  { id: 'sp1_travel_003', part: 1, topic: 'Travel', question: 'Do you prefer travelling alone or with other people?' },

  { id: 'sp1_weather_001', part: 1, topic: 'Weather', question: 'What kind of weather do you like?' },
  { id: 'sp1_weather_002', part: 1, topic: 'Weather', question: 'Does the weather affect your mood?' },
  { id: 'sp1_weather_003', part: 1, topic: 'Weather', question: 'What is the weather usually like where you live?' },

  { id: 'sp1_music_001', part: 1, topic: 'Music', question: 'Do you often listen to music?' },
  { id: 'sp1_music_002', part: 1, topic: 'Music', question: 'What kind of music do you like?' },
  { id: 'sp1_music_003', part: 1, topic: 'Music', question: 'Did you learn music when you were a child?' },

  { id: 'sp1_reading_001', part: 1, topic: 'Reading', question: 'Do you enjoy reading?' },
  { id: 'sp1_reading_002', part: 1, topic: 'Reading', question: 'What kinds of things do you usually read?' },
  { id: 'sp1_reading_003', part: 1, topic: 'Reading', question: 'Do you prefer printed books or e-books?' },

  { id: 'sp1_technology_001', part: 1, topic: 'Technology', question: 'What technology do you use every day?' },
  { id: 'sp1_technology_002', part: 1, topic: 'Technology', question: 'Do you think you spend too much time using your phone?' },
  { id: 'sp1_technology_003', part: 1, topic: 'Technology', question: 'What app do you find most useful?' },

  { id: 'sp1_friends_001', part: 1, topic: 'Friends', question: 'Do you spend a lot of time with your friends?' },
  { id: 'sp1_friends_002', part: 1, topic: 'Friends', question: 'What do you usually do with your friends?' },
  { id: 'sp1_friends_003', part: 1, topic: 'Friends', question: 'Is it easy for you to make new friends?' },

  { id: 'sp1_sports_001', part: 1, topic: 'Sports', question: 'Do you like playing or watching sports?' },
  { id: 'sp1_sports_002', part: 1, topic: 'Sports', question: 'What sport is popular in your country?' },
  { id: 'sp1_sports_003', part: 1, topic: 'Sports', question: 'Did you do any sports when you were younger?' },
].map(addSpeakingMetadata);

export const speakingPart2: SpeakingQuestion[] = [
  {
    id: 'sp2_person_001',
    part: 2,
    topic: 'Person',
    question: 'Describe a person who has helped you.',
    cueCard: 'Describe a person who has helped you. You should say who this person is, how they helped you, when this happened, and explain why their help was important to you.',
  },
  {
    id: 'sp2_place_001',
    part: 2,
    topic: 'Place',
    question: 'Describe a place in your city that you like to visit.',
    cueCard: 'Describe a place in your city that you like to visit. You should say where it is, what you can do there, how often you go there, and explain why you like this place.',
  },
  {
    id: 'sp2_object_001',
    part: 2,
    topic: 'Object',
    question: 'Describe a useful object you use every day.',
    cueCard: 'Describe an object that you use every day. You should say what it is, how you use it, why it is useful, and explain how you would feel without it.',
  },
  {
    id: 'sp2_event_001',
    part: 2,
    topic: 'Event',
    question: 'Describe an important event you attended.',
    cueCard: 'Describe an important event you attended. You should say what the event was, where it took place, who was there, and explain why it was important to you.',
  },
  {
    id: 'sp2_experience_001',
    part: 2,
    topic: 'Experience',
    question: 'Describe an experience when you tried something new.',
    cueCard: 'Describe an experience when you tried something new. You should say what you tried, when and where you tried it, whether it was difficult, and explain how you felt afterwards.',
  },
  {
    id: 'sp2_skill_001',
    part: 2,
    topic: 'Skill',
    question: 'Describe a skill you would like to improve.',
    cueCard: 'Describe a skill you would like to improve. You should say what the skill is, why you want to improve it, how you could improve it, and explain how it would help you in the future.',
  },
  {
    id: 'sp2_decision_001',
    part: 2,
    topic: 'Decision',
    question: 'Describe a decision you made that was difficult.',
    cueCard: 'Describe a decision you made that was difficult. You should say what the decision was, why it was difficult, what you finally decided, and explain whether you think it was the right choice.',
  },
  {
    id: 'sp2_media_001',
    part: 2,
    topic: 'Media',
    question: 'Describe a book, film, or TV program you enjoyed.',
    cueCard: 'Describe a book, film, or TV program you enjoyed. You should say what it was, what it was about, when you watched or read it, and explain why you enjoyed it.',
  },
  {
    id: 'sp2_technology_001',
    part: 2,
    topic: 'Technology',
    question: 'Describe a piece of technology that is important to you.',
    cueCard: 'Describe a piece of technology that is important to you. You should say what it is, how often you use it, what you use it for, and explain why it is important in your life.',
  },
  {
    id: 'sp2_routine_001',
    part: 2,
    topic: 'Routine',
    question: 'Describe a daily routine you enjoy.',
    cueCard: 'Describe a daily routine you enjoy. You should say what the routine is, when you usually do it, how long you have had this routine, and explain why you enjoy it.',
  },
  {
    id: 'sp2_study_work_001',
    part: 2,
    topic: 'Study/Work',
    question: 'Describe a project or task you worked hard on.',
    cueCard: 'Describe a project or task you worked hard on. You should say what it was, why you had to work hard, what the result was, and explain what you learned from it.',
  },
  {
    id: 'sp2_change_001',
    part: 2,
    topic: 'Change',
    question: 'Describe a positive change in your life.',
    cueCard: 'Describe a positive change in your life. You should say what the change was, when it happened, why it happened, and explain how it affected your life.',
  },
].map(addSpeakingMetadata);

export const speakingPart3: SpeakingQuestion[] = [
  { id: 'sp3_person_001', part: 3, topic: 'Helping Others', question: 'Why do some people enjoy helping others?' },
  { id: 'sp3_person_002', part: 3, topic: 'Helping Others', question: 'Do you think people today help their neighbors less than in the past?' },
  { id: 'sp3_person_003', part: 3, topic: 'Helping Others', question: 'Should schools teach children to be more helpful?' },
  { id: 'sp3_person_004', part: 3, topic: 'Helping Others', question: 'What kinds of help are most valuable in modern society?' },

  { id: 'sp3_place_001', part: 3, topic: 'Cities and Places', question: 'What makes a public place attractive to local people?' },
  { id: 'sp3_place_002', part: 3, topic: 'Cities and Places', question: 'How have cities changed in recent years?' },
  { id: 'sp3_place_003', part: 3, topic: 'Cities and Places', question: 'Should governments spend more money on public spaces?' },
  { id: 'sp3_place_004', part: 3, topic: 'Cities and Places', question: 'Do young people and older people enjoy different types of places?' },

  { id: 'sp3_objects_001', part: 3, topic: 'Objects and Consumption', question: 'Why do people buy new things even when old ones still work?' },
  { id: 'sp3_objects_002', part: 3, topic: 'Objects and Consumption', question: 'Are people too dependent on everyday objects and devices?' },
  { id: 'sp3_objects_003', part: 3, topic: 'Objects and Consumption', question: 'How can people reduce waste from things they use every day?' },

  { id: 'sp3_events_001', part: 3, topic: 'Events', question: 'Why are ceremonies and celebrations important in society?' },
  { id: 'sp3_events_002', part: 3, topic: 'Events', question: 'Do people spend too much money on special events?' },
  { id: 'sp3_events_003', part: 3, topic: 'Events', question: 'How have online events changed the way people meet?' },

  { id: 'sp3_skills_001', part: 3, topic: 'Skills and Learning', question: 'What skills are most important for young people today?' },
  { id: 'sp3_skills_002', part: 3, topic: 'Skills and Learning', question: 'Is it better to learn skills from teachers or from online resources?' },
  { id: 'sp3_skills_003', part: 3, topic: 'Skills and Learning', question: 'Why do some adults stop learning new skills?' },
  { id: 'sp3_skills_004', part: 3, topic: 'Skills and Learning', question: 'How can employers encourage workers to keep learning?' },

  { id: 'sp3_decisions_001', part: 3, topic: 'Decisions', question: 'What kinds of decisions are difficult for young adults?' },
  { id: 'sp3_decisions_002', part: 3, topic: 'Decisions', question: 'Should people make important decisions quickly or slowly?' },
  { id: 'sp3_decisions_003', part: 3, topic: 'Decisions', question: 'How much should people rely on advice from family and friends?' },

  { id: 'sp3_media_001', part: 3, topic: 'Media', question: 'How do films and books influence people’s ideas?' },
  { id: 'sp3_media_002', part: 3, topic: 'Media', question: 'Do people learn more from entertainment media now than in the past?' },
  { id: 'sp3_media_003', part: 3, topic: 'Media', question: 'What are the advantages and disadvantages of watching international media?' },

  { id: 'sp3_technology_001', part: 3, topic: 'Technology', question: 'How has technology changed the way people communicate?' },
  { id: 'sp3_technology_002', part: 3, topic: 'Technology', question: 'Do you think technology saves people time or makes life busier?' },
  { id: 'sp3_technology_003', part: 3, topic: 'Technology', question: 'Should children be taught how to use technology responsibly?' },
  { id: 'sp3_technology_004', part: 3, topic: 'Technology', question: 'What kinds of technology might become essential in the future?' },

  { id: 'sp3_routines_001', part: 3, topic: 'Routines', question: 'Why do some people prefer a fixed daily routine?' },
  { id: 'sp3_routines_002', part: 3, topic: 'Routines', question: 'Can routines make people less creative?' },
  { id: 'sp3_routines_003', part: 3, topic: 'Routines', question: 'How have work and study routines changed in modern life?' },

  { id: 'sp3_work_001', part: 3, topic: 'Work and Study', question: 'What motivates people to work hard?' },
  { id: 'sp3_work_002', part: 3, topic: 'Work and Study', question: 'Is teamwork always better than working alone?' },
  { id: 'sp3_work_003', part: 3, topic: 'Work and Study', question: 'How important is failure in learning or work?' },

  { id: 'sp3_change_001', part: 3, topic: 'Change', question: 'Why do some people find change difficult?' },
  { id: 'sp3_change_002', part: 3, topic: 'Change', question: 'Are social changes happening faster now than in the past?' },
  { id: 'sp3_change_003', part: 3, topic: 'Change', question: 'What kinds of changes are usually positive for a community?' },
].map(addSpeakingMetadata);

export interface WritingQuestion {
  id: string;
  type: string;
  question: string;
  topicCategory?: WritingTask2TopicCategory;
  tags?: WritingTask2TopicCategory[];
}

const addWritingMetadata = (question: Omit<WritingQuestion, 'topicCategory' | 'tags'>): WritingQuestion => {
  const categoryById: Record<string, WritingTask2TopicCategory> = {
    wt2_001: 'Education',
    wt2_002: 'Education',
    wt2_003: 'Work & Employment',
    wt2_004: 'Transport & Cities',
    wt2_005: 'Work & Employment',
    wt2_006: 'Economy & Consumerism',
    wt2_007: 'Transport & Cities',
    wt2_008: 'Education',
    wt2_009: 'Culture & Media',
    wt2_010: 'Work & Employment',
    wt2_011: 'Government & Society',
    wt2_012: 'Culture & Media',
    wt2_013: 'Technology',
    wt2_014: 'Family & Children',
    wt2_015: 'Health',
    wt2_016: 'Environment & Resources',
    wt2_017: 'Transport & Cities',
    wt2_018: 'Technology',
    wt2_019: 'Work & Employment',
    wt2_020: 'Health',
    wt2_021: 'Economy & Consumerism',
    wt2_022: 'Family & Children',
  };
  const topicCategory = categoryById[question.id] || 'Government & Society';
  return { ...question, topicCategory, tags: [topicCategory] };
};

export const writingTask2: WritingQuestion[] = [
  {
    id: 'wt2_001',
    type: 'discuss both views',
    question: 'Some people believe that university students should study whatever they like, while others believe they should only study subjects useful for the future. Discuss both views and give your own opinion.',
  },
  {
    id: 'wt2_002',
    type: 'agree/disagree',
    question: 'Some people think that children should start learning a foreign language at primary school rather than secondary school. To what extent do you agree or disagree?',
  },
  {
    id: 'wt2_003',
    type: 'advantages/disadvantages',
    question: 'More people are choosing to work from home instead of travelling to an office. Do the advantages of this development outweigh the disadvantages?',
  },
  {
    id: 'wt2_004',
    type: 'problem-solution',
    question: 'In many cities, traffic congestion is becoming a serious problem. What are the main causes of this problem, and what measures could be taken to solve it?',
  },
  {
    id: 'wt2_005',
    type: 'two-part',
    question: 'Many young people change jobs several times during their careers. Why does this happen, and do you think it is a positive or negative development?',
  },
  {
    id: 'wt2_006',
    type: 'positive/negative development',
    question: 'An increasing number of people buy products online rather than in physical stores. Is this a positive or negative development?',
  },
  {
    id: 'wt2_007',
    type: 'agree/disagree',
    question: 'Some people believe that governments should provide free public transport in large cities. To what extent do you agree or disagree?',
  },
  {
    id: 'wt2_008',
    type: 'discuss both views',
    question: 'Some people think that schools should focus mainly on academic subjects, while others believe practical skills are more important. Discuss both views and give your own opinion.',
  },
  {
    id: 'wt2_009',
    type: 'advantages/disadvantages',
    question: 'Many people now use social media as their main source of news. What are the advantages and disadvantages of this trend?',
  },
  {
    id: 'wt2_010',
    type: 'problem-solution',
    question: 'In some countries, fewer young people are interested in becoming teachers. What problems can this cause, and how can more people be encouraged to enter the teaching profession?',
  },
  {
    id: 'wt2_011',
    type: 'two-part',
    question: 'People today often have less contact with their neighbors than in the past. Why is this happening, and what can be done to improve local communities?',
  },
  {
    id: 'wt2_012',
    type: 'agree/disagree',
    question: 'Some people think that museums and art galleries should be free for everyone. To what extent do you agree or disagree?',
  },
  {
    id: 'wt2_013',
    type: 'positive/negative development',
    question: 'More companies are using artificial intelligence to complete routine tasks. Is this a positive or negative development for workers?',
  },
  {
    id: 'wt2_014',
    type: 'discuss both views',
    question: 'Some people believe that children should spend more time outdoors, while others think indoor activities can be equally valuable. Discuss both views and give your own opinion.',
  },
  {
    id: 'wt2_015',
    type: 'advantages/disadvantages',
    question: 'In many countries, people are living longer than before. What are the advantages and disadvantages of an ageing population?',
  },
  {
    id: 'wt2_016',
    type: 'problem-solution',
    question: 'Many people throw away food that is still edible. Why does this happen, and what can be done to reduce food waste?',
  },
  {
    id: 'wt2_017',
    type: 'two-part',
    question: 'Some people prefer to live in small towns rather than big cities. Why might this be the case, and do you think it is a good trend?',
  },
  {
    id: 'wt2_018',
    type: 'agree/disagree',
    question: 'Some people think that parents should limit the amount of time children spend using digital devices. To what extent do you agree or disagree?',
  },
  {
    id: 'wt2_019',
    type: 'positive/negative development',
    question: 'In many workplaces, casual clothing is becoming more common than formal dress. Is this a positive or negative development?',
  },
  {
    id: 'wt2_020',
    type: 'problem-solution',
    question: 'Many students find it difficult to manage stress during exams. What are the causes of this problem, and what solutions can schools and families offer?',
  },
  {
    id: 'wt2_021',
    type: 'discuss both views',
    question: 'Some people think that professional athletes are paid too much, while others believe their high salaries are justified. Discuss both views and give your own opinion.',
  },
  {
    id: 'wt2_022',
    type: 'advantages/disadvantages',
    question: 'More people are choosing to live alone than in the past. What are the advantages and disadvantages of this trend?',
  },
].map(addWritingMetadata);
