# Habit Dashboard · Habit Types & Metadata

Each habit stores its configuration in Trilium labels. This guide lists every field exposed in the editor and how it influences the dashboard.

## Shared Fields
| Field | Description | Notes |
| --- | --- | --- |
| **Title** | Display name shown in cards, tables, and summaries. | Required. |
| **Group** | Organises habits under a coloured header. | Groups are optional; default “General” group is generated. |
| **Description** | Markdown-friendly explanatory text. | Shown on hover/tooltips and future docs. |
| **Slug** | Optional override for the habit note name. | Auto-generated from title if left blank. |
| **Reminder time** | HH:MM string stored in metadata. | No built-in reminder engine yet; available for integrations. |
| **Accent colour** | Hex colour for card border and chip accents. | Leave blank to inherit theme palette. |
| **Icon class** | [Boxicons](https://boxicons.com/) class (e.g., `bx bx-star`). | Fallback is `bx bx-bulb`. |
| **Quick increment** | Numeric step applied during quick actions. | Defaults depend on type (1 for count/value). |
| **Allow multiple entries per day** | Toggle enabling per-day history. | Stored as `meta.multiEntries = true`. |
| **Sub-entries** | Ordered array of `{ id, title, required }` used to template sub-rows. | Enabling creates per-template entry slots and automatically migrates existing data. |
| **Streak goal (days)** | Minimum number of successes required in the rolling window. | Leave blank to disable rolling streaks (falls back to consecutive tracking for check habits). |
| **Streak window (days)** | Window length for the rolling streak algorithm. | Defaults to 7 when not set. |

## Type-Specific Settings
### Check
Binary done/not-done habit.
- **Target**: ignored; completion is based on checkbox (value 1) or skip flag.
- **Quick increment**: toggles between 0 and 1 when set to 1.
- **Streak behaviour**: Works with or without streak goal/window. Without, consecutive days are counted; with, uses the rolling algorithm.

### Count
Tracks discrete quantities (e.g., glasses of water).
- **Unit**: Text displayed in summaries (`cups`, `steps`, etc.).
- **Target**: Daily minimum for streak success and target met badges.
- **Decimals**: Optional decimal precision (default 0). Useful for e.g., 0.5 servings.
- **Quick increment**: Increments by the specified value when tapping chips.

### Time
Captures minutes spent (deep work, exercise).
- **Target**: Minutes per day.
- **Quick increment**: Amount of minutes to add per quick tap.
- **Display**: Summaries show total/average as `HH:MM`.

### Rating
Subjective scales (mood, energy).
- **Scale min / max**: Define allowed rating range (defaults 1–5).
- **Target**: Optional lower bound to treat as success (e.g., 4+).
- **Quick increment**: Adds to the current rating (clamped to max).

### Value
Generic float (e.g., weight lifted).
- **Unit**: Display suffix (`kg`, `pages`).
- **Target**: Daily minimum for success.
- **Decimals**: Precision for display and increments.

## Metadata Storage Summary
| Label | Purpose |
| --- | --- |
| `habitType` | Habit type (`check`, `count`, `time`, `rating`, `value`). |
| `habitSlug` | Optional slug override. |
| `habitOrder` | Position within its group. |
| `habitGroup` | Group note ID. |
| `habitGroupColor` | Hex colour for group accent. |
| `habitMetaVersion` | Incremented when metadata schema changes internally. |

## Tips for Designing Habits
- If you need both daily completion and volume tracking, create two complementary habits (e.g., `Gym (Show up)` check + `Gym (Minutes)` time).
- When migrating existing data, align note slugs with desirable names before attaching the dashboard; the script respects pre-existing habit notes where possible.
- Tempted to break a habit into repeatable parts? Add templated sub-entries instead of separate habits—the dashboard will generate per-sub-entry quick actions and migrate historical data for you.
- Use streak goals to represent consistency (“5 of 7 days”) rather than perfect attendance; skips count as intentional rest.
