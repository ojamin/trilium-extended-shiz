# Habit Dashboard · Data Structure Reference

This document outlines how the Habit Dashboard stores data inside Trilium so integrators and advanced users can script against it confidently.

## Overview
Each dashboard note creates two child books:
- `Habits` – Contains one note per habit.
- `Entries` – Contains one note per habit/day (or per entry when multiple entries per day are enabled).
- Deleting a habit also deletes its associated entry notes to keep the vault tidy.

> The script now refuses to provision or mutate data unless it is running inside a note that already carries the `habitDashboardRoot` label (or the note that is in the process of being initialised). Navigating away from a dashboard suspends the UI and backend until a labelled root comes back into focus, preventing stray `Habits`/`Entries` books from appearing under unrelated notes.

Both books live directly under the dashboard note, allowing multiple dashboards to coexist without collisions.

## Habit Notes
| Attribute | Storage | Description |
| --- | --- | --- |
| Title | Note title | Display name of the habit. |
| Group | Parent relationship (`habitGroup` label) | Points to a group note (created automatically). |
| `habitType` | Label (value = type string) | One of `check`, `count`, `time`, `rating`, `value`. |
| `habitSlug` | Label | Optional slug override used in URLs/tooling. |
| `habitOrder` | Label (integer) | Determines order within group. |
| `habitArchived` | Label (flag) | Reserved for future use. |
| `habitMetaVersion` | Label (integer) | Bumped when internal schema changes. |
| Metadata | JSON stored in note content | Includes unit, target, quickStep, streak settings, icon, colour, reminder, etc. |

Habit notes are linked to the script via the `habitRole` label, making it easy to query all habit notes in the workspace.

## Group Notes
Groups live under the dashboard note alongside the `Habits` book.

| Label | Purpose |
| --- | --- |
| `habitGroup` | Links habits to the group. |
| `habitGroupOrder` | Controls group ordering in the UI. |
| `habitGroupColor` | Optional hex colour used for the accent border. |

Deleting a group reassigns its habits to the default group.

## Entry Notes
Each entry note resides under the `Entries` book and stores raw log data.

| Attribute | Storage | Description |
| --- | --- | --- |
| Title | Note title | Human-readable label (`Habit Title – YYYY-MM-DD`). |
| Content | JSON payload | `{ value, skip, recordedAt, source, subEntryId }`. Older entries may omit `subEntryId`; the script back-fills it when migrating. |
| `habitEntryKey` | Label | Unique key `habitId:YYYY-MM-DD[:suffix]`. When templated sub-entries are enabled the suffix equals the template id; otherwise a random suffix is used for legacy multi-entry rows. |
| `habitRef` | Relation | Points back to the habit note. |
| `habitSkipped` | Label (flag) | Present when the entry was marked skipped. |
| `habitValue` | Label (string/number) | Legacy surface of the numeric value for compatibility. |

When “Allow multiple entries per day” is disabled and no templates exist, the key omits the suffix and the dashboard enforces a single entry per date. Enabling templated sub-entries automatically rewrites historical data: single-entry habits move the existing value into the first template and mark the rest skipped, while multi-entry habits distribute logs in order (averaging overflow into the last template).

## Templated Sub-entries

- Stored in `habit.meta.subEntries` as an ordered array of `{ id, title, required }` objects.
- Entry notes created for templated habits always include `subEntryId` in both the JSON payload and the `habitEntryKey` suffix.
- Backward compatibility: switching a habit to templated mode migrates existing entries as described above; the migration runs on the backend so no manual cleanup is required.

## Dashboard Settings Labels
Stored on the dashboard note itself:

| Label | Type | Purpose |
| --- | --- | --- |
| `habitDashboardRoot` | relation/label | Identifies the dashboard context. |
| `habitCompactMode` | flag | Persists compact mode per dashboard. |
| `habitDebug` | flag | Enables streak debug UI and additional logging. |

## Querying via API Scripts
Use Trilium’s scripting API (`api.search`, `api.getNote`, etc.) to query data. Example: fetch all entries for a habit in September 2025.

```javascript
const habitId = "NOTE-ID";
const month = "2025-09";
const entries = await api.search(
  `note.hasLabel(habitEntryKey) and note.labelIncludes(habitEntryKey, '${habitId}:${month}')`
);
```

> Entry keys use ISO date strings; prefix searching is convenient for month/year filters.
