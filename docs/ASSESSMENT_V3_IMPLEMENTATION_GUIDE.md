# Assessment V3 Implementation Guide

## What You're Building

A video-based conversation assessment where users watch short video clips, answer questions, and get routed to personalized results based on their skill gaps.

**The User Experience:**
```
VIDEO plays (15-30 sec) → pauses → Question appears → User answers → Next VIDEO plays
                                                                          ↓
                                                              (repeat 8 times)
                                                                          ↓
                                                              Results Page with Coach Insight
```

---

## Key Concepts

### Three Things You Create in the Admin

| What | Where | Purpose |
|------|-------|---------|
| **Segments** | `/admin/assessment/segments` | Video clips from Bunny Stream |
| **Questions** | `/admin/assessment/questions` | Questions that appear after videos |
| **Flow** | `/admin/assessment/flow` | Connects segments & questions with routing logic |

### How They Connect

```
SEGMENT (video) ──► QUESTION ──► SEGMENT (response video) ──► QUESTION ──► ...
     │                  │                    │
     │                  │                    │
     ▼                  ▼                    ▼
  Bunny Video      Shows overlay       Routes based on
  plays here       with options        user's answer
```

**Important:** Segments are just video references. Questions are just question definitions. The FLOW is what connects them and defines the order + routing logic.

---

## The Complete User Journey

The pattern is simple and consistent:

```
VIDEO (intro/response) → QUESTION(s) → VIDEO (response + next topic intro) → QUESTION(s) → ...
```

Here's exactly what the user sees:

