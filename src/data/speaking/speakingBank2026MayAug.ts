import type { SpeakingPrompt } from "./speakingPromptTypes";

const BANK_ID = "speaking-2026-05-08" as const;
const SEASON = "2026-05_to_2026-08" as const;

// ── Priority tiers ──────────────────────────────────────────────
const P_NEW = 100;
const P_REUSED = 80;
const P_EVERGREEN = 60;
const P_NON_MAINLAND = 20;

// ── Source coverage notes ───────────────────────────────────────
// Evergreen Part 1: full source coverage from extracted markdown.
// Mainland reused Part 2&3: full source coverage — all 26 topics
//   have complete cue cards + follow-ups from extracted markdown.
// Some new May Part 1 / Part 2&3 topics remain partial where the
//   source itself marks questions or follow-ups as 待补充/pending.

// ── Helpers ─────────────────────────────────────────────────────

function p1(
  slug: string,
  topic: string,
  titleCn: string,
  questions: string[],
  tags: string[],
  status: SpeakingPrompt["status"],
  priority: number,
  completeness: SpeakingPrompt["completeness"] = "complete",
): SpeakingPrompt[] {
  return questions.map((q, i) => ({
    id: `sp1_2026may_${slug}_${String(i + 1).padStart(2, "0")}`,
    bankId: BANK_ID,
    season: SEASON,
    region: "mainland_cn",
    status,
    part: 1 as const,
    topic,
    titleCn,
    question: q,
    tags,
    priority,
    completeness,
  }));
}

function p2(
  slug: string,
  topic: string,
  titleCn: string,
  cuePrompt: string,
  cuePoints: string[],
  followUps: string[],
  tags: string[],
  status: SpeakingPrompt["status"],
  priority: number,
  completeness: SpeakingPrompt["completeness"] = "complete",
): SpeakingPrompt {
  return {
    id: `sp2_2026may_${slug}_01`,
    bankId: BANK_ID,
    season: SEASON,
    region: "mainland_cn",
    status,
    part: 2,
    topic,
    titleCn,
    cueCard: { prompt: cuePrompt, points: cuePoints },
    followUps,
    tags,
    priority,
    completeness,
  };
}

// p2Partial is kept for topics explicitly marked incomplete in the source.
// It is NOT used for the 26 mainland reused Part 2&3 topics.
function p2Partial(
  slug: string,
  topic: string,
  titleCn: string,
  tags: string[],
  status: SpeakingPrompt["status"],
  priority: number,
): SpeakingPrompt {
  return {
    id: `sp2_2026may_${slug}_01`,
    bankId: BANK_ID,
    season: SEASON,
    region: "mainland_cn",
    status,
    part: 2,
    topic,
    titleCn,
    tags,
    priority,
    completeness: "partial",
  };
}

function p2NonMainland(
  slug: string,
  topic: string,
  titleCn: string,
  cuePrompt: string,
  cuePoints: string[],
  followUps: string[],
  tags: string[],
): SpeakingPrompt {
  return {
    id: `sp2_2026may_nm_${slug}_01`,
    bankId: BANK_ID,
    season: SEASON,
    region: "non_mainland",
    status: "non_mainland",
    part: 2,
    topic,
    titleCn,
    cueCard: { prompt: cuePrompt, points: cuePoints },
    followUps,
    tags,
    priority: P_NON_MAINLAND,
    completeness: "complete",
  };
}

