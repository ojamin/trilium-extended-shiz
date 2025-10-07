# Habit Dashboard · Customization & Theming

The Habit Dashboard inherits Trilium’s active theme and exposes additional CSS variables for fine tuning. This guide explains how to tweak the look & feel without breaking updates.

## Theme Variables
The root `.habit-dashboard` element defines local variables that map to Trilium tokens:

| Variable | Description | Default Mapping |
| --- | --- | --- |
| `--hd-surface` | Primary card background | `--card-background-color` |
| `--hd-border` | Default border colour | `--card-border-color` |
| `--hd-foreground` | Primary text colour | `--detail-font-color` |
| `--hd-foreground-muted` | Secondary text | `--muted-text-color` |
| `--hd-accent` / `--hd-info` | Accent colour used for icons/badges | `--link-color` |
| `--hd-positive` / `--hd-warning` / `--hd-critical` | Semantically positive/alert/danger colours | `--success-color`, `--warning-color`, `--danger-color` |
| `--hd-chip-*` | Pill backgrounds/borders/text | Button tokens |
| `--hd-shadow-*` | Predefined shadow strengths | Derived using `color-mix` |

Override them at the dashboard note level by attaching a CSS note:

```css
/* Example: soften card borders */
.habit-dashboard[data-note-id="NOTE-ID-HERE"] {
  --hd-border: color-mix(in srgb, var(--pane-border-color) 40%, transparent);
  --hd-foreground: #263238;
}
```

> Replace `NOTE-ID-HERE` with the dashboard note’s ID (visible in the URL bar or note toolbar).

## Layout Tweaks
- `.habit-dashboard__summary-card` controls the two-line layout in multi-day views. Adjust `grid-template-rows` or `gap` to change density.
- `.habit-dashboard--compact` is applied when compact mode is enabled. You can further reduce spacing by targeting `.habit-dashboard--compact .habit-dashboard__summary-card`.
- Progress ring size is set via `--habit-dashboard-ring-size` (default 68px). Lower it for very dense dashboards:

```css
.habit-dashboard {
  --habit-dashboard-ring-size: 56px;
}
```

## Habit-Level Customization
- Accent colour and icon are configured per habit in the editor. The accent feeds card borders, chips, and hover states.
- To add more preset colours, extend the swatch array inside `buildColorField` (search for `const swatches = [...]`).

## Celebrations & Copy
Victory messages and confetti are emitted through `triggerCelebration`. Update the copy or add new effects in `habit-dashboard.js` (search for `CELEBRATIONS`). When adjusting, keep success/failure feedback consistent so users know what triggered the celebration.

## Debug Mode Styling
When the `habitDebug` label is present, an extra `.habit-dashboard__streak-debug` block appears under cards. Style it via:

```css
.habit-dashboard__streak-debug {
  font-family: var(--monospace-font-family, monospace);
  font-size: 12px;
  white-space: pre-wrap;
}
```

## Accessibility Considerations
- Ensure any custom colours maintain WCAG contrast. The default theme variables already align with Trilium’s accessibility guidelines.
- Keep focus styles visible. The default controls inherit Trilium’s focus ring; avoid overriding outline unless you supply an alternative.