| Step | What Happens | Type |
|------|--------------|------|
| **TOPIC 1: Starting Point** | | |
| 1 | Intro video plays | VIDEO `intro` |
| 2 | Q1: How long playing? | QUESTION `time_playing` |
| 3 | Q2: Current situation? | QUESTION `current_situation` |
| **TOPIC 2: Fretboard Check** | | |
| 4 | Response video (acknowledges answers + introduces fretboard topic) | VIDEO `response_starting_point` |
| 5 | Q3a: 6th fret A string? | QUESTION `fretboard_check_1` |
| 6 | Q3b: Major 3rd from G? | QUESTION `fretboard_check_2` |
| 7 | Q3c: Open A elsewhere? | QUESTION `fretboard_check_3` |
| **TOPIC 3: Fretboard Application** | | |
| 8 | Response video (pass/fail + introduces application) | VIDEO `fretboard_pass` or `fretboard_fail` |
| 9 | Q4: Chord change to D? | QUESTION `fretboard_application` |
| **TOPIC 4: Theory Check** | | |
| 10 | Response video (acknowledges + introduces theory) | VIDEO `response_fretboard_app` |
| 11 | Q5: V chord in G? | QUESTION `theory_check` |
| **TOPIC 5: Creation** | | |
| 12 | Response video (pass/fail/don't know + introduces creation) | VIDEO `theory_pass/fail/dont_know` |
| 13 | Q6: Fill in bar 4? | QUESTION `creation_test` |
| **TOPIC 6: Groove** | | |
| 14 | Response video (acknowledges + introduces groove) | VIDEO `response_creation` |
| 15 | Q7: Playing with drummer? | QUESTION `groove_truth` |
| **TOPIC 7: Frustration** | | |
| 16 | Response video (acknowledges + introduces frustration) | VIDEO `response_groove` |
| 17 | Q8: What frustrates you? | QUESTION `frustration` |
| **TOPIC 8: Goals & Wrap-up** | | |
| 18 | Response video (acknowledges + introduces goals) | VIDEO `response_frustration` |
| 19 | Q9: Goals? | QUESTION `goals` |
| 20 | Q10: Genre? (optional) | QUESTION `genre` |
| **ENDING** | | |
| 21 | Ending video (wraps up, "analyzing...") | VIDEO `ending` |
| 22 | Results overlay appears (with coach insight) | RESULT OVERLAY |

### The Pattern

Every topic follows the same structure:
```
┌─────────────────────────────────────────────────────────────┐
│  VIDEO                           │  QUESTION(S)            │
│  - Responds to previous answer   │  - User answers         │
│  - Introduces this topic         │  - Can be 1-3 questions │
└─────────────────────────────────────────────────────────────┘
```

### Video Content Pattern

Each response video does TWO things:
1. **Acknowledges** the previous answer(s) - "Good, you know your fretboard" or "That's useful info, the fretboard's blurry for you"
2. **Introduces** the next topic - "Now let's talk about..."

This creates the feeling of a real conversation, not a quiz.

---

## Phase 1: Create Segments

Go to `/admin/assessment/segments` and create these video segments.

### What Each Field Means

| Field | What to Enter |
|-------|---------------|
| Name | Display name (e.g., "Intro") |
| Slug | Unique ID (e.g., `intro`) - used in the flow |
| Video Library ID | Your Bunny Stream library ID |
| Video ID | The specific video's GUID from Bunny |
| Duration | Approximate length in seconds |

### Segments to Create

#### 1. Intro Video (Topic 1 Start)
```
Name: Intro
Slug: intro
Duration: 35-45 seconds
Content:
  - Hook/contrarian premise
  - "Most bass players practice the wrong thing for years..."
  - Introduces first questions (time playing, current situation)
```

#### 2. Response: Starting Point → Fretboard (Topic 2 Start)
```
Name: Response - Starting Point to Fretboard
Slug: response_starting_point
Duration: 25-30 seconds
Content:
  - Acknowledges their starting point answers
  - "Here's where most assessments get it wrong. They ask how you FEEL..."
  - Introduces fretboard skill checks
```

#### 3. Fretboard Pass → Application (Topic 3 Start)
```
Name: Fretboard Response - Pass
Slug: fretboard_pass
Duration: 15-20 seconds
Content:
  - "Good. You know your fretboard."
  - Introduces fretboard application question
```

#### 4. Fretboard Fail → Application (Topic 3 Start)
```
Name: Fretboard Response - Fail
Slug: fretboard_fail
Duration: 15-20 seconds
Content:
  - "Okay. That's useful information. The fretboard's blurry for you right now."
  - Introduces fretboard application question
```

#### 5. Response: Fretboard App → Theory (Topic 4 Start)
```
Name: Response - Fretboard App to Theory
Slug: response_fretboard_app
Duration: 15-20 seconds
Content:
  - Acknowledges their fretboard application answer
  - Introduces theory check
```

#### 6. Theory Pass → Creation (Topic 5 Start)
```
Name: Theory Response - Pass
Slug: theory_pass
Duration: 15-20 seconds
Content:
  - "Nice. You've got your theory fundamentals."
  - Introduces creation question
```

#### 7. Theory Fail → Creation (Topic 5 Start)
```
Name: Theory Response - Fail
Slug: theory_fail
Duration: 15-20 seconds
Content:
  - "Okay. Theory's a bit fuzzy. That's not a problem—it tells me where to focus."
  - Introduces creation question
```

#### 8. Theory Don't Know → Creation (Topic 5 Start)
```
Name: Theory Response - Don't Know
Slug: theory_dont_know
Duration: 18-22 seconds
Content:
  - "Got it. The music theory language isn't there yet. That's actually holding you back more than you realize. But it's very fixable."
  - Introduces creation question
```

#### 9. Response: Creation → Groove (Topic 6 Start)
```
Name: Response - Creation to Groove
Slug: response_creation
Duration: 15-18 seconds
Content:
  - Acknowledges their creation answer
  - "Last skill check. This one's about feel. Groove."
  - Introduces groove question
```

#### 10. Response: Groove → Frustration (Topic 7 Start)
```
Name: Response - Groove to Frustration
Slug: response_groove
Duration: 15-20 seconds
Content:
  - Acknowledges their groove answer
  - "One more question—and this is the important one."
  - Introduces frustration question
```

#### 11. Response: Frustration → Goals (Topic 8 Start)
```
Name: Response - Frustration to Goals
Slug: response_frustration
Duration: 15-18 seconds
Content:
  - Acknowledges their frustration
  - Introduces goals/wrap-up questions
```

#### 12. Ending Video
```
Name: Ending
Slug: ending
Duration: 12-15 seconds
Content:
  - "Good. I've got what I need."
  - "Give me a second to put this together..."
  - Transitions to results overlay
```

#### 13-18. Coach Insight Content (6 total)

These appear in the results overlay (not separate videos):

```
Slug: insight_getting_started
Slug: insight_fretboard_freedom
Slug: insight_understanding_why
Slug: insight_finding_feel
Slug: insight_ready_for_more
Slug: insight_plateau
```

### Total Video Segments: 12

| # | Slug | Purpose |
|---|------|---------|
| 1 | `intro` | Start + introduces Topic 1 questions |
| 2 | `response_starting_point` | Responds to Topic 1 + introduces Topic 2 |
| 3 | `fretboard_pass` | Responds to Topic 2 (pass) + introduces Topic 3 |
| 4 | `fretboard_fail` | Responds to Topic 2 (fail) + introduces Topic 3 |
| 5 | `response_fretboard_app` | Responds to Topic 3 + introduces Topic 4 |
| 6 | `theory_pass` | Responds to Topic 4 (pass) + introduces Topic 5 |
| 7 | `theory_fail` | Responds to Topic 4 (fail) + introduces Topic 5 |
| 8 | `theory_dont_know` | Responds to Topic 4 (don't know) + introduces Topic 5 |
| 9 | `response_creation` | Responds to Topic 5 + introduces Topic 6 |
| 10 | `response_groove` | Responds to Topic 6 + introduces Topic 7 |
| 11 | `response_frustration` | Responds to Topic 7 + introduces Topic 8 |
| 12 | `ending` | Wraps up + transitions to results |

---

## Phase 2: Create Questions

Go to `/admin/assessment/questions` and create these 12 questions.

### Question Types

| Type | What It Does |
|------|--------------|
| `multiple-choice` | User picks one option |
| `multiple-select` | User picks multiple options |
| `skill-verification` | Has a correct answer - used for routing |

### Questions to Create

#### Q1: Time Playing
```
Key: time_playing
Type: multiple-choice
Question: "How long have you been playing bass?"
Options:
  - "Just getting started (less than 6 months)" → less_than_6_months
  - "Past the beginning (6 months - 2 years)" → 6_months_to_2_years
  - "Been at it a while (2-5 years)" → 2_to_5_years
  - "Years in (5+ years)" → 5_plus_years
```

#### Q2: Current Situation
```
Key: current_situation
Type: multiple-select
Question: "Which of these feels true right now? (Select all that apply)"
Options:
  - "My fingers still fight me on basic stuff" → fingers_fight
  - "I can play some things but I'm trapped in one area of the neck" → trapped_neck
  - "I play patterns but don't understand WHY they work" → dont_understand_why
  - "Something feels 'off' even when I hit the right notes" → something_off
  - "I keep playing the same things over and over" → same_things
  - "I've hit a wall and nothing I do seems to help" → hit_wall
```

#### Q3a: Fretboard Check 1 - Note Location
```
Key: fretboard_check_1
Type: skill-verification
Question: "What note is at the 6th fret of the A string?"
Options: D, D#, Eb, E, "I don't know"
Correct Answer: Eb (or D#)
```

#### Q3b: Fretboard Check 2 - Interval Shape
```
Key: fretboard_check_2
Type: skill-verification
Question: "You're playing a G on the 3rd fret of the E string. Where's the major 3rd (B) of that note?"
Options:
  - "2nd fret of A string" ← CORRECT
  - "4th fret of A string"
  - "5th fret of A string"
  - "Same fret on the A string"
  - "I don't know"
Correct Answer: 2nd fret of A string
```

#### Q3c: Fretboard Check 3 - Same Note Different Position
```
Key: fretboard_check_3
Type: skill-verification
Question: "You're playing an A on the open A string. Where else can you play that same A?"
Options:
  - "3rd fret of E string"
  - "5th fret of E string" ← CORRECT
  - "7th fret of E string"
  - "4th fret of E string"
  - "I don't know"
Correct Answer: 5th fret of E string
```

#### Q4: Fretboard Application
```
Key: fretboard_application
Type: multiple-choice
Question: "You're playing a song in the key of A. The chord changes to D. What do you do?"
Options:
  - "I'd need to think about where D is" → need_to_think
  - "I know where D is on the E string but that's about it" → know_e_string
  - "I could find D in a couple spots but I'd probably stay safe" → couple_spots_stay_safe
  - "I could move to D in any position without thinking" → any_position
```

#### Q5: Theory Check
```
Key: theory_check
Type: skill-verification
Question: "Someone says 'play the V chord in the key of G.' What chord do they want?"
Options: A, C, D, E, "I don't know what 'the V chord' means"
Correct Answer: D
```

#### Q6: Creation Test
```
Key: creation_test
Type: multiple-choice
Question: "You're playing a 4-bar progression. Bar 4 needs a fill before the loop repeats. What actually happens?"
Options:
  - "I'm not sure what a fill is or when I'd use one" → not_sure_fill
  - "I know I should add something but I freeze up and play through" → freeze_up
  - "I have one or two fills I always use—same thing every time" → same_fills
  - "I can usually think of something, but it feels repetitive" → feels_repetitive
  - "I have plenty of options depending on the song" → plenty_options
```

#### Q7: Groove Truth
```
Key: groove_truth
Type: multiple-choice
Question: "When you play with a drummer (or a drum track), what's your honest experience?"
Options:
  - "I'm mostly focused on not messing up the notes" → focused_notes
  - "I can play the notes but I'm not really locked in with the kick" → not_locked_in
  - "I lock in okay at first, but it drifts or something feels slightly off" → drifts_off
  - "I naturally feel where the beat sits—it's not something I think about" → naturally_feel
```

#### Q8: Frustration
```
Key: frustration
Type: multiple-choice
Question: "What actually frustrates you about your playing?"
Options:
  - "I'm still building basic control—my hands don't do what I want" → building_control
  - "I'm stuck in one position—I can't move around the neck confidently" → stuck_position
  - "I can play things but I don't understand WHY they work" → dont_understand
  - "Something's off with my feel/groove even when the notes are right" → feel_off
  - "I'm bored—I keep playing the same patterns and licks every time" → bored_same_patterns
  - "I've been at this for years and I'm not improving" → not_improving
```

#### Q9: Goals
```
Key: goals
Type: multiple-choice
Question: "What would 'success' look like for you in the next 6 months?"
Options:
  - "Being able to play songs I love without struggling" → play_songs
  - "Jamming with other musicians confidently" → jam_confidently
  - "Understanding what I'm playing, not just copying tabs" → understand_playing
  - "Being able to create my own bass lines" → create_bass_lines
  - "Getting out of this plateau and seeing real improvement" → break_plateau
```

#### Q10: Genre (Optional)
```
Key: genre
Type: multiple-choice
Question: "What style do you most want to play?"
Options:
  - "Funk/R&B" → funk
  - "Rock" → rock
  - "Metal" → metal
  - "Jazz/Blues" → jazz
  - "Pop" → pop
```

---

## Phase 3: Build the Flow

Go to `/admin/assessment/flow`. This is where you connect everything.

### Understanding the Flow Editor

The flow is a **graph** made of:
- **Nodes** = Things that happen (play video, show question, route user)
- **Edges** = Connections between nodes (with optional conditions)

```
[Node A] ──edge──► [Node B] ──edge──► [Node C]
                      │
                      │ (condition: if answer = X)
                      ▼
                   [Node D]
```

### Node Types

| Type | What It Does | Links To |
|------|--------------|----------|
| `segment` | Plays a video | A segment you created |
| `question` | Shows a question overlay | A question you created |
| `branch` | Routes user (no UI) | Nothing - just routing logic |
| `result` | Shows final results | A coach insight segment |

### Building the Flow Step-by-Step

The flow follows the pattern: **VIDEO → QUESTION(s) → VIDEO → QUESTION(s) → ...**

#### Step 1: Topic 1 - Starting Point

```
n_intro (segment: intro) ← ENTRY POINT
    │ always
    ▼
n_time_playing (question: time_playing)
    │ always
    ▼
n_current_situation (question: current_situation)
    │ always
    ▼
n_response_starting_point (segment: response_starting_point)
```

#### Step 2: Topic 2 - Fretboard Check

```
n_response_starting_point
    │ always
    ▼
n_fretboard_check_1 (question: fretboard_check_1)
    │ always
    ▼
n_fretboard_check_2 (question: fretboard_check_2)
    │ always
    ▼
n_fretboard_check_3 (question: fretboard_check_3)
    │ always
    ▼
n_fretboard_scoring (branch) ─── Routes based on score (0-3 correct)
         │
    ┌────┴────┐
    │         │
(>= 2)    (< 2)
    │         │
    ▼         ▼
n_fretboard_pass    n_fretboard_fail
(segment)           (segment)
    │                    │
    └────────┬───────────┘
             │ always
             ▼
```

#### Step 3: Topic 3 - Fretboard Application

```
n_fretboard_application (question: fretboard_application)
    │ always
    ▼
n_response_fretboard_app (segment: response_fretboard_app)
```

#### Step 4: Topic 4 - Theory Check

```
n_response_fretboard_app
    │ always
    ▼
n_theory_check (question: theory_check)
    │
    ├── (correct) ────► n_theory_pass (segment: theory_pass)
    │
    ├── (wrong) ──────► n_theory_fail (segment: theory_fail)
    │
    └── (dont_know) ──► n_theory_dont_know (segment: theory_dont_know)
             │
    All three connect:
             │ always
             ▼
```

#### Step 5: Topic 5 - Creation

```
n_creation_test (question: creation_test)
    │ always
    ▼
n_response_creation (segment: response_creation)
```

#### Step 6: Topic 6 - Groove

```
n_response_creation
    │ always
    ▼
n_groove_truth (question: groove_truth)
    │ always
    ▼
n_response_groove (segment: response_groove)
```

#### Step 7: Topic 7 - Frustration

```
n_response_groove
    │ always
    ▼
n_frustration (question: frustration)
    │ always
    ▼
n_response_frustration (segment: response_frustration)
```

#### Step 8: Topic 8 - Goals & Wrap-up

```
n_response_frustration
    │ always
    ▼
n_goals (question: goals)
    │ always
    ▼
n_genre (question: genre)
    │ always
    ▼
n_ending (segment: ending)
```

#### Step 9: Results Routing

After the ending video, route to one of 6 result overlays based on accumulated flags.

```
n_ending
    │ always
    ▼
n_routing (branch) ─── Checks flags in priority order
    │
    ├── (fretboard_failed) ────► n_result_fretboard_freedom
    │
    ├── (theory_failed) ───────► n_result_understanding_why
    │
    ├── (creation_beginner) ───► n_result_getting_started
    │
    ├── (groove_off) ──────────► n_result_finding_feel
    │
    ├── (creation_repetitive) ─► n_result_ready_for_more
    │
    ├── (plateau) ─────────────► n_result_plateau
    │
    └── (fallback) ────────────► n_result_ready_for_more
```

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 1: Starting Point                                                      │
│ intro (VIDEO) → time_playing (Q) → current_situation (Q)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 2: Fretboard Check                                                     │
│ response_starting_point (VIDEO) → fretboard_1 (Q) → fretboard_2 (Q) →       │
│ fretboard_3 (Q) → [BRANCH: pass/fail]                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 3: Fretboard Application                                               │
│ fretboard_pass OR fretboard_fail (VIDEO) → fretboard_application (Q)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 4: Theory Check                                                        │
│ response_fretboard_app (VIDEO) → theory_check (Q) → [BRANCH: pass/fail/dk]  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 5: Creation                                                            │
│ theory_pass OR theory_fail OR theory_dont_know (VIDEO) → creation_test (Q)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 6: Groove                                                              │
│ response_creation (VIDEO) → groove_truth (Q)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 7: Frustration                                                         │
│ response_groove (VIDEO) → frustration (Q)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPIC 8: Goals & Wrap-up                                                     │
│ response_frustration (VIDEO) → goals (Q) → genre (Q)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENDING                                                                       │
│ ending (VIDEO) → [ROUTING BRANCH] → RESULT OVERLAY                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Routing Priority (Checked in Order)

| Priority | Condition | Routes To |
|----------|-----------|-----------|
| 1 | `fretboard_failed` flag set | Fretboard Freedom |
| 2 | `theory_failed` flag set | Understanding the Why |
| 3 | `creation_beginner` flag set | Getting Started |
| 4 | `groove_off` flag set | Finding the Feel |
| 5 | `creation_repetitive` flag set | Ready for More |
| 6 | `plateau` flag set | The Plateau |
| 7 (fallback) | None of the above | Ready for More |

### How Flags Get Set

| Flag | Set When |
|------|----------|
| `fretboard_failed` | Score < 2 on fretboard checks OR Q4 answer is "need_to_think" or "know_e_string" |
| `theory_failed` | Q5 answer is wrong |
| `creation_beginner` | Q6 answer is "not_sure_fill" or "freeze_up" |
| `groove_off` | Q7 answer is "drifts_off" |
| `creation_repetitive` | Q6 answer is "same_fills" or "feels_repetitive" |
| `plateau` | Q1 = "5_plus_years" AND Q8 = "not_improving" |

---

## Phase 4: Configure Result Pages

Each result bucket needs page content that appears after the coach insight video.

### Result 1: Getting Started
```
CTA Button: "START BUILDING THE FOUNDATION →"
Link: /tutorials/beginner-start
```

### Result 2: Fretboard Freedom
```
CTA Button: "UNLOCK THE FRETBOARD →"
Link: /tutorials/fretboard-freedom
```

### Result 3: Understanding the Why
```
CTA Button: "GET THE MAP →"
Link: /tutorials/theory-for-bass
```

### Result 4: Finding the Feel
```
CTA Button: "FIND THE POCKET →"
Link: /tutorials/groove-mastery
```

### Result 5: Ready for More
```
CTA Button: "GET THE VOCABULARY →"
Link: /tutorials/vocabulary-expansion
```

### Result 6: The Plateau
```
CTA Button: "LET'S BUILD A PLAN →"
Link: /tutorials/plateau-breakthrough
```

---

## Testing Checklist

### Test Each Result Path

- [ ] **Getting Started** - Answer Q6 with "not_sure_fill"
- [ ] **Fretboard Freedom** - Get < 2 correct on fretboard checks
- [ ] **Understanding the Why** - Answer Q5 wrong
- [ ] **Finding the Feel** - Answer Q7 with "drifts_off"
- [ ] **Ready for More** - Answer Q6 with "same_fills"
- [ ] **The Plateau** - Q1 = "5_plus_years" + Q8 = "not_improving"

### Test Video Playback

- [ ] Hook video plays on page load
- [ ] All response videos play after answers
- [ ] Coach insight video plays on results page
- [ ] Genre acknowledgments play for selected genre

### Test Flow Logic

- [ ] 3 fretboard questions appear back-to-back (no video between)
- [ ] Correct response video plays based on fretboard score
- [ ] Theory routing works (pass/fail/don't know)
- [ ] Final routing picks highest priority flag

---

## Summary

| What | Count |
|------|-------|
| Video Segments | 12 |
| Questions | 12 |
| Flow Nodes | ~25 |
| Result Buckets | 6 |

### Video Segments Recap

| # | Slug | When It Plays |
|---|------|---------------|
| 1 | `intro` | Assessment start |
| 2 | `response_starting_point` | After Q1+Q2, before fretboard checks |
| 3 | `fretboard_pass` | After fretboard checks (score >= 2) |
| 4 | `fretboard_fail` | After fretboard checks (score < 2) |
| 5 | `response_fretboard_app` | After Q4, before theory check |
| 6 | `theory_pass` | After theory check (correct) |
| 7 | `theory_fail` | After theory check (wrong) |
| 8 | `theory_dont_know` | After theory check (don't know) |
| 9 | `response_creation` | After Q6, before groove |
| 10 | `response_groove` | After Q7, before frustration |
| 11 | `response_frustration` | After Q8, before goals |
| 12 | `ending` | After all questions, before results |

### Questions Recap

| # | Key | Topic |
|---|-----|-------|
| 1 | `time_playing` | Starting Point |
| 2 | `current_situation` | Starting Point |
| 3 | `fretboard_check_1` | Fretboard (6th fret A) |
| 4 | `fretboard_check_2` | Fretboard (major 3rd shape) |
| 5 | `fretboard_check_3` | Fretboard (same note elsewhere) |
| 6 | `fretboard_application` | Fretboard Application |
| 7 | `theory_check` | Theory |
| 8 | `creation_test` | Creation |
| 9 | `groove_truth` | Groove |
| 10 | `frustration` | Frustration |
| 11 | `goals` | Goals |
| 12 | `genre` | Genre (optional) |

**The key insight:** Segments and Questions are just definitions. The FLOW is what brings them together and defines the user journey.
