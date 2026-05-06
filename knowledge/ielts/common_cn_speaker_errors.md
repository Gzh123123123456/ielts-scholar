---
module: both
scope: cn_speaker_errors
last_reviewed: 2026-05-06
source_policy: app-usable summary based on uploaded learning materials and product rules; not official IELTS source; no long copyrighted excerpts
---

# Common Chinese Native Speaker Errors in English

## Purpose
Catalog the most frequent English output errors made by Chinese native speakers. Used by the AI to tag and explain corrections. All explanations are in Chinese when the user's context is Chinese-first.

## Error Categories

### Article (`article`)
Chinese does not have articles (a, an, the). Speakers often omit them or insert them incorrectly.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| I went to store. | I went to the store. | 英语中可数名词单数前通常需要冠词。 |
| She is teacher. | She is a teacher. | 职业前需要不定冠词 a/an。 |

### Tense (`tense`)
Chinese verbs do not conjugate for time. Tense is often forgotten or mixed in the same answer.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| Yesterday I go to the park. | Yesterday I went to the park. | 过去时间状语需要搭配过去时态。 |
| I have seen him yesterday. | I saw him yesterday. | 具体过去时间 (yesterday) 通常用一般过去时，不用现在完成时。 |

### Preposition (`preposition`)
Prepositions do not map one-to-one between Chinese and English. Errors are common with in/at/on/for/to.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| I arrived to the airport. | I arrived at the airport. | arrive 后接 at（小地点）或 in（大地点），不用 to。 |
| It depends of the situation. | It depends on the situation. | depend 固定搭配 on。 |

### Word Choice (`word_choice`)
Selecting a word that is technically correct in dictionary meaning but unnatural in context.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| I want to improve my English level. | I want to improve my English. | "English level" 是中式直译，native speakers 通常只说 "improve my English"。 |
| I have a big pressure. | I'm under a lot of pressure. | "big pressure" 是中式搭配，正确表达是 "under pressure" 或 "a lot of pressure"。 |

### Collocation (`collocation`)
Words that should go together naturally but are paired incorrectly.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| Learn knowledge | Gain/acquire knowledge | "learn knowledge" 是中式英语，know 和 learn 搭配不同。 |
| Make a decision carefully | Think carefully / Decide carefully | "make a decision" 可以搭配 carefully，但更自然的说法是 "think it through"。 |

### Sentence Structure (`sentence_structure`)
Direct word-for-word translation from Chinese sentence patterns produces awkward English structure.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| There has a park near my house. | There is a park near my house. | 中文"有"被直译为 have，英语 There be 结构表达存在。 |
| Although I like it, but I don't use it. | Although I like it, I don't use it. | although 和 but 不能同时使用，中文"虽然…但是…"允许同时出现。 |

### Overly Written Style (`overly_written_style`)
Using written/academic vocabulary and structures in spoken English. Common when candidates memorize essay phrases and reuse them in speaking.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| It is universally acknowledged that… | Most people would agree that… | Speaking 中避免论文模板句，用口语化的表达。 |
| Furthermore, it cannot be denied that… | And honestly, you can't ignore that… | Part 1/2 不需要正式连接词，自然停顿和转换即可。 |

### Unclear Reference (`unclear_reference`)
Pronouns or referents that don't clearly point to a specific noun, leaving the listener unsure what is being referred to.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| My father and my uncle, he is very tall. | My father and my uncle — my father is very tall. | "he" 指向不明。当有两个男性先行词时必须明确指明。 |
| This is important for it. | This skill is important for career growth. | "it" 没有明确的先行词。用具体名词替代模糊代词。 |

### Lack of Example (`lack_of_example`)
Making claims without concrete support. Particularly fatal in Part 2 and Part 3.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| Technology makes life easier. | Technology makes life easier — for example, mobile payments mean I haven't carried cash in years. | 抽象论点需要用具体例子支撑，否则听起来像背诵。 |

## Writing-Focused Error Categories

The following are common in Chinese native speaker academic writing. Tag them separately from speaking errors.

### Vague Nouns (`vague_noun`)
Using empty placeholder nouns instead of precise terms.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| People do many things online. | People now bank, socialize, and study online. | "things" 太模糊，用具体动作替代。 |
| The government should solve this thing. | The government should address this problem through regulation. | "thing" 在学术写作中不可接受。 |

