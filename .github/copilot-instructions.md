# GitHub Copilot Instructions

> **⚠️ IMPORTANT**: This file serves as a pointer to the canonical agent instructions. Always consult `AGENTS.MD` in the repository root for the complete, up-to-date guidance.

## Primary Reference

**All AI coding agents MUST read and follow [`AGENTS.MD`](../AGENTS.MD)** located in the repository root.

That file contains:
- Complete project context and architecture
- Detailed implementation notes for the Habit Dashboard
- Detailed implementation notes for the Task Dashboard  
- Breaking changes and evolution history
- Code conventions and helper usage patterns
- Data structure expectations
- Integration points with Trilium Next Notes

## Why This Structure?

- **Single Source of Truth**: `AGENTS.MD` is the authoritative, actively maintained reference
- **No Duplication**: Prevents drift between multiple instruction files
- **Always Current**: Contributors update `AGENTS.MD` directly as features evolve
- **Cross-Tool Compatibility**: Works for all AI agents, not just GitHub Copilot

## Quick Project Overview

This repository contains custom dashboards and scripts for [Trilium Next Notes](https://github.com/TriliumNext/Trilium):

### Active Projects
1. **Habit Dashboard** (`habits/`) - Streak-based habit tracking with multi-view support
2. **Task Dashboard** (`task-system/`) - Kanban & list-based task management

### Tech Stack
- **Runtime**: Trilium Next Notes frontend scripts (browser JavaScript)
- **Backend**: Trilium API (`api.runOnBackend()`, note manipulation)
- **Styling**: CSS with Trilium theme tokens (`--detail-*`, `--shade-*`)
- **Data Storage**: Trilium note attributes and labels (JSON metadata)

### Key Constraints
- All code must work within Trilium's script execution environment
- No external dependencies (pure JavaScript/CSS)
- Backend calls use Trilium's `api` object
- DOM manipulation via jQuery (available as `$`)
- Themes must respect Trilium's light/dark mode tokens

## When Making Changes

1. **Read `AGENTS.MD` first** - Contains essential context and gotchas
2. **Update `AGENTS.MD`** - Add new patterns, breaking changes, or architectural decisions
3. **Keep READMEs in sync** - User-facing docs in `habits/README.md` and `task-system/README.md`
4. **Test in Trilium** - These are live scripts, not standalone apps
5. **Preserve data structures** - Existing installations depend on label/attribute schemas

## File Organization

```
/
├── AGENTS.MD                    # 👈 START HERE - Complete agent instructions
├── README.md                    # High-level project summary
├── habits/
│   ├── README.md               # User-facing habit dashboard docs
│   ├── habit-dashboard.js      # Main frontend script
│   └── docs/                   # Deep-dive documentation
├── task-system/
│   ├── README.md               # User-facing task dashboard docs
│   ├── scripts/                # Frontend, backend, utils
│   ├── styles/                 # CSS modules
│   └── config/                 # Templates and configs
└── Trilium/                    # Upstream Trilium Next Notes mirror
```

## Common Pitfalls (See AGENTS.MD for Details)

- **Don't duplicate dark theme colors** - Use Trilium's theme tokens
- **Backend safety** - Always use `Backend.call()` or `callService()` wrappers
- **Multi-entry support** - Check if habit allows multiple entries per day
- **Streak calculation** - Rolling window algorithm in `AGENTS.MD`, don't reinvent
- **Filter persistence** - Dashboard state stored in note labels
- **Keyboard shortcuts** - Disabled at dashboard level to avoid conflicts

## Documentation Hierarchy

1. **`AGENTS.MD`** - Complete technical context for AI agents ⭐
2. **`habits/README.md`** - User onboarding for Habit Dashboard
3. **`task-system/README.md`** - User onboarding for Task Dashboard  
4. **`habits/docs/`** - Deep-dive habit system documentation
5. **Repository `README.md`** - Project landing page

---

**Remember**: Before suggesting changes, read [`AGENTS.MD`](../AGENTS.MD) to understand the full context, existing patterns, and lessons learned from past iterations.
