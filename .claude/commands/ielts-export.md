# /ielts-export

Export the current IELTS Speaking training session as an Obsidian-ready markdown note.

## What this command does

Claude writes a `.md` file under `notes/ielts/speaking/` following the unified standard defined in `docs/IELTS_SPEAKING_NOTE_STANDARD.md`.

## Export behavior

1. Claude detects session density:
   - 1 question → Single Question structure
   - 2–4 questions → Mini Session structure
   - 5+ questions → Topic Session structure (with P0/P1/P2 weighting)

2. Claude writes the complete markdown file. Every Attempt Block is self-contained — no "see other note" references.

3. Claude reports the file path and a 2–3 sentence summary in chat.

4. Claude does NOT print the full note in chat when file access is available. The file is the primary output.

## File naming

```
YYYY-MM-DD_IELTS_Speaking_Work.md
YYYY-MM-DD_IELTS_Speaking_Hometown.md
YYYY-MM-DD_IELTS_Speaking_Part2_Person.md
YYYY-MM-DD_IELTS_Speaking_Mixed_Part1_Part3.md
```

## Expression limits

- Active Today: max 3 expressions
- Recognize Only: 5–8 expressions
- Bright phrase budget: max 1 per Part 1 answer

## Rules

- Notes under `notes/ielts/` are local practice data. Do NOT commit or push them to the GitHub repo.
- Follow `docs/IELTS_SPEAKING_NOTE_STANDARD.md` exactly.
- Answer Path comes before Revised Answer in every Attempt Block.
- Re-answer Mission uses Must do / Try to use / Optional tiers.
- Transfer questions are labeled Same material / Same answer path / Same skill.