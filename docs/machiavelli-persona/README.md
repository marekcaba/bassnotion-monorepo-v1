# Machiavelli Persona for Claude Code

This folder contains configuration files that enable Claude Code to adopt the persona of Nicolo Machiavelli, the renowned Renaissance political philosopher.

## Purpose

When these files are included in your Claude Code project context, the AI will respond as if it were Machiavelli himself - offering counsel on modern situations through the lens of his political philosophy, drawing on historical examples, and speaking with his characteristic directness and pragmatism.

## Files

| File | Purpose |
|------|---------|
| `MACHIAVELLI_SYSTEM.md` | Core persona prompt - identity, background, philosophical principles |
| `MACHIAVELLI_KNOWLEDGE.md` | Key teachings from "The Prince" organized by theme |
| `MACHIAVELLI_STYLE.md` | Response patterns, characteristic phrases, example conversations |
| `README.md` | This file - usage instructions |

## Usage

### Option 1: Include All Files
Add all markdown files from this folder to your Claude Code project's knowledge context. This gives the fullest persona experience.

### Option 2: Minimal Setup
Include only `MACHIAVELLI_SYSTEM.md` for the core persona. The AI will still respond as Machiavelli but with less detailed knowledge of specific teachings.

### Option 3: Custom System Prompt
Copy the content from `MACHIAVELLI_SYSTEM.md` into your custom system prompt configuration.

## Example Interactions

**You:** I have a colleague who keeps taking credit for my work. What should I do?

**Machiavelli:** Upon this matter of a colleague who appropriates your achievements, I say that you face a situation not unlike what I observed in the courts of Italy...

[Continues with historical parallels, practical advice, and characteristic directness]

## Customization

### Adjusting Formality
Edit `MACHIAVELLI_STYLE.md` to adjust how formal or casual the responses should be.

### Adding Knowledge
Extend `MACHIAVELLI_KNOWLEDGE.md` with additional content from:
- "Discourses on Livy"
- "The Art of War"
- Machiavelli's letters and diplomatic dispatches

### Modern Context
The persona is designed to apply Machiavellian principles to modern situations. If you want responses strictly limited to 16th century context, modify the system prompt accordingly.

## Notes

- This persona is designed for educational and entertainment purposes
- Machiavelli's advice was meant for rulers maintaining states - apply to personal situations with appropriate judgment
- The persona captures Machiavelli's realistic view of power without endorsing harmful actions
- Remember: Machiavelli was a republican at heart who believed in civic virtue

## About Machiavelli

**Nicolo Machiavelli** (1469-1527) was a Florentine diplomat, philosopher, and writer. He served as Secretary to the Second Chancery of Florence from 1498 to 1512, conducting diplomatic missions throughout Italy and Europe. After the Medici returned to power, he was imprisoned and tortured, then exiled to his farm where he wrote "The Prince" in 1513.

His works established the foundation of modern political science, separating politics from ethics and focusing on how power actually operates rather than how it ideally should.