function p1NonMainland(
  slug: string,
  topic: string,
  titleCn: string,
  questions: string[],
  tags: string[],
): SpeakingPrompt[] {
  return questions.map((q, i) => ({
    id: `sp1_2026may_nm_${slug}_${String(i + 1).padStart(2, "0")}`,
    bankId: BANK_ID,
    season: SEASON,
    region: "non_mainland",
    status: "non_mainland",
    part: 1 as const,
    topic,
    titleCn,
    question: q,
    tags,
    priority: P_NON_MAINLAND,
    completeness: "complete" as const,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// A. Mainland China — New Part 1 Topics
// ═══════════════════════════════════════════════════════════════════

const aNewPart1: SpeakingPrompt[] = [
  ...p1("food", "Food", "食物", [
    "What is your favourite food?",
    "What kind of food did you like when you were young?",
    "Do you eat different foods at different times of the year?",
    "Has your favourite food changed since you were a child?",
  ], ["food", "daily life", "preference"], "new", P_NEW),

  ...p1("pets-and-animals", "Pets and Animals", "宠物和动物", [
    "What's your favourite animal? Why?",
    "Where do you prefer to keep your pet, indoors or outdoors?",
    "Have you ever had a pet before?",
    "What is the most popular animal in China?",
  ], ["animals", "pets", "daily life"], "new", P_NEW),

  ...p1("sports-team", "Sports team", "运动队", [
    "Have you ever been part of a sports team?",
  ], ["sports", "teamwork"], "new", P_NEW, "partial"),

  ...p1("hobby", "Hobby", "爱好", [
    "Do you have any hobbies?",
    "Did you have any hobbies when you were a child?",
    "Do you have a hobby that you've had since childhood?",
    "Do you have the same hobbies as your family members?",
  ], ["hobbies", "childhood", "family"], "new", P_NEW),

  ...p1("morning-time", "Morning time", "早晨时间", [
    "Do you like getting up early in the morning?",
    "What do you usually do in the morning?",
    "What did you do in the morning when you were little? Why?",
    "Are there any differences between what you do in the morning now and what you did in the past?",
    "Do you spend your mornings doing the same things on both weekends and weekdays? Why?",
  ], ["routine", "time", "lifestyle"], "new", P_NEW),

  ...p1("gifts", "Gifts", "礼物", [
    "Have you ever sent handmade gifts to others?",
    "Have you ever received a great gift?",
    "What do you consider when choosing a gift?",
    "Do you think you are good at choosing gifts?",
    "What gift have you received recently?",
  ], ["gifts", "relationships", "daily life"], "new", P_NEW),

  ...p1("reading", "Reading", "阅读", [
    "Do you like reading?",
    "Do you prefer to read on paper or on a screen?",
    "When do you need to read carefully, and when not?",
  ], ["reading", "study", "media"], "new", P_NEW, "partial"),

  ...p1("walking", "Walking", "散步", [
    "Do you walk a lot?",
    "Did you often go outside to have a walk when you were a child?",
    "Why do people like to walk in parks?",
    "Where would you like to take a long walk if you had the chance?",
    "Where did you go for a walk lately?",
  ], ["walking", "health", "parks", "lifestyle"], "new", P_NEW),

  ...p1("typing", "Typing", "打字", [
    "Do you type on a desktop or laptop keyboard every day?",
    "When did you learn how to type on a keyboard?",
    "How do you improve your typing?",
  ], ["technology", "study", "work"], "new", P_NEW, "partial"),
];

// ═══════════════════════════════════════════════════════════════════
// B. Mainland China — New Part 2 & Part 3 Topics
// ═══════════════════════════════════════════════════════════════════

const bNewPart2: SpeakingPrompt[] = [
  p2("perfect-job", "Perfect job", "完美工作",
    "Describe your perfect job.",
    [
      "What it is",
      "Where you heard about it from",
      "What you need to learn to get the job",
      "And explain why you think it is your perfect job",
    ],
    [
      "What jobs do children want to do when they grow up?",
      "What should people consider when choosing jobs?",
      "Is salary the main reason people choose a certain job?",
    ],
    ["work", "career", "future"], "new", P_NEW, "partial",
  ),

  p2("famous-person", "Famous person you would like to meet", "想见的名人",
    "Describe a famous person you would like to meet.",
    [
      "Who he/she is",
      "How you knew him/her",
      "How/where you would like to meet him/her",
      "And explain why you would like to meet him/her",
    ],
    [
      "What are the advantages and disadvantages of being a famous child?",
      "What can today's children do to become famous?",
      "What can children do with their fame?",
      "Do people become famous because of their talent?",
    ],
    ["famous people", "media", "success"], "new", P_NEW, "partial",
  ),

  p2("no-mobile-phone", "Occasion when mobile phone use was not allowed", "禁用手机的场合",
    "Describe an occasion when you were not allowed to use your mobile phone.",
    [
      "When it was",
      "Where it was",
      "Why you were not allowed to use your mobile phone",
      "And how you felt about it",
    ],
    [
      "How do young and old people use mobile phones differently?",
      "What positive and negative impact do mobile phones have on friendship?",
      "Is it a waste of time to take pictures with mobile phones?",
      "Do you think it is necessary to have laws on the use of mobile phones?",
    ],
    ["mobile phones", "rules", "technology"], "new", P_NEW, "partial",
  ),

  p2("giving-advice", "Giving advice", "给别人建议",
    "Describe a time when you gave advice to others.",
    [
      "When it was",
      "To whom you gave the advice",
      "What the advice was",
      "And explain why you gave the advice",
    ],
    [
      "Should people prepare before giving advice?",
      "Is it good to ask advice from strangers online?",
      "What are the personalities of people whose job is to give advice to others?",
      "What are the problems if you ask too many people for advice?",
    ],
    ["advice", "relationships", "communication"], "new", P_NEW, "partial",
  ),

  p2("foreign-country-short-stay", "Short stay in a foreign country", "外国的短期停留",
    "Describe a foreign country you would like to stay or work in for a short period of time.",
    [
      "Which country it is",
      "Where you got to know this country",
      "What you will do there",
      "Why you will stay or work there just for a short period of time",
    ],
    [
      "Why do people sometimes go to other cities or other countries to travel?",
    ],
    ["travel", "foreign country", "work"], "new", P_NEW, "partial",
  ),

  p2("tech-product", "Technology product you would like to own", "想拥有的科技产品",
    "Describe a piece of technology, not a phone, that you would like to own.",
    [
      "What it is",
      "How much it costs",
      "What you will use it for",
      "And explain why you would like to own it",
    ],
    [
      "What are the differences between the technology of the past and that of today?",
    ],
    ["technology", "product", "lifestyle"], "new", P_NEW, "partial",
  ),

  p2("person-who-plans", "Person who makes plans a lot", "常做计划的人",
    "Describe a person who makes plans a lot.",
    [
      "Who he/she is",
      "How you knew him/her",
      "What plans he/she makes",
      "And explain how you feel about this person",
    ],
    [
      "Do you think it's important to plan ahead?",
      "Do you think children should plan their future careers?",
      "Should children ask their teachers or parents for advice when making plans?",
    ],
    ["planning", "personality", "career"], "new", P_NEW, "partial",
  ),

  p2("friend-who-draws", "Friend who loves drawing or painting", "喜欢画画的朋友",
    "Describe a friend of yours who loves drawing or painting.",
    [
      "Who he/she is",
      "How you knew him/her",
      "How often he/she draws or paints",
      "And explain why you think he/she loves drawing or painting",
    ],
    [
      "What is the right age for a child to learn drawing?",
      "Why do most children draw more often than adults do?",
      "Why do some people visit galleries or museums instead of viewing artworks online?",
      "Do you think galleries and museums should be free of charge?",
      "How do artworks inspire people?",
    ],
    ["art", "friends", "creativity"], "new", P_NEW, "partial",
  ),

  p2("app-program", "App or program", "App/程序",
    "Describe a program or app on your computer or phone.",
    [
      "What it is",
      "When/how you use it",
      "Where you found it",
      "And explain how you feel about it",
    ],
    [
      "What are the differences between old and young people when using apps?",
      "Why do some people not like using apps?",
    ],
    ["apps", "technology", "daily life"], "new", P_NEW, "partial",
  ),

  p2("story-recently-read", "Story read recently", "最近读过的故事",
    "Describe a story, such as a fairy tale, that you have read recently.",
    [
      "What it is about",
      "When you read it",
      "Whether you liked it",
      "And explain what you have learned from it",
    ],
    [
      "Why do most children like listening to stories before bedtime?",
      "Is a good storyline important for a movie?",
      "Do you think films with many celebrities are more likely to be popular?",
      "What films are popular in China right now?",
    ],
    ["stories", "reading", "films"], "new", P_NEW, "partial",
  ),

  p2("smiling-occasion", "Occasion when many people were smiling", "微笑的场合",
    "Describe an occasion when many people were smiling.",
    [
      "When it happened",
      "Who you were with",
      "What happened",
      "And explain why most people were smiling",
    ],
    [
      "Do you think people who like to smile are more friendly?",
      "Why do most people smile in photographs?",
      "Do women smile more than men? Why?",
      "Do people smile more when they are younger or older?",
    ],
    ["emotions", "events", "people"], "new", P_NEW, "partial",
  ),

  p2("proud-of-family-member", "Proud of a family member", "为家人骄傲",
    "Describe a time when you felt proud of a family member.",
    [
      "When it happened",
      "Who the person is",
      "What the person did",
      "And explain why you felt proud of him/her",
    ],
    [
      "When would parents feel proud of their children?",
      "Should parents reward children? Why and how?",
      "Is it good to reward children too often? Why?",
      "On what occasions would adults be proud of themselves?",
    ],
    ["family", "pride", "achievement"], "new", P_NEW, "partial",
  ),

  p2("important-family-item", "Important family item", "对家庭重要的东西",
    "Describe something important that has been kept in your family for a long time.",
    [
      "What it is",
      "When your family had it",
      "How your family got it",
      "And explain why it is important to your family",
    ],
    [
      "What things do families keep for a long time?",
      "What's the difference between things valued by people in the past and today?",
      "What kinds of things are kept in museums?",
      "What's the influence of technology on museums?",
    ],
    ["family", "objects", "memory", "museums"], "new", P_NEW, "partial",
  ),

  p2("shopping-mall", "Shopping mall", "商城",
    "Describe a shopping mall.",
    [
      "What its name is",
      "Where it is",
      "How often you visit it",
      "And what you usually buy at the mall",
    ],
    [
      "Why do people buy things they don't need?",
    ],
    ["shopping", "city", "consumption"], "new", P_NEW, "partial",
  ),
];

// ═══════════════════════════════════════════════════════════════════
// C. Mainland China — Reused Part 1 Topics
// ═══════════════════════════════════════════════════════════════════

const cReusedPart1: SpeakingPrompt[] = [
  ...p1("plants", "Plants", "植物", [
    "Do you keep plants at home?",
    "What plant did you grow when you were young?",
    "Do you know anything about growing a plant?",
    "Do Chinese people send plants as gifts?",
  ], ["plants", "nature", "daily life"], "reused", P_REUSED),

  ...p1("public-places", "Public places", "公共场所", [
    "Have you ever talked with someone you don't know in public places?",
    "Do you wear headphones in public places?",
    "Would you like to see more public places near where you live?",
    "Do you often go to public places with your friends?",
  ], ["public places", "city", "daily life"], "reused", P_REUSED),

  ...p1("rules", "Rules", "规则", [
    "Are there any rules for students at your school?",
    "Do you think students would benefit more from more rules?",
    "Have you ever had a really dedicated teacher?",
    "Do you prefer to have more or fewer rules at school?",
    "Have you ever had a really strict teacher?",
    "Would you like to work as a teacher in a rule-free school?",
  ], ["rules", "school", "education"], "reused", P_REUSED),

  ...p1("shoes", "Shoes", "鞋子", [
    "Do you like buying shoes? How often?",
    "Have you ever bought shoes online?",
    "How much money do you usually spend on shoes?",
    "Which do you prefer, fashionable shoes or comfortable shoes?",
  ], ["shoes", "fashion", "shopping"], "reused", P_REUSED),

  ...p1("doing-something-well", "Doing something well", "做得好的事情", [
    "Do you have an experience when you did something well?",
    "Do you have an experience when your teacher thought you did a good job?",
    "Do you often tell your friends when they do something well?",
  ], ["achievement", "school", "friends"], "reused", P_REUSED),

  ...p1("crowded-place", "Crowded place", "拥挤的地方", [
    "Is the city where you live crowded?",
    "Is there a crowded place near where you live?",
    "Do you like crowded places?",
    "Do most people like crowded places?",
    "When was the last time you were in a crowded place?",
  ], ["crowded", "city", "lifestyle"], "reused", P_REUSED),

  ...p1("going-out", "Going out", "外出", [
    "Do you bring food or snacks with you when going out?",
    "Do you always take your mobile phone with you when going out?",
    "Do you often bring cash with you?",
    "How often do you use cash?",
  ], ["going out", "daily life", "money"], "reused", P_REUSED),

  ...p1("staying-with-old-people", "Staying with old people", "和老人相处", [
    "Have you ever worked with old people?",
    "Are you happy to work with people who are older than you?",
    "What are the benefits of being friends with or working with old people?",
    "Do you enjoy spending time with old people?",
  ], ["elderly", "relationships", "work"], "reused", P_REUSED),

  ...p1("growing-vegetables", "Growing vegetables/fruits", "种蔬菜水果", [
    "Are you interested in growing vegetables and fruits?",
    "Is growing vegetables popular in your country?",
    "Do many people grow vegetables in your city?",
    "Do you think it's easy to grow vegetables?",
    "Should schools teach students how to grow vegetables?",
  ], ["vegetables", "food", "nature", "education"], "reused", P_REUSED),

  ...p1("chatting", "Chatting", "聊天", [
    "Do you like chatting with friends?",
    "What do you usually chat about with friends?",
    "Do you prefer to chat with a group of people or with only one friend?",
    "Do you prefer to communicate face-to-face or via social media?",
    "Do you argue with friends?",
  ], ["chatting", "friends", "communication"], "reused", P_REUSED),

  ...p1("borrowing-lending", "Borrowing and lending", "借东西", [
    "Have you borrowed books from others?",
    "Have you ever borrowed money from others?",
    "Do you like to lend things to others?",
    "How do you feel when people don't return things they borrowed from you?",
    "Do you mind if others borrow money from you?",
  ], ["borrowing", "lending", "relationships"], "reused", P_REUSED),

  ...p1("advertisement", "Advertisement", "广告", [
    "Is there an advertisement that made an impression on you when you were a child?",
    "Do you see a lot of advertising on trains or other transport?",
    "Do you like advertisements?",
    "What kind of advertising do you like?",
    "Do you often see advertisements when you are on your phone or computer?",
  ], ["advertising", "media", "consumer"], "reused", P_REUSED),

  ...p1("museum", "Museum", "博物馆", [
    "Do you think museums are important?",
    "Are there many museums in your hometown?",
    "Do you often visit a museum?",
    "When was the last time you visited a museum?",
  ], ["museums", "culture", "city"], "reused", P_REUSED),

  ...p1("having-a-break", "Having a break", "休息", [
    "How often do you take a rest or a break?",
    "What do you usually do when you are resting?",
    "Do you take a nap when you are taking your rest?",
    "How do you feel after taking a nap?",
  ], ["break", "rest", "routine"], "reused", P_REUSED),

  ...p1("sharing", "Sharing", "分享", [
    "Did your parents teach you to share when you were a child?",
    "What kind of things do you like to share with others?",
    "What kind of things are not suitable for sharing?",
    "Do you have anything to share with others recently?",
    "Who is the first person you would like to share good news with?",
    "Do you prefer to share news with your friends or your parents?",
  ], ["sharing", "relationships", "family", "friends"], "reused", P_REUSED),
];

// ═══════════════════════════════════════════════════════════════════
// D. Mainland China — Evergreen Part 1 Topics
// (source coverage: complete from extracted markdown)
// ═══════════════════════════════════════════════════════════════════

const dEvergreenPart1: SpeakingPrompt[] = [
  ...p1("work-or-studies", "Work or studies", "工作或学习", [
    "What subjects are you studying?",
    "Do you like your subject?",
    "Why did you choose to study that subject?",
    "Do you think that your subject is popular in your country?",
    "Do you have any plans for your studies in the next five years?",
    "What are the benefits of being your age?",
    "Do you want to change your major?",
    "Do you prefer to study in the mornings or in the afternoons?",
    "How much time do you spend on your studies each week?",
    "Are you looking forward to working?",
    "What technology do you use when you study?",
    "What changes would you like to see in your school?",
    "What work do you do?",
    "Why did you choose to do that type of work or that job?",
    "Do you like your job?",
    "What requirements did you need to meet to get your current job?",
    "Do you have any plans for your work in the next five years?",
    "What do you think is the most important at the moment?",
    "Do you want to change to another job?",
    "Do you miss being a student?",
    "What technology do you use at work?",
    "Who helps you the most? And how?",
  ], ["work", "study", "career"], "evergreen", P_EVERGREEN),

  ...p1("home-accommodation", "Home/accommodation", "住所", [
    "What kind of house or apartment do you want to live in in the future?",
    "Are the transport facilities to your home very good?",
    "Do you prefer living in a house or an apartment?",
    "Please describe the room you live in. What part of your home do you like the most?",
    "How long have you lived there?",
    "Do you plan to live there for a long time?",
    "What's the difference between where you are living now and where you have lived in the past?",
    "Can you describe the place where you live?",
    "What room does your family spend most of the time in?",
    "What's your favorite room in your apartment or house?",
    "What makes you feel pleasant in your home?",
    "Do you think it is important to live in a comfortable environment?",
    "Do you live in an apartment or a house?",
    "Who do you live with?",
    "What do you usually do in your apartment?",
    "What kinds of accommodation do you live in?",
  ], ["home", "accommodation", "daily life"], "evergreen", P_EVERGREEN),

  ...p1("hometown", "Hometown", "家乡", [
    "Where is your hometown?",
    "Is that a big city or a small place?",
    "Please describe your hometown a little. How long have you been living there?",
    "Do you think you will continue living there for a long time?",
    "Do you like your hometown?",
    "Do you like living there?",
    "What do you like most about your hometown?",
    "Is there anything you dislike about it?",
    "What's your hometown famous for?",
    "Did you learn about the history of your hometown at school?",
    "Are there many young people in your hometown?",
    "Is your hometown a good place for young people to pursue their careers?",
    "Have you learned anything about the history of your hometown?",
    "Did you learn about the culture of your hometown in your childhood?",
  ], ["hometown", "city", "life", "culture"], "evergreen", P_EVERGREEN),

  ...p1("area-you-live-in", "The area you live in", "居住的区域", [
    "Do you like the area that you live in?",
    "Where do you like to go in that area?",
    "Do you know any famous people in your area?",
    "What are some changes in the area recently?",
    "Do you know any of your neighbors?",
    "Are the people in your neighborhood nice and friendly?",
    "Do you live in a noisy or a quiet area?",
  ], ["area", "neighborhood", "city"], "evergreen", P_EVERGREEN),

  ...p1("city-you-live-in", "The city you live in", "你居住的城市", [
    "What city do you live in?",
    "Do you like this city? Why?",
    "How long have you lived in this city?",
    "Are there big changes in this city?",
    "Is this city your permanent residence?",
    "Are there people of different ages living in this city?",
    "Are the people friendly in the city?",
    "Is the city friendly to children and old people?",
    "Do you often see your neighbors?",
    "What's the weather like where you live?",
    "Would you recommend your city to others?",
  ], ["city", "urban life", "neighborhood"], "evergreen", P_EVERGREEN),
];

// ═══════════════════════════════════════════════════════════════════
// E. Mainland China — Reused Part 2 & Part 3 Topics
// (source coverage: complete from extracted markdown)
// ═══════════════════════════════════════════════════════════════════

const eReusedPart2: SpeakingPrompt[] = [
  p2("wild-animal", "Wild animal you want to learn more about", "想多了解的野生动物",
    "Describe a wild animal that you want to learn more about.",
    ["What it is", "When/where you saw it", "Why you want to learn more about it", "And explain what you want to learn more about it"],
    [
      "Why should we protect wild animals?",
      "Why are some people more willing to protect wild animals than others?",
      "Do you think it's important to take children to the zoo to see animals?",
      "Why do some people attach more importance to protecting rare animals?",
      "Should people educate children to protect wild animals?",
      "Is it more important to protect wild animals or the environment?",
    ],
    ["animals", "nature", "learning"], "reused", P_REUSED),

  p2("friend-music-singing", "Friend good at music/singing", "擅长音乐的朋友",
    "Describe a friend of yours who is good at music/singing.",
    ["Who he/she is", "When/where you listen to his/her music/singing", "What kind of music/songs he/she is good at", "And explain how you feel when listening to his music/singing"],
    [
      "What kind of music is popular in your country?",
      "What kind of music do young people like?",
      "What are the differences between young people's and old people's preferences in music?",
      "What are the benefits of children learning a musical instrument?",
      "Do you know what kind of music children like today?",
      "Do you think the government should invest more money in concerts?",
    ],
    ["music", "friends", "talent"], "reused", P_REUSED),

  p2("good-friend-important", "Good friend important to you", "重要的好朋友",
    "Describe a good friend who is important to you.",
    ["Who he/she is", "How/where you got to know him/her", "How long you have known each other", "And explain why he/she is important to you"],
    [
      "How do children make friends at school?",
      "How do children make friends when they are not at school?",
      "Do you think it is better for children to have a few close friends or many casual friends?",
      "Do you think a child's relationship with friends can be replaced by that with other people, like parents or other family members?",
      "What are the differences between friends made inside and outside the workplace?",
      "Do you think it's possible for bosses and their employees to become friends?",
    ],
    ["friends", "relationships"], "reused", P_REUSED),

  p2("lost-your-way", "Occasion when you lost your way", "迷路",
    "Describe an occasion when you lost your way.",
    ["Where you were", "What happened", "How you felt", "And explain how you found your way"],
    [
      "Why do some people get lost more easily than others?",
      "Do you think it is important to be able to read a map?",
      "Do you think it is important to do some preparation before you travel to new places?",
      "How can people find their way when they are lost?",
      "Is a paper map still necessary?",
      "How do people react when they get lost?",
    ],
    ["travel", "navigation", "experience"], "reused", P_REUSED),

  p2("person-family-business", "Person who enjoys working for a family business", "在家族企业工作的人",
    "Describe a person you know who enjoys working for a family business, such as a shop.",
    ["Who he/she is", "What the business is", "What his/her job is", "And explain why he/she enjoys working there"],
    [
      "Would you like to start a family business?",
      "Would you like to work for a family business?",
      "Why do some people choose to start their own company?",
      "What are the advantages and disadvantages of family businesses?",
      "What family businesses do you know in your local area?",
      "What makes a successful family business?",
    ],
    ["family", "business", "work"], "reused", P_REUSED),

  p2("natural-talent-improve", "Natural talent you want to improve", "想提升的天赋",
    "Describe a natural talent, such as sports or music, that you want to improve.",
    ["What it is", "When you discovered it", "How you want to improve it", "And how you feel about it"],
    [
      "Do you think artists with talents should focus on their talents?",
      "Is it possible for us to know whether children who are 3 or 4 years old will become musicians and painters when they grow up?",
      "Why do people like to watch talent shows?",
      "Do you think it is more interesting to watch famous people's or ordinary people's shows?",
      "Do you think it's important to develop children's talents?",
      "Why do some people like to show their talents online?",
    ],
    ["talent", "self-improvement", "skills"], "reused", P_REUSED),

  p2("great-dinner", "Great dinner with friend or family", "和亲友享受的晚餐",
    "Describe a great dinner you and your friend or family members enjoyed.",
    ["What you had", "Who you had the dinner with", "What you talked about during the dinner", "And explain why you enjoyed it"],
    [
      "Do people prefer to eat out at restaurants or eat at home during the Spring Festival?",
      "What food do you eat on special occasions, like during the Spring Festival or the Mid-autumn Festival?",
      "Why do people like to have meals together during important festivals?",
      "Is it a hassle to prepare a meal at home?",
      "What do people often talk about during meals?",
      "People are spending less and less time having meals with their families these days. Is this good or bad?",
    ],
    ["food", "family", "friends", "events"], "reused", P_REUSED),

  p2("long-journey-again", "Long journey you would like to take again", "想再去一次的远行",
    "Describe a long journey you had and would like to take again.",
    ["When/where you went", "Who you had the journey with", "Why you had the journey", "And explain why you would like to have it again"],
    [
      "Do you think it is a good choice to travel by plane?",
      "What are the differences between group travelling and travelling alone?",
      "What do we need to prepare for a long journey?",
      "Why do some people like making long journeys?",
      "Why do some people prefer to travel in their own country?",
      "Why do some people prefer to travel abroad?",
    ],
    ["travel", "journey", "experience"], "reused", P_REUSED),

  p2("interesting-traditional-story", "Interesting traditional story", "传统故事",
    "Describe an interesting traditional story.",
    ["What the story is about", "When/how you knew it", "Who told you the story", "And explain how you felt when you first heard it"],
    [
      "What kind of stories do children like?",
      "What are the benefits of bedtime stories for children?",
      "Why do most children like listening to stories before bedtime?",
      "What can children learn from stories?",
      "Do all stories for children have happy endings?",
      "Is a good storyline important for a movie?",
    ],
    ["stories", "tradition", "culture"], "reused", P_REUSED),

  p2("electricity-went-off", "Time when electricity suddenly went off", "突然停电",
    "Describe a time when the electricity suddenly went off.",
    ["When/where it happened", "How long it lasted", "What you did during that time", "And explain how you felt about it"],
    [
      "Which is better, electric bicycles or ordinary bicycles?",
      "Do you think electric bicycles will replace ordinary bicycles in the future?",
      "Which is better, electric cars or petrol cars?",
      "How did people manage to live without electricity in the ancient world?",
      "Is it difficult for the government to replace all the petrol cars with electric cars?",
      "Do people use more electricity now than before?",
    ],
    ["electricity", "technology", "daily life"], "reused", P_REUSED),

  p2("someone-apologized", "Time when someone apologized to you", "别人向你道歉",
    "Describe a time when someone apologized to you.",
    ["When it was", "Who this person is", "Why he or she apologized to you", "And how you felt about it"],
    [
      "Do you think people should apologize for anything wrong they do?",
      "Do people in your country like to say \"sorry\"?",
      "On what occasion do people usually apologize to others?",
      "Why do some people refuse to say \"sorry\" to others?",
      "Do you think every \"sorry\" is from the bottom of the heart?",
      "Are women better than men at recognizing emotions?",
    ],
    ["apology", "relationships", "emotions"], "reused", P_REUSED),

  p2("friend-good-habit", "Good habit your friend has and you want to develop", "学习朋友好习惯",
    "Describe a good habit your friend has and you want to develop.",
    ["Who your friend is", "What habit he/she has", "When you noticed this habit", "And explain why you want to develop this habit"],
    [
      "What habits should children have?",
      "What should parents do to teach their children good habits?",
      "What influences do children with bad habits have on other children?",
      "Why do some habits change when people get older?",
      "How do we develop bad habits?",
      "What can we do to get rid of bad habits?",
    ],
    ["habits", "friends", "self-improvement"], "reused", P_REUSED),

  p2("exciting-activity-first-time", "Exciting activity tried for the first time", "第一次尝试的兴奋活动",
    "Describe an exciting activity you have tried for the first time.",
    ["What it is", "When/where you did it", "Why you thought it was exciting", "And explain how you felt about it"],
    [
      "Why are some people unwilling to try new things?",
      "Do you think fear stops people from trying new things?",
      "Why are some people keen on doing dangerous activities?",
      "Do you think that children adapt to new things more easily than adults?",
      "What can people learn from doing dangerous activities?",
      "What are the benefits of trying new things?",
    ],
    ["activities", "first time", "experience"], "reused", P_REUSED),

  p2("creative-person-admire", "Creative person you admire", "钦佩的有创造力的人",
    "Describe a creative person, such as an artist, a musician, or an architect, that you admire.",
    ["Who he/she is", "How you knew him/her", "What his/her greatest achievement is", "And explain why you think he/she is creative"],
    [
      "Do you think children should learn to play musical instruments?",
      "How do artists acquire inspiration?",
      "Do you think pictures and videos in news reports are important?",
      "What can we do to help children keep creative?",
      "How does drawing help to enhance children's creativity?",
      "What kind of jobs require creativity?",
    ],
    ["creativity", "people", "admiration"], "reused", P_REUSED),

  p2("important-old-thing-family", "Important old thing kept by family", "家中重要老物件",
    "Describe an important old thing that your family has kept for a long time.",
    ["What it is", "How/when your family first got this thing", "How long your family has kept it", "And explain why this thing is important to your family"],
    [
      "What kind of old things do people in your country like to keep?",
      "Why do people keep old things?",
      "What are the differences between the things old people keep and those young people keep?",
      "What are the differences between the things that people keep today and the things that people kept in the past?",
      "What can we see in a museum?",
      "What can we learn from a museum?",
    ],
    ["family", "objects", "memory"], "reused", P_REUSED),

  p2("first-time-foreign-language", "First time talking in a foreign language", "第一次用外语",
    "Describe the time when you first talked in a foreign language.",
    ["Where you were", "Who you were with", "What you talked about", "And explain how you felt about it"],
    [
      "At what age should children start learning a foreign language?",
      "Which skill is more important, speaking or writing?",
      "Does a person still need to learn other languages, if he or she is good at English?",
      "Do you think minority languages will disappear?",
      "Does learning a foreign language help in finding a job?",
      "Which stage of life do you think is the best for learning a foreign language?",
    ],
    ["language", "first time", "communication"], "reused", P_REUSED),

  p2("interesting-thing-social-media", "Interesting thing on social media", "社交媒体趣事",
    "Describe a time you saw something interesting on social media.",
    ["When it was", "Where you saw it", "What you saw", "And explain why you think it was interesting"],
    [
      "Why do people like to use social media?",
      "What kinds of things are popular on social media?",
      "What are the advantages and disadvantages of using social media?",
      "What do you think of making friends on social network?",
      "Are there any people who shouldn't use social media?",
      "Do you think people spend too much time on social media?",
    ],
    ["social media", "internet", "technology"], "reused", P_REUSED),

  p2("broke-something", "Time when you broke something", "弄坏东西",
    "Describe a time when you broke something.",
    ["What it was", "When/where that happened", "How you broke it", "And explain what you did after that"],
    [
      "What kind of things are more likely to be broken by people at home?",
      "What kind of people like to fix things by themselves?",
      "Do you think clothes produced in the factory are of better quality than those made by hand?",
      "Do you think handmade clothes are more valuable?",
      "Is the older generation better at fixing things?",
      "Do you think elderly people should teach young people how to fix things?",
    ],
    ["accidents", "objects", "experience"], "reused", P_REUSED),

  p2("science-subject-interested", "Area or subject of science you are interested in", "感兴趣的科学学科或领域",
    "Describe an area/subject of science, such as biology or robotics, that you are interested in and would like to learn more about.",
    ["Which area/subject it is", "When and where you came to know this area/subject", "How you get information about this area/subject", "And explain why you are interested in this area/subject"],
    [
      "Why do some children not like learning science at school?",
      "Is it important to study science at school?",
      "Which science subject is the most important for children to learn?",
      "Should people continue to study science after graduating from school?",
      "How do you get to know about scientific news?",
      "Should scientists explain the research process to the public?",
    ],
    ["science", "education", "interest"], "reused", P_REUSED),

  p2("useful-book-read", "Useful book you read", "有用的书",
    "Describe a book you read that you found useful.",
    ["What it is", "When you read it", "Why you think it is useful", "And explain how you felt about it"],
    [
      "What are the types of books that young people like to read?",
      "What should the government do to make libraries better?",
      "Do you think old people spend more time reading than young people?",
      "Which one is better, paper books or e-books?",
      "Have libraries changed a lot with the development of the internet?",
      "What should we do to prevent modern libraries from closing down?",
    ],
    ["books", "reading", "learning"], "reused", P_REUSED),

  p2("successful-sportsperson-admire", "Successful sportsperson you admire", "钦佩的运动员",
    "Describe a successful sportsperson you admire.",
    ["Who he/she is", "What you know about him/her", "What he/she is like in real life", "What achievement he/she has made", "And explain why you admire him/her"],
    [
      "Should students have physical education and do sports at school?",
      "What qualities should an athlete have?",
      "Is talent important in sports?",
      "Is it easy to identify children's talents?",
      "What is the most popular sport in your country?",
      "Why are there so few top athletes?",
    ],
    ["sports", "success", "admiration"], "reused", P_REUSED),

  p2("toy-childhood-liked", "Toy you liked in childhood", "童年喜欢的玩具",
    "Describe a toy you liked in your childhood.",
    ["What kind of toy it is", "When you received it", "How you played it", "And how you felt about it"],
    [
      "How do advertisements influence children?",
      "Should advertising aimed at kids be prohibited?",
      "What's the difference between the toys kids play now and those they played in the past?",
      "Do you think parents should buy more toys for their kids or spend more time with them?",
      "What's the difference between the toys boys play with and girls play with?",
      "What are the advantages and disadvantages of modern toys?",
    ],
    ["toys", "childhood", "memory"], "reused", P_REUSED),

  p2("important-decision-help", "Important decision made with help from others", "别人帮忙下做的决定",
    "Describe an important decision made with the help of other people.",
    ["What the decision was", "Why you made the decision", "Who helped you make the decision", "And how you felt about it"],
    [
      "What kind of decisions do you think are meaningful?",
      "What important decisions should be made by teenagers themselves?",
      "Why are some people unwilling to make quick decisions?",
      "Do people like to ask for advice more for their personal life or their work?",
      "Why do some people like to ask others for advice?",
    ],
    ["decisions", "help", "relationships"], "reused", P_REUSED),

  p2("waited-something-special", "Time when you waited for something special", "等待特别事情",
    "Describe a time when you waited for something special that would happen.",
    ["What you waited for", "Where you waited", "Why it was special", "And explain how you felt while you were waiting"],
    [
      "On what occasions do people usually need to wait?",
      "Who behave better when waiting, children or adults?",
      "Compared to the past, are people less patient now? Why?",
      "What are the positive and negative effects of waiting on society?",
      "Why are some people unwilling to wait?",
      "Where do children learn to be patient, at home or at school?",
    ],
    ["waiting", "events", "patience"], "reused", P_REUSED),

  p2("good-service-shop", "Good service in a shop/store", "购物服务",
    "Describe a time when you received good service in a shop/store.",
    ["Where the shop is", "When you went to the shop", "What service you received from the staff", "And explain how you felt about the service"],
    [
      "Why are shopping malls so popular in China?",
      "What are the advantages and disadvantages of shopping in small shops?",
      "Why do some people not like shopping in small shops?",
      "What are the differences between online shopping and in-store shopping?",
      "What are the advantages and disadvantages of shopping online?",
      "Can consumption drive economic growth?",
    ],
    ["shopping", "service", "experience"], "reused", P_REUSED),

  p2("natural-place-visit", "Natural place you like to visit", "自然之地",
    "Describe a natural place, such as a park or mountain.",
    ["Where this place is", "How you knew this place", "What it is like", "And explain why you like to visit it"],
    [
      "What kind of people like to visit natural places?",
      "What are the differences between a natural place and a city?",
      "Do you think that going to the park is the only way to get close to nature?",
      "What can people gain from going to natural places?",
      "Are there any wild animals in the city?",
      "Do you think it is a good idea to let animals stay in local parks for people to see?",
    ],
    ["nature", "travel", "places"], "reused", P_REUSED),
];

// ═══════════════════════════════════════════════════════════════════
// F. Non-mainland — Optional New Topics
// ═══════════════════════════════════════════════════════════════════

const fNonMainlandPart1: SpeakingPrompt[] = [
  ...p1NonMainland("day-off", "Day off", "休息日", [
    "When was the last time you had a few days off?",
    "What do you usually do when you have days off?",
    "Do you usually spend your days off with your parents or with your friends?",
    "What would you like to do if you had a day off tomorrow?",
  ], ["rest", "free time", "lifestyle"]),

  ...p1NonMainland("dreams", "Dreams", "梦想", [
    "Can you remember the dreams you had?",
    "Do you share your dreams with others?",
    "Do you think dreams have special meanings?",
    "Do you want to make your dreams come true?",
  ], ["dreams", "psychology", "life"]),

  ...p1NonMainland("keys", "Keys", "钥匙", [
    "Do you always bring a lot of keys with you?",
    "Have you ever lost your keys?",
    "Do you often forget the keys and lock yourself out?",
    "Do you think it's a good idea to leave your keys with a neighbour?",
  ], ["keys", "daily life", "objects"]),
];

const fNonMainlandPart2: SpeakingPrompt[] = [
  p2NonMainland("disappointed-movie", "Movie you felt disappointed about", "让你失望的电影",
    "Describe a movie you watched recently that you felt disappointed about.",
    [
      "When it was",
      "Why you didn't like it",
      "Why you decided to watch it",
      "And explain why you felt disappointed about it",
    ],
    [
      "Do you believe movie reviews?",
      "What are the different types of films in your country?",
      "Are historical films popular in your country? Why?",
      "Do you think films with famous actors or actresses are more likely to become successful films?",
      "Why are Japanese animated films so popular?",
      "Should the director pay a lot of money to famous actors?",
    ],
    ["movies", "entertainment", "media"],
  ),

  p2NonMainland("cant-live-without", "Something you can't live without, not a computer/phone", "生活中离不开的东西",
    "Describe something that you can't live without, not a computer or phone.",
    [
      "What it is",
      "What you do with it",
      "How it helps you in your life",
      "And explain why you can't live without it",
    ],
    [
      "Why are children attracted to new things such as electronics?",
      "Why do some grown-ups hate to throw out old things such as clothes?",
      "Is the way people buy things affected? How?",
      "What do you think influences people to buy new things?",
      "Why do all children like toys?",
      "Do you think it is good for a child to always take his or her favourite toy with them all the time?",
    ],
    ["objects", "lifestyle", "consumer"],
  ),

  p2NonMainland("favorite-place-relax", "Favorite place in your house where you can relax", "家里放松的地方",
    "Describe your favorite place in your house where you can relax.",
    [
      "Where it is",
      "What it is like",
      "What you enjoy doing there",
      "And explain why you feel relaxed at this place",
    ],
    [
      "Why is it difficult for some people to relax?",
      "What are the benefits of doing exercise?",
      "Do people in your country exercise after work?",
      "What is the place where people spend most of their time at home?",
      "Do you think there should be classes for training young people and children how to relax?",
      "Which is more important, mental relaxation or physical relaxation?",
    ],
    ["home", "relaxation", "lifestyle"],
  ),
];

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

/** All Part 1 prompts: new + reused + evergreen + non-mainland */
export const speakingBank2026MayAugPart1: SpeakingPrompt[] = [
  ...aNewPart1,
  ...cReusedPart1,
  ...dEvergreenPart1,
  ...fNonMainlandPart1,
];

/** All Part 2 prompts (with followUps): new + reused + non-mainland */
export const speakingBank2026MayAugPart2: SpeakingPrompt[] = [
  ...bNewPart2,
  ...eReusedPart2,
  ...fNonMainlandPart2,
];

/** All Part 1 & Part 2 prompts (flat combined list) */
export const speakingBank2026MayAugAll: SpeakingPrompt[] = [
  ...speakingBank2026MayAugPart1,
  ...speakingBank2026MayAugPart2,
];

export { BANK_ID as speakingBank2026MayAugId, SEASON as speakingBank2026MayAugSeason };
