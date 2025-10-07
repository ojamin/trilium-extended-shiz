# Trilium Task System

An end-to-end tasks and todo dashboard for single-user Trilium Notes. This bundle delivers a responsive frontend, a workflow-aware backend, reusable utilities, and theme-friendly styles so you can manage complex task hierarchies without modifying Trilium core.

## Highlights at a Glance

- **Multi-dashboard architecture** – render any task subtree as a dashboard, with depth limits and tree-order selectors that mirror the Trilium note structure.
- **Multiple views** – List, Kanban, Calendar, and Overview modes share the same dataset and filters.
- **Fast capture** – Quick Add modal (single or multi-line) with shared status/due/tag/role selectors plus a template-driven sample data generator.
- **Rich filtering** – Search, quick chips (due windows, pinned, top tags/roles), full filter sidebar, and persisted per-dashboard preferences.
- **Workflow logging** – Every status change is logged (timeline + “updated within” filters) and surfaces relative timestamps in the UI.
- **Powerful bulk edits** – Multi-select in List view with range selection and a master checkbox for visible tasks, plus a bulk bar for status/priority/due/pin/tag/role changes.
- **Kanban polish** – Column toolbar for sorting/visibility, responsive cards with location, role/tag badges, tooltip summaries, and drag/drop when manual ordering is active.
- **Theme alignment** – Styles rely on Trilium theme tokens, inherit light/dark modes, and include motion/accessibility tweaks.

## Repository Contents

| Path | Purpose |
| --- | --- |
| `scripts/task-utils.js` | Shared normalization, filtering, sorting, and insight helpers (backend). |
| `scripts/task-service-backend.js` | Backend handler that powers dashboard bootstrap, CRUD, bulk updates, and tree traversal. |
| `scripts/task-dashboard-frontend.js` | Frontend render script (attach to the Render note) responsible for all UI. |
| `scripts/task-sample-data.js` | Optional backend script to seed example dashboards/tasks for demos. |
| `styles/task-dashboard.css` | Scoped stylesheet injected by the frontend script. |
| `views/task-dashboard.html` | Render note wrapper that hosts the UI script. |
| `config/dashboard-template.md` | Markdown template to pre-populate new dashboard notes. |

## Installation

1. **Prepare Trilium**
   - Use a single-user Trilium instance (the scripts rely on per-user storage).
   - Create a parent note (e.g., `Task System`).

2. **Import Notes** – For each file in the table below, create a note, copy the file contents, and set attributes/labels exactly as listed.

   | File | Note title | Type / MIME | Labels / Notes |
   | --- | --- | --- | --- |
   | `scripts/task-utils.js` | `TaskUtils` | Code · `application/javascript;env=backend` | Label `taskUtils` |
   | `scripts/task-service-backend.js` | `TaskService` | Code · `application/javascript;env=backend` | Label `taskService` |
   | `styles/task-dashboard.css` | `TaskDashboard Stylesheet` | Code · `text/css` | Label `taskStyles` |
   | `views/task-dashboard.html` | `Task Dashboard HTML` | Code · `text/html` | Label `taskDashboardHtml` |
   | `scripts/task-dashboard-frontend.js` | `TaskDashboards UI` | Code · `application/javascript;env=frontend` | Store as child of the HTML note |
   | `scripts/task-sample-data.js` *(optional)* | `Task Sample Data Seed` | Code · `application/javascript;env=backend` | Run once to seed demo data |
   | `config/dashboard-template.md` | `Task Dashboard Template` | Text · `text/markdown` | Use as copy source when creating dashboards |

3. **Attach the frontend** – Convert the dashboard host note to a Render note and set relation `~renderNote=<Task Dashboard HTML noteId>`. Any child dashboards pointing at that render note will display the UI.

4. **Create dashboards** – For each dashboard note:
   - Set label `taskDashboard=true`.
   - Paste the template content or customize.
   - Optionally run the sample data script to generate demo boards/tasks.

## Daily Workflow

### Views & Navigation

- **List view** – Default view with multi-select, sortable headers, status tints, and location columns. Toggle via the view switch.
- **Kanban** – Drag & drop (when manual sorting), column sorting options, column auto-hide, and metadata-rich cards.
- **Calendar** – Month view with previous/next navigation; due tasks are rendered directly into day cells.
- **Overview** – Insight cards (status breakdown, due soon, role summary) derived from the shared dataset.

### Filters & Search

- Search box (debounced) keeps focus after refresh.
- Quick chips: due range (All/Overdue/Today/Next 7 days/No due), pinned toggle, top tags and roles.
- Filter sidebar: depth, status, tags, roles, include descendants, backlog/archived toggles, “updated within” window, etc. Settings persist per dashboard note (`taskHideBacklog`, `taskDueRange`, etc.).

### Quick Add Modal

- Launch from the header “Quick Add” button (keyboard shortcuts are intentionally disabled to avoid conflicts).
- **Single** tab: title, description, status, due, priority, tags, roles.
- **Multiple** tab: paste one task per line (`Title` or `Title: description`) and apply shared metadata to all.
- Token inputs support suggestions, dedupe, and commit on blur/enter.

### Bulk Operations (List View)

- Checkbox column with optional Shift-click range selection; everything can be managed via the UI (no global keyboard shortcuts enabled by default).
- Bulk bar surfaces selection insights (count, earliest due, pinned count, top statuses) and actions:
  - Status, priority, due date set/clear, pin/unpin.
  - Add/remove tags or roles incrementally (no need to overwrite existing values).
- Clear selection at any time via the toolbar button or master checkbox toggle.
- Backend `bulkUpdateTasks` ensures status logs, due dates, tags, and roles stay consistent.

### Kanban Enhancements

- Toolbar controls sort strategy (Priority/Due/Last changed/Title/Manual) and column visibility.
- Hidden statuses (filtered) and collapsed empty columns are reported via pills.
- Cards show title, due badge, priority chip, last-changed pill, location line with icon, role chips, and capped tag badges (`+N`). Tooltips summarize status, due, roles, tags, and last change.

### Status History & Insights

- Every status change appends to `taskStatusLog` and updates `taskStatusChangedAt`.
- List/Kanban display relative “last changed” badges; detail drawer includes a timeline with absolute timestamps.
- Baseline insights (`computeInsights`) power the overview cards and quick-chip suggestions.

## Extensibility Tips

- Utilities expose `STATUS_ORDER`, filtering/sorting helpers, and insights – extend there before changing frontend logic.
- Backend merges tag/role arrays via `normalizeStringSet` and supports additive/removal sets (`tagsAdd`, `tagsRemove`, etc.).
- Frontend renders theme colours through CSS custom properties; keep new classes aligned with existing design tokens.
- Dashboard configs persist depth, view, and filter preferences via labels. Use `task-service-backend.saveDashboardConfig` if you add fields.

## Contributing

- File additional enhancements as PRs accompanied by documentation updates (README & `AGENTS.MD`).
- Use the sample data script for demos while ensuring production environments rely on real task trees.
- Each feature that modifies task metadata should continue to route through backend actions (`handleUpdateTask`, `handleBulkUpdateTasks`) to retain status logging and tagging guarantees.

Happy tasking!
