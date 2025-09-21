# Documentation Guidelines

**STOP! Before creating ANY new documentation, follow these guidelines.**

## 🚫 What NOT to Do

1. **DO NOT create documentation in the root directory** - Only README.md and CLAUDE.md belong there
2. **DO NOT create duplicate documentation** - Check INDEX.md first
3. **DO NOT create temporary fix documentation** - These go in `archived/fixes/`
4. **DO NOT create test files as documentation** - Use actual test files instead

## ✅ Documentation Structure

```
docs/
├── INDEX.md                    # Main catalog - UPDATE THIS when adding docs
├── DOCUMENTATION_GUIDELINES.md # This file
├── 2. Stories/                 # User stories and epics
├── 2. Technical docs/          # Technical documentation
├── architecture/               # Architecture docs
│   ├── analysis/              # System analysis documents
│   └── *.md                   # Architecture plans
├── implementations/            # Completed implementation summaries
├── playback/                  # Playback domain specific docs
├── developer-handbook/         # Developer guides
├── archived/                  # Historical/deprecated docs
│   └── fixes/                 # Old fix documentation
└── NEW STORIES/               # Active story documentation
```

## 📝 Before Creating New Documentation

1. **Check INDEX.md** - Is there already a doc covering this topic?
2. **Consider existing docs** - Can you update an existing doc instead?
3. **Choose the right location**:
   - Architecture analysis → `architecture/analysis/`
   - Implementation summaries → `implementations/`
   - Fix documentation → `archived/fixes/`
   - Developer guides → `developer-handbook/`
   - Story documentation → `NEW STORIES/` or `2. Stories/`

## 🏗️ Documentation Types & Where They Belong

### Architecture Documentation
- **Location**: `docs/architecture/`
- **Examples**: System design, architecture decisions, analysis reports
- **Naming**: `SYSTEM-COMPONENT-ANALYSIS.md`, `FEATURE-ARCHITECTURE.md`

### Implementation Summaries
- **Location**: `docs/implementations/`
- **Purpose**: Document completed features/systems
- **Naming**: `FEATURE-IMPLEMENTATION-SUMMARY.md`
- **When**: After implementation is complete and tested

### Fix Documentation
- **Location**: `docs/archived/fixes/`
- **Purpose**: Document specific bug fixes
- **Naming**: `ISSUE-FIX-SUMMARY.md`
- **Note**: Should be temporary - update main docs instead

### Developer Guides
- **Location**: `docs/developer-handbook/`
- **Purpose**: How-to guides, best practices, workflows
- **Examples**: TROUBLESHOOTING_FLOWCHART.md, CODING_STANDARDS.md

### Story Documentation
- **Location**: `docs/NEW STORIES/` or `docs/2. Stories/`
- **Purpose**: Track feature development progress
- **Naming**: `Story-X.XX-Feature-Name.md`

## 📄 Document Template

```markdown
# Document Title

## Overview
Brief description of what this document covers.

## Purpose
Why this document exists and who should read it.

## Content
Main content organized with clear headings.

## References
- Link to related docs
- External resources

## Last Updated
Date and author
```

## 🔄 Maintenance

1. **Update INDEX.md** immediately after creating new docs
2. **Archive outdated docs** instead of deleting
3. **Review quarterly** to identify redundant/outdated docs
4. **Consolidate** similar documents when possible

## ❌ Common Mistakes

1. Creating "test-something.md" files in root
2. Creating multiple docs for the same feature
3. Not updating INDEX.md
4. Creating docs without clear purpose
5. Mixing temporary fixes with permanent documentation

## 📊 Good Documentation Examples

- `developer-handbook/TROUBLESHOOTING_FLOWCHART.md` - Clear, actionable
- `playback/dependency-injection-architecture.md` - Technical but accessible
- `API_DOCUMENTATION.md` - Comprehensive reference

## 🚮 When NOT to Create Documentation

- For temporary debugging (use comments in code)
- For one-off fixes (update existing docs)
- For test scenarios (create actual tests)
- For TODOs (use TODO comments or issues)

---

**Remember**: Good documentation is discoverable, maintainable, and serves a clear purpose. When in doubt, ask: "Will someone need this in 6 months?"