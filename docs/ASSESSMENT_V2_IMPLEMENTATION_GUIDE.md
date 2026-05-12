# Assessment V2 Implementation Guide

## Complete Flow Setup for Segment-Based Branching Assessment

This guide provides step-by-step instructions for setting up the entire assessment flow based on the **BASS_ASSESSMENT_COMPLETE_GUIDE_V2.md** psychology-optimized design.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [The 5 Skill Buckets](#the-5-skill-buckets)
3. [The 8 Topics](#the-8-topics)
4. [Video Segments Inventory](#video-segments-inventory)
5. [Questions Inventory](#questions-inventory)
6. [Complete Flow Graph](#complete-flow-graph)
7. [Step-by-Step Setup Instructions](#step-by-step-setup-instructions)
8. [Coach Insights Setup](#coach-insights-setup)
9. [Testing Checklist](#testing-checklist)

---

## System Overview

### How It Works

Every user watches **exactly 8 videos** (one per topic), but the SPECIFIC video they see depends on their answers and skill bucket. This creates a personalized experience from ~24 total video segments.

```
USER JOURNEY (8 videos total):

Topic 1: Level Assessment    → 1 video (same for all) + skill check questions
Topic 2: Goals               → 1 video (branched by level: beginner vs intermediate)
Topic 3: Pain/Struggle       → 1 video (branched by 5 skill buckets)
Topic 4: Learning Style      → 1 video (same for all)
Topic 5: Practice Reality    → 1 video (same for all)
Topic 6: Genre               → 1 video (same for all) + short acknowledgment
Topic 7: Equipment           → 1 video (same for all) + conditional response
Topic 8: Commitment          → 1 video (same for all)
                               ─────────────────────────
                               8 videos per user
```

### Node Types in the Flow

| Type | Purpose | Has Video? |
|------|---------|------------|
| `segment` | Plays a Bunny Stream video | Yes |
| `question` | Shows question overlay after video | No |
| `skill_verification` | Question with correct answer check | No |
| `branch` | Invisible routing based on conditions | No |
| `result` | Final results screen | No |

### Edge Conditions

| Condition | Use Case |
|-----------|----------|
| `always` | Default path, no conditions |
| `answer_equals` | Route based on specific answer value |
| `bucket_equals` | Route based on determined skill bucket |
| `skill_verified` | Route if skill check passed |
| `skill_failed` | Route if skill check failed |

---

## The 5 Skill Buckets

These are determined by Topic 1 (Level + Skill Checks):

| Bucket ID | Label | How Determined |
|-----------|-------|----------------|
| `true_beginner` | True Beginner | Self-reported "never played" OR failed basic check |
| `solid_beginner` | Solid Beginner | Self-reported beginner + passed basics check |
| `beginner_with_gaps` | Beginner with Gaps | Self-reported intermediate + failed fretboard check |
| `intermediate_theory_gaps` | Intermediate (Theory Gaps) | Passed fretboard + failed interval check |
| `solid_intermediate` | Solid Intermediate | Passed both intermediate checks |

---

## The 8 Topics

### Topic 1: Level Assessment
- **Purpose:** Determine where the user actually is (not where they think they are)
- **Video:** 15-20 seconds, challenges them to be honest
- **Questions:** Self-report + skill verification checks
- **Output:** Sets the user's skill bucket

### Topic 2: Goals
- **Purpose:** Understand what they want to achieve
- **Videos:** 2 versions (beginner path vs intermediate path)
- **Questions:** Main goal selection

### Topic 3: Pain/Struggle
- **Purpose:** Name their real problem better than they can
- **Videos:** 5 versions (one per skill bucket)
- **Questions:** Specific struggle based on level

### Topic 4: Learning Style
- **Purpose:** Match teaching approach to how they learn
- **Video:** Same for all (12-15 seconds)
- **Questions:** Preference selection

### Topic 5: Practice Reality
- **Purpose:** Set realistic expectations
- **Video:** Same for all (15-18 seconds)
- **Questions:** Time commitment

### Topic 6: Genre
- **Purpose:** Personalize by musical style
- **Video:** Same for all (12-15 seconds) + 6 short acknowledgments
- **Questions:** Genre selection

### Topic 7: Equipment
- **Purpose:** Ensure they can actually practice
- **Video:** Same for all (10-12 seconds) + 2 conditional responses
- **Questions:** Setup check

### Topic 8: Commitment
- **Purpose:** Build momentum, preview the 3-day plan
- **Video:** Same for all (20 seconds, peak energy)
- **Questions:** Ready confirmation

---

## Video Segments Inventory

### Total: 24 Video Segments

#### Topic 1: Level Assessment (4 segments)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `level_intro` | Level Assessment Intro | `level_intro` | All | 15-20s |
| `skill_wrong_basics` | Skill Check: Basics Wrong | `skill_check_response` | true_beginner | 5s |
| `skill_wrong_fretboard` | Skill Check: Fretboard Wrong | `skill_check_response` | beginner_with_gaps | 5s |
| `skill_wrong_interval` | Skill Check: Interval Wrong | `skill_check_response` | intermediate_theory_gaps | 5s |

#### Topic 2: Goals (2 segments)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `goals_beginner` | Goals for Beginners | `goals_beginner` | true_beginner, solid_beginner, beginner_with_gaps | 12-15s |
| `goals_intermediate` | Goals for Intermediates | `goals_intermediate` | intermediate_theory_gaps, solid_intermediate | 12-15s |

#### Topic 3: Pain/Struggle (5 segments)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `struggle_true_beginner` | Struggle: True Beginner | `struggle_true_beginner` | true_beginner | 20-25s |
| `struggle_solid_beginner` | Struggle: Solid Beginner | `struggle_solid_beginner` | solid_beginner | 20-25s |
| `struggle_beginner_gaps` | Struggle: Beginner with Gaps | `struggle_beginner_with_gaps` | beginner_with_gaps | 20-25s |
| `struggle_intermediate_theory` | Struggle: Intermediate Theory | `struggle_intermediate_theory_gaps` | intermediate_theory_gaps | 20-25s |
| `struggle_solid_intermediate` | Struggle: Solid Intermediate | `struggle_solid_intermediate` | solid_intermediate | 20-25s |

#### Topic 4: Learning Style (1 segment)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `learning_style` | Learning Style | `learning_style` | All | 12-15s |

#### Topic 5: Practice Reality (1 segment)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `practice_time` | Practice Reality | `practice_time` | All | 15-18s |

#### Topic 6: Genre (7 segments)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `genre_intro` | Genre Selection | `genre` | All | 12-15s |
| `genre_ack_funk` | Genre: Funk Acknowledgment | `genre_acknowledgment` | All | 5s |
| `genre_ack_rock` | Genre: Rock Acknowledgment | `genre_acknowledgment` | All | 5s |
| `genre_ack_metal` | Genre: Metal Acknowledgment | `genre_acknowledgment` | All | 5s |
| `genre_ack_jazz` | Genre: Jazz Acknowledgment | `genre_acknowledgment` | All | 5s |
| `genre_ack_pop` | Genre: Pop Acknowledgment | `genre_acknowledgment` | All | 5s |
| `genre_ack_multi` | Genre: Multi-Style Acknowledgment | `genre_acknowledgment` | All | 5s |

#### Topic 7: Equipment (3 segments)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `equipment_intro` | Equipment Check | `equipment` | All | 10-12s |
| `equipment_no_gear` | Equipment: No Gear Response | `equipment_response` | All | 5s |
| `equipment_bad_sound` | Equipment: Bad Sound Response | `equipment_response` | All | 5s |

#### Topic 8: Commitment (1 segment)

| Segment ID | Name | Topic | Target Buckets | Duration |
|------------|------|-------|----------------|----------|
| `commitment` | Commitment & Ready | `commitment` | All | 20s |

---

## Questions Inventory

### Total: 11 Questions

#### Topic 1: Level Questions

| Question Key | Question Text | Type | Category | Options |
|--------------|---------------|------|----------|---------|
| `level_self_report` | Be honest—where are you right now? | `multiple-choice` | `level` | complete_beginner, knows_basics, intermediate, advanced |
| `skill_check_basics` | What's the lowest (thickest) string on a standard bass? | `skill-verification` | `skill_check` | G, D, A, E (correct: E) |
| `skill_check_fretboard` | What note is at the 5th fret on the A string? | `skill-verification` | `skill_check` | C, D, E, G (correct: D) |
| `skill_check_interval` | What's the interval between a root note and its 5th? | `skill-verification` | `skill_check` | 3, 5, 7, 12 (correct: 7) |

#### Topic 2: Goal Question

| Question Key | Question Text | Type | Category | Options |
|--------------|---------------|------|----------|---------|
| `goal` | What's your main goal with bass? | `multiple-choice` | `goal` | play_songs, join_band, write_music, hobby, professional |

#### Topic 3: Struggle Questions (2 versions)

| Question Key | Question Text | Type | Category | Options |
|--------------|---------------|------|----------|---------|
| `struggle_beginner` | What's your biggest challenge right now? | `multiple-choice` | `struggle` | dont_know_start, fingers_wont_work, cant_keep_rhythm, dont_understand_tabs, get_bored |
| `struggle_intermediate` | What's keeping you stuck? | `multiple-choice` | `struggle` | plateaued, timing_not_tight, dont_understand_why, struggle_improvising, cant_learn_fast |

#### Topic 4-8: Standard Questions

| Question Key | Question Text | Type | Category | Options |
|--------------|---------------|------|----------|---------|
| `learning_style` | How do you prefer to learn? | `multiple-choice` | `preference` | show_me, theory_first, mix_both, learn_by_songs |
| `practice_time` | Realistically, how much can you practice? | `multiple-choice` | `preference` | 10_15_min, 20_30_min, 30_60_min, more_than_hour, varies |
| `genre` | What style do you want to play? | `multiple-choice` | `preference` | rock, funk, metal, pop, jazz, multi |
| `equipment` | What's your current setup? | `multiple-choice` | `preference` | bass_and_amp, bass_headphones, bass_cant_hear, still_figuring |
| `ready` | Ready to start? | `multiple-choice` | `confirmation` | lets_go, have_question |

---

## Complete Flow Graph

### Visual Flow Diagram

```
                                    ┌─────────────────────┐
                                    │    level_intro      │ ← ENTRY POINT
                                    │   (Video Segment)   │
                                    └──────────┬──────────┘
                                               │ always
                                               ▼
                                    ┌─────────────────────┐
                                    │  level_self_report  │
                                    │    (Question)       │
                                    └──────────┬──────────┘
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
            answer=complete_beginner    answer=knows_basics   answer=intermediate
                          │                    │                    │
                          ▼                    ▼                    ▼
                    ┌───────────┐      ┌─────────────────┐   ┌─────────────────┐
                    │  BRANCH   │      │skill_check_basics│   │skill_check_fret │
                    │ (set      │      │(Skill Verify)    │   │(Skill Verify)   │
                    │ bucket:   │      └────────┬─────────┘   └────────┬────────┘
                    │ true_     │               │                      │
                    │ beginner) │     ┌─────────┴─────────┐    ┌───────┴───────┐
                    └─────┬─────┘     │                   │    │               │
                          │      skill_verified    skill_failed  skill_verified  skill_failed
                          │           │                   │        │               │
                          │           ▼                   ▼        ▼               ▼
                          │    ┌──────────┐        ┌──────────┐ ┌────────────┐ ┌──────────┐
                          │    │ BRANCH   │        │ BRANCH   │ │skill_check │ │ BRANCH   │
                          │    │(solid_   │        │(true_    │ │  interval  │ │(beginner │
                          │    │beginner) │        │beginner) │ │(Skill Ver) │ │_with_    │
                          │    └────┬─────┘        └────┬─────┘ └─────┬──────┘ │gaps)     │
                          │         │                   │             │        └────┬─────┘
                          │         │                   │    ┌────────┴────────┐    │
                          │         │                   │ skill_verified  skill_failed
                          │         │                   │    │                 │    │
                          │         │                   │    ▼                 ▼    │
                          │         │                   │ ┌────────┐     ┌────────┐ │
                          │         │                   │ │BRANCH  │     │BRANCH  │ │
                          │         │                   │ │(solid_ │     │(inter_ │ │
                          │         │                   │ │inter.) │     │theory) │ │
                          │         │                   │ └───┬────┘     └───┬────┘ │
                          │         │                   │     │              │      │
                          ▼         ▼                   ▼     ▼              ▼      ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                         TOPIC 2 HUB                             │
                    │               (Branch by bucket: beginner vs intermediate)      │
                    └────────────────────────────┬────────────────────────────────────┘
                              ┌──────────────────┴──────────────────┐
                bucket ∈ [true_beginner,              bucket ∈ [intermediate_theory_gaps,
                solid_beginner, beginner_with_gaps]         solid_intermediate]
                              │                                     │
                              ▼                                     ▼
                    ┌─────────────────┐                   ┌─────────────────┐
                    │ goals_beginner  │                   │goals_intermediate│
                    │ (Video Segment) │                   │ (Video Segment)  │
                    └────────┬────────┘                   └────────┬─────────┘
                             │                                     │
                             └──────────────────┬──────────────────┘
                                                │ always
                                                ▼
                                      ┌─────────────────┐
                                      │      goal       │
                                      │   (Question)    │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                         TOPIC 3 HUB                             │
                    │                    (Branch by 5 buckets)                        │
                    └────────────────────────────┬────────────────────────────────────┘
           ┌──────────────┬──────────────┬───────┴───────┬──────────────┬──────────────┐
           │              │              │               │              │              │
      true_beginner  solid_beginner  beginner_    intermediate_   solid_intermediate
           │              │          with_gaps    theory_gaps          │
           ▼              ▼              ▼               ▼              ▼
    ┌─────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
    │struggle_    │ │struggle_   │ │struggle_   │ │struggle_   │ │struggle_   │
    │true_beginner│ │solid_      │ │beginner_   │ │inter_      │ │solid_      │
    │(Video)      │ │beginner    │ │gaps        │ │theory      │ │intermediate│
    └──────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │              │              │
           └──────────────┴──────────────┴──────┬───────┴──────────────┘
                                                │ always
                                                ▼
                                      ┌─────────────────┐
                                      │  struggle_q     │ (varies by bucket)
                                      │   (Question)    │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │ learning_style  │
                                      │ (Video Segment) │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │ learning_style  │
                                      │   (Question)    │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │  practice_time  │
                                      │ (Video Segment) │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │  practice_time  │
                                      │   (Question)    │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │   genre_intro   │
                                      │ (Video Segment) │
                                      └────────┬────────┘
                                               │ always
                                               ▼
                                      ┌─────────────────┐
                                      │     genre       │
                                      │   (Question)    │
                                      └────────┬────────┘
              ┌────────────────┬───────────────┼───────────────┬────────────────┐
        answer=rock      answer=funk     answer=metal    answer=jazz      answer=multi
              │                │               │               │                │
              ▼                ▼               ▼               ▼                ▼
       ┌────────────┐   ┌────────────┐  ┌────────────┐  ┌────────────┐   ┌────────────┐
       │genre_ack_  │   │genre_ack_  │  │genre_ack_  │  │genre_ack_  │   │genre_ack_  │
       │rock        │   │funk        │  │metal       │  │jazz        │   │multi       │
       │(Video 5s)  │   │(Video 5s)  │  │(Video 5s)  │  │(Video 5s)  │   │(Video 5s)  │
       └─────┬──────┘   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘   └─────┬──────┘
             │                │               │               │                │
             └────────────────┴───────────────┴───────┬───────┴────────────────┘
                                                      │ always
                                                      ▼
                                            ┌─────────────────┐
                                            │ equipment_intro │
                                            │ (Video Segment) │
                                            └────────┬────────┘
                                                     │ always
                                                     ▼
                                            ┌─────────────────┐
                                            │    equipment    │
                                            │   (Question)    │
                                            └────────┬────────┘
                    ┌────────────────────────────────┼────────────────────────────────┐
              answer=bass_and_amp          answer=still_figuring          answer=bass_cant_hear
              OR bass_headphones                    │                              │
                    │                               ▼                              ▼
                    │                      ┌─────────────────┐            ┌─────────────────┐
                    │                      │equipment_no_gear│            │equipment_bad_   │
                    │                      │(Video 5s)       │            │sound (Video 5s) │
                    │                      └────────┬────────┘            └────────┬────────┘
                    │                               │                              │
                    └───────────────────────────────┴──────────────────────────────┘
                                                    │ always
                                                    ▼
                                          ┌─────────────────┐
                                          │   commitment    │
                                          │ (Video Segment) │
                                          └────────┬────────┘
                                                   │ always
                                                   ▼
                                          ┌─────────────────┐
                                          │     ready       │
                                          │   (Question)    │
                                          └────────┬────────┘
                                                   │ answer=lets_go
                                                   ▼
                                          ┌─────────────────┐
                                          │     result      │
                                          │  (Result Node)  │
                                          └─────────────────┘
```

---

## Step-by-Step Setup Instructions

### Phase 1: Create Segments (in /admin/assessment/segments)

Create these 24 segments in order. You'll need Bunny Stream video IDs for each.

#### Step 1.1: Topic 1 Segments

1. **level_intro**
   - Name: "Level Assessment Intro"
   - Slug: `level_intro`
   - Topic: `level_intro`
   - Target Buckets: (all 5)
   - Duration: 20 seconds
   - Video Library ID: [your Bunny library ID]
   - Video ID: [your video GUID]

2. **skill_wrong_basics**
   - Name: "Skill Check: Basics Wrong Response"
   - Slug: `skill_wrong_basics`
   - Topic: `skill_check_response`
   - Target Buckets: `true_beginner`
   - Duration: 5 seconds

3. **skill_wrong_fretboard**
   - Name: "Skill Check: Fretboard Wrong Response"
   - Slug: `skill_wrong_fretboard`
   - Topic: `skill_check_response`
   - Target Buckets: `beginner_with_gaps`
   - Duration: 5 seconds

4. **skill_wrong_interval**
   - Name: "Skill Check: Interval Wrong Response"
   - Slug: `skill_wrong_interval`
   - Topic: `skill_check_response`
   - Target Buckets: `intermediate_theory_gaps`
   - Duration: 5 seconds

#### Step 1.2: Topic 2 Segments

5. **goals_beginner**
   - Name: "Goals for Beginners"
   - Slug: `goals_beginner`
   - Topic: `goals_beginner`
   - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`
   - Duration: 15 seconds

6. **goals_intermediate**
   - Name: "Goals for Intermediates"
   - Slug: `goals_intermediate`
   - Topic: `goals_intermediate`
   - Target Buckets: `intermediate_theory_gaps`, `solid_intermediate`
   - Duration: 15 seconds

#### Step 1.3: Topic 3 Segments (5 versions - one per bucket)

7. **struggle_true_beginner**
   - Name: "Struggle: True Beginner"
   - Slug: `struggle_true_beginner`
   - Topic: `struggle_true_beginner`
   - Target Buckets: `true_beginner`
   - Duration: 25 seconds
   - Video Library ID: [your Bunny library ID]
   - Video ID: [your video GUID]
   - Description: "Video addressing the true beginner's specific pain point - feeling lost, not knowing where to start"

8. **struggle_solid_beginner**
   - Name: "Struggle: Solid Beginner"
   - Slug: `struggle_solid_beginner`
   - Topic: `struggle_solid_beginner`
   - Target Buckets: `solid_beginner`
   - Duration: 25 seconds
   - Video Library ID: [your Bunny library ID]
   - Video ID: [your video GUID]
   - Description: "Video addressing the solid beginner's pain point - fingers won't cooperate, physical frustration"

9. **struggle_beginner_gaps**
   - Name: "Struggle: Beginner with Gaps"
   - Slug: `struggle_beginner_gaps`
   - Topic: `struggle_beginner_with_gaps`
   - Target Buckets: `beginner_with_gaps`
   - Duration: 25 seconds
   - Video Library ID: [your Bunny library ID]
   - Video ID: [your video GUID]
   - Description: "Video addressing gaps in knowledge - they think they're intermediate but have foundational holes"

10. **struggle_intermediate_theory**
    - Name: "Struggle: Intermediate Theory Gaps"
    - Slug: `struggle_intermediate_theory`
    - Topic: `struggle_intermediate_theory_gaps`
    - Target Buckets: `intermediate_theory_gaps`
    - Duration: 25 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Video addressing theory gaps - they can play but don't understand WHY things work"

11. **struggle_solid_intermediate**
    - Name: "Struggle: Solid Intermediate"
    - Slug: `struggle_solid_intermediate`
    - Topic: `struggle_solid_intermediate`
    - Target Buckets: `solid_intermediate`
    - Duration: 25 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Video addressing the plateau feeling - they're good but stuck, not progressing"

#### Step 1.4: Topic 4 - Learning Style (1 segment)

12. **learning_style**
    - Name: "Learning Style"
    - Slug: `learning_style`
    - Topic: `learning_style`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 15 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick question about how they prefer to learn - theory first vs show me first vs songs"

#### Step 1.5: Topic 5 - Practice Reality (1 segment)

13. **practice_time**
    - Name: "Practice Reality"
    - Slug: `practice_time`
    - Topic: `practice_time`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 18 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Setting realistic expectations about practice time - no judgment, just getting real data"

#### Step 1.6: Topic 6 - Genre (7 segments total)

14. **genre_intro**
    - Name: "Genre Selection"
    - Slug: `genre_intro`
    - Topic: `genre`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 15 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Ask what style they want to play - personalizes the experience"

15. **genre_ack_rock**
    - Name: "Genre: Rock Acknowledgment"
    - Slug: `genre_ack_rock`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick acknowledgment for rock selection - 'Rock, nice! We're going to cover...'"

16. **genre_ack_funk**
    - Name: "Genre: Funk Acknowledgment"
    - Slug: `genre_ack_funk`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick acknowledgment for funk selection - 'Funk, excellent! We'll work on...'"

17. **genre_ack_metal**
    - Name: "Genre: Metal Acknowledgment"
    - Slug: `genre_ack_metal`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick acknowledgment for metal selection - 'Metal! We'll focus on...'"

18. **genre_ack_jazz**
    - Name: "Genre: Jazz Acknowledgment"
    - Slug: `genre_ack_jazz`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick acknowledgment for jazz selection - 'Jazz, great choice! We'll explore...'"

19. **genre_ack_pop**
    - Name: "Genre: Pop Acknowledgment"
    - Slug: `genre_ack_pop`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Quick acknowledgment for pop selection - 'Pop bass, solid! We'll cover...'"

20. **genre_ack_multi**
    - Name: "Genre: Multi-Style Acknowledgment"
    - Slug: `genre_ack_multi`
    - Topic: `genre_acknowledgment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Acknowledgment for 'all of the above' - 'A bit of everything? Perfect...'"

#### Step 1.7: Topic 7 - Equipment (3 segments)

21. **equipment_intro**
    - Name: "Equipment Check"
    - Slug: `equipment_intro`
    - Topic: `equipment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 12 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Making sure they can actually practice - checking their setup"

22. **equipment_no_gear**
    - Name: "Equipment: No Gear Response"
    - Slug: `equipment_no_gear`
    - Topic: `equipment_response`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Response if they're still figuring out gear - reassurance and guidance"

23. **equipment_bad_sound**
    - Name: "Equipment: Bad Sound Response"
    - Slug: `equipment_bad_sound`
    - Topic: `equipment_response`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 5 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Response if they can't hear themselves properly - tips for setup"

#### Step 1.8: Topic 8 - Commitment (1 segment)

24. **commitment**
    - Name: "Commitment & Ready"
    - Slug: `commitment`
    - Topic: `commitment`
    - Target Buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`, `intermediate_theory_gaps`, `solid_intermediate`
    - Duration: 20 seconds
    - Video Library ID: [your Bunny library ID]
    - Video ID: [your video GUID]
    - Description: "Peak energy moment - preview the 3-day plan, build excitement, CTA to start"

---

### Phase 2: Create Questions (in /admin/assessment/questions)

#### Step 2.1: Level Self-Report Question

1. **level_self_report**
   - Question Key: `level_self_report`
   - Category: `level`
   - Type: `multiple-choice`
   - Question Text: "Be honest—where are you right now?"
   - Options:
     - Label: "Complete beginner — never really played bass" | Value: `complete_beginner`
     - Label: "I know some basics but still struggle" | Value: `knows_basics`
     - Label: "Intermediate — I can play stuff, but I've hit a wall" | Value: `intermediate`
     - Label: "Advanced — I'm looking for specific techniques" | Value: `advanced`

#### Step 2.2: Skill Check Questions

2. **skill_check_basics**
   - Question Key: `skill_check_basics`
   - Category: `skill_check`
   - Type: `skill-verification`
   - Question Text: "What's the lowest (thickest) string on a standard bass?"
   - Options: G, D, A, E
   - Correct Answer: `E`
   - Wrong Answer Feedback: "No stress—that's exactly why we check. Your path is going to cover this."

3. **skill_check_fretboard**
   - Question Key: `skill_check_fretboard`
   - Category: `skill_check`
   - Type: `skill-verification`
   - Question Text: "What note is at the 5th fret on the A string?"
   - Options: C, D, E, G
   - Correct Answer: `D`
   - Wrong Answer Feedback: "That's a gap. Not a big deal—it's one of the most common holes I see. We're going to fix it."

4. **skill_check_interval**
   - Question Key: `skill_check_interval`
   - Category: `skill_check`
   - Type: `skill-verification`
   - Question Text: "What's the interval between a root note and its 5th?"
   - Options: 3 semitones, 5 semitones, 7 semitones, 12 semitones
   - Correct Answer: `7`
   - Wrong Answer Feedback: "You've got the hands. The theory's a little fuzzy. That's actually good news—it's the easiest thing to fix."

#### Step 2.3: Goal Question

5. **goal**
   - Question Key: `goal`
   - Category: `goal`
   - Type: `multiple-choice`
   - Question Text: "What's your main goal with bass?"
   - Options:
     - Label: "Learn to play my favorite songs" | Value: `play_songs`
     - Label: "Join or start a band" | Value: `join_band`
     - Label: "Write my own music" | Value: `write_music`
     - Label: "Just a fun hobby" | Value: `hobby`
     - Label: "Go professional" | Value: `professional`

#### Step 2.4: Struggle Questions (2 versions based on level)

6. **struggle_beginner**
   - Question Key: `struggle_beginner`
   - Category: `struggle`
   - Type: `multiple-choice`
   - Question Text: "What's your biggest challenge right now?"
   - Options:
     - Label: "I don't know where to start" | Value: `dont_know_start`
     - Label: "My fingers won't do what I want" | Value: `fingers_wont_work`
     - Label: "I can't keep a steady rhythm" | Value: `cant_keep_rhythm`
     - Label: "I don't understand tabs or notation" | Value: `dont_understand_tabs`
     - Label: "I get bored and quit practicing" | Value: `get_bored`
   - Note: This question is shown to buckets: `true_beginner`, `solid_beginner`, `beginner_with_gaps`

7. **struggle_intermediate**
   - Question Key: `struggle_intermediate`
   - Category: `struggle`
   - Type: `multiple-choice`
   - Question Text: "What's keeping you stuck?"
   - Options:
     - Label: "I've plateaued—not getting better" | Value: `plateaued`
     - Label: "My timing isn't tight enough" | Value: `timing_not_tight`
     - Label: "I don't understand why things work" | Value: `dont_understand_why`
     - Label: "I struggle to improvise" | Value: `struggle_improvising`
     - Label: "I can't learn songs fast enough" | Value: `cant_learn_fast`
   - Note: This question is shown to buckets: `intermediate_theory_gaps`, `solid_intermediate`

#### Step 2.5: Learning Style Question

8. **learning_style**
   - Question Key: `learning_style`
   - Category: `preference`
   - Type: `multiple-choice`
   - Question Text: "How do you prefer to learn?"
   - Options:
     - Label: "Show me how—I'll copy" | Value: `show_me`
     - Label: "Explain the theory first" | Value: `theory_first`
     - Label: "Mix of both" | Value: `mix_both`
     - Label: "Just teach me songs" | Value: `learn_by_songs`

#### Step 2.6: Practice Time Question

9. **practice_time**
   - Question Key: `practice_time`
   - Category: `preference`
   - Type: `multiple-choice`
   - Question Text: "Realistically, how much can you practice per day?"
   - Options:
     - Label: "10-15 minutes" | Value: `10_15_min`
     - Label: "20-30 minutes" | Value: `20_30_min`
     - Label: "30-60 minutes" | Value: `30_60_min`
     - Label: "More than an hour" | Value: `more_than_hour`
     - Label: "It varies" | Value: `varies`

#### Step 2.7: Genre Question

10. **genre**
    - Question Key: `genre`
    - Category: `preference`
    - Type: `multiple-choice`
    - Question Text: "What style do you want to play?"
    - Options:
      - Label: "Rock" | Value: `rock`
      - Label: "Funk" | Value: `funk`
      - Label: "Metal" | Value: `metal`
      - Label: "Pop" | Value: `pop`
      - Label: "Jazz" | Value: `jazz`
      - Label: "A bit of everything" | Value: `multi`

#### Step 2.8: Equipment Question

11. **equipment**
    - Question Key: `equipment`
    - Category: `preference`
    - Type: `multiple-choice`
    - Question Text: "What's your current setup?"
    - Options:
      - Label: "Bass + amp—good to go" | Value: `bass_and_amp`
      - Label: "Bass + headphones (or audio interface)" | Value: `bass_headphones`
      - Label: "I have a bass but can't hear myself properly" | Value: `bass_cant_hear`
      - Label: "Still figuring out my gear" | Value: `still_figuring`

#### Step 2.9: Ready Question

12. **ready**
    - Question Key: `ready`
    - Category: `confirmation`
    - Type: `multiple-choice`
    - Question Text: "Ready to start your 3-day plan?"
    - Options:
      - Label: "Let's go!" | Value: `lets_go`
      - Label: "I have a question first" | Value: `have_question`

---

### Phase 3: Build the Flow Graph (in /admin/assessment/flow)

#### Step 3.1: Create All Nodes (38 total)

In the Flow Editor (/admin/assessment/flow), click "Add Node" for each of the following. Create them in order:

**Topic 1 Nodes (10 nodes):**

1. **n_level_intro** (ENTRY POINT)
   - Node ID: `n_level_intro`
   - Type: `segment`
   - Linked Segment: `level_intro`
   - Position X: 400
   - Position Y: 50
   - Is Entry Point: **YES** ✓

2. **n_level_question**
   - Node ID: `n_level_question`
   - Type: `question`
   - Linked Question: `level_self_report`
   - Position X: 400
   - Position Y: 150
   - Is Entry Point: No

3. **n_skill_basics**
   - Node ID: `n_skill_basics`
   - Type: `skill_verification`
   - Linked Question: `skill_check_basics`
   - Position X: 200
   - Position Y: 250
   - Is Entry Point: No

4. **n_skill_fretboard**
   - Node ID: `n_skill_fretboard`
   - Type: `skill_verification`
   - Linked Question: `skill_check_fretboard`
   - Position X: 600
   - Position Y: 250
   - Is Entry Point: No

5. **n_skill_interval**
   - Node ID: `n_skill_interval`
   - Type: `skill_verification`
   - Linked Question: `skill_check_interval`
   - Position X: 700
   - Position Y: 350
   - Is Entry Point: No

6. **n_branch_true_beg**
   - Node ID: `n_branch_true_beg`
   - Type: `branch`
   - Linked Segment/Question: (none - leave empty)
   - Position X: 100
   - Position Y: 350
   - Is Entry Point: No
   - Purpose: Sets bucket to `true_beginner`

7. **n_branch_solid_beg**
   - Node ID: `n_branch_solid_beg`
   - Type: `branch`
   - Linked Segment/Question: (none)
   - Position X: 200
   - Position Y: 350
   - Is Entry Point: No
   - Purpose: Sets bucket to `solid_beginner`

8. **n_branch_beg_gaps**
   - Node ID: `n_branch_beg_gaps`
   - Type: `branch`
   - Linked Segment/Question: (none)
   - Position X: 500
   - Position Y: 450
   - Is Entry Point: No
   - Purpose: Sets bucket to `beginner_with_gaps`

9. **n_branch_int_theory**
   - Node ID: `n_branch_int_theory`
   - Type: `branch`
   - Linked Segment/Question: (none)
   - Position X: 700
   - Position Y: 450
   - Is Entry Point: No
   - Purpose: Sets bucket to `intermediate_theory_gaps`

10. **n_branch_solid_int**
    - Node ID: `n_branch_solid_int`
    - Type: `branch`
    - Linked Segment/Question: (none)
    - Position X: 800
    - Position Y: 350
    - Is Entry Point: No
    - Purpose: Sets bucket to `solid_intermediate`

**Topic 2 Nodes (3 nodes):**

11. **n_goals_beginner**
    - Node ID: `n_goals_beginner`
    - Type: `segment`
    - Linked Segment: `goals_beginner`
    - Position X: 200
    - Position Y: 550
    - Is Entry Point: No

12. **n_goals_intermediate**
    - Node ID: `n_goals_intermediate`
    - Type: `segment`
    - Linked Segment: `goals_intermediate`
    - Position X: 700
    - Position Y: 550
    - Is Entry Point: No

13. **n_goal_question**
    - Node ID: `n_goal_question`
    - Type: `question`
    - Linked Question: `goal`
    - Position X: 400
    - Position Y: 650
    - Is Entry Point: No

**Topic 3 Nodes (7 nodes):**

14. **n_struggle_tb**
    - Node ID: `n_struggle_tb`
    - Type: `segment`
    - Linked Segment: `struggle_true_beginner`
    - Position X: 100
    - Position Y: 750
    - Is Entry Point: No

15. **n_struggle_sb**
    - Node ID: `n_struggle_sb`
    - Type: `segment`
    - Linked Segment: `struggle_solid_beginner`
    - Position X: 250
    - Position Y: 750
    - Is Entry Point: No

16. **n_struggle_bg**
    - Node ID: `n_struggle_bg`
    - Type: `segment`
    - Linked Segment: `struggle_beginner_gaps`
    - Position X: 400
    - Position Y: 750
    - Is Entry Point: No

17. **n_struggle_it**
    - Node ID: `n_struggle_it`
    - Type: `segment`
    - Linked Segment: `struggle_intermediate_theory`
    - Position X: 550
    - Position Y: 750
    - Is Entry Point: No

18. **n_struggle_si**
    - Node ID: `n_struggle_si`
    - Type: `segment`
    - Linked Segment: `struggle_solid_intermediate`
    - Position X: 700
    - Position Y: 750
    - Is Entry Point: No

19. **n_struggle_q_beg**
    - Node ID: `n_struggle_q_beg`
    - Type: `question`
    - Linked Question: `struggle_beginner`
    - Position X: 250
    - Position Y: 850
    - Is Entry Point: No

20. **n_struggle_q_int**
    - Node ID: `n_struggle_q_int`
    - Type: `question`
    - Linked Question: `struggle_intermediate`
    - Position X: 550
    - Position Y: 850
    - Is Entry Point: No

**Topic 4 Nodes (2 nodes):**

21. **n_learning_seg**
    - Node ID: `n_learning_seg`
    - Type: `segment`
    - Linked Segment: `learning_style`
    - Position X: 400
    - Position Y: 950
    - Is Entry Point: No

22. **n_learning_q**
    - Node ID: `n_learning_q`
    - Type: `question`
    - Linked Question: `learning_style`
    - Position X: 400
    - Position Y: 1050
    - Is Entry Point: No

**Topic 5 Nodes (2 nodes):**

23. **n_practice_seg**
    - Node ID: `n_practice_seg`
    - Type: `segment`
    - Linked Segment: `practice_time`
    - Position X: 400
    - Position Y: 1150
    - Is Entry Point: No

24. **n_practice_q**
    - Node ID: `n_practice_q`
    - Type: `question`
    - Linked Question: `practice_time`
    - Position X: 400
    - Position Y: 1250
    - Is Entry Point: No

**Topic 6 Nodes (8 nodes):**

25. **n_genre_seg**
    - Node ID: `n_genre_seg`
    - Type: `segment`
    - Linked Segment: `genre_intro`
    - Position X: 400
    - Position Y: 1350
    - Is Entry Point: No

26. **n_genre_q**
    - Node ID: `n_genre_q`
    - Type: `question`
    - Linked Question: `genre`
    - Position X: 400
    - Position Y: 1450
    - Is Entry Point: No

27. **n_genre_rock**
    - Node ID: `n_genre_rock`
    - Type: `segment`
    - Linked Segment: `genre_ack_rock`
    - Position X: 100
    - Position Y: 1550
    - Is Entry Point: No

28. **n_genre_funk**
    - Node ID: `n_genre_funk`
    - Type: `segment`
    - Linked Segment: `genre_ack_funk`
    - Position X: 250
    - Position Y: 1550
    - Is Entry Point: No

29. **n_genre_metal**
    - Node ID: `n_genre_metal`
    - Type: `segment`
    - Linked Segment: `genre_ack_metal`
    - Position X: 400
    - Position Y: 1550
    - Is Entry Point: No

30. **n_genre_jazz**
    - Node ID: `n_genre_jazz`
    - Type: `segment`
    - Linked Segment: `genre_ack_jazz`
    - Position X: 550
    - Position Y: 1550
    - Is Entry Point: No

31. **n_genre_pop**
    - Node ID: `n_genre_pop`
    - Type: `segment`
    - Linked Segment: `genre_ack_pop`
    - Position X: 700
    - Position Y: 1550
    - Is Entry Point: No

32. **n_genre_multi**
    - Node ID: `n_genre_multi`
    - Type: `segment`
    - Linked Segment: `genre_ack_multi`
    - Position X: 850
    - Position Y: 1550
    - Is Entry Point: No

**Topic 7 Nodes (4 nodes):**

33. **n_equip_seg**
    - Node ID: `n_equip_seg`
    - Type: `segment`
    - Linked Segment: `equipment_intro`
    - Position X: 400
    - Position Y: 1650
    - Is Entry Point: No

34. **n_equip_q**
    - Node ID: `n_equip_q`
    - Type: `question`
    - Linked Question: `equipment`
    - Position X: 400
    - Position Y: 1750
    - Is Entry Point: No

35. **n_equip_no_gear**
    - Node ID: `n_equip_no_gear`
    - Type: `segment`
    - Linked Segment: `equipment_no_gear`
    - Position X: 300
    - Position Y: 1850
    - Is Entry Point: No

36. **n_equip_bad_sound**
    - Node ID: `n_equip_bad_sound`
    - Type: `segment`
    - Linked Segment: `equipment_bad_sound`
    - Position X: 500
    - Position Y: 1850
    - Is Entry Point: No

**Topic 8 Nodes (2 nodes):**

37. **n_commit_seg**
    - Node ID: `n_commit_seg`
    - Type: `segment`
    - Linked Segment: `commitment`
    - Position X: 400
    - Position Y: 1950
    - Is Entry Point: No

38. **n_ready_q**
    - Node ID: `n_ready_q`
    - Type: `question`
    - Linked Question: `ready`
    - Position X: 400
    - Position Y: 2050
    - Is Entry Point: No

**Result Node (1 node):**

39. **n_result**
    - Node ID: `n_result`
    - Type: `result`
    - Linked Segment/Question: (none)
    - Position X: 400
    - Position Y: 2150
    - Is Entry Point: No

#### Step 3.2: Create All Edges

Create edges connecting nodes with proper conditions:

**Topic 1 Edges:**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_level_intro | n_level_question | always | - | 0 |
| n_level_question | n_branch_true_beg | answer_equals | complete_beginner | 0 |
| n_level_question | n_skill_basics | answer_equals | knows_basics | 0 |
| n_level_question | n_skill_fretboard | answer_equals | intermediate | 0 |
| n_skill_basics | n_branch_solid_beg | skill_verified | - | 0 |
| n_skill_basics | n_branch_true_beg | skill_failed | - | 1 |
| n_skill_fretboard | n_skill_interval | skill_verified | - | 0 |
| n_skill_fretboard | n_branch_beg_gaps | skill_failed | - | 1 |
| n_skill_interval | n_branch_solid_int | skill_verified | - | 0 |
| n_skill_interval | n_branch_int_theory | skill_failed | - | 1 |

**Topic 2 Edges (bucket routing):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_branch_true_beg | n_goals_beginner | always | - | 0 |
| n_branch_solid_beg | n_goals_beginner | always | - | 0 |
| n_branch_beg_gaps | n_goals_beginner | always | - | 0 |
| n_branch_int_theory | n_goals_intermediate | always | - | 0 |
| n_branch_solid_int | n_goals_intermediate | always | - | 0 |
| n_goals_beginner | n_goal_question | always | - | 0 |
| n_goals_intermediate | n_goal_question | always | - | 0 |

**Topic 3 Edges (struggle by bucket):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_goal_question | n_struggle_tb | bucket_equals | true_beginner | 0 |
| n_goal_question | n_struggle_sb | bucket_equals | solid_beginner | 0 |
| n_goal_question | n_struggle_bg | bucket_equals | beginner_with_gaps | 0 |
| n_goal_question | n_struggle_it | bucket_equals | intermediate_theory_gaps | 0 |
| n_goal_question | n_struggle_si | bucket_equals | solid_intermediate | 0 |

**Topic 3 to Struggle Question Edges:**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_struggle_tb | n_struggle_q_beg | always | - | 0 |
| n_struggle_sb | n_struggle_q_beg | always | - | 0 |
| n_struggle_bg | n_struggle_q_beg | always | - | 0 |
| n_struggle_it | n_struggle_q_int | always | - | 0 |
| n_struggle_si | n_struggle_q_int | always | - | 0 |

**Topic 4 Edges (Learning Style):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_struggle_q_beg | n_learning_seg | always | - | 0 |
| n_struggle_q_int | n_learning_seg | always | - | 0 |
| n_learning_seg | n_learning_q | always | - | 0 |

**Topic 5 Edges (Practice Time):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_learning_q | n_practice_seg | always | - | 0 |
| n_practice_seg | n_practice_q | always | - | 0 |

**Topic 6 Edges (Genre):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_practice_q | n_genre_seg | always | - | 0 |
| n_genre_seg | n_genre_q | always | - | 0 |
| n_genre_q | n_genre_rock | answer_equals | rock | 0 |
| n_genre_q | n_genre_funk | answer_equals | funk | 0 |
| n_genre_q | n_genre_metal | answer_equals | metal | 0 |
| n_genre_q | n_genre_jazz | answer_equals | jazz | 0 |
| n_genre_q | n_genre_pop | answer_equals | pop | 0 |
| n_genre_q | n_genre_multi | answer_equals | multi | 0 |

**Genre Acknowledgments to Equipment:**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_genre_rock | n_equip_seg | always | - | 0 |
| n_genre_funk | n_equip_seg | always | - | 0 |
| n_genre_metal | n_equip_seg | always | - | 0 |
| n_genre_jazz | n_equip_seg | always | - | 0 |
| n_genre_pop | n_equip_seg | always | - | 0 |
| n_genre_multi | n_equip_seg | always | - | 0 |

**Topic 7 Edges (Equipment):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_equip_seg | n_equip_q | always | - | 0 |
| n_equip_q | n_commit_seg | answer_equals | bass_and_amp | 0 |
| n_equip_q | n_commit_seg | answer_equals | bass_headphones | 0 |
| n_equip_q | n_equip_no_gear | answer_equals | still_figuring | 0 |
| n_equip_q | n_equip_bad_sound | answer_equals | bass_cant_hear | 0 |

**Equipment Response to Commitment:**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_equip_no_gear | n_commit_seg | always | - | 0 |
| n_equip_bad_sound | n_commit_seg | always | - | 0 |

**Topic 8 Edges (Commitment & Result):**

| From | To | Condition | Value | Priority |
|------|-----|-----------|-------|----------|
| n_commit_seg | n_ready_q | always | - | 0 |
| n_ready_q | n_result | answer_equals | lets_go | 0 |

---

### Complete Edge List for Copy-Paste Reference

Here is the complete numbered list of all 52 edges to create:

| # | From Node | To Node | Condition Type | Condition Value | Priority |
|---|-----------|---------|----------------|-----------------|----------|
| 1 | n_level_intro | n_level_question | always | - | 0 |
| 2 | n_level_question | n_branch_true_beg | answer_equals | complete_beginner | 0 |
| 3 | n_level_question | n_skill_basics | answer_equals | knows_basics | 0 |
| 4 | n_level_question | n_skill_fretboard | answer_equals | intermediate | 0 |
| 5 | n_skill_basics | n_branch_solid_beg | skill_verified | - | 0 |
| 6 | n_skill_basics | n_branch_true_beg | skill_failed | - | 1 |
| 7 | n_skill_fretboard | n_skill_interval | skill_verified | - | 0 |
| 8 | n_skill_fretboard | n_branch_beg_gaps | skill_failed | - | 1 |
| 9 | n_skill_interval | n_branch_solid_int | skill_verified | - | 0 |
| 10 | n_skill_interval | n_branch_int_theory | skill_failed | - | 1 |
| 11 | n_branch_true_beg | n_goals_beginner | always | - | 0 |
| 12 | n_branch_solid_beg | n_goals_beginner | always | - | 0 |
| 13 | n_branch_beg_gaps | n_goals_beginner | always | - | 0 |
| 14 | n_branch_int_theory | n_goals_intermediate | always | - | 0 |
| 15 | n_branch_solid_int | n_goals_intermediate | always | - | 0 |
| 16 | n_goals_beginner | n_goal_question | always | - | 0 |
| 17 | n_goals_intermediate | n_goal_question | always | - | 0 |
| 18 | n_goal_question | n_struggle_tb | bucket_equals | true_beginner | 0 |
| 19 | n_goal_question | n_struggle_sb | bucket_equals | solid_beginner | 0 |
| 20 | n_goal_question | n_struggle_bg | bucket_equals | beginner_with_gaps | 0 |
| 21 | n_goal_question | n_struggle_it | bucket_equals | intermediate_theory_gaps | 0 |
| 22 | n_goal_question | n_struggle_si | bucket_equals | solid_intermediate | 0 |
| 23 | n_struggle_tb | n_struggle_q_beg | always | - | 0 |
| 24 | n_struggle_sb | n_struggle_q_beg | always | - | 0 |
| 25 | n_struggle_bg | n_struggle_q_beg | always | - | 0 |
| 26 | n_struggle_it | n_struggle_q_int | always | - | 0 |
| 27 | n_struggle_si | n_struggle_q_int | always | - | 0 |
| 28 | n_struggle_q_beg | n_learning_seg | always | - | 0 |
| 29 | n_struggle_q_int | n_learning_seg | always | - | 0 |
| 30 | n_learning_seg | n_learning_q | always | - | 0 |
| 31 | n_learning_q | n_practice_seg | always | - | 0 |
| 32 | n_practice_seg | n_practice_q | always | - | 0 |
| 33 | n_practice_q | n_genre_seg | always | - | 0 |
| 34 | n_genre_seg | n_genre_q | always | - | 0 |
| 35 | n_genre_q | n_genre_rock | answer_equals | rock | 0 |
| 36 | n_genre_q | n_genre_funk | answer_equals | funk | 0 |
| 37 | n_genre_q | n_genre_metal | answer_equals | metal | 0 |
| 38 | n_genre_q | n_genre_jazz | answer_equals | jazz | 0 |
| 39 | n_genre_q | n_genre_pop | answer_equals | pop | 0 |
| 40 | n_genre_q | n_genre_multi | answer_equals | multi | 0 |
| 41 | n_genre_rock | n_equip_seg | always | - | 0 |
| 42 | n_genre_funk | n_equip_seg | always | - | 0 |
| 43 | n_genre_metal | n_equip_seg | always | - | 0 |
| 44 | n_genre_jazz | n_equip_seg | always | - | 0 |
| 45 | n_genre_pop | n_equip_seg | always | - | 0 |
| 46 | n_genre_multi | n_equip_seg | always | - | 0 |
| 47 | n_equip_seg | n_equip_q | always | - | 0 |
| 48 | n_equip_q | n_commit_seg | answer_equals | bass_and_amp | 0 |
| 49 | n_equip_q | n_commit_seg | answer_equals | bass_headphones | 0 |
| 50 | n_equip_q | n_equip_no_gear | answer_equals | still_figuring | 0 |
| 51 | n_equip_q | n_equip_bad_sound | answer_equals | bass_cant_hear | 0 |
| 52 | n_equip_no_gear | n_commit_seg | always | - | 0 |
| 53 | n_equip_bad_sound | n_commit_seg | always | - | 0 |
| 54 | n_commit_seg | n_ready_q | always | - | 0 |
| 55 | n_ready_q | n_result | answer_equals | lets_go | 0 |

---

### Phase 4: Save and Test

1. Click **Save Flow** in the Flow Editor
2. Go to **http://localhost:3001/assessment/v2** to test
3. Run through each path to verify routing works correctly

---

## Coach Insights Setup

Go to `/admin/assessment/insights` and create the following coach insights. Each insight is matched to users based on their bucket + goal + struggle combination.

### Phase 4.1: High-Priority Insights (5 insights - one per bucket)

Create these 5 insights first as they cover the most common paths:

#### Insight 1: True Beginner + Play Songs + Don't Know Where to Start

1. **true_beginner_play_songs_dont_know_start**
   - Target Bucket: `true_beginner`
   - Target Goal: `play_songs`
   - Target Struggle: `dont_know_start`
   - Priority: 1
   - Insight Title: "Here's What I'm Seeing"
   - Insight Body:
     ```
     You want to play songs, but right now it feels like there's a mountain in front of you.
     That's actually the best place to be—because you haven't built any bad habits yet.

     Most beginners try to learn songs before they understand the instrument. That's backwards.
     In the next 3 days, I'm going to show you the building blocks that make every bass line work.
     By Day 3, you'll play your first real bass line—and you'll understand WHY it works.
     ```
   - Day 1 Title: "Your First Notes"
   - Day 1 Description: "Learn where your hands go and play your first 4 notes"
   - Day 2 Title: "The Root-5 Pattern"
   - Day 2 Description: "The foundation of 80% of all bass lines"
   - Day 3 Title: "Your First Bass Line"
   - Day 3 Description: "Put it all together and play a real song"
   - CTA Text: "Start Day 1"
   - CTA Link: `/tutorials/beginner-start`

#### Insight 2: Solid Beginner + Play Songs + Fingers Won't Work

2. **solid_beginner_play_songs_fingers_wont_work**
   - Target Bucket: `solid_beginner`
   - Target Goal: `play_songs`
   - Target Struggle: `fingers_wont_work`
   - Priority: 1
   - Insight Title: "Here's What I'm Seeing"
   - Insight Body:
     ```
     You know what you want to play, but your fingers aren't cooperating yet.
     That's completely normal—you're building new muscle memory.

     The secret is: you don't need more practice time. You need the right exercises.
     Over the next 3 days, I'll give you specific drills that build finger independence fast.
     These are the same exercises I used to go from struggling to gigging.
     ```
   - Day 1 Title: "The Spider Exercise"
   - Day 1 Description: "Build finger independence in 10 minutes"
   - Day 2 Title: "Left-Right Sync"
   - Day 2 Description: "Get both hands working together"
   - Day 3 Title: "Speed Building"
   - Day 3 Description: "Apply your new control to a real song"
   - CTA Text: "Start Day 1"
   - CTA Link: `/tutorials/finger-control`

#### Insight 3: Beginner with Gaps + Join Band + Can't Keep Rhythm

3. **beginner_gaps_join_band_cant_keep_rhythm**
   - Target Bucket: `beginner_with_gaps`
   - Target Goal: `join_band`
   - Target Struggle: `cant_keep_rhythm`
   - Priority: 1
   - Insight Title: "Here's What I'm Seeing"
   - Insight Body:
     ```
     You want to play with other musicians, but timing is holding you back.
     Here's the thing: most bass players think rhythm is something you're born with. It's not.

     Rhythm is a skill, and I can teach it to you systematically.
     You have gaps in your foundation—but that's actually easy to fix.
     In 3 days, you'll understand groove in a way most bass players never do.
     ```
   - Day 1 Title: "The Subdivision Secret"
   - Day 1 Description: "Feel the beat like a drummer does"
   - Day 2 Title: "Locking with the Kick"
   - Day 2 Description: "The #1 skill for playing in a band"
   - Day 3 Title: "Your First Groove"
   - Day 3 Description: "Play a groove that feels rock solid"
   - CTA Text: "Start Day 1"
   - CTA Link: `/tutorials/rhythm-foundation`

#### Insight 4: Intermediate Theory Gaps + Write Music + Don't Understand Why

4. **intermediate_theory_dont_understand_why**
   - Target Bucket: `intermediate_theory_gaps`
   - Target Goal: `write_music`
   - Target Struggle: `dont_understand_why`
   - Priority: 1
   - Insight Title: "Here's What I'm Seeing"
   - Insight Body:
     ```
     You can play—but when you try to write, you're guessing.
     You want to know WHY certain notes work, not just which notes to play.

     Here's the good news: theory isn't as complicated as people make it.
     You just need to see it through a bass player's lens, not a pianist's.
     In 3 days, I'll connect the dots between what you play and what you hear.
     ```
   - Day 1 Title: "The Number System"
   - Day 1 Description: "See chord progressions like a pro"
   - Day 2 Title: "Note Choice Logic"
   - Day 2 Description: "Why certain notes sound right over certain chords"
   - Day 3 Title: "Write Your First Line"
   - Day 3 Description: "Create a bass line from scratch—and know exactly why it works"
   - CTA Text: "Start Day 1"
   - CTA Link: `/tutorials/theory-for-bass`

#### Insight 5: Solid Intermediate + Join Band + Plateaued

5. **solid_intermediate_join_band_plateaued**
   - Target Bucket: `solid_intermediate`
   - Target Goal: `join_band`
   - Target Struggle: `plateaued`
   - Priority: 1
   - Insight Title: "Here's What I'm Seeing"
   - Insight Body:
     ```
     You're good. But you're not getting better.
     That plateau feeling? It means you've mastered the basics—now you need new challenges.

     Most intermediate players just learn more songs. That doesn't work.
     What works is pushing your weak spots while building on your strengths.
     In 3 days, I'm going to identify exactly where you need to grow—and give you a path forward.
     ```
   - Day 1 Title: "The Skills Audit"
   - Day 1 Description: "Identify your real gaps (not what you think they are)"
   - Day 2 Title: "Advanced Groove Concepts"
   - Day 2 Description: "Techniques that separate amateurs from pros"
   - Day 3 Title: "Your Next Level"
   - Day 3 Description: "A personalized practice plan for the next 30 days"
   - CTA Text: "Start Day 1"
   - CTA Link: `/tutorials/intermediate-breakthrough`

### Phase 4.2: Secondary Insights (20 more combinations)

Create additional insights for other common goal/struggle combinations. Use the same format as above.

**For True Beginner bucket, also create:**
6. true_beginner + hobby + get_bored
7. true_beginner + join_band + dont_know_start
8. true_beginner + play_songs + fingers_wont_work
9. true_beginner + hobby + dont_know_start

**For Solid Beginner bucket, also create:**
10. solid_beginner + join_band + cant_keep_rhythm
11. solid_beginner + play_songs + get_bored
12. solid_beginner + hobby + fingers_wont_work
13. solid_beginner + write_music + fingers_wont_work

**For Beginner with Gaps bucket, also create:**
14. beginner_with_gaps + play_songs + dont_understand_tabs
15. beginner_with_gaps + write_music + cant_keep_rhythm
16. beginner_with_gaps + hobby + cant_keep_rhythm

**For Intermediate Theory Gaps bucket, also create:**
17. intermediate_theory_gaps + join_band + timing_not_tight
18. intermediate_theory_gaps + play_songs + struggle_improvising
19. intermediate_theory_gaps + professional + dont_understand_why

**For Solid Intermediate bucket, also create:**
20. solid_intermediate + write_music + struggle_improvising
21. solid_intermediate + professional + plateaued
22. solid_intermediate + play_songs + cant_learn_fast
23. solid_intermediate + hobby + plateaued

### Phase 4.3: Fallback Insights (5 insights - one per bucket)

Create fallback insights that match ONLY on bucket (no specific goal/struggle) to catch any unmatched combinations:

24. **true_beginner_fallback**
    - Target Bucket: `true_beginner`
    - Target Goal: (leave empty)
    - Target Struggle: (leave empty)
    - Priority: 10 (lower priority = fallback)
    - Generic insight for true beginners

25. **solid_beginner_fallback**
    - Target Bucket: `solid_beginner`
    - Target Goal: (leave empty)
    - Target Struggle: (leave empty)
    - Priority: 10

26. **beginner_with_gaps_fallback**
    - Target Bucket: `beginner_with_gaps`
    - Target Goal: (leave empty)
    - Target Struggle: (leave empty)
    - Priority: 10

27. **intermediate_theory_gaps_fallback**
    - Target Bucket: `intermediate_theory_gaps`
    - Target Goal: (leave empty)
    - Target Struggle: (leave empty)
    - Priority: 10

28. **solid_intermediate_fallback**
    - Target Bucket: `solid_intermediate`
    - Target Goal: (leave empty)
    - Target Struggle: (leave empty)
    - Priority: 10

---

## Testing Checklist

### Path Testing (test each user journey)

- [ ] Complete Beginner → Goals Beginner → Struggle True Beginner → Result
- [ ] Knows Basics + Pass → Goals Beginner → Struggle Solid Beginner → Result
- [ ] Knows Basics + Fail → Goals Beginner → Struggle True Beginner → Result
- [ ] Intermediate + Pass Both → Goals Intermediate → Struggle Solid Intermediate → Result
- [ ] Intermediate + Fail Fretboard → Goals Beginner → Struggle Beginner Gaps → Result
- [ ] Intermediate + Pass Fretboard + Fail Interval → Goals Intermediate → Struggle Intermediate Theory → Result

### Feature Testing

- [ ] Video plays correctly for each segment
- [ ] Questions appear after video ends
- [ ] Skill verification shows wrong answer feedback
- [ ] Bucket is correctly determined
- [ ] Genre acknowledgment plays for selected genre
- [ ] Equipment conditional responses work
- [ ] Results screen shows correct coach insight
- [ ] Session resume works (close and reopen)

### Edge Cases

- [ ] "Advanced" answer routes to waitlist/email capture
- [ ] "Have a question" on ready screen shows help
- [ ] Back button works during questions
- [ ] Progress bar updates correctly (0/8 → 8/8)

---

## Summary

This guide covers the complete setup for the V2 assessment system:

| Component | Count | Notes |
|-----------|-------|-------|
| Video Segments | 24 | 4 (Topic 1) + 2 (Topic 2) + 5 (Topic 3) + 1 (Topic 4) + 1 (Topic 5) + 7 (Topic 6) + 3 (Topic 7) + 1 (Topic 8) |
| Questions | 12 | 4 (level/skill) + 1 (goal) + 2 (struggle) + 1 (learning) + 1 (practice) + 1 (genre) + 1 (equipment) + 1 (ready) |
| Flow Nodes | 39 | Explicitly listed in Step 3.1 |
| Flow Edges | 55 | Explicitly listed in Complete Edge List |
| Coach Insights | 28 | 5 (priority) + 18 (secondary) + 5 (fallback) |
| User Paths | 6 | Distinct journeys based on skill bucket |
| Videos per User | 8 | Always exactly 8 videos |

### What You Need to Create (Checklist)

**Phase 1: Segments** (/admin/assessment/segments)
- [ ] Segments 1-4: Topic 1 (Level)
- [ ] Segments 5-6: Topic 2 (Goals)
- [ ] Segments 7-11: Topic 3 (Struggle - 5 bucket versions)
- [ ] Segment 12: Topic 4 (Learning Style)
- [ ] Segment 13: Topic 5 (Practice Time)
- [ ] Segments 14-20: Topic 6 (Genre - 7 versions)
- [ ] Segments 21-23: Topic 7 (Equipment - 3 versions)
- [ ] Segment 24: Topic 8 (Commitment)

**Phase 2: Questions** (/admin/assessment/questions)
- [ ] Questions 1-4: Level self-report + 3 skill checks
- [ ] Question 5: Goal
- [ ] Questions 6-7: Struggle (beginner + intermediate versions)
- [ ] Question 8: Learning style
- [ ] Question 9: Practice time
- [ ] Question 10: Genre
- [ ] Question 11: Equipment
- [ ] Question 12: Ready

**Phase 3: Flow Graph** (/admin/assessment/flow)
- [ ] Create 39 nodes (see Step 3.1)
- [ ] Create 55 edges (see Complete Edge List)
- [ ] Set n_level_intro as Entry Point
- [ ] Save and verify no validation errors

**Phase 4: Coach Insights** (/admin/assessment/insights)
- [ ] Create 5 priority insights (one per bucket)
- [ ] Create 18 secondary insights
- [ ] Create 5 fallback insights

**Phase 5: Testing**
- [ ] Test all 6 user paths
- [ ] Verify all videos play
- [ ] Verify correct coach insight shows for each path

The system is designed so every user:
1. Watches exactly 8 videos
2. Gets personalized content based on their skill bucket
3. Receives a coach insight that feels like mind-reading
4. Leaves with a clear 3-day starter plan