### Unnecessary Fillers (`filler`)
Stock phrases that add no meaning and weaken the opening.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| Nowadays, as we all know, technology is developing rapidly. | Technology has advanced significantly in the past decade. | "nowadays" 和 "as we all know" 是空洞模板，直接进入论点。 |
| From my point of view, I think education is important. | Education is important for several reasons. | "From my point of view, I think" 是三重冗余。去掉或只保留一个。 |

### General Noun Over-Marking (`over_marked_noun`)
Adding unnecessary articles or determiners before plural general nouns.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| The universities should provide the scholarships. | Universities should provide scholarships. | 复数泛指不加 the。这里讨论的是所有大学/奖学金，不是特指某一个。 |
| Some students choose to study abroad. | Students may choose to study abroad. | 如果讨论的是普遍现象，不需要 "some" 来限定。 |

### Pronoun Ambiguity (`pronoun_ambiguity`)
Unclear what "this", "it", or "they" refers to.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| This is a serious problem. | This dependence on fossil fuels is a serious problem. | "This" 指代不明。用完整名词词组替代裸 this。 |
| They should consider this carefully. | Policymakers should consider the long-term consequences carefully. | "They" 和 "this" 都不明确。 |

### Over-Complex Vocabulary (`over_complex`)
Using rare words inaccurately to sound advanced.

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| Technology facilitates our quotidian existence. | Technology makes daily life more convenient. | "quotidian" 用在这里极其不自然。简单精准优于复杂但不准确。 |
| This phenomenon has multifarious ramifications. | This trend has several consequences. | "multifarious ramifications" 过度堆砌，考官一眼识破。 |

### Misused Word Pairs (`word_pair`)

| Original | Better | ExplanationZh |
|----------|--------|---------------|
| This improves efficiency. | This improves effectiveness. | efficiency=少资源做同样的事; effectiveness=达到目标。用混会偏离题意。 |
| We should enhance the problem. | We should address / solve the problem. | enhance = 提升好的东西。不能说 "enhance the problem"。 |
| Kids spend too much time online. | Children spend too much time online. | "kids" 在学术写作中不正式，用 "children"。 |
| The punishment for crime should be strict. | The penalties for serious offences should be strict. | "punishment" 偏向报复，"penalties" 偏向法律后果。Task 2 通常讨论后者。 |
| Drugs are harmful. | Certain pharmaceutical drugs may cause dependency when misused. | "drugs" 可能指毒品或药品。Task 2 涉及医药话题时需明确区分。 |
| The internet is very popular. | The internet is widely used / nearly universal. | "popular" 暗示"受欢迎、有人气"。"common" 暗示"常见、普遍"。数据说互联网普及率高，用 common/ubiquitous；说某个网站受欢迎，用 popular。 |
| We should teach knowledge to students. | We should develop students' critical thinking skills. | "teach knowledge" 是中式搭配。"knowledge" 偏向信息储备，"skills" 偏向应用能力，"learning" 偏向过程，"(critical) thinking" 偏向分析判断。学术写作中区分这四个词。 |

## Feedback Rules
- Tag every flagged error with the correct category from the lists above.
- **Speaking tags:** `article`, `tense`, `preposition`, `word_choice`, `collocation`, `sentence_structure`, `overly_written_style`, `unclear_reference`, `lack_of_example`.
- **Writing tags (additional):** `vague_noun`, `filler`, `over_marked_noun`, `pronoun_ambiguity`, `over_complex`, `word_pair`.
- Provide the Chinese explanation when the user's context indicates Chinese-first.
- For Speaking: prioritize fluency-impacting errors over minor imperfections.
- For Writing: prioritize task response and coherence errors before vocabulary polish.

## Do Not
- Do not flag every minor error if the meaning is clear and the error pattern is already noted elsewhere.
- Do not use the same template explanation for every instance — vary the phrasing.
- Do not flag dialect/regional variation as an error unless it genuinely affects IELTS band score.
- Do not mix Speaking and Writing error categories. Use the appropriate tag set for the module.

## Tag Mapping for V1 Schema

The detailed knowledge tags below should be mapped to the app's existing V1 schema tags in the output JSON. This ensures the feedback JSON only uses tags the app recognizes.

| Knowledge Tag | V1 Schema Tag |
|---------------|---------------|
| `vague_noun` | `lexical_precision` |
| `filler` | `coherence` or `lexical_precision` |
| `over_marked_noun` | `article` |
| `pronoun_ambiguity` | `coherence` |
| `over_complex` | `lexical_precision` |
| `word_pair` | `lexical_precision` |

The detailed knowledge tags are used internally for error classification and explanation generation. The V1 schema tags are what the JSON output actually contains.
