# Habit Dashboard for Trilium Next Notes

> A full-featured habit tracking dashboard that lives inside [Trilium Next Notes](https://github.com/TriliumNext/Trilium), designed to feel native and encourage streaks.

## Table of Contents

- [Overview](#overview)
- [Feature Highlights](#feature-highlights)
- [Quick Start](#quick-start)
- [Habit Types & Metadata](#habit-types--metadata)
- [Views & Navigation](#views--navigation)
- [Recording Entries](#recording-entries)
- [Streaks & Motivation Model](#streaks--motivation-model)
- [Data Layout & Storage](#data-layout--storage)
- [Customization & Theming](#customization--theming)
- [Diagnostics & Debugging](#diagnostics--debugging)
- [Development](#development)
- [Documentation Roadmap](#documentation-roadmap)
- [Community](#community)
- [License](#license)

## Overview

The Habit Dashboard script embeds directly into a Trilium dashboard note and turns it into a rich habit manager. It creates opinionated views for daily rituals, rolling summaries, and streak-based motivation while reusing Trilium's storage, theming, and sync capabilities.

The dashboard automatically provisions its data vault beneath each dashboard note, so you can run multiple independent dashboards (work vs personal etc.) from the very same script note.

## Feature Highlights

- **Multiple time scales** – Day, Last 7, Last 14, Week (Monday start), Two Weeks, and Month views with fast left/right navigation.
- **Rich habit metadata** – Configure type, target, units, streak goal/window, reminders, colour, icon, quick increment, slug overrides, and more.
- **Inline habit & group management** – Create, edit, delete, and reorder habits and groups without leaving the dashboard. Drag cards or use Alt+↑/↓ to rearrange.
- **Quick actions everywhere** – Short-click chips to toggle or increment the latest entry; long-press (or use modifier-click) to open the editor for precise control.
- **Multi-entry days** – Optional per-habit setting allows multiple logs per day with timestamps, history lists, and entry-level delete/edit.
- **Templated sub-entries** – Define named sub-rows (e.g., "AM Energy", "PM Focus") with per-item quick actions, star pickers, and automatic data migration.
- **Group-aware layout** – Colour-accented group headers and left-border accents keep related habits together.
- **Rewarding motivations** – Rolling streak engine, celebratory toasts/confetti, badges for perfect weeks, and star indicators when targets are met.
- **Theme-native UI** – Uses Trilium palette tokens via local `--hd-*` variables so dark/light/custom themes just work.
- **Multi-dashboard friendly** – Habits and Entries books live beneath each dashboard note, enabling several dashboards to co-exist without data collisions.

## Quick Start

> Prerequisites: Trilium Next Notes ≥ 0.98.1 (desktop or server).

1. **Copy the script**

   - Inside Trilium, create a new *code note* for the script
   - Set the note type to **JS Frontend**
   - Paste the contents of [`habits/habit-dashboard.js`](habits/habit-dashboard.js) into the note
2. **Create the dashboard render note**

   - Create a note where you want the dashboard to appear and change its note type to **Render Note**
   - Open the note owned attributes and add a relation `~renderNote=<script note>` that points to the script note you created in step 1 (if you type ~renderNote=@ it should popup a list to search for it)
3. **Open the dashboard**

   - The first load will create `Habits` and `Entries` books under the dashboard render note, seed sample habits, and display the Last 7 Days view by default
4. **Create your own habits**

   - Use `Add Habit` to define each habit's type, targets, streak settings, colours, icons, and metadata.
   - Optionally create groups to cluster habits; group order controls the layout
5. **Log progress**

   - Click day chips for quick toggles or hold to open the editor. Each view stays in sync with summaries and streak feedback

## Habit Types & Metadata

Every habit stores metadata in Trilium labels. Highlights:

- Types: `check`, `count`, `time`, `rating`, `value`
- Targets, units, decimals, and quick increments tailor how success is measured
- Rolling streak settings (`goal` and `window`) work across all types
- Optional multi-entry mode captures several logs per day with timestamps
- Accent colour, icon, reminders, and slug help with presentation and integrations

For the full matrix of fields and storage details, see [docs/habit-types.md](docs/habit-types.md)

## Views & Navigation

- **Day view** – Focused control panel with full habit table, status toggles, and inline streak summaries
- **Last 7 / Last 14 days** – Rolling retros covering today and previous days, stepping 7 or 14 days at a time
- **Week / Two Weeks** – Monday-anchored ranges for planning or reviews
- **Month view** – Calendar-style summary across the full month

Use the header arrows or jump back to "Today" with the control buttons. Compact mode further tightens spacing and persists per-dashboard.

## Recording Entries

- **Quick actions**: Primary click updates the latest entry for the selected day (or the focused sub-entry); hold (or Ctrl/Cmd-click) to open the full editor
- **Entry editor**: Skip is a pill toggle, rating habits reuse the star picker, and templated sub-entries stack vertically with dedicated controls. Multi-entry habits still surface a sortable history with per-entry delete
- **Celebrations**: Hitting targets or long streaks triggers confetti overlays and positive toast copy to reinforce progress

## Streaks & Motivation Model

All habit types share the same rolling streak engine: evaluation prefers today (falling back to yesterday), activation requires `goal` successes inside the rolling `window`, and streak length counts successful or skipped days until the first window that fails the goal. Skips count as intentional rest, and numeric targets control success for count/time/value/rating habits.

The algorithm is documented in depth with examples in [docs/streak-algorithm.md](docs/streak-algorithm.md).

## Data Layout & Storage

- Each dashboard note gains two child books (`Habits`, `Entries`) beneath it
- Habits keep configuration in labels and JSON metadata, while entries store per-day values keyed by `habitEntryKey`
- Entry keys follow `habitId:YYYY-MM-DD[:subEntryId]`. When templated sub-entries are enabled the suffix matches the template id; legacy multi-entry suffixes remain random. The dashboard automatically migrates existing entries when templates are introduced.
- Dashboard-level settings such as compact mode and debug toggles persist as labels on the dashboard note
- Deleting a habit now also deletes its historical entries to prevent orphaned data

See [docs/data-structure.md](docs/data-structure.md) for a complete schema reference and API query tips.

## Customization & Theming

- The UI consumes Trilium palette tokens and re-exposes them as `--hd-*` variables for safe overrides
- Habit-level accents control card borders, chips, and icons without leaving the theme
- Compact mode shrinks spacing further; responsive tweaks kick in at 900 px and 600 px

Tuning examples and variable listings live in [docs/customization.md](docs/customization.md).

## Diagnostics & Debugging

- Add the `habitDebug` label to either the dashboard note or the script note to enable verbose logging and the copy-friendly "Streak debug" line under each card
- Console logs are prefixed with the deployed version (e.g., `[habit-dashboard/v12]`), making it easy to confirm upgrades
- Backend calls emit structured logs (`backend.call.start`, `.success`, `.failed`) with the script/root note IDs to aid support cases

## Development

- No build step is required - edit the script directly and reload the dashboard note inside Trilium to test.
- Keep modal action buttons inside `<form>` elements so submit handlers continue to fire (Trilium disables default submit on buttons outside forms)
- Use the provided helpers (`normalizeString`, `normalizeNumber`, `performHabitQuickAction`, `deleteEntryKeys`, etc.) when extending logic to avoid regression
- When changing behaviour, bump `CONSTANTS.version` so logs and bug reports remain traceable
- Run manual QA across light/dark themes, compact mode, and small viewports, paying close attention to multi-entry habits and streak calculations

## Documentation

- [docs/habit-types.md](docs/habit-types.md) – Field-by-field breakdown of habit metadata
- [docs/streak-algorithm.md](docs/streak-algorithm.md) – Formal specification of the rolling streak engine
- [docs/customization.md](docs/customization.md) – Theme variables, layout tweaks, and styling tips
- [docs/data-structure.md](docs/data-structure.md) – Storage schema and scripting pointers

Contributions and doc updates are always welcome — remember to update `AGENTS.MD` alongside public docs so internal and external guidance stay aligned.

## Community

- **Issues & Ideas** – Open a GitHub issue describing the use case, reproduction steps, console logs and current script version (`habit-dashboard/vXX`)
- **Streak issues** – Share streak debug snippets (with `habitDebug` label enabled) to help diagnose streak behaviour quickly

## License

This project is licensed under the terms of the GNU General Public License v3.0. See the [LICENSE](../../LICENSE) file for the full text.
