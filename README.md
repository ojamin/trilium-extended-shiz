# Trilium Extended Dashboards

## Disclaimer

The code in this repository is provided "as is", without warranty of any kind, express or implied. Use at your own risk, please ensure you backup your data before running anything.

Each of the dashboards should be entirely self contained and shouldn't touch any notes outside of the ones it creates/are in its tree structure below the render notes you setup the dashboards to work with, but backups are good practice regardless!

## Overview

These scripts exist because I wanted something that fitted inside Trilium, worked with its sync system, is fully featured and has an easy UX flow. They will continue to evolve and improve over time, but they are already very usable/stable.

Thoughts, feedback and ideas are welcome. There are a few known small issues, but in general everything works really well with both dashboards in use daily running several habit and task dashboards with lots of items.

There are still a few responsive refinements needed, but everything is usable on desktop and mobile (browser and Trilium desktop app).

## Projects

This repository collects custom dashboards, scripts, and helpers designed for [Trilium Next Notes](https://github.com/TriliumNext/Trilium). It currently ships two projects:

- **Habit Dashboard** (`habits/`) – A streak-driven habit tracker frontend script with rich metadata, rolling summaries, multi-entry support, and per-dashboard data isolation. Full documentation lives in [`habits/README.md`](habits/README.md) with deep dives under `habits/docs/`
- **Task Dashboard** (`task-system/`) – A productivity hub featuring Kanban & List views, quick add modals, bulk edits, calendar/overview modes, status timelines, and advanced filtering. See [`task-system/README.md`](task-system/README.md) for installation and usage

## Contributing

We welcome improvements to both dashboards and the shared documentation. Please update `AGENTS.MD` with any new context so future contributors stay aligned, and keep each directory’s README (and any deep-dive docs) current when behaviour changes.

## Development Notes

When working on the scripts with AI tooling, it really helps with consistency and context to have the Trilium source code available. Clone it into a Trilium directory in the project root and it should be automatically picked up.

## License

This project is licensed under the terms of the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for the full text.
