(() => {
    "use strict";

    const hasWindow = typeof window !== "undefined";
    const globalScope = hasWindow ? window : (typeof globalThis !== "undefined" ? globalThis : (typeof global !== "undefined" ? global : {}));
    const $ = hasWindow ? globalScope.$ : null;
    const runtimeTimers = {
        setTimeout: typeof globalScope.setTimeout === "function" ? globalScope.setTimeout.bind(globalScope) : () => 0,
        clearTimeout: typeof globalScope.clearTimeout === "function" ? globalScope.clearTimeout.bind(globalScope) : () => {},
        setInterval: typeof globalScope.setInterval === "function" ? globalScope.setInterval.bind(globalScope) : () => 0,
        clearInterval: typeof globalScope.clearInterval === "function" ? globalScope.clearInterval.bind(globalScope) : () => {},
        requestAnimationFrame: typeof globalScope.requestAnimationFrame === "function"
            ? globalScope.requestAnimationFrame.bind(globalScope)
            : (cb) => (typeof globalScope.setTimeout === "function" ? globalScope.setTimeout(cb, 16) : 0)
    };

    const apiRef = typeof api !== "undefined" ? api : null;

    function getNoteSafely(apiObj, noteId) {
        if (!apiObj || !noteId) {
            return null;
        }
        try {
            const note = apiObj.getNote(noteId);
            if (!note || note.isDeleted) {
                return null;
            }
            return note;
        } catch (error) {
            return null;
        }
    }

    function hasHabitDashboardRootLabel(note, constants) {
        if (!note || !constants?.labels?.root) {
            return false;
        }
        try {
            return note.getLabelValue(constants.labels.root) === "1";
        } catch (error) {
            return false;
        }
    }

    try {

    const GLOBAL_KEY = "__TN_HABIT_DASHBOARDS__";
    const ACTIONS = Object.freeze({
        ENSURE_STRUCTURE: "ensureStructure",
        SNAPSHOT: "snapshot",
        RANGE_SNAPSHOT: "rangeSnapshot",
        SAVE_ENTRY: "saveEntry",
        DELETE_ENTRIES: "deleteEntries",
        SET_COMPACT: "setCompact",
        SET_SUBENTRY_EXPANSION: "setSubentryExpansion",
        SET_RANGE_ALIGNMENT: "setRangeAlignment",
        CREATE_GROUP: "createGroup",
        UPDATE_GROUP: "updateGroup",
        DELETE_GROUP: "deleteGroup",
        CREATE_HABIT: "createHabit",
        UPDATE_HABIT: "updateHabit",
        DELETE_HABIT: "deleteHabit"
    });

    const CONSTANTS = Object.freeze({
        version: 13,
        labels: {
            root: "habitDashboardRoot",
            role: "habitRole",
            type: "habitType",
            slug: "habitSlug",
            order: "habitOrder",
            archived: "habitArchived",
            entryKey: "habitEntryKey",
            entryValue: "habitValue",
            entrySkip: "habitSkipped",
            compact: "habitCompactMode",
            subentriesExpanded: "habitSubentriesExpanded",
            rangeAlignment: "habitRangeAlignment",
            habitMetaVersion: "habitMetaVersion",
            group: "habitGroup",
            groupOrder: "habitGroupOrder",
            groupColor: "habitGroupColor",
            groupLink: "habitGroupLink",
            debug: "habitDebug"
        },
        relations: {
            habitRef: "habitRef"
        },
        actions: ACTIONS,
        views: ["day", "last7", "last14", "week", "twoWeeks", "month"],
        streakWindowDays: 7,
        streakLookbackDays: 365,
        streakPreseedDays: 60,
        groupDefaults: {
            title: "General",
            color: "#4ba3ff"
        },
        sampleGroups: [
            {
                key: "foundations",
                title: "Daily Foundations",
                color: "#38bdf8",
                order: 0
            },
            {
                key: "body-mind",
                title: "Body & Mind",
                color: "#60dea9",
                order: 10
            },
            {
                key: "focus-growth",
                title: "Focus & Growth",
                color: "#f97316",
                order: 20
            }
        ],
        sampleHabits: [
            {
                title: "Morning Hydration",
                type: "check",
                slug: "morning-hydration",
                description: "Drink at least 500ml of water after waking up.",
                groupKey: "foundations",
                icon: "bx-droplet",
                color: "#38bdf8"
            },
            {
                title: "Mindful Meals",
                type: "check",
                slug: "mindful-meals",
                description: "Log each balanced meal to keep nutrition on track.",
                groupKey: "foundations",
                icon: "bx-bowl-hot",
                multiEntries: true,
                subEntries: [
                    { id: "breakfast", title: "Breakfast" },
                    { id: "lunch", title: "Lunch" },
                    { id: "dinner", title: "Dinner" }
                ]
            },
            {
                title: "Daily Steps",
                type: "count",
                slug: "daily-steps",
                unit: "steps",
                target: 8000,
                description: "Number of steps recorded today.",
                groupKey: "body-mind",
                icon: "bx-walk",
                color: "#60dea9"
            },
            {
                title: "Energy Check-ins",
                type: "rating",
                slug: "energy-check-ins",
                scaleMin: 1,
                scaleMax: 5,
                description: "Morning and evening energy ratings (1-5).",
                groupKey: "body-mind",
                icon: "bx-bolt",
                multiEntries: true,
                subEntries: [
                    { id: "am", title: "Morning" },
                    { id: "pm", title: "Evening" }
                ]
            },
            {
                title: "Deep Work Blocks",
                type: "time",
                slug: "deep-work-blocks",
                unit: "minutes",
                target: 120,
                description: "Two focused sessions to tackle priority work.",
                groupKey: "focus-growth",
                icon: "bx-target-lock",
                quickStep: 30,
                multiEntries: true,
                subEntries: [
                    { id: "am-block", title: "AM Focus" },
                    { id: "pm-block", title: "PM Focus" }
                ]
            },
            {
                title: "Reading Progress",
                type: "value",
                slug: "reading-progress",
                unit: "pages",
                target: 20,
                decimals: 1,
                description: "How many pages did you read today?",
                groupKey: "focus-growth",
                icon: "bx-book-open",
                color: "#f97316"
            }
        ],
        compactLevels: [
            { key: "roomy", label: "Spacious" },
            { key: "compact", label: "Compact" },
            { key: "dense", label: "Dense" },
            { key: "micro", label: "Micro" }
        ]
    });

    const COMPACT_LEVELS_SOURCE = Array.isArray(CONSTANTS.compactLevels) && CONSTANTS.compactLevels.length
        ? CONSTANTS.compactLevels
        : [
            { key: "roomy", label: "Spacious" },
            { key: "compact", label: "Compact" },
            { key: "dense", label: "Dense" },
            { key: "micro", label: "Micro" }
        ];

    const COMPACT_LEVELS = COMPACT_LEVELS_SOURCE.map((level, index) => {
        const normalizedKey = typeof level.key === "string" && level.key.trim().length
            ? level.key.trim().toLowerCase()
            : `level-${index}`;
        const normalizedLabel = typeof level.label === "string" && level.label.trim().length
            ? level.label.trim()
            : (typeof level.key === "string" && level.key.trim().length ? level.key.trim() : `Level ${index + 1}`);
        return {
            value: index,
            key: normalizedKey,
            label: normalizedLabel
        };
    });

    const MAX_COMPACT_LEVEL = Math.max(0, COMPACT_LEVELS.length - 1);

    const COMPACT_LEVEL_LOOKUP = (() => {
        const map = new Map();
        COMPACT_LEVELS.forEach((level) => {
            if (level.key) {
                map.set(level.key, level);
            }
            if (level.label) {
                const labelKey = level.label.trim().toLowerCase();
                if (labelKey && !map.has(labelKey)) {
                    map.set(labelKey, level);
                }
            }
        });
        return map;
    })();

    const clampCompactLevelClient = (level) => {
        if (!Number.isFinite(level)) {
            return 0;
        }
        return Math.min(MAX_COMPACT_LEVEL, Math.max(0, Math.round(level)));
    };

    const normalizeCompactLevelClient = (value) => {
        if (typeof value === "number" && Number.isFinite(value)) {
            return clampCompactLevelClient(value);
        }
        if (typeof value === "boolean") {
            return value ? 1 : 0;
        }
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed.length) {
                return 0;
            }
            if (/^-?\d+$/.test(trimmed)) {
                return clampCompactLevelClient(parseInt(trimmed, 10));
            }
            const mapped = COMPACT_LEVEL_LOOKUP.get(trimmed.toLowerCase());
            if (mapped) {
                return mapped.value;
            }
            if (trimmed.toLowerCase() === "true") {
                return 1;
            }
            if (trimmed.toLowerCase() === "false") {
                return 0;
            }
        }
        if (value && typeof value === "object") {
            if (typeof value.level === "number") {
                return clampCompactLevelClient(value.level);
            }
            if (typeof value.key === "string") {
                const mapped = COMPACT_LEVEL_LOOKUP.get(value.key.trim().toLowerCase());
                if (mapped) {
                    return mapped.value;
                }
            }
            if (typeof value.enabled === "boolean") {
                return value.enabled ? 1 : 0;
            }
        }
        return 0;
    };

    const LOG_PREFIX = `habit-dashboard/v${CONSTANTS.version}`;

    const DASHBOARD_TEMPLATE = /*html*/`
<div class="habit-dashboard" data-habit-dashboard>
    <style>
        .habit-dashboard,
        .habit-dashboard__modal {
            --hd-surface: var(--card-background-color, var(--accented-background-color, var(--main-background-color, #ffffff)));
            --hd-surface-alt: var(--card-background-hover-color, var(--more-accented-background-color, rgba(0, 0, 0, 0.06)));
            --hd-surface-strong: var(--more-accented-background-color, rgba(0, 0, 0, 0.08));
            --hd-border: var(--card-border-color, var(--main-border-color, #d5dbe6));
            --hd-border-strong: var(--main-border-color, #c3cad6);
            --hd-foreground: var(--detail-font-color, var(--main-text-color, #1f2933));
            --hd-foreground-muted: var(--muted-text-color, rgba(71, 85, 105, 0.85));
            --hd-foreground-soft: var(--muted-text-color, rgba(71, 85, 105, 0.65));
            --hd-accent: var(--link-color, #4ba3ff);
            --hd-info: var(--hd-accent);
            --hd-positive: var(--success-color, #60dea9);
            --hd-warning: var(--warning-color, #ffb453);
            --hd-critical: var(--danger-color, #c95353);
            --hd-color-scheme: var(--color-scheme, light dark);
            --hd-control-bg: var(--input-background-color, var(--hd-surface));
            --hd-control-border: var(--input-border-color, var(--hd-border));
            --hd-control-foreground: var(--input-text-color, var(--hd-foreground));
            --hd-chip-bg: var(--button-background-color, var(--hd-surface-alt));
            --hd-chip-border: var(--button-border-color, var(--hd-border));
            --hd-chip-foreground: var(--button-text-color, var(--hd-foreground));
            --hd-border-soft: color-mix(in srgb, var(--hd-border) 35%, var(--hd-surface) 65%);
            --hd-border-stronger: color-mix(in srgb, var(--hd-border) 65%, var(--hd-surface) 35%);
            --hd-ring-empty: color-mix(in srgb, var(--hd-border) 30%, var(--hd-surface) 70%);
            --hd-positive-bg: color-mix(in srgb, var(--hd-positive) 18%, var(--hd-surface) 82%);
            --hd-positive-border: color-mix(in srgb, var(--hd-positive) 42%, var(--hd-surface) 58%);
            --hd-warning-bg: color-mix(in srgb, var(--hd-warning) 18%, var(--hd-surface) 82%);
            --hd-warning-border: color-mix(in srgb, var(--hd-warning) 45%, var(--hd-surface) 55%);
            --hd-info-bg: color-mix(in srgb, var(--hd-info) 18%, var(--hd-surface) 82%);
            --hd-info-border: color-mix(in srgb, var(--hd-info) 48%, var(--hd-surface) 52%);
            --hd-critical-bg: color-mix(in srgb, var(--hd-critical) 18%, var(--hd-surface) 82%);
            --hd-critical-border: color-mix(in srgb, var(--hd-critical) 48%, var(--hd-surface) 52%);
            --hd-surface-muted: color-mix(in srgb, var(--hd-surface) 92%, var(--hd-foreground) 8%);
            --hd-surface-elevated: color-mix(in srgb, var(--hd-surface) 88%, var(--hd-foreground) 12%);
            --hd-surface-hover: color-mix(in srgb, var(--hd-surface) 94%, var(--hd-foreground) 6%);
            --hd-overlay: color-mix(in srgb, var(--hd-foreground) 72%, transparent);
            --hd-shadow-soft: 0 12px 24px color-mix(in srgb, var(--hd-foreground) 16%, transparent);
            --hd-shadow-medium: 0 12px 32px color-mix(in srgb, var(--hd-foreground) 18%, transparent);
            --hd-shadow-strong: 0 14px 36px color-mix(in srgb, var(--hd-foreground) 24%, transparent);
            --hd-menu-bg: var(--menu-background-color-no-backdrop,
                var(--menu-background-color,
                    var(--hd-surface-elevated, var(--detail-background, #ffffff))));
            --hd-menu-border: var(--menu-border-color, var(--hd-border-soft, rgba(148, 163, 184, 0.45)));
            --hd-menu-foreground: var(--menu-text-color, var(--hd-foreground));
            --hd-menu-foreground-muted: color-mix(in srgb, var(--hd-menu-foreground) 66%, transparent);
            --detail-background: var(--hd-surface);
            --detail-background-alt: var(--hd-surface-alt);
            --detail-foreground: var(--hd-foreground);
            --detail-foreground-muted: var(--hd-foreground-muted);
            --detail-border: var(--hd-border);
            --pane-background-color: var(--hd-surface);
            --pane-background-color-alt: var(--hd-surface-alt);
            --main-foreground-color: var(--hd-foreground);
            --secondary-foreground-color: var(--hd-foreground-muted);
            font-family: var(--detail-font-family, var(--main-font-family));
            font-size: 14px;
            line-height: 1.4;
            color: var(--hd-foreground);
        }

        .habit-dashboard {
            background: transparent;
            display: flex;
            flex-direction: column;
            gap: 12px;
            color-scheme: var(--hd-color-scheme, light dark);
        }

        .habit-dashboard__header {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }

        .habit-dashboard__title {
            font-weight: 600;
            font-size: 15px;
            margin-right: auto;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .habit-dashboard__title::before {
            content: "\\e9b1";
            font-family: "boxicons";
            font-size: 18px;
        }

        .habit-dashboard__controls {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .habit-dashboard select,
        .habit-dashboard__modal select,
        .habit-dashboard input[type="date"],
        .habit-dashboard__modal input[type="date"] {
            background: var(--hd-control-bg);
            color: var(--hd-control-foreground);
            border: 1px solid var(--hd-control-border);
            color-scheme: var(--hd-color-scheme, light dark);
        }

        .habit-dashboard select,
        .habit-dashboard__modal select {
            -webkit-appearance: none;
            appearance: none;
            padding-right: 26px;
            background-image:
                linear-gradient(45deg, transparent 50%, var(--hd-control-foreground) 50%),
                linear-gradient(-45deg, transparent 50%, var(--hd-control-foreground) 50%);
            background-position:
                right 10px center,
                right 5px center;
            background-size: 6px 6px;
            background-repeat: no-repeat;
        }

        .habit-dashboard select::-ms-expand {
            display: none;
        }

        .habit-dashboard__controls button,
        .habit-dashboard__controls input[type="date"],
        .habit-dashboard__controls select {
            background: var(--hd-control-bg);
            color: var(--hd-control-foreground);
            border: 1px solid var(--hd-control-border);
            border-radius: 4px;
            padding: 4px 8px;
            height: 28px;
        }

        .habit-dashboard__controls button {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .habit-dashboard__controls button:hover {
            background: var(--hd-surface-hover, var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9)));
        }

        .habit-dashboard select option,
        .habit-dashboard__modal select option,
        .habit-dashboard select optgroup,
        .habit-dashboard__modal select optgroup {
            background: var(--hd-menu-bg) !important;
            color: var(--hd-menu-foreground) !important;
        }

        .habit-dashboard select option:checked,
        .habit-dashboard select option:hover,
        .habit-dashboard select option:focus,
        .habit-dashboard__modal select option:checked,
        .habit-dashboard__modal select option:hover,
        .habit-dashboard__modal select option:focus {
            background: color-mix(in srgb, var(--hd-accent) 18%, var(--hd-menu-bg) 82%) !important;
            color: var(--hd-menu-foreground) !important;
        }

        .habit-dashboard input[type="date"]::-webkit-calendar-picker-indicator,
        .habit-dashboard__modal input[type="date"]::-webkit-calendar-picker-indicator {
            filter: brightness(0.9);
        }

        .habit-dashboard__action-menu {
            position: relative;
            display: inline-flex;
        }

        .habit-dashboard__menu-trigger {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
        }

        .habit-dashboard__menu-trigger .bx {
            font-size: 18px;
        }

        .habit-dashboard__menu-trigger-label {
            font-size: 12px;
        }

        @media (max-width: 640px) {
            .habit-dashboard__menu-trigger-label {
                display: none;
            }
        }

        .habit-dashboard__action-menu.is-open > .habit-dashboard__menu-trigger,
        .habit-dashboard__action-menu.is-open > .habit-dashboard__menu-trigger:focus-visible {
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
        }

        .habit-dashboard__menu-surface {
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            display: none;
            flex-direction: column;
            padding: 6px;
            background: var(--hd-menu-bg);
            color: var(--hd-menu-foreground);
            border: 1px solid var(--hd-menu-border);
            border-radius: 8px;
            box-shadow: var(--hd-shadow-medium, 0 14px 30px rgba(15, 23, 42, 0.18));
            min-width: 220px;
            z-index: 40;
            gap: 4px;
        }

        .habit-dashboard__action-menu.is-open > .habit-dashboard__menu-surface {
            display: flex;
        }

        .habit-dashboard__menu-surface button {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: none;
            background: none;
            padding: 6px 8px;
            border-radius: 6px;
            height: auto;
            font-size: 12px;
            color: inherit;
        }

        .habit-dashboard__menu-surface button:hover,
        .habit-dashboard__menu-surface button:focus-visible {
            background: color-mix(in srgb, var(--hd-accent) 8%, var(--hd-surface-hover) 92%);
            outline: none;
        }

        .habit-dashboard__menu-surface button.is-disabled {
            opacity: 0.5;
            pointer-events: none;
        }

        .habit-dashboard__menu-item-main {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex: 1;
        }

        .habit-dashboard__menu-item-meta {
            font-size: 11px;
            color: var(--hd-menu-foreground-muted, var(--hd-foreground-muted));
            white-space: nowrap;
        }

        .habit-dashboard__menu-divider {
            height: 1px;
            width: 100%;
            background: var(--hd-border-soft, rgba(148, 163, 184, 0.35));
            margin: 2px 0 4px;
        }

        .habit-dashboard__status {
            font-size: 12px;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #4b5565));
        }

        .habit-dashboard__body {
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 6px;
            overflow: hidden;
        }

        .habit-dashboard__table {
            width: 100%;
            border-collapse: collapse;
        }

        .habit-dashboard__table thead {
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 11px;
        }

        .habit-dashboard__table th,
        .habit-dashboard__table td {
            padding: 8px 10px;
            border-bottom: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            vertical-align: middle;
        }

        .habit-dashboard__table tbody tr:last-child td {
            border-bottom: none;
        }

        .habit-dashboard__group-row {
            --habit-group-color: color-mix(in srgb, var(--hd-info) 45%, transparent);
        }

        .habit-dashboard__group-row td {
            font-weight: 600;
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
            border-bottom: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-left: 4px solid var(--habit-group-color);
        }

        .habit-dashboard__group-row.is-drag-target td {
            box-shadow: inset 0 0 0 2px var(--habit-group-color);
        }

        .habit-dashboard__group-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .habit-dashboard__group-actions button {
            background: transparent;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0 4px;
        }

        .habit-dashboard__habit-name {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .habit-dashboard__habit-name strong {
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .habit-dashboard__habit-meta {
            font-size: 11px;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #4b5565));
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .habit-dashboard__habit {
            border-left: 4px solid var(--habit-row-accent, transparent);
        }

        .habit-dashboard__type-badge {
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .habit-dashboard__control input,
        .habit-dashboard__control select,
        .habit-dashboard__control button {
            background: var(--hd-control-bg);
            color: var(--hd-control-foreground);
            border: 1px solid var(--hd-control-border);
            border-radius: 4px;
            padding: 4px 6px;
            min-width: 60px;
        }

        .habit-dashboard__control input[type="range"] {
            width: 120px;
            padding: 0;
        }

        .habit-dashboard__rating-group {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .habit-dashboard__rating-star-list {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .habit-dashboard__rating-star {
            appearance: none;
            border: none;
            background: transparent;
            color: var(--hd-border-strong, #c3cad6);
            padding: 2px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            cursor: pointer;
            transition: transform 0.12s ease, color 0.12s ease, background 0.12s ease;
        }

        .habit-dashboard__rating-star .habit-dashboard__rating-icon {
            font-size: 20px;
            line-height: 1;
        }

        .habit-dashboard__rating-star:is(:hover, :focus-visible) {
            background: color-mix(in srgb, var(--hd-warning) 18%, transparent);
            color: var(--hd-warning, #ffb453);
            transform: translateY(-1px);
        }

        .habit-dashboard__rating-star.is-active {
            color: var(--hd-warning, #ffb453);
        }

        .habit-dashboard__rating-star.is-active .habit-dashboard__rating-icon {
            color: var(--hd-warning, #ffb453);
        }

        .habit-dashboard__rating-star:focus-visible {
            outline: 2px solid color-mix(in srgb, var(--hd-warning) 55%, transparent);
            outline-offset: 2px;
        }

        .habit-dashboard__rating-star[disabled] {
            cursor: not-allowed;
            opacity: 0.6;
        }

        .habit-dashboard__rating-value {
            font-size: 12px;
            color: var(--secondary-foreground-color, #4b5565);
            min-width: 48px;
            text-align: right;
        }

        .habit-dashboard__row-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }

        .habit-dashboard__row-actions button {
            padding: 4px 10px;
            border-radius: 4px;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            cursor: pointer;
        }

        .habit-dashboard__row-actions button:hover {
            background: var(--pane-background-color-alt, #e6ebf5);
        }

        @media (max-width: 780px) {
            .habit-dashboard__row-actions {
                flex-direction: column;
                align-items: stretch;
            }

            .habit-dashboard__row-actions > * {
                width: 100%;
            }
        }

        .habit-dashboard__value-display {
            font-size: 12px;
            color: var(--secondary-foreground-color, #4b5565);
        }

        .habit-dashboard__row--skipped {
            opacity: 0.6;
        }

        .habit-dashboard__row--dirty .habit-dashboard__value-display::after {
            content: " • unsaved";
            color: var(--accent, #ffb347);
        }

        .habit-dashboard__row[draggable='true'] {
            cursor: grab;
        }

        .habit-dashboard__row.is-dragging {
            opacity: 0.55;
        }

        .habit-dashboard__row.is-drag-over {
            outline: 2px dashed var(--habit-row-accent, var(--accent, #4ba3ff));
        }

        .habit-dashboard__row.is-celebrating {
            animation: habit-dashboard-row-celebrate 0.7s ease-in-out;
        }

        .habit-dashboard__range-cell {
            padding: 0;
            min-width: 72px;
            text-align: center;
        }

        .habit-dashboard__range-button {
            width: 100%;
            height: 100%;
            min-height: 36px;
            background: transparent;
            border: none;
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            cursor: pointer;
            padding: 6px 4px;
            transition: background 0.15s ease, transform 0.1s ease;
        }

        .habit-dashboard__range-button:hover {
            background: color-mix(in srgb, var(--hd-info) 14%, transparent);
        }

        .habit-dashboard__range-button:active {
            transform: translateY(1px);
        }

        .habit-dashboard__range-button.is-skipped {
            color: var(--hd-warning);
        }

        .habit-dashboard__range-button.is-empty {
            opacity: 0.6;
        }

        .habit-dashboard__range-button.is-complete {
            color: var(--hd-positive);
        }

        .habit-dashboard__range-button.is-target-met::before {
            content: "★";
            font-size: 11px;
            color: var(--hd-info);
        }

        .habit-dashboard__range-button.is-missed {
            color: var(--hd-critical);
        }

        .habit-dashboard__range-summary-cell {
            font-size: 12px;
            color: var(--secondary-foreground-color, #4b5565);
            min-width: 160px;
        }

        .habit-dashboard__empty {
            padding: 16px;
            text-align: center;
            font-size: 13px;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #4b5565));
            display: none;
        }

        .habit-dashboard__empty a {
            color: var(--accent, #4ba3ff);
        }

        .habit-dashboard.is-compact .habit-dashboard__table td,
        .habit-dashboard.is-compact .habit-dashboard__table th {
            padding: 4px 6px;
        }

        .habit-dashboard.is-compact .habit-dashboard__habit-meta {
            display: none;
        }

        .habit-dashboard.is-compact .habit-dashboard__range-summary {
            gap: 6px;
        }

        .habit-dashboard.is-compact .habit-dashboard__range-header {
            padding: 6px 10px;
            font-size: 12px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-group {
            padding: 8px;
            gap: 6px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-card {
            padding: 6px 8px;
            gap: 4px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-metric {
            font-size: 10px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-dates {
            gap: 3px;
            margin-top: 3px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-dates-row {
            gap: 4px;
            margin-top: 2px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-subentry-toggle {
            gap: 4px;
            font-size: 11px;
        }

        .habit-dashboard.is-compact .habit-dashboard__summary-subentry-chips .habit-dashboard__date-chip {
            font-size: 9px;
            padding: 2px 5px;
        }

        .habit-dashboard.is-compact .habit-dashboard__date-chip {
            padding: 2px 6px;
            font-size: 10px;
        }

        .habit-dashboard.is-compact .habit-dashboard__range-button {
            min-height: 26px;
            padding: 3px 2px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__table td,
        .habit-dashboard.is-compact-level-2 .habit-dashboard__table th {
            padding: 3px 4px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-group {
            padding: 6px;
            gap: 4px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-card {
            padding: 5px 6px;
            gap: 3px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-metric {
            font-size: 9.5px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-dates {
            gap: 2px;
            margin-top: 2px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-dates-row {
            gap: 3px;
            margin-top: 1px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__date-chip {
            padding: 1.5px 5px;
            font-size: 9px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-subentry-chips .habit-dashboard__date-chip {
            font-size: 8.5px;
            padding: 1px 4px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__range-header {
            padding: 5px 8px;
            font-size: 11px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__range-summary {
            gap: 5px;
        }

        .habit-dashboard.is-compact-level-2 .habit-dashboard__summary-subentry-toggle {
            font-size: 10px;
            gap: 3px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__table td,
        .habit-dashboard.is-compact-level-3 .habit-dashboard__table th {
            padding: 2px 3px;
            font-size: 11px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-group {
            padding: 4px;
            gap: 3px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-card {
            padding: 4px 5px;
            gap: 2px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-metric {
            font-size: 9px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-dates {
            gap: 1px;
            margin-top: 1px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-dates-row {
            gap: 2px;
            margin-top: 0;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__date-chip {
            padding: 1px 4px;
            font-size: 8px;
            min-width: 24px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-subentry-chips .habit-dashboard__date-chip {
            font-size: 7.5px;
            padding: 1px 3px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__range-header {
            padding: 4px 6px;
            font-size: 10px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__range-summary {
            gap: 4px;
        }

        .habit-dashboard.is-compact-level-3 .habit-dashboard__summary-subentry-toggle {
            font-size: 9.5px;
            gap: 2px;
        }

        .habit-dashboard__legend {
            font-size: 11px;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #4b5565));
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }

        .habit-dashboard__legend span::before {
            content: "•";
            margin-right: 4px;
            color: var(--accent, #4ba3ff);
        }

        .habit-dashboard__inactive {
            align-items: center;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #5f6b7a));
            display: flex;
            justify-content: center;
            min-height: 8rem;
            padding: 2rem 1rem;
            text-align: center;
        }

        .habit-dashboard__inactive p {
            font-size: 1rem;
            line-height: 1.5;
            margin: 0;
            max-width: 24rem;
        }

        .habit-dashboard__range-summary {
            display: none;
            margin-top: 6px;
            gap: 10px;
            flex-direction: column;
            width: 100%;
        }

        .habit-dashboard__range-summary.is-visible {
            display: flex;
        }

        .habit-dashboard__range-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 9px;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
            font-size: 13px;
            font-weight: 600;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__summary-card {
            position: relative;
            --habit-accent: var(--accent, var(--hd-info));
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-left: 4px solid var(--habit-accent);
            border-radius: 9px;
            padding: 6px 12px;
            min-height: 48px;
            min-width: 0;
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--habit-accent) 18%, transparent);
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__summary-card[draggable='true'] {
            cursor: grab;
        }

        .habit-dashboard__summary-card.is-dragging {
            opacity: 0.65;
        }

        .habit-dashboard__summary-card.is-drag-over {
            border-color: var(--habit-accent, var(--hd-info));
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--habit-accent) 35%, transparent);
        }

        .habit-dashboard__summary-card.is-celebrating {
            animation: habit-dashboard-card-celebrate 0.8s ease-in-out;
        }

        .habit-dashboard__summary-card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(120deg,
                    color-mix(in srgb, var(--hd-positive) 12%, transparent),
                    color-mix(in srgb, var(--habit-accent) 12%, transparent));
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }

        .habit-dashboard__summary-card:hover::after {
            opacity: 1;
        }

        .habit-dashboard__summary-content {
            flex: 1;
            display: grid;
            grid-template-rows: 1fr 1fr;
            align-items: center;
            gap: 2px;
            min-width: 0;
        }

        .habit-dashboard__summary-main {
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            gap: 5px;
            min-width: 0;
        }

        .habit-dashboard__summary-info {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
            flex: 1;
            flex-wrap: nowrap;
        }

        .habit-dashboard__summary-heading {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            font-size: 12px;
        }

        .habit-dashboard__summary-heading .bx {
            font-size: 15px;
        }

        .habit-dashboard__summary-title {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
        }

        .habit-dashboard__summary-stat {
            font-size: 12px;
            color: var(--detail-foreground-muted, var(--secondary-foreground-color, #4b5565));
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .habit-dashboard__summary-badges {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__summary-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            border-radius: 999px;
            background: var(--hd-positive-bg);
            border: 1px solid var(--hd-positive-border);
            font-weight: 600;
        }

        .habit-dashboard__summary-badge--streak {
            background: var(--hd-warning-bg);
            border-color: var(--hd-warning-border);
        }

        .habit-dashboard__summary-badge--perfect {
            background: var(--hd-info-bg);
            border-color: var(--hd-info-border);
        }

        .habit-dashboard__progress-circle {
            width: 48px;
            min-width: 48px;
            height: 48px;
            border-radius: 50%;
            background: conic-gradient(var(--habit-accent, var(--hd-info)) calc(var(--habit-progress, 0) * 1%), var(--hd-ring-empty) 0);
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__progress-circle::after {
            content: "";
            position: absolute;
            inset: 6px;
            border-radius: 50%;
            background: var(--detail-background, var(--pane-background-color, #ffffff));
        }

        .habit-dashboard__progress-circle-label {
            position: relative;
            z-index: 1;
        }

        .habit-dashboard__summary-group {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-left: 4px solid var(--habit-group-color, color-mix(in srgb, var(--hd-info) 55%, transparent));
            border-radius: 9px;
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hd-info) 12%, transparent);
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__summary-group.is-drag-target {
            box-shadow: 0 0 0 2px var(--habit-group-color, color-mix(in srgb, var(--hd-info) 55%, transparent));
        }

        .habit-dashboard__summary-group .habit-dashboard__group-header {
            margin-bottom: 4px;
            font-size: 13px;
            font-weight: 600;
        }

        .habit-dashboard__summary-actions {
            display: flex;
            gap: 6px;
            align-items: center;
            margin-left: auto;
        }

        .habit-dashboard__summary-actions button {
            background: transparent;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 4px;
            padding: 2px 6px;
            height: 26px;
            min-width: 26px;
            color: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .habit-dashboard__summary-actions button span {
            line-height: 1;
        }

        .habit-dashboard__summary-subentry-section {
            margin-top: 6px;
            border-top: 1px solid var(--hd-border-soft);
            padding-top: 6px;
        }

        .habit-dashboard__summary-subentry-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: none;
            background: none;
            color: inherit;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
            padding: 0;
            margin: 0;
        }

        .habit-dashboard__summary-subentry-toggle:hover,
        .habit-dashboard__summary-subentry-toggle:focus-visible {
            color: var(--hd-accent);
        }

        .habit-dashboard__summary-subentry-toggle:focus-visible {
            outline: 2px solid color-mix(in srgb, var(--hd-accent) 45%, transparent);
            outline-offset: 2px;
        }

        .habit-dashboard__summary-toggle-icon {
            font-size: 16px;
            transition: transform 0.2s ease;
        }

        .habit-dashboard__summary-subentry-toggle.is-expanded .habit-dashboard__summary-toggle-icon {
            transform: rotate(90deg);
        }

        .habit-dashboard__summary-subentry-section.is-collapsed .habit-dashboard__summary-subentry-list {
            display: none;
        }

        .habit-dashboard__summary-subentry-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 6px;
        }

        .habit-dashboard__summary-subentry-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas:
                "title average"
                "chips chips";
            row-gap: 4px;
            column-gap: 8px;
            font-size: 11px;
            color: var(--hd-foreground-muted);
            align-items: center;
        }

        .habit-dashboard__summary-subentry-title {
            grid-area: title;
            font-weight: 600;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            min-width: 0;
        }

        .habit-dashboard__summary-subentry-average {
            grid-area: average;
            white-space: nowrap;
            color: var(--hd-foreground-muted);
            margin-right: 0;
            justify-self: end;
        }

        .habit-dashboard__summary-subentry-chips {
            grid-area: chips;
            display: flex;
            flex-wrap: nowrap;
            gap: 4px;
            overflow-x: auto;
            scrollbar-width: thin;
            justify-content: flex-start;
            min-width: 0;
            width: 100%;
        }

        .habit-dashboard__summary-subentry-chips .habit-dashboard__date-chip {
            font-size: 10px;
            padding: 2px 6px;
            cursor: pointer;
        }

        @media (max-width: 900px) {
            .habit-dashboard__summary-card {
                padding: 6px 10px;
                gap: 8px;
            }

            .habit-dashboard__progress-circle {
                width: 40px;
                min-width: 40px;
                height: 40px;
            }

            .habit-dashboard__summary-actions {
                gap: 4px;
            }
        }

        @media (max-width: 600px) {
            .habit-dashboard__summary-card {
                flex-direction: column;
                gap: 6px;
            }

            .habit-dashboard__summary-content {
                display: flex;
                flex-direction: column;
                min-height: auto;
                gap: 4px;
            }

            .habit-dashboard__summary-main {
                flex-wrap: wrap;
                align-items: flex-start;
            }

            .habit-dashboard__progress-circle {
                display: none;
            }

            .habit-dashboard__summary-actions {
                width: 100%;
                justify-content: flex-start;
                margin-left: 0;
            }

            .habit-dashboard__summary-dates {
                flex-wrap: wrap;
                overflow: visible;
                margin-top: 2px;
            }

            .habit-dashboard__summary-dates-row {
                flex-wrap: wrap;
                gap: 4px;
            }

        }

        @media (max-width: 420px) {
            .habit-dashboard__header {
                flex-direction: column;
                align-items: flex-start;
                gap: 6px;
            }

            .habit-dashboard__controls {
                flex-wrap: wrap;
                width: 100%;
            }

            .habit-dashboard__controls button,
            .habit-dashboard__controls select,
            .habit-dashboard__controls input[type="date"] {
                width: 100%;
            }
        }

        .habit-dashboard__multi-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin: 6px 0;
        }

        .habit-dashboard__multi-item {
            display: flex;
            align-items: center;
            gap: 6px;
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 6px;
            padding: 4px 6px;
        }

        .habit-dashboard__multi-item.is-active {
            border-color: var(--hd-info);
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--hd-info) 35%, transparent);
        }

        .habit-dashboard__multi-label {
            flex: 1;
            font-size: 11px;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
        }

        .habit-dashboard__multi-action {
            border: none;
            background: transparent;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            cursor: pointer;
            padding: 2px 4px;
        }

        .habit-dashboard__multi-add {
            border: 1px dashed var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: transparent;
            color: var(--accent, #4ba3ff);
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
        }

        .habit-dashboard__modal {
            position: fixed;
            inset: 0;
            background: color-mix(in srgb, var(--modal-backdrop-color, var(--hd-overlay)) 40%, transparent);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            overflow-y: auto;
            z-index: 999;
        }

        .habit-dashboard__modal-content {
            background: var(--modal-background-color,
                var(--hd-surface-elevated, var(--detail-background, var(--pane-background-color, #ffffff))));
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 10px;
            padding: 20px;
            width: min(600px, 92vw);
            max-width: 680px;
            max-height: min(90vh, 720px);
            overflow-y: auto;
            box-shadow: var(--hd-shadow-medium);
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        @media (max-height: 620px) {
            .habit-dashboard__modal {
                align-items: flex-start;
            }
        }

        @media (max-width: 640px) {
            .habit-dashboard__modal {
                padding: 16px;
            }

            .habit-dashboard__modal-content {
                width: min(560px, 96vw);
                padding: 18px;
            }
        }

        .habit-dashboard__modal-content h3 {
            margin: 0;
            font-size: 16px;
        }

        .habit-dashboard__form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
        }

        .habit-dashboard__form-grid--subentries {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .habit-dashboard__form-field--subentry {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--hd-border-soft);
            background: var(--hd-surface-muted, var(--hd-surface));
        }

        .habit-dashboard__form-field--subentry .habit-dashboard__subentry-control {
            margin-top: 4px;
        }

        .habit-dashboard__form-field--subentry input.is-disabled {
            opacity: 0.6;
        }

        .habit-dashboard__toggle {
            align-self: flex-start;
            border: 1px solid var(--hd-border-soft);
            background: var(--hd-surface);
            border-radius: 16px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: var(--hd-foreground-muted);
            cursor: pointer;
            transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .habit-dashboard__toggle:hover,
        .habit-dashboard__toggle:focus-visible {
            border-color: var(--hd-accent);
        }

        .habit-dashboard__toggle.is-active {
            background: var(--hd-info-bg);
            border-color: var(--hd-info-border);
            color: var(--hd-info-foreground, var(--detail-foreground, #1f2933));
        }

        .habit-dashboard__toggle--skip.is-active {
            background: var(--hd-warning-bg);
            border-color: var(--hd-warning-border);
            color: var(--hd-warning-foreground, var(--detail-foreground, #1f2933));
        }

        .habit-dashboard__form-grid label {
            display: flex;
            flex-direction: column;
            font-size: 12px;
            gap: 4px;
        }

        .habit-dashboard__form-grid label.habit-dashboard__form-field--full {
            grid-column: 1 / -1;
        }

        .habit-dashboard__form-field--inline {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }

        .habit-dashboard__form-field--inline > span {
            font-weight: 600;
        }

        .habit-dashboard__form-grid input,
        .habit-dashboard__form-grid select,
        .habit-dashboard__form-grid textarea {
            background: var(--hd-control-bg);
            color: var(--hd-control-foreground);
            border: 1px solid var(--hd-control-border);
            border-radius: 4px;
            padding: 6px 8px;
            color-scheme: var(--hd-color-scheme, light dark);
        }

        .habit-dashboard__form-grid textarea {
            min-height: 72px;
            resize: vertical;
        }

        .habit-dashboard__subentry-config-section {
            border: 1px solid var(--hd-border-soft);
            border-radius: 8px;
            padding: 12px;
            margin-top: 8px;
            background: var(--hd-surface-muted, var(--hd-surface));
            grid-column: 1 / -1;
        }

        .habit-dashboard__subentry-config-section legend {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .habit-dashboard__subentry-config-help {
            font-size: 12px;
            color: var(--hd-foreground-muted);
            margin-bottom: 8px;
        }

        .habit-dashboard__subentry-config-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .habit-dashboard__subentry-config {
            display: grid;
            grid-template-columns: minmax(120px, 1fr) minmax(180px, 1.5fr) auto;
            align-items: center;
            gap: 8px;
            padding: 10px;
            border: 1px solid var(--hd-border-soft);
            border-radius: 6px;
            background: var(--hd-surface);
        }

        .habit-dashboard__subentry-field {
            width: 100%;
            display: flex;
            align-items: center;
        }

        .habit-dashboard__subentry-config input[type="text"] {
            min-width: 0;
            width: 100%;
        }

        .habit-dashboard__subentry-config-id {
            max-width: 220px;
        }

        .habit-dashboard__subentry-config-title {
            max-width: 100%;
        }

        .habit-dashboard__subentry-required {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--hd-foreground-muted);
        }

        .habit-dashboard__subentry-config-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            justify-self: end;
        }

        @media (max-width: 640px) {
            .habit-dashboard__subentry-config {
                grid-template-columns: 1fr;
            }

            .habit-dashboard__subentry-config-actions {
                justify-self: start;
            }
        }

        .habit-dashboard__subentry-add {
            margin-top: 10px;
        }

        .habit-dashboard__subentry-control {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-right: 8px;
        }

        .habit-dashboard__color-field {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }

        .habit-dashboard__color-input {
            flex: 0 0 38px;
            width: 38px;
            height: 28px;
            padding: 0;
            border-radius: 4px;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: transparent;
        }

        .habit-dashboard__color-input.is-empty {
            background-image: repeating-conic-gradient(var(--pane-border-color, #d5dbe6) 0% 25%, transparent 0% 50%);
            background-size: 10px 10px;
        }

        .habit-dashboard__color-text {
            flex: 1;
        }

        .habit-dashboard__color-swatches {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .habit-dashboard__color-swatch {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: var(--habit-color-swatch, #4ba3ff);
            cursor: pointer;
            padding: 0;
        }

        .habit-dashboard__color-reset {
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 4px;
            background: transparent;
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            padding: 4px 8px;
            cursor: pointer;
        }

        .habit-dashboard__toast-container {
            position: fixed;
            top: 20px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 3000;
            pointer-events: none;
        }

        .habit-dashboard__toast {
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 6px;
            padding: 8px 12px;
            box-shadow: var(--hd-shadow-soft);
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .habit-dashboard__toast.is-visible {
            opacity: 1;
            transform: translateY(0);
        }

        .habit-dashboard__celebration {
            position: absolute;
            inset: 0;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }

        .habit-dashboard__celebration-message {
            background: var(--hd-overlay);
            color: #fff;
            padding: 14px 22px;
            border-radius: 999px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: var(--hd-shadow-strong);
            display: inline-flex;
            align-items: center;
            gap: 10px;
            animation: habit-dashboard-celebration-pop 0.6s ease;
        }

        .habit-dashboard__confetti {
            position: absolute;
            width: 10px;
            height: 16px;
            opacity: 0;
            border-radius: 2px;
            animation: habit-dashboard-confetti-fall 1.2s ease-out forwards;
        }

        @keyframes habit-dashboard-row-celebrate {
            0% { transform: scale(1); box-shadow: none; }
            40% { transform: scale(1.02); box-shadow: 0 0 0 2px color-mix(in srgb, var(--hd-positive) 60%, transparent); }
            100% { transform: scale(1); box-shadow: none; }
        }

        @keyframes habit-dashboard-card-celebrate {
            0% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
            60% { transform: translateY(2px); }
            100% { transform: translateY(0); }
        }

        @keyframes habit-dashboard-confetti-fall {
            0% { transform: translateY(-10%) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }

        @keyframes habit-dashboard-celebration-pop {
            0% { transform: scale(0.8); opacity: 0; }
            60% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        .habit-dashboard__form-actions {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 8px;
        }

        .habit-dashboard__form-actions button {
            padding: 6px 12px;
            border-radius: 4px;
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            cursor: pointer;
        }

        .habit-dashboard__form-actions button:hover {
            background: var(--detail-background-alt, var(--pane-background-color-alt, #f1f5f9));
        }

        @media (max-width: 520px) {
            .habit-dashboard__form-grid {
                grid-template-columns: 1fr;
            }
        }

        .habit-dashboard__summary-dates {
            display: flex;
            flex-wrap: nowrap;
            gap: 4px;
            margin-top: 0;
            align-items: center;
            overflow-x: auto;
            scrollbar-width: thin;
        }

        .habit-dashboard__summary-dates-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            min-width: 0;
        }

        .habit-dashboard__summary-dates-row .habit-dashboard__summary-dates {
            flex: 1 1 auto;
            min-width: 0;
        }

        .habit-dashboard--align-dates .habit-dashboard__summary-dates,
        .habit-dashboard--align-dates .habit-dashboard__summary-subentry-chips {
            display: grid;
            grid-template-columns: var(--hd-range-date-template, repeat(1, minmax(0, 1fr)));
            gap: 6px;
            overflow: visible;
        }

        .habit-dashboard.is-compact.habit-dashboard--align-dates .habit-dashboard__summary-dates,
        .habit-dashboard.is-compact.habit-dashboard--align-dates .habit-dashboard__summary-subentry-chips {
            gap: 4px;
        }

        .habit-dashboard--align-dates .habit-dashboard__summary-dates-row {
            width: 100%;
        }

        .habit-dashboard--align-dates .habit-dashboard__summary-dates .habit-dashboard__date-chip,
        .habit-dashboard--align-dates .habit-dashboard__summary-subentry-chips .habit-dashboard__date-chip {
            width: 100%;
            justify-self: stretch;
        }

        .habit-dashboard__streak-debug {
            font-size: 11px;
            color: var(--hd-foreground-muted);
            margin-top: 4px;
            word-break: break-word;
        }

        .habit-dashboard__date-chip {
            border: 1px solid var(--detail-border, var(--pane-border-color, #d5dbe6));
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
            background: var(--detail-background, var(--pane-background-color, #ffffff));
            color: var(--detail-foreground, var(--main-foreground-color, #1f2933));
            cursor: pointer;
        }

        .habit-dashboard__date-chip.is-complete {
            background: var(--hd-positive-bg);
            border-color: var(--hd-positive-border);
        }

        .habit-dashboard__date-chip.is-skipped {
            background: var(--hd-warning-bg);
            border-color: var(--hd-warning-border);
        }

        .habit-dashboard__date-chip.is-empty {
            opacity: 0.6;
        }

        .habit-dashboard__date-chip.is-target-met {
            background: var(--hd-info-bg);
            border-color: var(--hd-info-border);
        }

        .habit-dashboard__date-chip.is-missed {
            background: var(--hd-critical-bg);
            border-color: var(--hd-critical-border);
        }

        .habit-dashboard__date-chip.is-current-day {
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--hd-info) 45%, transparent);
            font-weight: 600;
        }

        .habit-dashboard__date-chip.is-today {
            border-style: dashed;
        }
    </style>

    <div class="habit-dashboard__header">
        <div class="habit-dashboard__title">Habit Dashboard</div>
        <div class="habit-dashboard__controls" data-role="date-controls">
            <button type="button" data-action="go-previous" title="Previous"><span class="bx bx-chevron-left"></span></button>
            <button type="button" data-action="go-today">Today</button>
            <button type="button" data-action="go-next" title="Next"><span class="bx bx-chevron-right"></span></button>
            <input type="date" data-action="pick-date" />
            <select data-action="change-view" aria-label="Range view">
                <option value="day">Day</option>
                <option value="last7">Last 7 Days</option>
                <option value="last14">Last 14 Days</option>
                <option value="week">Week</option>
                <option value="twoWeeks">Two Weeks</option>
                <option value="month">Month</option>
            </select>
            <div class="habit-dashboard__action-menu" data-role="action-menu">
                <button type="button" class="habit-dashboard__menu-trigger" data-action="toggle-menu" aria-haspopup="true" aria-expanded="false" aria-controls="habit-dashboard-menu">
                    <span class="bx bx-dots-vertical-rounded" aria-hidden="true"></span>
                    <span class="habit-dashboard__menu-trigger-label">Menu</span>
                </button>
                <div class="habit-dashboard__menu-surface" id="habit-dashboard-menu" data-role="menu-surface" role="menu">
                    <button type="button" data-action="go-current-week" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-calendar-week" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">This Week</span>
                        </span>
                    </button>
                    <button type="button" data-action="toggle-compact" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-dock-right" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">Compact Mode</span>
                        </span>
                        <span class="habit-dashboard__menu-item-meta" data-role="compact-label">Spacious</span>
                    </button>
                    <button type="button" data-action="toggle-range-align" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-grid-alt" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">Align Day Columns</span>
                        </span>
                    </button>
                    <button type="button" data-action="toggle-subentry-rows" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-collapse" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">Collapse Sub-entries</span>
                        </span>
                    </button>
                    <div class="habit-dashboard__menu-divider" role="separator"></div>
                    <button type="button" data-action="refresh" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-refresh" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">Refresh Data</span>
                        </span>
                    </button>
                    <button type="button" data-action="add-group" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-folder-plus" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">New Group</span>
                        </span>
                    </button>
                    <button type="button" data-action="add-habit" role="menuitem">
                        <span class="habit-dashboard__menu-item-main" data-role="menu-item-main">
                            <span class="bx bx-plus" data-role="menu-item-icon"></span>
                            <span data-role="menu-item-label">New Habit</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="habit-dashboard__status" data-role="status-line">Synchronising…</div>

    <div class="habit-dashboard__body">
        <div class="habit-dashboard__empty" data-role="empty-state">
            No habits yet. Add them to the <strong>Habits</strong> book that lives under this dashboard to make them appear here.
        </div>
        <table class="habit-dashboard__table" data-role="grid">
            <thead>
                <tr data-role="grid-head">
                    <th scope="col" class="habit-dashboard__head-habit">Habit</th>
                    <th scope="col" class="habit-dashboard__head-range">Entry</th>
                    <th scope="col" class="habit-dashboard__head-summary">Summary</th>
                    <th scope="col" class="habit-dashboard__head-actions">Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <div class="habit-dashboard__range-summary" data-role="range-summary"></div>
    </div>

    <div class="habit-dashboard__legend">
        <span>Habits live under the Habits book</span>
        <span>Entries are generated under the Entries book</span>
        <span>All timestamps use your Trilium locale</span>
    </div>
</div>`;

    const BOOTSTRAP_RETRY_DELAY_MS = 60;
    const BOOTSTRAP_MAX_RETRIES = 40;
    let bootstrapRetryCount = 0;

    function ensureRootStructure(api) {
        const $container = api.$container;

        if (!$container || !$container.length) {
            throw new Error("Habit dashboard: missing render container");
        }

        let $root = $container.find("[data-habit-dashboard]").first();
        if ($root.length) {
            return $root;
        }

        const $template = $(DASHBOARD_TEMPLATE.trim());
        $container.empty().append($template);
        return $template;
    }

    class Logger {
        constructor(api) {
            this.api = api;
            this.prefix = LOG_PREFIX;
        }

        setApi(api) {
            this.api = api;
        }

        emit(level, event, context = {}) {
            const payload = {
                ts: new Date().toISOString(),
                level,
                event,
                ...context
            };

            const line = `[${this.prefix}] ${JSON.stringify(payload)}`;

            if (level === "error") {
                console.error(line);
            } else if (level === "warn") {
                console.warn(line);
            } else {
                console.log(line);
            }

            try {
                this.api?.log(line);
            } catch (e) {
                // ignore logging failures
            }
        }

        info(event, context) {
            this.emit("info", event, context);
        }

        warn(event, context) {
            this.emit("warn", event, context);
        }

        error(event, context) {
            this.emit("error", event, context);
        }
    }

    class Backend {
        constructor(api, logger) {
            this.api = api;
            this.logger = logger;
            this.structurePromise = null;
            this.structure = null;
            this.rootNoteId = null;
            this.scriptNoteId = this.detectScriptNoteId(api);
            this.structureCachedAt = 0;
            this.structureCacheTTL = 60000;
            this.explicitRootNoteId = null;
            this.knownRootNoteIds = new Set();
            this.pendingRootNoteIds = new Set();
            this.constants = CONSTANTS;
        }

        setApi(api) {
            this.api = api;
            this.rootNoteId = null;
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            const detectedScriptId = this.detectScriptNoteId(api);
            if (detectedScriptId) {
                this.scriptNoteId = detectedScriptId;
            }
            this.explicitRootNoteId = null;
            this.pendingRootNoteIds.clear();
            this.knownRootNoteIds.clear();
        }

        resetStructureCache() {
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
        }

        setExplicitRootNoteId(noteId, { allowPending = false } = {}) {
            if (!noteId) {
                this.explicitRootNoteId = null;
                this.pendingRootNoteIds.clear();
                this.rootNoteId = null;
                return;
            }
            this.explicitRootNoteId = noteId;
            this.rootNoteId = noteId;
            if (allowPending) {
                this.pendingRootNoteIds.add(noteId);
            } else {
                this.pendingRootNoteIds.delete(noteId);
            }
            if (this.isDashboardRootNoteId(noteId)) {
                this.knownRootNoteIds.add(noteId);
                this.pendingRootNoteIds.delete(noteId);
            }
        }

        getResolvedRootNoteId() {
            if (this.rootNoteId && this.isDashboardRootNoteId(this.rootNoteId)) {
                return this.rootNoteId;
            }
            return null;
        }

        registerKnownRootNote(noteId) {
            if (!noteId) {
                return;
            }
            if (this.isDashboardRootNoteId(noteId, { forceLookup: true })) {
                this.knownRootNoteIds.add(noteId);
                this.pendingRootNoteIds.delete(noteId);
            }
        }

        isDashboardRootNoteId(noteId, { forceLookup = false } = {}) {
            if (!noteId) {
                return false;
            }

            if (!forceLookup && this.pendingRootNoteIds.has(noteId)) {
                const pendingNote = getNoteSafely(this.api, noteId);
                if (!pendingNote) {
                    this.pendingRootNoteIds.delete(noteId);
                    return false;
                }
                if (hasHabitDashboardRootLabel(pendingNote, this.constants)) {
                    this.pendingRootNoteIds.delete(noteId);
                    this.knownRootNoteIds.add(noteId);
                }
                return true;
            }

            if (!forceLookup && this.knownRootNoteIds.has(noteId)) {
                const cachedNote = getNoteSafely(this.api, noteId);
                if (cachedNote && hasHabitDashboardRootLabel(cachedNote, this.constants)) {
                    return true;
                }
                this.knownRootNoteIds.delete(noteId);
            }

            const note = getNoteSafely(this.api, noteId);
            if (!note) {
                return false;
            }
            if (hasHabitDashboardRootLabel(note, this.constants)) {
                this.knownRootNoteIds.add(noteId);
                this.pendingRootNoteIds.delete(noteId);
                return true;
            }
            return false;
        }

        detectScriptNoteId(api) {
            if (!api) {
                return null;
            }
            if (api.scriptNote?.noteId) {
                return api.scriptNote.noteId;
            }
            if (api.note?.type === "script" && api.note.noteId) {
                return api.note.noteId;
            }
            if (api.startNote?.noteId) {
                return api.startNote.noteId;
            }
            return this.scriptNoteId || null;
        }

        resolveRootNoteId(force = false) {
            const previous = this.rootNoteId && this.isDashboardRootNoteId(this.rootNoteId)
                ? this.rootNoteId
                : null;
            if (!force && previous && !this.pendingRootNoteIds.has(previous)) {
                return previous;
            }
            let candidate = null;
            try {
                const context = this.api.getActiveContextNote?.();
                if (context?.noteId) {
                    candidate = context.noteId;
                }
            } catch (error) {
                // context note unavailable in some flows; fallback to start note
            }
            const candidates = [];
            if (candidate) {
                candidates.push(candidate);
            }
            if (this.explicitRootNoteId && !candidates.includes(this.explicitRootNoteId)) {
                candidates.unshift(this.explicitRootNoteId);
            }
            const structureRootId = this.structure?.rootNoteId;
            if (structureRootId && !candidates.includes(structureRootId)) {
                candidates.push(structureRootId);
            }
            const startNoteId = this.api.startNote?.noteId || null;
            if (startNoteId && !candidates.includes(startNoteId)) {
                candidates.push(startNoteId);
            }
            if (previous && !candidates.includes(previous)) {
                candidates.push(previous);
            }

            for (const candidateId of candidates) {
                if (!candidateId) {
                    continue;
                }
                if (this.isDashboardRootNoteId(candidateId)) {
                    if (previous && previous !== candidateId) {
                        this.resetStructureCache();
                    }
                    this.rootNoteId = candidateId;
                    return candidateId;
                }
            }

            this.rootNoteId = previous || null;
            return this.rootNoteId;
        }

        async ensureStructure(force = false) {
            const now = Date.now();
            const cacheAge = now - this.structureCachedAt;
            const cacheStale = cacheAge < 0 || cacheAge > this.structureCacheTTL;
            const needsRefresh = force || !this.structurePromise || cacheStale;

            if (needsRefresh) {
                this.logger.info("backend.structure.refresh", {
                    force,
                    cacheStale,
                    cacheAgeMs: this.structureCachedAt ? cacheAge : null
                });
                this.structureCachedAt = now;
                this.structurePromise = this.call(ACTIONS.ENSURE_STRUCTURE, {});
                try {
                    this.structure = await this.structurePromise;
                    this.structureCachedAt = Date.now();
                    this.registerKnownRootNote(this.structure?.rootNoteId);
                } catch (error) {
                    this.structurePromise = null;
                    this.structureCachedAt = 0;
                    throw error;
                }
            } else if (!this.structure && this.structurePromise) {
                try {
                    this.structure = await this.structurePromise;
                    this.registerKnownRootNote(this.structure?.rootNoteId);
                } catch (error) {
                    this.structurePromise = null;
                    throw error;
                }
            }

            return this.structure;
        }

        async snapshot(dateISO) {
            return await this.call(ACTIONS.SNAPSHOT, { date: dateISO });
        }

        async rangeSnapshot(view, startDate) {
            return await this.call(ACTIONS.RANGE_SNAPSHOT, { view, startDate });
        }

        async saveEntry(payload) {
            return await this.call(ACTIONS.SAVE_ENTRY, payload);
        }

        async deleteEntries(keys) {
            return await this.call(ACTIONS.DELETE_ENTRIES, { keys });
        }

        async setCompactMode(level) {
            const result = await this.call(ACTIONS.SET_COMPACT, { level });
            this.structure = {
                ...(this.structure || {}),
                compactLevel: result.compactLevel
            };
            return result;
        }

        async setSubentryExpansion(enabled) {
            const result = await this.call(ACTIONS.SET_SUBENTRY_EXPANSION, { enabled });
            this.structure = {
                ...(this.structure || {}),
                subentriesExpanded: result.subentriesExpanded
            };
            return result;
        }

        async setRangeAlignment(mode) {
            const result = await this.call(ACTIONS.SET_RANGE_ALIGNMENT, { mode });
            this.structure = {
                ...(this.structure || {}),
                rangeAlignment: result.rangeAlignment
            };
            return result;
        }

        async createGroup(data) {
            const result = await this.call(ACTIONS.CREATE_GROUP, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async updateGroup(data) {
            const result = await this.call(ACTIONS.UPDATE_GROUP, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async deleteGroup(data) {
            const result = await this.call(ACTIONS.DELETE_GROUP, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async createHabit(data) {
            const result = await this.call(ACTIONS.CREATE_HABIT, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async updateHabit(data) {
            const result = await this.call(ACTIONS.UPDATE_HABIT, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async deleteHabit(data) {
            const result = await this.call(ACTIONS.DELETE_HABIT, data);
            this.structurePromise = null;
            this.structure = null;
            this.structureCachedAt = 0;
            return result;
        }

        async call(action, payload = {}) {
            let rootNoteId = this.resolveRootNoteId();
            if (!rootNoteId && this.explicitRootNoteId) {
                rootNoteId = this.explicitRootNoteId;
                this.pendingRootNoteIds.add(rootNoteId);
            }
            if (!rootNoteId) {
                this.logger?.warn?.("backend.call.no-root", {
                    action,
                    payloadKeys: Object.keys(payload || {})
                });
                throw new Error("Habit dashboard root note unavailable");
            }
            const scriptNoteId = this.detectScriptNoteId(this.api) || this.scriptNoteId || null;
            if (scriptNoteId) {
                this.scriptNoteId = scriptNoteId;
            }
            const paramsWithRoot = {
                ...payload
            };
            if (rootNoteId) {
                paramsWithRoot.rootNoteId = rootNoteId;
            }
            if (scriptNoteId) {
                paramsWithRoot.scriptNoteId = scriptNoteId;
            }
            this.logger?.info?.("backend.call.start", {
                action,
                rootNoteId: paramsWithRoot.rootNoteId || null,
                scriptNoteId: paramsWithRoot.scriptNoteId || null,
                payloadKeys: Object.keys(payload || {})
            });
            const backendFn = function(constants, actionName, params) {
                const CONSTANTS = constants;
                const LOG_PREFIX = `habit-dashboard/v${constants?.version ?? ""}`;
                function backendLog(level, event, context) {
                    const payload = {
                        ts: new Date().toISOString(),
                        level,
                        event,
                        ...context
                    };
                    try {
                        api.log(`[${LOG_PREFIX}][backend] ${JSON.stringify(payload)}`);
                    } catch (error) {
                        // ignore logging failures
                    }
                }

                backendLog("info", "action.dispatch", {
                    action: actionName,
                    hasRootNoteId: !!params?.rootNoteId,
                    hasScriptNoteId: !!params?.scriptNoteId,
                    keyCount: Array.isArray(params?.keys) ? params.keys.length : null
                });

                let scriptNote = null;
                if (params?.scriptNoteId) {
                    scriptNote = api.getNote(params.scriptNoteId);
                }
                if (!scriptNote || scriptNote.isDeleted) {
                    backendLog("warn", "script-note.fallback.start-note", {
                        requestedScriptNoteId: params?.scriptNoteId || null,
                        fallbackStartNoteId: api.startNote?.noteId || null
                    });
                    scriptNote = api.startNote || null;
                }
                if (!scriptNote || scriptNote.isDeleted) {
                    backendLog("warn", "script-note.fallback.root-note", {
                        requestedScriptNoteId: params?.scriptNoteId || null,
                        requestedRootNoteId: params?.rootNoteId || null
                    });
                    scriptNote = params?.rootNoteId ? api.getNote(params.rootNoteId) : null;
                }

                let rootNote = scriptNote;
                if (params?.rootNoteId) {
                    const candidate = api.getNote(params.rootNoteId);
                    if (candidate && !candidate.isDeleted) {
                        rootNote = candidate;
                    } else {
                        backendLog("warn", "root-note.fallback", {
                            requestedRootNoteId: params?.rootNoteId || null,
                            candidateFound: !!candidate,
                            candidateDeleted: !!candidate?.isDeleted
                        });
                    }
                }

                backendLog("info", "notes.resolved", {
                    action: actionName,
                    resolvedScriptNoteId: scriptNote?.noteId || null,
                    resolvedRootNoteId: rootNote?.noteId || null
                });

                if (!rootNote || rootNote.isDeleted) {
                    backendLog("error", "root-note.missing", {
                        action: actionName,
                        paramsRootNoteId: params?.rootNoteId || null,
                        scriptNoteId: scriptNote?.noteId || null
                    });
                    throw new Error("Habit dashboard root note unavailable");
                }

                function nowISO() {
                    return api.dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
                }

                function getChildren(note) {
                    return note.getChildNotes().filter((child) => !child.isDeleted);
                }

                function slugify(input) {
                    return (input || "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "")
                        || api.randomString(6).toLowerCase();
                }

                function ensureStructure() {
                    if (!rootNote || !rootNote.noteId) {
                        backendLog("error", "ensure-structure.missing-root", {
                            hasRootNote: !!rootNote,
                            rootNoteId: rootNote?.noteId || null
                        });
                        throw new Error("Root note unavailable in ensureStructure");
                    }

                    const childNotes = getChildren(rootNote);

                    function ensureBook(title, role, icon) {
                        if (!rootNote || !rootNote.noteId) {
                            throw new Error("Root note missing in ensureBook");
                        }

                        let node = childNotes.find((child) => child.getLabelValue(constants.labels.role) === role);

                        if (!node) {
                            node = childNotes.find((child) => child.title === title && !child.isDeleted);
                        }

                        if (!node) {
                            const created = api.createNewNote({
                                parentNoteId: rootNote.noteId,
                                title,
                                type: "book",
                                content: ""
                            }).note;

                            created.setLabel(constants.labels.role, role);
                            created.setLabel("iconClass", icon);
                            created.save();
                            node = created;
                        } else {
                            node.setLabel(constants.labels.role, role);
                            if (icon && !node.getLabelValue("iconClass")) {
                                node.setLabel("iconClass", icon);
                            }
                        }

                        return node;
                    }

                    const habitsNode = ensureBook("Habits", "habits", "bx bx-task");
                    const entriesNode = ensureBook("Entries", "entries", "bx bx-log-in");

                    rootNote.setLabel(constants.labels.root, "1");
                    if (!rootNote.getLabelValue("iconClass")) {
                        rootNote.setLabel("iconClass", "bx bx-grid-alt");
                    }

                    const subentriesExpandedLabel = rootNote.getLabelValue(constants.labels.subentriesExpanded);
                    const subentriesExpanded = subentriesExpandedLabel === "0" ? false : true;
                    const rangeAlignmentLabel = (rootNote.getLabelValue(constants.labels.rangeAlignment) || "").toLowerCase();
                    const rangeAlignment = rangeAlignmentLabel === "grid" ? "grid" : "float";

                    let groupNotes = getChildren(habitsNode).filter((child) => child.getLabelValue(constants.labels.group));

                    if (!groupNotes.length) {
                        if (Array.isArray(constants.sampleGroups) && constants.sampleGroups.length) {
                            constants.sampleGroups.forEach((group, index) => {
                                const { note } = api.createNewNote({
                                    parentNoteId: habitsNode.noteId,
                                    title: group.title,
                                    type: "text",
                                    content: ""
                                });
                                note.setLabel(constants.labels.group, "1");
                                const parsedOrder = Number(group.order);
                                const orderValue = Number.isFinite(parsedOrder) ? parsedOrder : index * 10;
                                note.setLabel(constants.labels.groupOrder, String(orderValue));
                                const groupColor = typeof group.color === "string" && group.color.trim().length ? group.color.trim() : constants.groupDefaults.color;
                                note.setLabel(constants.labels.groupColor, groupColor);
                                note.save();
                            });
                        } else {
                            const { note } = api.createNewNote({
                                parentNoteId: habitsNode.noteId,
                                title: constants.groupDefaults.title,
                                type: "text",
                                content: ""
                            });
                            note.setLabel(constants.labels.group, "1");
                            note.setLabel(constants.labels.groupOrder, "0");
                            note.setLabel(constants.labels.groupColor, constants.groupDefaults.color);
                            note.save();
                        }
                        groupNotes = getChildren(habitsNode).filter((child) => child.getLabelValue(constants.labels.group));
                    }

                    const groupLookup = new Map();
                    groupNotes.forEach((group) => {
                        const title = group.getTitleOrProtected ? group.getTitleOrProtected() : group.title;
                        const titleKey = slugify(title);
                        if (titleKey) {
                            groupLookup.set(titleKey, group);
                        }
                        groupLookup.set(group.noteId, group);
                    });
                    if (Array.isArray(constants.sampleGroups)) {
                        constants.sampleGroups.forEach((sampleGroup, index) => {
                            const key = typeof sampleGroup.key === "string" ? sampleGroup.key.trim() : null;
                            const fallbackKey = slugify(sampleGroup.title || key || `group-${index}`);
                            const slugKey = key ? slugify(key) : null;
                            const match = (slugKey && groupLookup.get(slugKey)) || groupLookup.get(fallbackKey);
                            if (match) {
                                if (slugKey) {
                                    groupLookup.set(slugKey, match);
                                }
                                if (key) {
                                    groupLookup.set(key, match);
                                }
                            }
                        });
                    }

                    let habitNotes = getChildren(habitsNode).filter((child) => child.getLabelValue(constants.labels.role) === "habit");
                    let createdSamples = false;

                    if (habitNotes.length === 0) {
                        const today = api.dayjs().format("YYYY-MM-DD");
                        constants.sampleHabits.forEach((sample, index) => {
                            const { note } = api.createDataNote(habitsNode.noteId, sample.title, {});

                            const slug = sample.slug ? sample.slug : slugify(sample.title);
                            const normalizedSubEntries = normalizeSubEntries(sample.subEntries || []);
                            const multiEntries = sample.multiEntries === true || normalizedSubEntries.length > 0;
                            const meta = {
                                createdAt: today,
                                templateVersion: constants.version,
                                type: sample.type,
                                slug,
                                unit: sample.unit ?? null,
                                target: sample.target ?? null,
                                decimals: sample.decimals ?? null,
                                scaleMin: sample.scaleMin ?? null,
                                scaleMax: sample.scaleMax ?? null,
                                description: sample.description ?? null,
                                color: sample.color ?? null,
                                icon: sample.icon ?? null,
                                reminderTime: sample.reminderTime ?? null,
                                streakTarget: sample.streakTarget ?? null,
                                streakWindow: sample.streakWindow ?? null,
                                quickStep: sample.quickStep ?? null,
                                multiEntries,
                                subEntries: normalizedSubEntries
                            };

                            note.setJsonContent(meta);

                            note.setLabel(constants.labels.role, "habit");
                            note.setLabel(constants.labels.type, sample.type);
                            note.setLabel(constants.labels.slug, slug);
                            note.setLabel(constants.labels.order, String((index + 1) * 10));
                            note.setLabel(constants.labels.habitMetaVersion, String(constants.version));

                            if (sample.icon) {
                                const rawIcon = String(sample.icon).trim();
                                if (rawIcon.length) {
                                    const normalizedIcon = rawIcon.startsWith("bx ")
                                        ? rawIcon
                                        : (rawIcon.startsWith("bx-") ? `bx ${rawIcon}` : `bx bx-${rawIcon}`);
                                    note.setLabel("iconClass", normalizedIcon);
                                }
                            }

                            const desiredGroup = (() => {
                                const candidates = [];
                                if (sample.groupKey) {
                                    candidates.push(sample.groupKey);
                                    candidates.push(slugify(sample.groupKey));
                                }
                                if (sample.group) {
                                    candidates.push(sample.group);
                                }
                                for (const candidate of candidates) {
                                    if (!candidate) {
                                        continue;
                                    }
                                    const key = typeof candidate === "string" ? candidate.trim() : candidate;
                                    if (!key) {
                                        continue;
                                    }
                                    const slugKey = slugify(key);
                                    const group = groupLookup.get(key) || groupLookup.get(slugKey);
                                    if (group) {
                                        return group;
                                    }
                                }
                                return null;
                            })();

                            if (desiredGroup) {
                                note.setLabel(constants.labels.groupLink, desiredGroup.noteId);
                            }

                            note.save();
                        });
                        habitNotes = getChildren(habitsNode).filter((child) => child.getLabelValue(constants.labels.role) === "habit");
                        createdSamples = true;
                    }

                    const sortedGroupsForDefault = groupNotes
                        .slice()
                        .sort((a, b) => {
                            const aOrderRaw = a.getLabelValue(constants.labels.groupOrder);
                            const bOrderRaw = b.getLabelValue(constants.labels.groupOrder);
                            const aOrder = aOrderRaw ? parseInt(aOrderRaw, 10) : 0;
                            const bOrder = bOrderRaw ? parseInt(bOrderRaw, 10) : 0;
                            if (aOrder === bOrder) {
                                return (a.getTitleOrProtected?.() || a.title || "").localeCompare(b.getTitleOrProtected?.() || b.title || "");
                            }
                            return aOrder - bOrder;
                        });
                    const defaultGroupId = sortedGroupsForDefault[0]?.noteId || null;

                    groupNotes.forEach((group, idx) => {
                        if (!group.getLabelValue(constants.labels.group)) {
                            group.setLabel(constants.labels.group, "1");
                        }
                        if (!group.getLabelValue(constants.labels.groupOrder)) {
                            group.setLabel(constants.labels.groupOrder, String(idx * 10));
                        }
                        if (!group.getLabelValue(constants.labels.groupColor)) {
                            group.setLabel(constants.labels.groupColor, constants.groupDefaults.color);
                        }
                    });

                    habitNotes.forEach((habit, idx) => {
                        if (!habit.getLabelValue(constants.labels.groupLink) && defaultGroupId) {
                            habit.setLabel(constants.labels.groupLink, defaultGroupId);
                        }
                        if (!habit.getLabelValue(constants.labels.order)) {
                            habit.setLabel(constants.labels.order, String((idx + 1) * 10));
                        }
                    });

                    const groups = groupNotes
                        .map((group) => hydrateGroup(group))
                        .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));

                    const compactLevel = normalizeCompactLevelBackend(rootNote.getLabelValue(constants.labels.compact));

                    const debugEnabled = Boolean(rootNote.getLabelValue(constants.labels.debug)
                        || scriptNote?.getLabelValue(constants.labels.debug));

                    return {
                        habitsId: habitsNode.noteId,
                        entriesId: entriesNode.noteId,
                        rootNoteId: rootNote.noteId,
                        compactLevel,
                        createdSamples,
                        defaultGroupId,
                        groups,
                        debugEnabled,
                        subentriesExpanded,
                        rangeAlignment
                    };
                }

                function getHabitOrder(note) {
                    const raw = note.getLabelValue(constants.labels.order);
                    const parsed = raw ? parseInt(raw, 10) : NaN;
                    return Number.isNaN(parsed) ? 99999 : parsed;
                }

        function hydrateHabit(note) {
            const rawMeta = note.getJsonContentSafely() || {};
            const meta = {
                ...rawMeta,
                subEntries: normalizeSubEntries(rawMeta.subEntries)
            };
            const order = getHabitOrder(note);

            return {
                id: note.noteId,
                title: note.getTitleOrProtected(),
                type: note.getLabelValue(constants.labels.type) || meta.type || "check",
                slug: note.getLabelValue(constants.labels.slug) || meta.slug || slugify(note.title),
                archived: note.getLabelValue(constants.labels.archived) === "1",
                icon: note.getLabelValue("iconClass") || meta.icon || "",
                order,
                groupId: note.getLabelValue(constants.labels.groupLink) || null,
                meta
            };
        }

        function hydrateGroup(note) {
            const orderRaw = note.getLabelValue(constants.labels.groupOrder);
            const order = orderRaw ? parseInt(orderRaw, 10) : 0;
            return {
                id: note.noteId,
                title: note.getTitleOrProtected(),
                color: note.getLabelValue(constants.labels.groupColor) || constants.groupDefaults.color,
                order: Number.isNaN(order) ? 99999 : order
            };
        }

                function ensureEntryStructure(structure) {
                    if (!structure || !structure.habitsId || !structure.entriesId) {
                        return ensureStructure();
                    }
                    return structure;
                }

                function getEntryNote(key) {
                    return api.getNoteWithLabel(constants.labels.entryKey, key);
                }

                function minutesToDisplay(minutes) {
                    if (typeof minutes !== "number" || Number.isNaN(minutes)) {
                        return null;
                    }

                    const absMinutes = Math.max(0, Math.round(minutes));
                    const hours = Math.floor(absMinutes / 60);
                    const mins = absMinutes % 60;
                    if (hours === 0) {
                        return `${mins}m`;
                    }
                    if (mins === 0) {
                        return `${hours}h`;
                    }
                    return `${hours}h ${mins}m`;
                }

                function buildEntryPayload(habit, entryNote, date, keyOverride) {
                    const json = entryNote?.getJsonContentSafely() || {};
                const payload = {
                    entryId: entryNote?.noteId || null,
                    habitId: habit.id,
                    type: habit.type,
                    date,
                    value: json.value ?? null,
                    skipped: json.skipped ?? false,
                    recordedAt: json.recordedAt || entryNote?.utcDateModified || entryNote?.utcDateCreated || null,
                    display: json.display || null,
                    key: keyOverride || entryNote?.getLabelValue(constants.labels.entryKey) || null
                };

                const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
                let detectedSubEntryId = null;
                if (json.subEntryId !== undefined && json.subEntryId !== null && String(json.subEntryId).trim() !== "") {
                    detectedSubEntryId = String(json.subEntryId).trim();
                } else if (payload.key && typeof payload.key === "string") {
                    const keyParts = payload.key.split(":");
                    if (keyParts.length >= 3) {
                        detectedSubEntryId = keyParts.slice(2).join(":");
                    }
                }
                if (hasSubEntryTemplates) {
                    payload.subEntryId = detectedSubEntryId ?? null;
                } else if (detectedSubEntryId !== null) {
                    payload.subEntryId = detectedSubEntryId;
                }

                if (payload.value === null || payload.value === undefined) {
                    const valueLabel = entryNote?.getLabelValue(constants.labels.entryValue);
                    if (valueLabel !== null && valueLabel !== undefined) {
                        const numericMatch = String(valueLabel).match(/-?\d+(?:\.\d+)?/);
                        if (numericMatch) {
                            const parsed = Number(numericMatch[0]);
                            if (Number.isFinite(parsed)) {
                                payload.value = parsed;
                            }
                        }
                    }
                }
                if (!payload.skipped) {
                    const skipLabel = entryNote?.getLabelValue(constants.labels.entrySkip);
                    if (skipLabel === "1") {
                        payload.skipped = true;
                    }
                }

                if (!payload.display && payload.value !== null) {
                    payload.display = formatDisplayValue(habit, payload.value, payload.skipped, json);
                }

                return payload;
                }

                function formatDisplayValue(habit, value, skipped, json) {
                    if (skipped) {
                        return "Skipped";
                    }

                    switch (habit.type) {
                        case "check":
                            return value ? "Completed" : "Not done";
                        case "count":
                        case "value": {
                            const unit = habit.meta?.unit || json.unit || "";
                            return unit ? `${value} ${unit}` : String(value);
                        }
                        case "time":
                            return minutesToDisplay(value) || `${value}m`;
                        case "rating": {
                            const max = habit.meta?.scaleMax || json.scaleMax || 5;
                            return `${value}/${max}`;
                        }
                        default:
                            return value === null || value === undefined ? "—" : String(value);
                    }
                }

        const backendCompactLevels = Array.isArray(constants.compactLevels) && constants.compactLevels.length
            ? constants.compactLevels.map((level, index) => {
                const key = typeof level.key === "string" && level.key.trim().length
                    ? level.key.trim().toLowerCase()
                    : `level-${index}`;
                const label = typeof level.label === "string" && level.label.trim().length
                    ? level.label.trim()
                    : (typeof level.key === "string" && level.key.trim().length ? level.key.trim() : `Level ${index + 1}`);
                return {
                    value: index,
                    key,
                    label
                };
            })
            : [
                { value: 0, key: "roomy", label: "Spacious" },
                { value: 1, key: "compact", label: "Compact" },
                { value: 2, key: "dense", label: "Dense" },
                { value: 3, key: "micro", label: "Micro" }
            ];
        const backendMaxCompactLevel = backendCompactLevels.length ? backendCompactLevels.length - 1 : 0;
        const backendCompactLevelLookup = new Map();
        backendCompactLevels.forEach((level) => {
            if (level.key) {
                backendCompactLevelLookup.set(level.key, level.value);
            }
            if (level.label) {
                const labelKey = level.label.trim().toLowerCase();
                if (labelKey && !backendCompactLevelLookup.has(labelKey)) {
                    backendCompactLevelLookup.set(labelKey, level.value);
                }
            }
        });

        function clampCompactLevelBackend(level) {
            if (!Number.isFinite(level)) {
                return 0;
            }
            return Math.min(backendMaxCompactLevel, Math.max(0, Math.round(level)));
        }

        function normalizeCompactLevelBackend(value) {
            if (typeof value === "number" && Number.isFinite(value)) {
                return clampCompactLevelBackend(value);
            }
            if (typeof value === "boolean") {
                return value ? 1 : 0;
            }
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed.length) {
                    return 0;
                }
                if (/^-?\d+$/.test(trimmed)) {
                    return clampCompactLevelBackend(parseInt(trimmed, 10));
                }
                const mapped = backendCompactLevelLookup.get(trimmed.toLowerCase());
                if (mapped !== undefined) {
                    return mapped;
                }
                if (trimmed.toLowerCase() === "true") {
                    return 1;
                }
                if (trimmed.toLowerCase() === "false") {
                    return 0;
                }
            }
            if (value && typeof value === "object") {
                if (typeof value.level === "number") {
                    return clampCompactLevelBackend(value.level);
                }
                if (typeof value.key === "string") {
                    const mapped = backendCompactLevelLookup.get(value.key.trim().toLowerCase());
                    if (mapped !== undefined) {
                        return mapped;
                    }
                }
                if (typeof value.enabled === "boolean") {
                    return value.enabled ? 1 : 0;
                }
            }
            return 0;
        }

        function normalizeString(value) {
            if (value === null || value === undefined) {
                return null;
            }
            const trimmed = String(value).trim();
            return trimmed.length ? trimmed : null;
        }

        function normalizeNumber(value) {
            if (value === null || value === undefined || value === "") {
                return null;
            }
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        }

        function normalizeSubEntries(subEntries, { strict = false } = {}) {
            if (!Array.isArray(subEntries)) {
                return [];
            }
            const seen = new Set();
            const normalized = [];
            subEntries.forEach((entry) => {
                if (!entry || typeof entry !== "object") {
                    return;
                }
                const id = normalizeString(entry.id);
                if (!id) {
                    return;
                }
                if (seen.has(id)) {
                    if (strict) {
                        throw new Error(`Duplicate sub-entry id: ${id}`);
                    }
                    return;
                }
                seen.add(id);
                const title = normalizeString(entry.title) || id;
                normalized.push({
                    id,
                    title,
                    required: entry.required === true
                });
            });
            return normalized;
        }

        function sanitizeEntryValue(habit, rawValue, skip) {
            if (skip) {
                return { value: null, display: "Skipped", raw: null };
            }

            const meta = habit.meta || {};

                    switch (habit.type) {
                        case "check": {
                            const truthy = rawValue === true || rawValue === "true" || rawValue === 1 || rawValue === "1";
                            return {
                                value: truthy ? 1 : 0,
                                display: truthy ? "Completed" : "Not done",
                                raw: truthy
                            };
                        }
                        case "count": {
                            const num = Number(rawValue);
                            const safe = Number.isFinite(num) && num >= 0 ? Math.round(num) : 0;
                            return {
                                value: safe,
                                display: meta.unit ? `${safe} ${meta.unit}` : String(safe),
                                raw: safe
                            };
                        }
                        case "value": {
                            const decimals = Number.isFinite(meta.decimals) ? Number(meta.decimals) : 2;
                            const num = Number(rawValue);
                            const safe = Number.isFinite(num) ? Number(num.toFixed(decimals)) : 0;
                            return {
                                value: safe,
                                display: meta.unit ? `${safe} ${meta.unit}` : String(safe),
                                raw: safe
                            };
                        }
                        case "time": {
                            if (typeof rawValue === "string" && rawValue.includes(":")) {
                                const [h, m] = rawValue.split(":").map((part) => Number(part));
                                const minutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
                                return {
                                    value: minutes,
                                    display: minutesToDisplay(minutes) || `${minutes}m`,
                                    raw: minutes
                                };
                            }
                            const minutes = Number(rawValue);
                            const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
                            return {
                                value: safeMinutes,
                                display: minutesToDisplay(safeMinutes) || `${safeMinutes}m`,
                                raw: safeMinutes
                            };
                        }
                        case "rating": {
                            const min = Number.isFinite(meta.scaleMin) ? Number(meta.scaleMin) : 1;
                            const max = Number.isFinite(meta.scaleMax) ? Number(meta.scaleMax) : 5;
                            const parsed = Number(rawValue);
                            let clamped = Number.isFinite(parsed) ? Math.round(parsed) : min;
                            clamped = Math.min(Math.max(clamped, min), max);

                            return {
                                value: clamped,
                                display: `${clamped}/${max}`,
                                raw: clamped
                            };
                        }
                        default: {
                            if (rawValue === null || rawValue === undefined) {
                                return { value: null, display: "—", raw: null };
                            }
                            return {
                                value: rawValue,
                                display: String(rawValue),
                                raw: rawValue
                            };
                }
            }
        }

        function ensureEntryArray(entry) {
            if (!entry) {
                return [];
            }
            if (Array.isArray(entry)) {
                return entry.slice();
            }
            return [entry];
        }

        function buildPriorDates(anchorISO, days) {
            const base = api.dayjs(anchorISO);
            if (!base.isValid() || !Number.isFinite(days) || days <= 0) {
                return [];
            }
            const list = [];
            for (let offset = days; offset >= 1; offset -= 1) {
                list.push(base.subtract(offset, "day").format("YYYY-MM-DD"));
            }
            return list;
        }

        function buildTrailingDates(endISO, length) {
            const base = api.dayjs(endISO);
            if (!base.isValid() || !Number.isFinite(length) || length <= 0) {
                return [];
            }
            const list = [];
            for (let offset = length - 1; offset >= 0; offset -= 1) {
                list.push(base.subtract(offset, "day").format("YYYY-MM-DD"));
            }
            return list;
        }

        function evaluateHabitDayStatus(habit, entries) {
            const list = ensureEntryArray(entries);
            if (!list.length) {
                return {
                    success: false,
                    completed: false,
                    skipped: false,
                    hasEntries: false
                };
            }
            const skipped = list.some((entry) => entry && entry.skipped);
            let completed = false;

            if (habit?.type === "check") {
                completed = list.some((entry) => entry && !entry.skipped && !!entry.value);
                return {
                    success: skipped || completed,
                    completed,
                    skipped,
                    hasEntries: true
                };
            }

            const target = Number.isFinite(Number(habit?.meta?.target)) ? Number(habit.meta.target) : null;
            if (target !== null) {
                completed = list.some((entry) => !entry.skipped && Number(entry.value || 0) >= target);
            } else {
                completed = list.some((entry) => !entry.skipped && entry.value !== null && entry.value !== undefined);
            }

            return {
                success: skipped || completed,
                completed,
                skipped,
                hasEntries: true
            };
        }

        function resolveRollingStreakAt(statuses, prefix, endIndex, goal, windowDays) {
            const fallback = {
                active: false,
                current: 0,
                startIndex: null,
                endIndex,
                startDate: null,
                endDate: endIndex >= 0 && endIndex < statuses.length ? statuses[endIndex]?.date : null,
                span: 0
            };

            if (!goal || goal <= 0 || !Array.isArray(statuses) || !statuses.length || !Number.isFinite(windowDays) || windowDays <= 0) {
                return fallback;
            }
            if (endIndex < 0 || endIndex >= statuses.length) {
                return fallback;
            }

            const hasFullWindow = endIndex >= windowDays - 1;
            if (hasFullWindow) {
                const windowSuccess = prefix[endIndex + 1] - prefix[endIndex + 1 - windowDays];
                if (windowSuccess < goal) {
                    return fallback;
                }
            } else {
                const totalSuccess = prefix[endIndex + 1];
                if (totalSuccess < goal) {
                    return fallback;
                }
            }

            let startIndex = endIndex;
            while (startIndex > 0) {
                const candidate = startIndex - 1;
                let ok = true;
                const firstWindowEnd = Math.max(candidate + windowDays - 1, windowDays - 1);
                for (let end = firstWindowEnd; end <= endIndex; end += 1) {
                    const windowStart = end - windowDays + 1;
                    if (windowStart < candidate) {
                        continue;
                    }
                    const windowSuccess = prefix[end + 1] - prefix[windowStart];
                    if (windowSuccess < goal) {
                        ok = false;
                        break;
                    }
                }
                if (!ok) {
                    break;
                }
                startIndex = candidate;
            }

            const current = prefix[endIndex + 1] - prefix[startIndex];
            if (current < goal) {
                return fallback;
            }

            return {
                active: true,
                current,
                startIndex,
                endIndex,
                startDate: statuses[startIndex]?.date || null,
                endDate: statuses[endIndex]?.date || null,
                span: endIndex - startIndex + 1
            };
        }

        function computeRollingLongest(statuses, prefix, goal, windowDays) {
            if (!goal || goal <= 0 || !Array.isArray(statuses) || !statuses.length || !Number.isFinite(windowDays) || windowDays <= 0) {
                return { longest: 0, spanDays: 0 };
            }
            let best = { active: false, current: 0, span: 0 };
            for (let idx = 0; idx < statuses.length; idx += 1) {
                const info = resolveRollingStreakAt(statuses, prefix, idx, goal, windowDays);
                if (!info.active) {
                    continue;
                }
                if (info.current > best.current || (info.current === best.current && info.span > best.span)) {
                    best = info;
                }
            }
            return { longest: best.current || 0, spanDays: best.span || 0 };
        }

        function calculateRollingStreak(habit, habitEntries, streakDates, todayISO, windowDays, streakGoal, debugEnabled = false) {
            if (!Array.isArray(streakDates) || !streakDates.length) {
                return { active: false, current: 0, longest: 0, startDate: null, endDate: null, span: 0, debug: {} };
            }
            const goal = Number.isFinite(streakGoal) && streakGoal > 0 ? Math.floor(streakGoal) : null;
            if (!goal) {
                return { active: false, current: 0, longest: 0, startDate: null, endDate: null, span: 0, debug: {} };
            }

            const statuses = streakDates.map((date) => ({
                date,
                ...evaluateHabitDayStatus(habit, habitEntries ? habitEntries[date] : null)
            }));
            const prefix = new Array(statuses.length + 1).fill(0);
            for (let i = 0; i < statuses.length; i += 1) {
                prefix[i + 1] = prefix[i] + (statuses[i].success ? 1 : 0);
            }

            const todayIndex = statuses.findIndex((entry) => entry.date === todayISO);
            let evalIndex = todayIndex;
            if (evalIndex !== -1) {
                if (!statuses[evalIndex]?.success) {
                    evalIndex -= 1;
                }
            } else {
                const firstFuture = statuses.findIndex((entry) => entry.date > todayISO);
                evalIndex = firstFuture === -1 ? statuses.length - 1 : firstFuture - 1;
            }
            while (evalIndex >= 0 && statuses[evalIndex]?.date > todayISO) {
                evalIndex -= 1;
            }

            const currentInfo = resolveRollingStreakAt(statuses, prefix, evalIndex, goal, windowDays);
            const longestInfo = computeRollingLongest(statuses, prefix, goal, windowDays);

            let debug = {};
            if (debugEnabled) {
                const windowSuccessAt = (end) => {
                    if (end < 0) {
                        return 0;
                    }
                    if (end >= windowDays - 1) {
                        return prefix[end + 1] - prefix[end + 1 - windowDays];
                    }
                    return prefix[end + 1];
                };
                const windowCounts = [];
                for (let i = 0; i < statuses.length; i += 1) {
                    windowCounts.push(windowSuccessAt(i));
                }
                const recentWindows = windowCounts.slice(-30);
                const debugTailStart = Math.max(0, statuses.length - 30);
                const pattern = statuses.slice(debugTailStart).map((day) => {
                    if (day.skipped && day.success) {
                        return "S";
                    }
                    if (day.success) {
                        return "X";
                    }
                    return "O";
                }).join("");
                debug = {
                    pattern,
                    evaluationIndex: evalIndex,
                    evaluationDate: evalIndex >= 0 ? statuses[evalIndex]?.date || null : null,
                    goal,
                    windowDays,
                    windowCounts: recentWindows
                };
            }

            return {
                active: currentInfo.active,
                current: currentInfo.current || 0,
                longest: Math.max(longestInfo.longest || 0, currentInfo.current || 0),
                startDate: currentInfo.startDate,
                endDate: currentInfo.endDate,
                span: currentInfo.span || 0,
                debug
            };
        }

        function startOfWeekMonday(day) {
            const base = api.dayjs(day);
            if (!base.isValid()) {
                return api.dayjs().startOf("day");
            }
            const weekday = base.day();
            const diff = (weekday + 6) % 7; // Monday -> 0
            return base.subtract(diff, "day").startOf("day");
        }

        function buildDateRange(view, startDate) {
            const base = api.dayjs(startDate || undefined).startOf("day");
            if (!base.isValid()) {
                throw new Error("Invalid start date");
            }

            if (view === "day") {
                return [base.format("YYYY-MM-DD")];
            }

            if (view === "last7") {
                const end = base;
                const start = end.subtract(6, "day");
                return Array.from({ length: 7 }, (_, idx) => start.add(idx, "day").format("YYYY-MM-DD"));
            }

            if (view === "last14") {
                const end = base;
                const start = end.subtract(13, "day");
                return Array.from({ length: 14 }, (_, idx) => start.add(idx, "day").format("YYYY-MM-DD"));
            }

            if (view === "week") {
                const start = startOfWeekMonday(base);
                return Array.from({ length: 7 }, (_, idx) => start.add(idx, "day").format("YYYY-MM-DD"));
            }

            if (view === "twoWeeks") {
                const start = startOfWeekMonday(base);
                return Array.from({ length: 14 }, (_, idx) => start.add(idx, "day").format("YYYY-MM-DD"));
            }

            if (view === "month") {
                const start = base.startOf("month");
                const days = start.daysInMonth();
                return Array.from({ length: days }, (_, idx) => start.add(idx, "day").format("YYYY-MM-DD"));
            }

            return [base.format("YYYY-MM-DD")];
        }

        function collectEntries(entriesNode, dates, habitMap) {
            const rangeSet = new Set(dates);
            const result = {};

            if (!entriesNode) {
                return result;
            }

            getChildren(entriesNode).forEach((entry) => {
                const key = entry.getLabelValue(constants.labels.entryKey);
                if (!key) {
                    return;
                }
                const [habitId, entryDate] = key.split(":");
                if (!habitId || !entryDate || !rangeSet.has(entryDate)) {
                    return;
                }
                const habit = habitMap[habitId];
                if (!habit) {
                    return;
                }

                if (!result[habitId]) {
                    result[habitId] = {};
                }
                if (!result[habitId][entryDate]) {
                    result[habitId][entryDate] = [];
                }
                result[habitId][entryDate].push(buildEntryPayload(habit, entry, entryDate, key));
            });

            return result;
        }

        function isHabitDaySuccess(habit, entries) {
            if (!entries || !entries.length) {
                return false;
            }
            const active = entries.filter((entry) => !entry.skipped);
            if (!active.length) {
                return false;
            }
            if (habit.type === "check") {
                return active.some((entry) => !!entry.value);
            }
            const target = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;
            if (target !== null) {
                return active.some((entry) => Number(entry.value || 0) >= target);
            }
            return true;
        }

        function computePreStreaks(habits, entriesByHabit, lookbackDates) {
            const streaks = {};
            const ordered = Array.isArray(lookbackDates) ? lookbackDates.slice() : [];
            habits.forEach((habit) => {
                const habitEntries = entriesByHabit?.[habit.id] || {};
                let consecutive = 0;
                for (let i = ordered.length - 1; i >= 0; i -= 1) {
                    const date = ordered[i];
                    const status = evaluateHabitDayStatus(habit, habitEntries[date]);
                    if (!status.success) {
                        break;
                    }
                    consecutive += 1;
                }
                streaks[habit.id] = { consecutive };
            });
            return streaks;
        }

        function aggregateHabitRange(habit, habitEntries, dates, context = {}) {
            const summary = {
                total: 0,
                average: 0,
                completed: 0,
                count: 0,
                skipped: 0,
                days: dates.length,
                activeDays: 0,
                targetsMet: 0,
                max: null,
                min: null,
                currentStreak: 0,
                longestStreak: 0,
                streakDebug: {},
                streakSpanDays: 0
            };

            const numericTarget = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;
            let accumulator = 0;
            let numericCount = 0;
            let ratedAccumulator = 0;
            let ratedCount = 0;
            const streakGoal = Number.isFinite(Number(habit.meta?.streakTarget)) ? Number(habit.meta.streakTarget) : null;
            const rawWindow = context.streakWindow !== undefined ? context.streakWindow : habit.meta?.streakWindow;
            const streakWindow = Number.isFinite(Number(rawWindow)) && Number(rawWindow) > 0
                ? Number(rawWindow)
                : CONSTANTS.streakWindowDays;
            const usesRolling = Number.isFinite(streakGoal) && Number.isFinite(streakWindow) && streakWindow > 0;
            const debugEnabled = !!context.debugEnabled;
            summary.streakGoal = Number.isFinite(streakGoal) ? streakGoal : null;
            summary.streakWindowDays = streakWindow;
            summary.streakActive = false;
            summary.streakStart = null;
            summary.streakEnd = null;
            summary.streakSpanDays = 0;
            const initialConsecutive = habit.type === "check" ? (context.consecutive || 0) : 0;
            let currentConsecutive = initialConsecutive;
            let longestConsecutive = initialConsecutive;

            dates.forEach((date) => {
                const list = ensureEntryArray(habitEntries?.[date]);

                if (!list.length) {
                    if (habit.type === "check" && !usesRolling) {
                        currentConsecutive = 0;
                    }
                    return;
                }

                let dayHasSuccess = false;
                let daySkipped = 0;

                list.forEach((entry) => {
                    if (entry.skipped) {
                        daySkipped += 1;
                        return;
                    }

                    const rawValue = entry.value;
                    const numeric = Number(rawValue);
                    const isNumeric = rawValue !== null && rawValue !== undefined && Number.isFinite(numeric);

                    switch (habit.type) {
                        case "check":
                            if (rawValue) {
                                dayHasSuccess = true;
                            }
                            break;
                        case "rating":
                            if (isNumeric) {
                                ratedAccumulator += numeric;
                                ratedCount += 1;
                                summary.max = summary.max === null ? numeric : Math.max(summary.max, numeric);
                                summary.min = summary.min === null ? numeric : Math.min(summary.min, numeric);
                                if (numericTarget !== null && numeric >= numericTarget) {
                                    summary.targetsMet += 1;
                                }
                            }
                            break;
                        default:
                            if (isNumeric) {
                                accumulator += numeric;
                                numericCount += 1;
                                summary.max = summary.max === null ? numeric : Math.max(summary.max, numeric);
                                summary.min = summary.min === null ? numeric : Math.min(summary.min, numeric);
                                if (numericTarget !== null && numeric >= numericTarget) {
                                    summary.targetsMet += 1;
                                }
                            }
                            break;
                    }
                });

                const allSkipped = daySkipped === list.length;
                if (allSkipped) {
                    summary.skipped += 1;
                    if (habit.type === "check" && !usesRolling) {
                        currentConsecutive = 0;
                    }
                    return;
                }

                summary.activeDays += 1;

                if (habit.type === "check") {
                    summary.count += 1;
                    if (dayHasSuccess) {
                        summary.completed += 1;
                        if (!usesRolling) {
                            currentConsecutive += 1;
                            longestConsecutive = Math.max(longestConsecutive, currentConsecutive);
                        }
                    } else {
                        if (!usesRolling) {
                            currentConsecutive = 0;
                        }
                    }
                } else {
                    summary.count += list.length;
                }
            });

            if (["count", "time", "value"].includes(habit.type)) {
                summary.total = accumulator;
                summary.average = numericCount > 0 ? accumulator / numericCount : 0;
            }

            if (habit.type === "rating") {
                summary.average = ratedCount > 0 ? ratedAccumulator / ratedCount : 0;
            }
            if (habit.type === "check") {
                const denominator = summary.days - summary.skipped;
                summary.total = summary.completed;
                summary.average = denominator > 0 ? summary.completed / denominator : 0;
                summary.targetsMet = summary.completed;
            }

            if (usesRolling) {
                const streakInfo = calculateRollingStreak(
                    habit,
                    habitEntries || {},
                    Array.isArray(context.streakDates) ? context.streakDates : [],
                    context.todayISO,
                    streakWindow,
                    streakGoal,
                    debugEnabled
                );
                summary.currentStreak = streakInfo.current || 0;
                summary.longestStreak = Math.max(summary.longestStreak, streakInfo.longest || 0);
                summary.streakActive = !!streakInfo.active;
                summary.streakStart = streakInfo.startDate || null;
                summary.streakEnd = streakInfo.endDate || null;
                summary.streakSpanDays = streakInfo.span || 0;
                summary.streakGoal = Number.isFinite(streakGoal) ? streakGoal : null;
                summary.streakWindowDays = streakWindow;
                summary.streakDebug = debugEnabled ? (streakInfo.debug || {}) : {};
            } else if (habit.type === "check") {
                summary.currentStreak = currentConsecutive;
                summary.longestStreak = Math.max(summary.longestStreak, longestConsecutive);
                summary.streakDebug = debugEnabled ? {} : {};
            }

            return summary;
        }

        function buildRangeSnapshot(view, startDate) {
            const normalizedView = constants.views.includes(view) ? view : "day";
            const dates = buildDateRange(normalizedView, startDate);
            const structure = ensureStructure();
            const debugEnabled = !!structure.debugEnabled;
            const habitsNode = api.getNote(structure.habitsId);
            const entriesNode = api.getNote(structure.entriesId);
            const habitNotes = getChildren(habitsNode).filter((child) => child.getLabelValue(constants.labels.role) === "habit");
            ensureEntryStructure(structure);

            const groupOrderMap = (structure.groups || []).reduce((acc, group, index) => {
                acc[group.id] = index;
                return acc;
            }, {});

            const habits = habitNotes
                .map((note) => hydrateHabit(note))
                .filter((habit) => !habit.archived)
                .sort((a, b) => {
                    const groupRankA = groupOrderMap[a.groupId] ?? 99999;
                    const groupRankB = groupOrderMap[b.groupId] ?? 99999;
                    if (groupRankA !== groupRankB) {
                        return groupRankA - groupRankB;
                    }
                    if (a.order !== b.order) {
                        return a.order - b.order;
                    }
                    return a.title.localeCompare(b.title);
                });

            const habitMap = habits.reduce((acc, habit) => {
                acc[habit.id] = habit;
                return acc;
            }, {});

            const todayISO = api.dayjs().format("YYYY-MM-DD");
            const preseedDates = buildPriorDates(dates[0], CONSTANTS.streakPreseedDays);
            const streakDates = buildTrailingDates(todayISO, CONSTANTS.streakLookbackDays);
            const combinedDates = Array.from(new Set([...dates, ...preseedDates, ...streakDates])).sort();

            const entries = collectEntries(entriesNode, combinedDates, habitMap);
            const preStreaks = computePreStreaks(habits, entries, preseedDates);
            const summary = habits.reduce((acc, habit) => {
                const initialState = preStreaks[habit.id] || { consecutive: 0 };
                const streakWindow = Number.isFinite(Number(habit.meta?.streakWindow)) && Number(habit.meta.streakWindow) > 0
                    ? Number(habit.meta.streakWindow)
                    : CONSTANTS.streakWindowDays;
                acc[habit.id] = aggregateHabitRange(habit, entries[habit.id] || {}, dates, {
                    consecutive: initialState.consecutive || 0,
                    streakDates,
                    todayISO,
                    streakWindow,
                    debugEnabled
                });
                return acc;
            }, {});

            return {
                view: normalizedView,
                startDate: dates[0],
                endDate: dates[dates.length - 1],
                dates,
                habits,
                groups: structure.groups,
                entries,
                summary,
                compactLevel: structure.compactLevel,
                debugEnabled,
                subentriesExpanded: structure.subentriesExpanded !== false,
                rangeAlignment: structure.rangeAlignment === "grid" ? "grid" : "float"
            };
        }

        function persistEntry(payload) {
            const structure = ensureEntryStructure(payload.structure || null);
            const habitsNode = api.getNote(structure.habitsId);
            const entriesNode = api.getNote(structure.entriesId);

            const habitNote = getChildren(habitsNode).find((child) => child.noteId === payload.habitId);
            if (!habitNote) {
                throw new Error("Habit not found");
            }

            const habit = hydrateHabit(habitNote);
            const subEntries = Array.isArray(habit.meta?.subEntries) ? habit.meta.subEntries : [];
            const hasSubEntryTemplates = subEntries.length > 0;
            const allowMultiple = hasSubEntryTemplates || !!(habit.meta && habit.meta.multiEntries);
            const baseKey = `${habit.id}:${payload.date}`;

            let normalizedSubEntryId = null;
            if (hasSubEntryTemplates) {
                let requestedSubEntryId = typeof payload.subEntryId === "string" ? payload.subEntryId.trim() : null;
                if ((!requestedSubEntryId || !requestedSubEntryId.length) && typeof payload.entryKey === "string") {
                    const keyParts = payload.entryKey.split(":");
                    if (keyParts.length >= 3) {
                        requestedSubEntryId = keyParts.slice(2).join(":");
                    }
                }
                if (requestedSubEntryId) {
                    const template = subEntries.find((item) => item.id === requestedSubEntryId);
                    if (template) {
                        normalizedSubEntryId = template.id;
                        payload.subEntryId = normalizedSubEntryId;
                    } else {
                        backendLog("warn", "sub-entry.unknown-id", {
                            habitId: habit.id,
                            requestedSubEntryId
                        });
                    }
                }
            }

            let entryKey = null;
            let entry = null;

            if (hasSubEntryTemplates && normalizedSubEntryId) {
                entryKey = `${baseKey}:${normalizedSubEntryId}`;
                entry = getChildren(entriesNode).find((child) => child.getLabelValue(constants.labels.entryKey) === entryKey) || null;
            } else if (allowMultiple) {
                entryKey = payload.entryKey && String(payload.entryKey).startsWith(baseKey)
                    ? String(payload.entryKey)
                    : null;
                if (entryKey) {
                    const existing = api.getNotesWithLabel(constants.labels.entryKey, entryKey) || [];
                    entry = existing.find((note) => !note.isDeleted) || null;
                }
                if (!entry) {
                    let attempts = 0;
                    let generatedKey = null;
                    while (attempts < 12 && !generatedKey) {
                        const candidate = `${baseKey}:${api.randomString(8)}`;
                        const collisions = api.getNotesWithLabel(constants.labels.entryKey, candidate) || [];
                        const activeCollision = collisions.find((note) => !note.isDeleted) || null;
                        if (!activeCollision) {
                            generatedKey = candidate;
                            if (attempts > 0) {
                                backendLog("warn", "entry-key.collision-resolved", {
                                    baseKey,
                                    attempts
                                });
                            }
                        } else {
                            attempts += 1;
                        }
                    }
                    if (!generatedKey) {
                        generatedKey = `${baseKey}:${Date.now()}-${api.randomString(4)}`;
                        backendLog("warn", "entry-key.fallback-timestamp", {
                            baseKey,
                            attempts
                        });
                    }
                    entryKey = generatedKey;
                }
            } else {
                entryKey = baseKey;
                entry = getChildren(entriesNode).find((child) => child.getLabelValue(constants.labels.entryKey) === entryKey);
            }

            const sanitized = sanitizeEntryValue(habit, payload.value, payload.skip);

            if (!entry) {
                const title = `${payload.date} · ${payload.habitTitle || habit.title}`;
                const storedSubEntryId = hasSubEntryTemplates
                    ? normalizedSubEntryId
                    : (payload.subEntryId !== undefined ? payload.subEntryId : null);
                        entry = api.createDataNote(entriesNode.noteId, title, {
                            value: sanitized.value,
                            skipped: !!payload.skip,
                            display: sanitized.display,
                            recordedAt: nowISO(),
                            subEntryId: storedSubEntryId
                        }).note;
                        entry.setLabel(constants.labels.entryKey, entryKey);
                        entry.setLabel(constants.labels.type, habit.type);
                        entry.setLabel(constants.labels.role, "habitEntry");
                        entry.setLabel(constants.labels.entrySkip, payload.skip ? "1" : "0");
                        if (sanitized.display) {
                            entry.setLabel(constants.labels.entryValue, sanitized.display);
                        }
                        entry.setRelation(constants.relations.habitRef, habit.id);
                        entry.setLabel("habitDate", payload.date);
                        entry.save();
                    } else {
                        const previousJson = typeof entry.getJsonContentSafely === "function"
                            ? (entry.getJsonContentSafely() || {})
                            : {};
                        const storedSubEntryId = hasSubEntryTemplates
                            ? normalizedSubEntryId
                            : (payload.subEntryId !== undefined
                                ? payload.subEntryId
                                : (previousJson.subEntryId ?? null));
                        entry.setJsonContent({
                            value: sanitized.value,
                            skipped: !!payload.skip,
                            display: sanitized.display,
                            recordedAt: nowISO(),
                            subEntryId: storedSubEntryId
                        });

                        entry.setLabel(constants.labels.entrySkip, payload.skip ? "1" : "0");
                        if (sanitized.display) {
                            entry.setLabel(constants.labels.entryValue, sanitized.display);
                        } else {
                            entry.removeLabel(constants.labels.entryValue);
                        }
                        entry.setLabel(constants.labels.type, habit.type);
                        entry.setRelation(constants.relations.habitRef, habit.id);
                        entry.setLabel("habitDate", payload.date);

                        const desiredTitle = `${payload.date} · ${payload.habitTitle || habit.title}`;
                        if (entry.title !== desiredTitle) {
                            entry.title = desiredTitle;
                        }

                        entry.save({ forceSave: true });
                    }

                    return {
                        entry: buildEntryPayload(habit, entry, payload.date, entryKey),
                        habit
                    };
        }

        function snapshot(date) {
            const range = buildRangeSnapshot("day", date);
            const dayEntries = Object.keys(range.entries).reduce((acc, habitId) => {
                const entries = range.entries[habitId]?.[range.dates[0]];
                if (Array.isArray(entries) && entries.length) {
                    acc[habitId] = entries;
                } else if (entries) {
                    acc[habitId] = [entries];
                }
                return acc;
            }, {});

            return {
                view: range.view,
                dates: range.dates,
                startDate: range.startDate,
                endDate: range.endDate,
                habits: range.habits,
                groups: range.groups,
                entries: dayEntries,
                summary: range.summary,
                compactLevel: range.compactLevel,
                debugEnabled: range.debugEnabled,
                subentriesExpanded: range.subentriesExpanded !== false,
                rangeAlignment: range.rangeAlignment === "grid" ? "grid" : "float"
            };
        }

        function deleteEntries(params) {
            const keys = Array.isArray(params.keys) ? params.keys : [];
            backendLog("info", "delete-entries.start", {
                keyCount: keys.length,
                keys: keys.slice(0, 5)
            });

            if (!keys.length) {
                return { deleted: 0 };
            }

            let deleted = 0;
            let errors = [];

            keys.forEach((key, keyIndex) => {
                try {
                    backendLog("info", "delete-entries.lookup", {
                        key,
                        keyIndex,
                        label: constants.labels.entryKey
                    });

                    let notes = [];
                    try {
                        // Alternative approach: search in entries book
                        if (!rootNote) {
                            backendLog("error", "delete-entries.no-root", { key, keyIndex });
                            errors.push({ key, keyIndex, error: "No root note" });
                            return;
                        }

                        const structure = ensureEntryStructure(null);
                        const entriesNode = api.getNote(structure.entriesId);
                        
                        if (!entriesNode) {
                            backendLog("error", "delete-entries.no-entries-book", { 
                                key, 
                                keyIndex,
                                entriesId: structure.entriesId 
                            });
                            errors.push({ key, keyIndex, error: "Entries book not found" });
                            return;
                        }

                        backendLog("info", "delete-entries.searching", {
                            key,
                            keyIndex,
                            entriesId: structure.entriesId,
                            entriesTitle: entriesNode.title
                        });

                        // Get all children and filter for matching key
                        const allEntries = getChildren(entriesNode);
                        notes = allEntries.filter((note) => {
                            if (!note) return false;
                            try {
                                const entryKey = note.getLabelValue(constants.labels.entryKey);
                                return entryKey === key;
                            } catch (err) {
                                backendLog("warn", "delete-entries.filter-error", {
                                    key,
                                    error: err?.message || String(err)
                                });
                                return false;
                            }
                        });

                        backendLog("info", "delete-entries.found", {
                            key,
                            keyIndex,
                            count: notes.length,
                            totalEntries: allEntries.length
                        });
                    } catch (searchError) {
                        backendLog("error", "delete-entries.search-error", {
                            key,
                            keyIndex,
                            error: searchError?.message || String(searchError),
                            stack: searchError?.stack || null
                        });
                        errors.push({ key, keyIndex, error: `Search error: ${searchError?.message || String(searchError)}` });
                        return;
                    }

                    if (!notes || notes.length === 0) {
                        backendLog("warn", "delete-entries.no-notes-found", {
                            key,
                            keyIndex
                        });
                        return;
                    }

                    notes.forEach((note, noteIndex) => {
                        try {
                            if (!note) {
                                backendLog("warn", "delete-entries.note-null", {
                                    key,
                                    noteIndex
                                });
                                return;
                            }

                            if (typeof note.isDeleted === 'undefined') {
                                backendLog("warn", "delete-entries.no-isDeleted", {
                                    key,
                                    noteIndex,
                                    noteKeys: Object.keys(note || {})
                                });
                                return;
                            }

                            if (!note.isDeleted) {
                                if (typeof note.markAsDeleted !== 'function') {
                                    backendLog("error", "delete-entries.no-markAsDeleted", {
                                        key,
                                        noteIndex,
                                        noteType: typeof note,
                                        noteKeys: Object.keys(note || {})
                                    });
                                    return;
                                }

                                note.markAsDeleted();
                                deleted += 1;

                                backendLog("info", "delete-entries.deleted", {
                                    key,
                                    noteIndex,
                                    noteId: note?.noteId || 'unknown'
                                });
                            }
                        } catch (noteError) {
                            const errorMsg = noteError?.message || String(noteError);
                            backendLog("error", "delete-entries.note-error", {
                                key,
                                noteIndex,
                                error: errorMsg,
                                stack: noteError?.stack || null,
                                noteId: note?.noteId || 'unknown',
                                hasNote: !!note
                            });
                            errors.push({ key, noteIndex, error: errorMsg });
                        }
                    });
                } catch (keyError) {
                    const errorMsg = keyError?.message || String(keyError);
                    backendLog("error", "delete-entries.key-error", {
                        key,
                        keyIndex,
                        error: errorMsg,
                        stack: keyError?.stack || null
                    });
                    errors.push({ key, keyIndex, error: errorMsg });
                }
            });

            backendLog("info", "delete-entries.complete", {
                deleted,
                errorCount: errors.length,
                errors: errors.slice(0, 3)
            });

            return { deleted, errors: errors.length > 0 ? errors : undefined };
        }

        function createGroup(params) {
            const structure = ensureStructure();
            const habitsNode = api.getNote(structure.habitsId);
            const order = params.order !== undefined
                ? (normalizeNumber(params.order) ?? 0)
                : (structure.groups.length ? Math.max(...structure.groups.map((g) => g.order)) + 10 : 0);
            const title = normalizeString(params.title) || "New Group";
            const color = normalizeString(params.color) || constants.groupDefaults.color;

            const { note } = api.createNewNote({
                parentNoteId: habitsNode.noteId,
                title,
                type: "text",
                content: ""
            });
            note.setLabel(constants.labels.group, "1");
            note.setLabel(constants.labels.groupOrder, String(order));
            note.setLabel(constants.labels.groupColor, color);
            note.save();

            const updated = ensureStructure();
            const group = updated.groups.find((g) => g.id === note.noteId) || hydrateGroup(note);
            return { group, groups: updated.groups };
        }

        function updateGroup(params) {
            if (!params.groupId) {
                throw new Error("Missing group id");
            }
            const groupNote = api.getNote(params.groupId);
            if (!groupNote || groupNote.isDeleted) {
                throw new Error("Group not found");
            }

            if (params.title !== undefined) {
                const title = normalizeString(params.title) || "";
                if (title) {
                    groupNote.title = title;
                }
            }
            if (params.color !== undefined) {
                const color = normalizeString(params.color);
                if (color) {
                    groupNote.setLabel(constants.labels.groupColor, color);
                } else {
                    groupNote.removeLabel(constants.labels.groupColor);
                }
            }
            if (params.order !== undefined) {
                const order = normalizeNumber(params.order);
                if (order !== null) {
                    groupNote.setLabel(constants.labels.groupOrder, String(order));
                }
            }
            groupNote.save({ forceSave: true });

            const updated = ensureStructure();
            const group = updated.groups.find((g) => g.id === groupNote.noteId) || hydrateGroup(groupNote);
            return { group, groups: updated.groups };
        }

        function deleteGroup(params) {
            if (!params.groupId) {
                throw new Error("Missing group id");
            }
            const structure = ensureStructure();
            if (structure.groups.length <= 1) {
                throw new Error("At least one group must remain");
            }

            const habitsNode = api.getNote(structure.habitsId);
            const groupNote = api.getNote(params.groupId);
            if (!groupNote || groupNote.isDeleted) {
                throw new Error("Group not found");
            }

            const fallbackId = params.fallbackGroupId && params.fallbackGroupId !== params.groupId
                ? params.fallbackGroupId
                : structure.groups.find((g) => g.id !== params.groupId)?.id;

            if (!fallbackId) {
                throw new Error("No fallback group available");
            }

            getChildren(habitsNode).forEach((habit) => {
                if (habit.getLabelValue(constants.labels.role) === "habit" && habit.getLabelValue(constants.labels.groupLink) === params.groupId) {
                    habit.setLabel(constants.labels.groupLink, fallbackId);
                }
            });

            groupNote.markAsDeleted();

            const updated = ensureStructure();
            return { groupId: params.groupId, fallbackGroupId: fallbackId, groups: updated.groups };
        }

        function createHabit(params) {
            const structure = ensureStructure();
            const habitsNode = api.getNote(structure.habitsId);
            const groupId = params.groupId || structure.defaultGroupId;
            const title = normalizeString(params.title) || "New Habit";
            const type = normalizeString(params.type) || "check";
            const slug = slugify(normalizeString(params.slug) || title);
            const order = params.order !== undefined ? params.order : (getChildren(habitsNode).length + 1) * 10;

            const unit = normalizeString(params.unit);
            const target = normalizeNumber(params.target);
            const decimals = normalizeNumber(params.decimals);
            const scaleMin = normalizeNumber(params.scaleMin);
            const scaleMax = normalizeNumber(params.scaleMax);
            const description = normalizeString(params.description);
            const color = normalizeString(params.color);
            const icon = normalizeString(params.icon);
            const reminderTime = normalizeString(params.reminderTime);
            const streakTarget = normalizeNumber(params.streakTarget);
            const streakWindow = normalizeNumber(params.streakWindow);
            const quickStep = normalizeNumber(params.quickStep);
            const multiEntries = params.multiEntries === true;
            const subEntries = normalizeSubEntries(params.subEntries, { strict: true });

            const { note } = api.createDataNote(habitsNode.noteId, title, {});
            const meta = {
                templateVersion: constants.version,
                type,
                slug,
                unit,
                target,
                decimals,
                scaleMin,
                scaleMax,
                description,
                color,
                icon,
                reminderTime,
                streakTarget,
                streakWindow,
                quickStep,
                multiEntries,
                subEntries
            };
            note.setJsonContent(meta);
            note.setLabel(constants.labels.role, "habit");
            note.setLabel(constants.labels.type, type);
            note.setLabel(constants.labels.slug, slug);
            note.setLabel(constants.labels.order, String(order));
            note.setLabel(constants.labels.groupLink, groupId);
            if (icon) {
                note.setLabel("iconClass", icon);
            }
            note.save();

            return { habit: hydrateHabit(note) };
        }

        function collectHabitEntries(entriesNode, habitId) {
            return getChildren(entriesNode).filter((entry) => {
                const key = entry.getLabelValue(constants.labels.entryKey);
                return key && key.startsWith(`${habitId}:`) && !entry.isDeleted;
            });
        }

        function sortEntriesByRecordedAt(notes) {
            return notes.slice().sort((a, b) => {
                const dataA = a.getJsonContentSafely?.() || {};
                const dataB = b.getJsonContentSafely?.() || {};
                const timeA = dataA.recordedAt || a.modifyTime || a.createTime || "";
                const timeB = dataB.recordedAt || b.modifyTime || b.createTime || "";
                return timeA.localeCompare(timeB);
            });
        }

        function findEntryByKey(entryKey) {
            const matches = api.getNotesWithLabel(constants.labels.entryKey, entryKey) || [];
            return matches.find((note) => !note.isDeleted) || null;
        }

        function writeEntryForTemplate(entriesNode, habit, date, templateId, options = {}) {
            const entryKey = `${habit.id}:${date}:${templateId}`;
            let entry = options.entryNote || findEntryByKey(entryKey);
            const sanitized = sanitizeEntryValue(habit, options.value, options.skip);
            const payload = {
                value: sanitized.value,
                skipped: !!options.skip,
                display: sanitized.display,
                recordedAt: options.recordedAt || nowISO(),
                subEntryId: templateId
            };

            if (!entry) {
                const created = api.createDataNote(entriesNode.noteId, `${date} · ${habit.title}`, payload);
                entry = created.note;
            } else {
                entry.setJsonContent(payload);
            }

            entry.setLabel(constants.labels.entryKey, entryKey);
            entry.setLabel(constants.labels.type, habit.type);
            entry.setLabel(constants.labels.entrySkip, payload.skipped ? "1" : "0");
            if (payload.display) {
                entry.setLabel(constants.labels.entryValue, payload.display);
            } else {
                entry.removeLabel(constants.labels.entryValue);
            }
            entry.setRelation(constants.relations.habitRef, habit.id);
            entry.setLabel("habitDate", date);
            entry.save({ forceSave: true });
            return entry;
        }

        function ensureSkipEntry(entriesNode, habit, date, templateId) {
            writeEntryForTemplate(entriesNode, habit, date, templateId, {
                entryNote: findEntryByKey(`${habit.id}:${date}:${templateId}`),
                value: null,
                skip: true,
                recordedAt: nowISO()
            });
        }

        function aggregateEntriesForLast(habit, baseInfo, remainderNotes) {
            if (!remainderNotes.length) {
                return baseInfo;
            }
            const dataPoints = [];
            if (baseInfo) {
                dataPoints.push({
                    value: baseInfo.value,
                    skipped: !!baseInfo.skip,
                    recordedAt: baseInfo.recordedAt || nowISO()
                });
            }
            remainderNotes.forEach((note) => {
                if (!note || note.isDeleted) {
                    return;
                }
                const json = note.getJsonContentSafely?.() || {};
                dataPoints.push({
                    value: json.value,
                    skipped: !!json.skipped,
                    recordedAt: json.recordedAt || note.modifyTime || note.createTime || nowISO()
                });
            });

            const activeValues = dataPoints.filter((point) => !point.skipped && point.value !== null && point.value !== undefined && Number.isFinite(Number(point.value)));
            let skip = false;
            let aggregatedValue = null;

            if (!activeValues.length) {
                skip = true;
            } else {
                const average = activeValues.reduce((acc, point) => acc + Number(point.value || 0), 0) / activeValues.length;
                switch (habit.type) {
                    case "time":
                    case "count": {
                        aggregatedValue = Math.round(average);
                        break;
                    }
                    case "value": {
                        const decimals = Number.isFinite(Number(habit.meta?.decimals))
                            ? Math.min(4, Math.max(0, Number(habit.meta.decimals)))
                            : 2;
                        aggregatedValue = Number(average.toFixed(decimals));
                        break;
                    }
                    case "rating": {
                        aggregatedValue = Math.round(average);
                        break;
                    }
                    case "check": {
                        aggregatedValue = average >= 0.5 ? 1 : 0;
                        break;
                    }
                    default: {
                        aggregatedValue = activeValues[activeValues.length - 1].value;
                    }
                }
            }

            const latestRecorded = dataPoints.reduce((latest, point) => {
                if (!latest) {
                    return point.recordedAt;
                }
                if (!point.recordedAt) {
                    return latest;
                }
                return point.recordedAt > latest ? point.recordedAt : latest;
            }, baseInfo?.recordedAt || nowISO());

            return {
                entryNote: baseInfo?.entryNote || null,
                value: aggregatedValue,
                skip,
                recordedAt: latestRecorded
            };
        }

        function convertSingleEntriesToSubEntries(entriesNode, habit, subEntries) {
            if (!Array.isArray(subEntries) || !subEntries.length) {
                return;
            }
            const entryNotes = collectHabitEntries(entriesNode, habit.id);
            if (!entryNotes.length) {
                return;
            }
            const templateIds = new Set(subEntries.map((template) => template.id));
            const alreadyConverted = entryNotes.every((note) => {
                const key = note.getLabelValue(constants.labels.entryKey) || "";
                const parts = key.split(":");
                return parts.length >= 3 && templateIds.has(parts[2]);
            });
            if (alreadyConverted) {
                return;
            }

            const byDate = new Map();
            entryNotes.forEach((note) => {
                const key = note.getLabelValue(constants.labels.entryKey) || "";
                const parts = key.split(":");
                if (parts.length < 2 || !parts[1]) {
                    return;
                }
                const date = parts[1];
                if (!byDate.has(date)) {
                    byDate.set(date, []);
                }
                byDate.get(date).push(note);
            });

            byDate.forEach((notes, date) => {
                const sorted = sortEntriesByRecordedAt(notes);
                const primary = sorted.shift();
                if (!primary) {
                    return;
                }
                const json = primary.getJsonContentSafely?.() || {};
                const skip = !!json.skipped;
                const value = skip ? null : json.value;
                const recordedAt = json.recordedAt || primary.modifyTime || primary.createTime || nowISO();
                writeEntryForTemplate(entriesNode, habit, date, subEntries[0].id, {
                    entryNote: primary,
                    value,
                    skip,
                    recordedAt
                });
                sorted.forEach((extra) => extra.markAsDeleted());
                for (let index = 1; index < subEntries.length; index += 1) {
                    ensureSkipEntry(entriesNode, habit, date, subEntries[index].id);
                }
            });
        }

        function convertMultiEntriesToSubEntries(entriesNode, habit, subEntries) {
            if (!Array.isArray(subEntries) || !subEntries.length) {
                return;
            }
            const entryNotes = collectHabitEntries(entriesNode, habit.id);
            if (!entryNotes.length) {
                return;
            }
            const templateIds = new Set(subEntries.map((template) => template.id));
            const alreadyConverted = entryNotes.every((note) => {
                const key = note.getLabelValue(constants.labels.entryKey) || "";
                const parts = key.split(":");
                return parts.length >= 3 && templateIds.has(parts[2]);
            });
            if (alreadyConverted) {
                return;
            }

            const byDate = new Map();
            entryNotes.forEach((note) => {
                const key = note.getLabelValue(constants.labels.entryKey) || "";
                const parts = key.split(":");
                if (parts.length < 2 || !parts[1]) {
                    return;
                }
                const date = parts[1];
                if (!byDate.has(date)) {
                    byDate.set(date, []);
                }
                byDate.get(date).push(note);
            });

            byDate.forEach((notes, date) => {
                const sorted = sortEntriesByRecordedAt(notes);
                const templateCount = subEntries.length;
                if (!templateCount) {
                    return;
                }

                const assignment = [];
                for (let index = 0; index < templateCount; index += 1) {
                    const note = sorted[index] || null;
                    const json = note?.getJsonContentSafely?.() || {};
                    assignment.push({
                        entryNote: note,
                        value: json.value ?? null,
                        skip: !!json.skipped,
                        recordedAt: json.recordedAt || note?.modifyTime || note?.createTime || nowISO()
                    });
                }

                const remainder = sorted.slice(templateCount);
                if (templateCount) {
                    const baseInfo = assignment[templateCount - 1] || { entryNote: null, value: null, skip: true, recordedAt: nowISO() };
                    assignment[templateCount - 1] = aggregateEntriesForLast(habit, baseInfo, remainder) || baseInfo;
                }

                remainder.forEach((extra) => extra.markAsDeleted());

                for (let index = 0; index < templateCount; index += 1) {
                    const template = subEntries[index];
                    const info = assignment[index] || { entryNote: null, value: null, skip: true, recordedAt: nowISO() };
                    writeEntryForTemplate(entriesNode, habit, date, template.id, info);
                }
            });
        }

        function updateHabit(params) {
            if (!params.habitId) {
                throw new Error("Missing habit id");
            }
            const habitNote = api.getNote(params.habitId);
            if (!habitNote || habitNote.isDeleted) {
                throw new Error("Habit not found");
            }

            if (params.title !== undefined) {
                const title = normalizeString(params.title);
                if (title) {
                    habitNote.title = title;
                }
            }
            if (params.type !== undefined) {
                const newType = normalizeString(params.type);
                if (newType) {
                    habitNote.setLabel(constants.labels.type, newType);
                }
            }
            if (params.slug !== undefined) {
                const slugValue = normalizeString(params.slug) || habitNote.title;
                habitNote.setLabel(constants.labels.slug, slugify(slugValue));
            }
            if (params.order !== undefined) {
                const order = normalizeNumber(params.order);
                if (order !== null) {
                    habitNote.setLabel(constants.labels.order, String(order));
                }
            }
            if (params.groupId !== undefined) {
                habitNote.setLabel(constants.labels.groupLink, params.groupId);
            }
            if (params.icon !== undefined) {
                const icon = normalizeString(params.icon);
                if (icon) {
                    habitNote.setLabel("iconClass", icon);
                } else {
                    habitNote.removeLabel("iconClass");
                }
            }

            const currentMeta = habitNote.getJsonContentSafely() || {};
            const nextSubEntries = params.subEntries !== undefined
                ? normalizeSubEntries(params.subEntries, { strict: true })
                : normalizeSubEntries(currentMeta.subEntries);
            const updatedMeta = {
                ...currentMeta,
                type: habitNote.getLabelValue(constants.labels.type) || currentMeta.type || "check",
                slug: habitNote.getLabelValue(constants.labels.slug) || currentMeta.slug || null,
                unit: params.unit !== undefined ? normalizeString(params.unit) : (currentMeta.unit ?? null),
                target: params.target !== undefined ? normalizeNumber(params.target) : (currentMeta.target ?? null),
                decimals: params.decimals !== undefined ? normalizeNumber(params.decimals) : (currentMeta.decimals ?? null),
                scaleMin: params.scaleMin !== undefined ? normalizeNumber(params.scaleMin) : (currentMeta.scaleMin ?? null),
                scaleMax: params.scaleMax !== undefined ? normalizeNumber(params.scaleMax) : (currentMeta.scaleMax ?? null),
                description: params.description !== undefined ? normalizeString(params.description) : (currentMeta.description ?? null),
                color: params.color !== undefined ? normalizeString(params.color) : (currentMeta.color ?? null),
                icon: params.icon !== undefined ? normalizeString(params.icon) : (currentMeta.icon ?? null),
                reminderTime: params.reminderTime !== undefined ? normalizeString(params.reminderTime) : (currentMeta.reminderTime ?? null),
                streakTarget: params.streakTarget !== undefined ? normalizeNumber(params.streakTarget) : (currentMeta.streakTarget ?? null),
                streakWindow: params.streakWindow !== undefined ? normalizeNumber(params.streakWindow) : (currentMeta.streakWindow ?? null),
                quickStep: params.quickStep !== undefined ? normalizeNumber(params.quickStep) : (currentMeta.quickStep ?? null),
                multiEntries: params.multiEntries !== undefined ? !!params.multiEntries : (currentMeta.multiEntries ?? false),
                subEntries: nextSubEntries
            };
            habitNote.setJsonContent(updatedMeta);
            habitNote.save({ forceSave: true });

            const updatedHabit = hydrateHabit(habitNote);

            try {
                const structure = ensureEntryStructure(null);
                const entriesNode = api.getNote(structure.entriesId);
                const previousHadTemplates = Array.isArray(currentMeta.subEntries) && currentMeta.subEntries.length > 0;
                const previousMulti = !!currentMeta.multiEntries;
                const nextHasTemplates = Array.isArray(nextSubEntries) && nextSubEntries.length > 0;
                const nextMulti = !!updatedMeta.multiEntries;

                if (entriesNode && nextHasTemplates) {
                    if (!previousMulti && !previousHadTemplates && nextMulti) {
                        convertSingleEntriesToSubEntries(entriesNode, updatedHabit, nextSubEntries);
                    } else if (previousMulti && !previousHadTemplates && nextMulti) {
                        convertMultiEntriesToSubEntries(entriesNode, updatedHabit, nextSubEntries);
                    }
                }
            } catch (conversionError) {
                backendLog("error", "habit.update.subentry-convert-failed", {
                    habitId: habitNote.noteId,
                    message: conversionError?.message || conversionError
                });
            }

            return { habit: updatedHabit };
        }

        function deleteHabit(params) {
            if (!params.habitId) {
                throw new Error("Missing habit id");
            }
            const structure = ensureStructure();
            const habitNote = api.getNote(params.habitId);
            if (!habitNote || habitNote.isDeleted) {
                throw new Error("Habit not found");
            }

            if (params.deleteEntries) {
                const entriesNode = api.getNote(structure.entriesId);
                getChildren(entriesNode).forEach((entry) => {
                    const key = entry.getLabelValue(constants.labels.entryKey);
                    if (key && key.startsWith(`${params.habitId}:`)) {
                        entry.markAsDeleted();
                    }
                });
            }

            habitNote.markAsDeleted();

            return { habitId: params.habitId };
        }

                function setCompactMode(payload) {
                    if (!rootNote || !rootNote.noteId) {
                        throw new Error("Root note unavailable in setCompactMode");
                    }
                    const level = normalizeCompactLevelBackend(payload);
                    rootNote.setLabel(constants.labels.compact, String(level));
                    return { compactLevel: level };
                }

                function setSubentryExpansion(enabled) {
                    if (!rootNote || !rootNote.noteId) {
                        throw new Error("Root note unavailable in setSubentryExpansion");
                    }
                    const next = enabled === false ? "0" : "1";
                    if (enabled === null) {
                        rootNote.removeLabel(constants.labels.subentriesExpanded);
                    } else {
                        rootNote.setLabel(constants.labels.subentriesExpanded, next);
                    }
                    return { subentriesExpanded: next !== "0" };
                }

                function setRangeAlignment(mode) {
                    if (!rootNote || !rootNote.noteId) {
                        throw new Error("Root note unavailable in setRangeAlignment");
                    }
                    const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : "";
                    const acceptable = new Set(["grid", "aligned", "columns", "column", "float"]);
                    const resolved = acceptable.has(normalized) ? normalized : "float";
                    const stored = resolved === "grid" || resolved === "aligned" || resolved === "columns" ? "grid" : "float";
                    rootNote.setLabel(constants.labels.rangeAlignment, stored);
                    return { rangeAlignment: stored };
                }

                // Pre-flight check for all actions
                if (!rootNote) {
                    backendLog("error", "action.dispatch.no-root", {
                        action: actionName,
                        paramsRootNoteId: params?.rootNoteId || null,
                        paramsScriptNoteId: params?.scriptNoteId || null
                    });
                    throw new Error(`Root note is null for action ${actionName}`);
                }

                if (!rootNote.noteId) {
                    backendLog("error", "action.dispatch.no-root-id", {
                        action: actionName,
                        hasRootNote: !!rootNote,
                        rootNoteType: typeof rootNote,
                        rootNoteKeys: Object.keys(rootNote || {})
                    });
                    throw new Error(`Root note has no noteId for action ${actionName}`);
                }

                backendLog("info", "action.dispatch.preflight-ok", {
                    action: actionName,
                    rootNoteId: rootNote.noteId,
                    hasScriptNote: !!scriptNote
                });

                if (actionName === constants.actions.ENSURE_STRUCTURE) {
                    return ensureStructure();
                }

                if (actionName === constants.actions.SNAPSHOT) {
                    return snapshot(params.date);
                }

                if (actionName === constants.actions.RANGE_SNAPSHOT) {
                    return buildRangeSnapshot(params.view || "week", params.startDate || params.date || api.dayjs().format("YYYY-MM-DD"));
                }

                if (actionName === constants.actions.SAVE_ENTRY) {
                    return persistEntry(params);
                }

                if (actionName === constants.actions.DELETE_ENTRIES) {
                    backendLog("info", "action.delete-entries.dispatch", {
                        keyCount: Array.isArray(params?.keys) ? params.keys.length : 0,
                        keys: Array.isArray(params?.keys) ? params.keys.slice(0, 3) : []
                    });
                    return deleteEntries(params);
                }

                if (actionName === constants.actions.SET_COMPACT) {
                    return setCompactMode(params);
                }

                if (actionName === constants.actions.SET_SUBENTRY_EXPANSION) {
                    return setSubentryExpansion(params.enabled);
                }

                if (actionName === constants.actions.SET_RANGE_ALIGNMENT) {
                    return setRangeAlignment(params.mode);
                }

                if (actionName === constants.actions.CREATE_GROUP) {
                    return createGroup(params);
                }

                if (actionName === constants.actions.UPDATE_GROUP) {
                    return updateGroup(params);
                }

                if (actionName === constants.actions.DELETE_GROUP) {
                    return deleteGroup(params);
                }

                if (actionName === constants.actions.CREATE_HABIT) {
                    return createHabit(params);
                }

                if (actionName === constants.actions.UPDATE_HABIT) {
                    return updateHabit(params);
                }

                if (actionName === constants.actions.DELETE_HABIT) {
                    return deleteHabit(params);
                }

                throw new Error(`Unknown backend action: ${actionName}`);
            };

            try {
                const result = await this.api.runOnBackend(backendFn, [CONSTANTS, action, paramsWithRoot]);
                this.logger?.info?.("backend.call.success", {
                    action,
                    hasResult: !!result,
                    resultKeys: result ? Object.keys(result) : null
                });
                return result;
            } catch (error) {
                this.logger?.error?.("backend.call.failed", {
                    action,
                    rootNoteId: paramsWithRoot.rootNoteId || null,
                    scriptNoteId: paramsWithRoot.scriptNoteId || null,
                    message: error?.message || String(error),
                    stack: error?.stack || null,
                    payloadKeys: Object.keys(payload || {})
                });

                if (paramsWithRoot.scriptNoteId) {
                    const fallbackParams = { ...paramsWithRoot };
                    delete fallbackParams.scriptNoteId;
                    this.scriptNoteId = null;
                    this.logger?.warn?.("backend.call.retry", {
                        action,
                        reason: "script-note-load-failed",
                        message: error?.message || String(error),
                        stack: error?.stack || null
                    });
                    return await this.api.runOnBackend(backendFn, [CONSTANTS, action, fallbackParams]);
                }

                throw error;
            }
        }
    }

    class NoteSwitchDetector {
        constructor(api, logger, handler) {
            this.api = api;
            this.logger = logger;
            this.handler = handler;
            this.active = false;
            this.interval = null;
            this.observer = null;
            this.hashListener = null;
            this.eventHandlers = [];
        }

        async start() {
            this.active = true;
            await this.attachEvents();
            this.attachMutationObserver();
            this.attachHashListener();
            this.attachPolling();
        }

        async restart(api) {
            await this.stop();
            this.api = api;
            await this.start();
        }

        async stop() {
            this.active = false;
            if (this.interval) {
                runtimeTimers.clearInterval(this.interval);
                this.interval = null;
            }
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.hashListener) {
                if (hasWindow && globalScope.removeEventListener && this.hashListener) {
                    globalScope.removeEventListener("hashchange", this.hashListener);
                }
                this.hashListener = null;
            }
            if (this.eventHandlers.length) {
                const detailWidget = this.eventHandlers[0]?.widget;
                if (detailWidget) {
                    this.eventHandlers.forEach(({ widget, event, handler }) => {
                        try {
                            widget.removeHandler(event, handler);
                        } catch (e) {
                            // ignore
                        }
                    });
                }
                this.eventHandlers = [];
            }
        }

        async attachEvents() {
            try {
                const widget = await this.api.getActiveNoteDetailWidget();
                const noteId = this.api.startNote?.noteId || this.api.currentNote?.noteId || null;
                const run = (source) => {
                    if (!this.active) {
                        return;
                    }
                    try {
                        const active = this.api.getActiveContextNote?.();
                        if (!noteId || active?.noteId === noteId) {
                            this.logger.info("detector.note-switched", { source });
                            this.handler(source, active || null);
                        }
                    } catch (error) {
                        this.logger.warn("detector.event-check-failed", { error: error.message });
                    }
                };

                const events = ["noteSwitched", "noteSwitchedAndActivated"];
                events.forEach((event) => {
                    const handler = () => run(event);
                    widget.registerHandler(event, handler);
                    this.eventHandlers.push({ widget, event, handler });
                });

                this.logger.info("detector.events-attached", {});
            } catch (error) {
                this.logger.warn("detector.events-unavailable", { error: error.message });
            }
        }

        attachMutationObserver() {
            const container = this.api.$container?.parent()?.get?.(0);
            if (!container) {
                return;
            }

            this.observer = new MutationObserver(() => {
                this.check("mutation");
            });

            this.observer.observe(container, {
                childList: true,
                subtree: false,
                attributes: false
            });

            this.logger.info("detector.mutation-attached", {});
        }

        attachHashListener() {
            this.hashListener = () => this.check("hash");
            if (hasWindow && globalScope.addEventListener) {
                globalScope.addEventListener("hashchange", this.hashListener);
            }
        }

        attachPolling() {
            this.interval = runtimeTimers.setInterval(() => this.check("polling"), 2000);
        }

        check(source) {
            if (!this.active) {
                return;
            }
            try {
                const note = this.api.getActiveContextNote?.();
                const startNoteId = this.api.startNote?.noteId || null;
                if (!startNoteId || note?.noteId === startNoteId) {
                    this.logger.info("detector.check-fired", { source });
                    this.handler(source, note || null);
                }
            } catch (error) {
                this.logger.warn("detector.check-error", { error: error.message });
            }
        }
    }

    class HabitDashboardApp {
        constructor(api, $root) {
            this.api = api;
            this.logger = new Logger(api);
            this.backend = new Backend(api, this.logger);
            const todayISO = api.dayjs().format("YYYY-MM-DD");
            this.state = {
                dateISO: todayISO,
                view: "last7",
                habits: [],
                groups: [],
                entries: new Map(),
                rangeEntries: {},
                summary: {},
                dates: [],
                compactLevel: 0,
                loading: false,
                debugEnabled: false,
                alignRangeByDay: false
            };
            this.dom = {
                root: $root && $root.length ? $root : ensureRootStructure(api)
            };
            this.activeModal = null;
            this.detector = new NoteSwitchDetector(api, this.logger, (source, note) => this.handleNoteSwitch(source, note));
            this.activePresses = new Map();
            this.dragState = null;
            this.longPressDelay = 450;
            this.toastContainer = null;
            this.toastTimeouts = new Set();
            this.lastCelebration = 0;
            this.celebrationTimestamps = new Map();
            this.pendingCelebration = null;
            this.destroying = false;
            this.ui = {
                rangeSubentryExpansion: new Map(),
                expandAllSubEntries: true
            };
            this.menuOutsideHandler = null;
            this.menuKeyHandler = null;
            this.activeRootNoteId = null;
            this.suspended = false;
            this.eventsBound = false;
        }

        async init() {
            if (!this.api?.$container) {
                this.logger.warn("init.no-container", {});
                return;
            }

            const initialRootId = this.detectInitialRootNoteId(this.api);
            if (initialRootId) {
                this.activeRootNoteId = initialRootId;
                this.backend.setExplicitRootNoteId(initialRootId, { allowPending: true });
            } else {
                this.logger.warn("init.no-root", {});
            }

            this.cacheDom();

            if (!this.dom.root?.length) {
                this.logger.warn("init.no-root", {});
                return;
            }

            if (!initialRootId) {
                this.suspendDashboard(null);
                await this.detector.start();
                return;
            }

            this.bindEvents();

            try {
                await this.backend.ensureStructure();
                const snapshot = this.state.view === "day"
                    ? await this.backend.snapshot(this.state.dateISO)
                    : await this.backend.rangeSnapshot(this.state.view, this.state.dateISO);
                this.applySnapshot(snapshot);
                await this.detector.start();
                this.logger.info("init.ready", { habitCount: this.state.habits.length });
            } catch (error) {
                this.logger.error("init.failed", { error: error.message });
                this.api.showError?.(`Failed to initialise habit dashboard: ${error.message}`);
            }
        }

        async adopt(api, $root) {
            await this.destroy();
            this.logger.setApi(api);
            this.backend.setApi(api);
            this.api = api;
            if ($root && $root.length) {
                this.dom.root = $root;
            } else {
                this.dom.root = ensureRootStructure(api);
            }
            const nextRootId = this.detectInitialRootNoteId(api);
            if (nextRootId) {
                this.activeRootNoteId = nextRootId;
                this.backend.setExplicitRootNoteId(nextRootId, { allowPending: true });
            } else {
                this.activeRootNoteId = null;
                this.backend.setExplicitRootNoteId(null);
            }
            this.suspended = false;
            this.state.dateISO = api.dayjs(this.state.dateISO).format("YYYY-MM-DD");
            this.cacheDom();
            this.bindEvents();
            await this.detector.restart(api);
            await this.refresh({ reason: "adopt" });
        }

        async destroy() {
            if (this.destroying) {
                return;
            }
            this.destroying = true;
            try {
                this.logger.info("destroy.start", {});
                try {
                    await this.detector.stop();
                } catch (error) {
                    this.logger.warn("destroy.detector-stop-failed", { error: error?.message || error });
                }

                this.closeModal();
                this.closeActionMenu();
                this.clearAllToasts();
                this.toastTimeouts = new Set();
                this.pendingCelebration = null;
                this.lastCelebration = 0;
                this.celebrationTimestamps?.clear();

                if (this.activePresses && this.activePresses.size) {
                    this.activePresses.forEach((context, key) => {
                        if (context?.timerId) {
                            runtimeTimers.clearTimeout(context.timerId);
                        }
                        this.activePresses.delete(key);
                    });
                }
                this.activePresses = new Map();

                if (this.dom.root && this.dom.root.length) {
                    this.dom.root.removeClass("habit-dashboard--align-dates").css("--hd-range-date-template", "");
                    this.dom.root.off();
                }
                this.eventsBound = false;

                this.dragState = null;
                if (this.ui?.rangeSubentryExpansion) {
                    this.ui.rangeSubentryExpansion.clear();
                }
                if (this.ui) {
                    this.ui.expandAllSubEntries = true;
                }
                this.dom = {};
                this.logger.info("destroy.complete", {});
            } finally {
                this.backend.resetStructureCache();
                this.backend.setExplicitRootNoteId(null);
                this.activeRootNoteId = null;
                this.suspended = true;
                this.destroying = false;
            }
        }

        detectInitialRootNoteId(apiInstance = this.api) {
            if (!apiInstance) {
                return null;
            }
            const directNote = (() => {
                try {
                    if (apiInstance.note?.noteId) {
                        if (apiInstance.note?.type && apiInstance.note.type.toLowerCase() !== "script") {
                            return apiInstance.note.noteId;
                        }
                    }
                } catch (error) {
                    this.logger.warn("root.detect.note-failed", { error: error.message });
                }
                return null;
            })();
            if (directNote) {
                return directNote;
            }
            try {
                if (apiInstance.renderNote?.noteId) {
                    return apiInstance.renderNote.noteId;
                }
            } catch (error) {
                this.logger.warn("root.detect.render-failed", { error: error.message });
            }
            try {
                const context = apiInstance.getActiveContextNote?.();
                if (context?.noteId) {
                    return context.noteId;
                }
            } catch (error) {
                this.logger.warn("root.detect.context-failed", { error: error.message });
            }
            return apiInstance.startNote?.noteId || null;
        }

        isDashboardRootNote(note) {
            if (!note || !note.noteId) {
                return false;
            }
            return this.backend.isDashboardRootNoteId(note.noteId);
        }

        suspendDashboard(noteId) {
            if (this.suspended) {
                return;
            }
            this.logger.info("dashboard.suspend", { noteId });
            this.suspended = true;
            this.activeRootNoteId = null;
            this.backend.setExplicitRootNoteId(null);
            this.backend.resetStructureCache();
            if (this.eventsBound && this.dom?.root?.length) {
                this.dom.root.off();
                this.eventsBound = false;
            }
            if (this.dom?.root?.length) {
                this.dom.root
                    .empty()
                    .append('<div class="habit-dashboard__inactive" data-role="inactive-state"><p>Open a Habit Dashboard note to resume tracking.</p></div>');
            }
        }

        async activateDashboard(noteId, { reason = "activate", allowPending = false } = {}) {
            if (!noteId) {
                return;
            }
            this.backend.setExplicitRootNoteId(noteId, { allowPending });
            this.activeRootNoteId = noteId;
            if (this.suspended) {
                this.dom.root = ensureRootStructure(this.api);
                this.suspended = false;
            } else if (this.dom?.root?.length) {
                this.dom.root = ensureRootStructure(this.api);
            }
            this.eventsBound = false;
            this.cacheDom();
            this.bindEvents();
            await this.refresh({ reason, silent: reason.includes("note-switch") });
        }

        async handleNoteSwitch(source, note) {
            if (this.destroying) {
                return;
            }
            const noteId = note?.noteId || null;
            const isRoot = noteId ? this.backend.isDashboardRootNoteId(noteId) : false;
            if (isRoot) {
                const needsActivation = this.suspended || this.activeRootNoteId !== noteId;
                if (needsActivation) {
                    await this.activateDashboard(noteId, {
                        reason: `note-switch:${source}`,
                        allowPending: false
                    });
                } else {
                    await this.refresh({ reason: `note-switch:${source}`, silent: true });
                }
                return;
            }

            this.logger.info("dashboard.context.leave", {
                source,
                nextNoteId: noteId || null,
                hadRoot: !!this.activeRootNoteId
            });
            this.suspendDashboard(noteId || null);
        }

        cacheDom() {
            const $root = this.dom.root && this.dom.root.length ? this.dom.root : ensureRootStructure(this.api);
            this.dom = {
                root: $root,
                headRow: $root.find("[data-role='grid-head']"),
                tbody: $root.find("tbody"),
                status: $root.find("[data-role='status-line']"),
                empty: $root.find("[data-role='empty-state']"),
                rangeSummary: $root.find("[data-role='range-summary']"),
                dateInput: $root.find("input[data-action='pick-date']"),
                viewSelect: $root.find("select[data-action='change-view']"),
                compactButton: $root.find("button[data-action='toggle-compact']"),
                refreshButton: $root.find("button[data-action='refresh']"),
                addGroupButton: $root.find("button[data-action='add-group']"),
                addHabitButton: $root.find("button[data-action='add-habit']"),
                subentryToggle: $root.find("button[data-action='toggle-subentry-rows']"),
                rangeAlignButton: $root.find("button[data-action='toggle-range-align']"),
                actionMenu: $root.find("[data-role='action-menu']"),
                actionMenuTrigger: $root.find("button[data-action='toggle-menu']"),
                actionMenuSurface: $root.find("[data-role='menu-surface']")
            };
            if (this.dom.dateInput?.length) {
                this.dom.dateInput.val(this.state.dateISO);
            }
            if (this.dom.viewSelect?.length) {
                this.dom.viewSelect.val(this.state.view);
            }
            this.updateCompactLevelUI();
            this.closeActionMenu();
            this.updateSubentryToggleButton();
            this.updateRangeAlignmentButton();
        }

        bindEvents() {
            const $root = this.dom.root;
            if (!$root || !$root.length) {
                return;
            }
            if (this.eventsBound) {
                return;
            }

            $root.on("click", "button[data-action='go-previous']", () => this.shiftDate(-1));
            $root.on("click", "button[data-action='go-next']", () => this.shiftDate(1));
            $root.on("click", "button[data-action='go-today']", () => this.setDate(this.api.dayjs().format("YYYY-MM-DD")));
            $root.on("change", "input[data-action='pick-date']", (event) => this.setDate(event.currentTarget.value));
            $root.on("change", "select[data-action='change-view']", (event) => this.setView(event.currentTarget.value));
            $root.on("click", "button[data-action='go-current-week']", () => this.goToCurrentWeek());
            $root.on("click", "button[data-action='toggle-menu']", (event) => {
                event.preventDefault();
                this.toggleActionMenu();
            });
            $root.on("click", "button[data-action='toggle-compact']", () => this.toggleCompact());
            $root.on("click", "button[data-action='toggle-subentry-rows']", (event) => {
                event.preventDefault();
                this.toggleAllSubEntries();
            });
            $root.on("click", "button[data-action='toggle-range-align']", (event) => {
                event.preventDefault();
                this.toggleRangeAlignment();
            });
            $root.on("click", "button[data-action='refresh']", () => this.refresh({ reason: "manual" }));
            $root.on("click", "button[data-action='add-group']", () => this.openGroupEditor());
            $root.on("click", "button[data-action='add-habit']", () => this.openHabitEditor());

            const hasPointerEvents = hasWindow && globalScope.PointerEvent !== undefined;
            const pressStartEvents = hasPointerEvents ? "pointerdown" : "mousedown touchstart";
            const pressEndEvents = hasPointerEvents ? "pointerup" : "mouseup touchend";
            const pressCancelEvents = hasPointerEvents ? "pointercancel pointerleave" : "touchcancel mouseleave";

            $root.on(pressStartEvents, "[data-habit-trigger='primary']", (event) => this.handleHabitPressStart(event));
            $root.on(pressEndEvents, "[data-habit-trigger='primary']", (event) => this.handleHabitPressEnd(event));
            $root.on(pressCancelEvents, "[data-habit-trigger='primary']", (event) => this.handleHabitPressCancel(event));
            $root.on("keydown", "[data-habit-trigger='primary']", (event) => this.handleHabitKeydown(event));
            $root.on("click", "[data-habit-trigger='sub-entry']", (event) => this.handleSubEntryChipClick(event));
            $root.on("keydown", "[data-habit-trigger='sub-entry']", (event) => this.handleSubEntryChipKeydown(event));

            $root.on("dragstart", "[data-role='habit-draggable']", (event) => this.handleHabitDragStart(event));
            $root.on("dragover", "[data-role='habit-draggable']", (event) => this.handleHabitDragOver(event));
            $root.on("dragleave", "[data-role='habit-draggable']", (event) => this.handleHabitDragLeave(event));
            $root.on("drop", "[data-role='habit-draggable']", (event) => this.handleHabitDrop(event));
            $root.on("dragend", "[data-role='habit-draggable']", () => this.handleHabitDragEnd());

            $root.on("click", "button[data-action='move-habit-up']", async (event) => {
                const habitId = $(event.currentTarget).closest("[data-habit-id]").data("habitId");
                if (habitId) {
                    event.preventDefault();
                    await this.moveHabitByOffset(habitId, -1);
                }
            });

            $root.on("click", "button[data-action='move-habit-down']", async (event) => {
                const habitId = $(event.currentTarget).closest("[data-habit-id]").data("habitId");
                if (habitId) {
                    event.preventDefault();
                    await this.moveHabitByOffset(habitId, 1);
                }
            });

            $root.on("click", "[data-action='add-entry']", (event) => {
                const $button = $(event.currentTarget);
                const habitId = $button.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const date = $button.data("entryDate") || this.state.dateISO;
                this.openEntryEditor(habit, date, null, { mode: "create" });
            });

            $root.on("click", "[data-action='edit-entry']", (event) => {
                const $button = $(event.currentTarget);
                const habitId = $button.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const date = $button.data("entryDate") || this.state.dateISO;
                const metadata = {
                    entryKey: $button.data("entryKey"),
                    entryId: $button.data("entryId"),
                    recordedAt: $button.data("entryRecordedAt")
                };
                const resolved = this.resolveEntryReference(habit.id, date, metadata);
                this.openEntryEditor(habit, date, resolved.entry || null, { entryKey: resolved.entryKey || null });
            });

            $root.on("click", "[data-action='delete-entry']", async (event) => {
                const $button = $(event.currentTarget);
                const habitId = $button.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const date = $button.data("entryDate") || this.state.dateISO;
                const metadata = {
                    entryKey: $button.data("entryKey"),
                    entryId: $button.data("entryId"),
                    recordedAt: $button.data("entryRecordedAt")
                };
                const resolved = this.resolveEntryReference(habit.id, date, metadata, { allowSingleFallback: true });
                const entryKey = resolved.entryKey;
                if (!entryKey) {
                    this.logger.warn("entry.delete.missing-key", {
                        habitId: habit.id,
                        date,
                        metadata
                    });
                    this.api.showError?.("Couldn't determine which entry to delete. Please refresh and try again.");
                    return;
                }
                const confirmed = await this.confirm("Delete this entry?", "Delete");
                if (!confirmed) {
                    return;
                }
                await this.deleteEntryKeys([entryKey]);
                await this.refresh({ reason: "entry-delete", silent: true });
            });

            $root.on("click", "[data-control='check']", (event) => {
                const $btn = $(event.currentTarget);
                const habitId = $btn.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const entries = this.state.entries.get(habit.id);
                const last = Array.isArray(entries) ? entries[entries.length - 1] : entries;
                const current = !!last?.value;
                this.persistEntry(habit, { value: current ? 0 : 1, skip: false, source: "check", entryKey: last?.key || null });
            });

            $root.on("change", "input[data-control='count']", (event) => {
                const $input = $(event.currentTarget);
                const habitId = $input.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const value = Number($input.val());
                this.persistEntry(habit, { value: value, skip: false, source: "count" });
            });

            $root.on("change", "input[data-control='value']", (event) => {
                const $input = $(event.currentTarget);
                const habitId = $input.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const value = Number($input.val());
                this.persistEntry(habit, { value, skip: false, source: "value" });
            });

            $root.on("change", "input[data-control='time']", (event) => {
                const $input = $(event.currentTarget);
                const habitId = $input.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                this.persistEntry(habit, { value: $input.val(), skip: false, source: "time" });
            });

            $root.on("click", "button[data-action='toggle-skip']", (event) => {
                const $button = $(event.currentTarget);
                const habitId = $button.closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                const entries = this.state.entries.get(habit.id);
                const last = Array.isArray(entries) ? entries[entries.length - 1] : entries;
                const nextSkip = !(last?.skipped ?? false);
                this.persistEntry(habit, {
                    value: last?.value ?? null,
                    skip: nextSkip,
                    source: "skip",
                    entryKey: last?.key || null
                });
            });

            $root.on("click", ".habit-dashboard__date-chip", (event) => {
                const $chip = $(event.currentTarget);
                const habitId = $chip.closest("[data-habit-id]").data("habitId");
                const date = $chip.data("date");
                if (!habitId || !date) {
                    return;
                }
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                if (!(event.altKey || event.metaKey || event.ctrlKey || event.shiftKey)) {
                    event.preventDefault();
                    return;
                }
                const entries = this.getEntryForDate(habitId, date);
                const latest = entries.length ? entries[entries.length - 1] : null;
                this.openEntryEditor(habit, date, latest, { entryKey: latest?.key || null });
            });

            $root.on("click", "button[data-action='open-entry']", (event) => {
                const $button = $(event.currentTarget);
                const habitId = $button.closest("[data-habit-id]").data("habitId");
                const date = $button.data("date");
                if (!habitId || !date) {
                    return;
                }
                const habit = this.findHabit(habitId);
                if (!habit) {
                    return;
                }
                this.openEntryEditor(habit, date, null, { trigger: "button-open" });
            });

            $root.on("click", "button[data-action='edit-habit']", (event) => {
                const habitId = $(event.currentTarget).closest("[data-habit-id]").data("habitId");
                const habit = this.findHabit(habitId);
                this.openHabitEditor(habit || null);
            });

            $root.on("click", "button[data-action='delete-habit']", async (event) => {
                const habitId = $(event.currentTarget).closest("[data-habit-id]").data("habitId");
                if (!habitId) {
                    return;
                }
                await this.deleteHabitFlow(habitId);
            });

            $root.on("click", "button[data-action='edit-group']", (event) => {
                const groupId = $(event.currentTarget).data("groupId");
                const group = this.state.groups.find((g) => g.id === groupId);
                this.openGroupEditor(group || null);
            });

            $root.on("click", "button[data-action='delete-group']", async (event) => {
                const groupId = $(event.currentTarget).data("groupId");
                if (!groupId) {
                    return;
                }
                await this.deleteGroupFlow(groupId);
            });

            this.eventsBound = true;
        }

        shouldIgnoreHabitPointer(event) {
            const $target = $(event.target);
            const $activator = $(event.currentTarget);
            const $blocker = $target.closest("button, input, select, textarea, label, a, .habit-dashboard__date-chip");
            if (!$blocker.length) {
                return false;
            }
            if ($blocker.is($activator)) {
                return false;
            }
            return true;
        }

        getPressIdentifier(event) {
            const original = event.originalEvent || event;
            if (original.pointerId !== undefined) {
                return `pointer-${original.pointerId}`;
            }
            if (original.changedTouches && original.changedTouches.length) {
                return `touch-${original.changedTouches[0].identifier}`;
            }
            if (original.touches && original.touches.length) {
                return `touch-${original.touches[0].identifier}`;
            }
            return "mouse";
        }

        handleHabitPressStart(event) {
            const isMouseEvent = event.type && event.type.startsWith("mouse");
            if (isMouseEvent && event.button !== undefined && event.button !== 0) {
                return;
            }
            if (this.shouldIgnoreHabitPointer(event)) {
                return;
            }
            const $current = $(event.currentTarget);
            const habitId = $current.closest("[data-habit-id]").data("habitId");
            if (!habitId) {
                return;
            }
            const pressId = this.getPressIdentifier(event);
            if (!pressId) {
                return;
            }

            const habitDate = $current.data("date") || this.getQuickActionDate();
            const originalEvent = event.originalEvent || event;
            const hasModifier = !!(originalEvent?.altKey || originalEvent?.metaKey || originalEvent?.ctrlKey || originalEvent?.shiftKey);

            if (!this.activePresses) {
                this.activePresses = new Map();
            }

            const existing = this.activePresses.get(pressId);
            if (existing) {
                runtimeTimers.clearTimeout(existing.timerId);
            }

            const context = {
                habitId,
                date: habitDate,
                target: event.currentTarget,
                startTime: Date.now(),
                longPressFired: false,
                isDragging: false,
                pressId,
                pointerType: event.type || "unknown",
                timerId: null,
                hasModifier
            };

            if (!hasModifier) {
                context.timerId = runtimeTimers.setTimeout(() => {
                    const pressContext = this.activePresses?.get(pressId);
                    if (!pressContext || pressContext.longPressFired || pressContext.isDragging) {
                        return;
                    }
                    pressContext.longPressFired = true;
                    const habit = this.findHabit(habitId);
                    if (habit) {
                        this.triggerHabitLongPress(habit, habitDate);
                    }
                }, this.longPressDelay);
            }

            this.activePresses.set(pressId, context);

        }

        async handleHabitPressEnd(event) {
            const pressId = this.getPressIdentifier(event);
            const context = this.activePresses?.get(pressId);
            if (!context) {
                return;
            }

            runtimeTimers.clearTimeout(context.timerId);
            this.activePresses.delete(pressId);

            if (context.isDragging) {
                return;
            }

            if (context.longPressFired) {
                event.preventDefault?.();
                return;
            }

            const originalEvent = event.originalEvent || event;
            const endHasModifier = !!(originalEvent?.altKey || originalEvent?.metaKey || originalEvent?.ctrlKey || originalEvent?.shiftKey);

            if (context.hasModifier || endHasModifier) {
                return;
            }

            if (this.shouldIgnoreHabitPointer(event)) {
                return;
            }

            const habit = this.findHabit(context.habitId);
            if (habit && Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length) {
                event.preventDefault?.();
                event.stopPropagation?.();
                const entries = this.getEntryForDate(habit.id, context.date) || [];
                const latest = entries.length ? entries[entries.length - 1] : null;
                this.openEntryEditor(habit, context.date, latest || null, {
                    entryKey: latest?.key || null,
                    trigger: "chip-open"
                });
                return;
            }

            event.preventDefault?.();
            event.stopPropagation?.();
            await this.performHabitQuickAction(context.habitId, context.date);
        }

        handleHabitPressCancel(event) {
            const pressId = this.getPressIdentifier(event);
            const context = this.activePresses?.get(pressId);
            if (!context) {
                return;
            }
            runtimeTimers.clearTimeout(context.timerId);
            this.activePresses.delete(pressId);
        }

        cancelHabitPressByHabit(habitId, markDragging = false) {
            if (!this.activePresses || !this.activePresses.size) {
                return;
            }
            this.activePresses.forEach((context, key) => {
                if (context.habitId !== habitId) {
                    return;
                }
                if (markDragging) {
                    context.isDragging = true;
                }
                runtimeTimers.clearTimeout(context.timerId);
                if (!markDragging) {
                    this.activePresses.delete(key);
                }
            });
        }

        triggerHabitLongPress(habit, dateOverride = null) {
            const date = dateOverride || this.getQuickActionDate();
            const entries = this.getEntryForDate(habit.id, date);
            const latest = entries.length ? entries[entries.length - 1] : null;
            this.openEntryEditor(habit, date, latest, { entryKey: latest?.key || null, trigger: "long-press" });
        }

        getQuickActionDate() {
            if (this.state.view === "day") {
                return this.state.dateISO;
            }
            if (Array.isArray(this.state.dates) && this.state.dates.length) {
                const todayISO = this.api.dayjs().format("YYYY-MM-DD");
                if (this.state.dates.includes(todayISO)) {
                    return todayISO;
                }
                if (this.state.dates.includes(this.state.dateISO)) {
                    return this.state.dateISO;
                }
                return this.state.dates[this.state.dates.length - 1];
            }
            return this.state.dateISO;
        }

        getEntryForDate(habitId, date) {
            if (!habitId || !date) {
                return null;
            }
            if (this.state.view === "day" && date === this.state.dateISO) {
                const list = this.state.entries.get(habitId);
                if (Array.isArray(list)) {
                    return list
                        .slice()
                        .sort((a, b) => (a?.recordedAt || `${date}T00:00:00Z`).localeCompare(b?.recordedAt || `${date}T00:00:00Z`));
                }
                return list ? [list] : [];
            }
            const perHabit = this.state.rangeEntries?.[habitId] || {};
            const values = perHabit[date];
            if (Array.isArray(values)) {
                return values
                    .slice()
                    .sort((a, b) => (a?.recordedAt || `${date}T00:00:00Z`).localeCompare(b?.recordedAt || `${date}T00:00:00Z`));
            }
            return values ? [values] : [];
        }

        resolveEntryReference(habitId, date, metadata = {}, options = {}) {
            const targetDate = date || this.state.dateISO;
            const entries = this.getEntryForDate(habitId, targetDate) || [];
            if (!entries.length) {
                return { entry: null, entryKey: null, entries: [] };
            }

            const keyCandidate = typeof metadata.entryKey === "string" && metadata.entryKey.length
                ? metadata.entryKey
                : null;
            if (keyCandidate) {
                const direct = entries.find((item) => item.key === keyCandidate);
                if (direct) {
                    return { entry: direct, entryKey: direct.key, entries };
                }
            }

            const idCandidate = metadata.entryId !== undefined && metadata.entryId !== null && String(metadata.entryId).length
                ? String(metadata.entryId)
                : null;
            if (idCandidate) {
                const byId = entries.find((item) => String(item.entryId || "") === idCandidate);
                if (byId) {
                    return { entry: byId, entryKey: byId.key || null, entries };
                }
            }

            const recordedCandidate = typeof metadata.recordedAt === "string" && metadata.recordedAt.length
                ? metadata.recordedAt
                : null;
            if (recordedCandidate) {
                const byRecorded = entries.find((item) => item.recordedAt === recordedCandidate);
                if (byRecorded) {
                    return { entry: byRecorded, entryKey: byRecorded.key || null, entries };
                }
            }

            if (options?.allowSingleFallback && entries.length === 1) {
                const only = entries[0];
                return { entry: only, entryKey: only?.key || null, entries };
            }

            return { entry: null, entryKey: null, entries };
        }

        countEntriesForHabit(habitId) {
            if (!habitId) {
                return 0;
            }
            if (this.state.view === "day") {
                const list = this.state.entries.get(habitId);
                return Array.isArray(list) ? list.length : list ? 1 : 0;
            }
            const range = this.state.rangeEntries?.[habitId];
            if (range) {
                return Object.values(range).reduce((total, entries) => {
                    if (Array.isArray(entries)) {
                        return total + entries.length;
                    }
                    return entries ? total + 1 : total;
                }, 0);
            }
            const list = this.state.entries.get(habitId);
            return Array.isArray(list) ? list.length : list ? 1 : 0;
        }

        getHabitQuickStep(habit) {
            const metaStep = Number(habit.meta?.quickStep);
            if (Number.isFinite(metaStep) && metaStep > 0) {
                return metaStep;
            }
            if (habit.type === "time") {
                return 15;
            }
            if (habit.type === "count") {
                return 1;
            }
            if (habit.type === "value") {
                const decimals = Number.isFinite(Number(habit.meta?.decimals)) ? Number(habit.meta.decimals) : 0;
                if (decimals > 0) {
                    return Number((1 / Math.pow(10, Math.min(4, Math.max(0, decimals)))).toFixed(Math.min(4, Math.max(0, decimals))));
                }
                return 1;
            }
            if (habit.type === "rating") {
                return 1;
            }
            return 1;
        }

        getQuickActionMessage(habit, { value, skip, date, subEntryId }) {
            const dateLabel = this.api.dayjs(date).format("ddd DD MMM");
            const template = subEntryId ? this.getSubEntryTemplate(habit, subEntryId) : null;
            const templateTitle = template ? (template.title || template.name || template.id) : null;
            const subject = templateTitle ? `${templateTitle} (${habit.title})` : habit.title;
            if (skip) {
                return `Skipped ${subject} · ${dateLabel}`;
            }
            switch (habit.type) {
                case "check":
                    if (value) {
                        return `Completed ${subject} · ${dateLabel}`;
                    }
                    return `Marked not done · ${subject} (${dateLabel})`;
                case "rating": {
                    const max = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                    return `Rating ${value}/${max} · ${subject}`;
                }
                case "time": {
                    return `${subject}: ${this.formatMinutesLabel(Number(value) || 0)} (${dateLabel})`;
                }
                case "count":
                case "value": {
                    const unit = habit.meta?.unit ? ` ${habit.meta.unit}` : "";
                    return `${subject}: ${value}${unit} (${dateLabel})`;
                }
                default:
                    return `${subject}: ${value ?? ""} (${dateLabel})`;
            }
        }

        buildCelebrationPayload(habit, entry) {
            if (!entry || entry.skipped) {
                return null;
            }
            const messages = [];
            if (habit.type === "check" && entry.value) {
                messages.push({ icon: "bx bx-check-circle", text: `Completed ${habit.title}!` });
            }
            if (this.isEntryTargetMet(habit, entry)) {
                messages.push({ icon: "bx bx-star", text: `Target met for ${habit.title}!` });
            }
            const summary = this.state.summary?.[habit.id] || {};
            const streak = summary.currentStreak || (this.state.view === "day" && habit.type === "check" && entry.value ? 1 : 0);
            if (streak >= 3) {
                messages.push({ icon: "bx bx-fire", text: `${streak} day streak!` });
            }
            if (!messages.length) {
                return null;
            }
            return messages[0];
        }

        triggerCelebration(habitId, payload) {
            if (!payload || !habitId) {
                return;
            }
            const now = Date.now();
            const HABIT_THROTTLE_MS = 800;
            const GLOBAL_SOFT_THROTTLE_MS = 200;
            const lastForHabit = this.celebrationTimestamps.get(habitId) || 0;

            if (now - lastForHabit < HABIT_THROTTLE_MS) {
                this.showToast(payload.text);
                this.flashHabitVisual(habitId);
                return;
            }

            if (now - this.lastCelebration < GLOBAL_SOFT_THROTTLE_MS) {
                this.celebrationTimestamps.set(habitId, now);
                this.lastCelebration = now;
                this.showToast(payload.text);
                this.flashHabitVisual(habitId);
                return;
            }

            this.celebrationTimestamps.set(habitId, now);
            this.lastCelebration = now;
            this.showToast(payload.text, 2600);
            this.flashHabitVisual(habitId, true);
            this.showCelebrationOverlay(payload);
        }

        flashHabitVisual(habitId, celebrate = false) {
            const row = this.dom.tbody.find(`[data-habit-id='${habitId}']`);
            if (row.length) {
                row.addClass("is-celebrating");
                setTimeout(() => row.removeClass("is-celebrating"), celebrate ? 1200 : 600);
            }
            if (this.dom.rangeSummary?.length) {
                const card = this.dom.rangeSummary.find(`.habit-dashboard__summary-card[data-habit-id='${habitId}']`);
                if (card.length) {
                    card.addClass("is-celebrating");
                    setTimeout(() => card.removeClass("is-celebrating"), celebrate ? 1200 : 600);
                }
            }
        }

        showCelebrationOverlay(payload) {
            const $root = this.dom.root;
            if (!$root || !$root.length) {
                return;
            }
            const $overlay = $("<div class='habit-dashboard__celebration'>");
            const $message = $("<div class='habit-dashboard__celebration-message' role='status' aria-live='polite'>");
            if (payload.icon) {
                $message.append(`<span class='bx ${payload.icon}'></span>`);
            }
            $message.append($("<span>").text(payload.text));
            $overlay.append($message);

            const colors = ["#60dea9", "#4ba3ff", "#ffb347", "#c95353", "#fff176"];
            const count = 18;
            for (let i = 0; i < count; i += 1) {
                const $confetti = $("<span class='habit-dashboard__confetti'>");
                const color = colors[i % colors.length];
                const delay = Math.random() * 0.2;
                const left = Math.random() * 100;
                const duration = 0.9 + Math.random() * 0.6;
                $confetti.css({
                    background: color,
                    left: `${left}%`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                });
                $overlay.append($confetti);
            }

            $root.css("position", "relative");
            $root.append($overlay);
            setTimeout(() => {
                $overlay.remove();
            }, 1500);
        }

        getSubEntryTemplate(habit, subEntryId) {
            if (!habit || !subEntryId) {
                return null;
            }
            const templates = Array.isArray(habit.meta?.subEntries) ? habit.meta.subEntries : [];
            return templates.find((item) => item.id === subEntryId) || null;
        }

        async performSubEntryQuickAction(habit, date, subEntryId) {
            if (!habit || !subEntryId) {
                return false;
            }
            const template = this.getSubEntryTemplate(habit, subEntryId);
            if (!template) {
                this.logger.warn("sub-entry.quick.missing-template", { habitId: habit.id, subEntryId });
                return false;
            }

            const entries = this.getEntryForDate(habit.id, date) || [];
            const existing = entries.find((entry) => entry?.subEntryId === subEntryId) || null;
            const skipped = !!existing?.skipped;
            const step = this.getHabitQuickStep(habit);
            let value = null;
            let skip = false;

            switch (habit.type) {
                case "check": {
                    if (skipped) {
                        value = 0;
                        skip = false;
                    } else if (existing?.value) {
                        value = existing.value;
                        skip = true;
                    } else {
                        value = 1;
                        skip = false;
                    }
                    break;
                }
                case "rating": {
                    const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                    const maxCandidate = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                    const max = maxCandidate >= min ? maxCandidate : min;
                    const current = Number.isFinite(Number(existing?.value)) && !skipped ? Number(existing.value) : (min - step);
                    let candidate = current + step;
                    if (!Number.isFinite(candidate) || candidate > max) {
                        candidate = min;
                    }
                    if (candidate < min) {
                        candidate = min;
                    }
                    value = candidate;
                    break;
                }
                case "time": {
                    const base = Number.isFinite(Number(existing?.value)) && !skipped ? Number(existing.value) : 0;
                    value = Math.max(0, base + step);
                    break;
                }
                case "count":
                case "value": {
                    const base = Number.isFinite(Number(existing?.value)) && !skipped ? Number(existing.value) : 0;
                    let nextValue = base + step;
                    if (habit.type === "value") {
                        const decimals = Number.isFinite(Number(habit.meta?.decimals)) ? Math.min(4, Math.max(0, Number(habit.meta.decimals))) : 0;
                        if (decimals > 0) {
                            nextValue = Number(nextValue.toFixed(decimals));
                        } else {
                            nextValue = Math.round(nextValue);
                        }
                    }
                    value = nextValue;
                    break;
                }
                default: {
                    const base = Number.isFinite(Number(existing?.value)) && !skipped ? Number(existing.value) : 0;
                    value = base ? 0 : 1;
                }
            }

            const success = await this.persistEntry(habit, {
                value,
                skip,
                source: "sub-entry-quick",
                subEntryId,
                date,
                entryKey: existing?.key || null
            });
            if (success) {
                this.showToast(this.getQuickActionMessage(habit, { value, skip, date, subEntryId }));
            }
            return success;
        }

        async performHabitQuickAction(habitId, dateOverride = null) {
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            const date = dateOverride || this.getQuickActionDate();
            const entries = this.getEntryForDate(habit.id, date);
            const lastEntry = entries.length ? entries[entries.length - 1] : null;
            const skipped = !!lastEntry?.skipped;

            if (habit.type === "check") {
                let value;
                let skip = false;
                if (skipped) {
                    value = 0;
                    skip = false;
                } else if (lastEntry?.value) {
                    value = lastEntry.value;
                    skip = true;
                } else {
                    value = 1;
                    skip = false;
                }
                const success = await this.persistEntry(habit, {
                    value,
                    skip,
                    source: "quick-check",
                    date,
                    entryKey: lastEntry?.key || null
                });
                if (success) {
                    this.showToast(this.getQuickActionMessage(habit, { value, skip, date }));
                }
                return;
            }

            let nextValue = null;
            let skip = false;

            if (habit.type === "rating") {
                const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                const max = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                const current = Number.isFinite(Number(lastEntry?.value)) && !skipped ? Number(lastEntry.value) : (min - 1);
                let candidate = current + this.getHabitQuickStep(habit);
                if (!Number.isFinite(candidate) || candidate > max) {
                    candidate = min;
                }
                if (candidate < min) {
                    candidate = min;
                }
                nextValue = candidate;
            } else if (habit.type === "time") {
                const step = this.getHabitQuickStep(habit);
                const base = Number.isFinite(Number(lastEntry?.value)) && !skipped ? Number(lastEntry.value) : 0;
                nextValue = Math.max(0, base + step);
            } else if (habit.type === "count" || habit.type === "value") {
                const step = this.getHabitQuickStep(habit);
                const decimalsRaw = Number.isFinite(Number(habit.meta?.decimals)) ? Math.min(4, Math.max(0, Number(habit.meta.decimals))) : 0;
                const base = Number.isFinite(Number(lastEntry?.value)) && !skipped ? Number(lastEntry.value) : 0;
                nextValue = base + step;
                if (decimalsRaw > 0) {
                    nextValue = Number(nextValue.toFixed(decimalsRaw));
                } else {
                    nextValue = Math.round(nextValue);
                }
            } else {
                const base = Number.isFinite(Number(lastEntry?.value)) && !skipped ? Number(lastEntry.value) : 0;
                nextValue = base ? 0 : 1;
            }

            const success = await this.persistEntry(habit, {
                value: nextValue,
                skip,
                source: "quick-action",
                date,
                entryKey: lastEntry?.key || null
            });
            if (success) {
                this.showToast(this.getQuickActionMessage(habit, { value: nextValue, skip, date }));
            }
        }

        async handleHabitKeydown(event) {
            const key = event.key;
            const habitId = $(event.currentTarget).closest("[data-habit-id]").data("habitId");
            if (!habitId) {
                return;
            }
            const habit = this.findHabit(habitId);
            const chipDate = $(event.currentTarget).data("date");
            const targetDate = chipDate || this.getQuickActionDate();

            if (key === " " || key === "Spacebar" || key === "Enter") {
                event.preventDefault();
                if (habit && Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length) {
                    const entries = this.getEntryForDate(habit.id, targetDate) || [];
                    const latest = entries.length ? entries[entries.length - 1] : null;
                    this.openEntryEditor(habit, targetDate, latest || null, {
                        entryKey: latest?.key || null,
                        trigger: "chip-keypress"
                    });
                } else {
                    await this.performHabitQuickAction(habitId, targetDate);
                }
                return;
            }

            if (event.altKey && key === "ArrowUp") {
                event.preventDefault();
                await this.moveHabitByOffset(habitId, -1);
                return;
            }

            if (event.altKey && key === "ArrowDown") {
                event.preventDefault();
                await this.moveHabitByOffset(habitId, 1);
            }
        }

        async handleSubEntryChipClick(event) {
            event.preventDefault?.();
            event.stopPropagation?.();
            const $target = $(event.currentTarget);
            const habitId = $target.closest("[data-habit-id]").data("habitId");
            const subEntryId = $target.data("subEntryId");
            const date = $target.data("date");
            if (!habitId || !subEntryId || !date) {
                return;
            }
            if (event?.metaKey || event?.ctrlKey || event?.altKey || event?.shiftKey) {
                await this.openSubEntryEditorFromChip(habitId, date, subEntryId, "sub-entry-chip-modifier");
                return;
            }
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            await this.performSubEntryQuickAction(habit, date, subEntryId);
        }

        async handleSubEntryChipKeydown(event) {
            const key = event.key;
            if (key !== " " && key !== "Spacebar" && key !== "Enter") {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const $target = $(event.currentTarget);
            const habitId = $target.closest("[data-habit-id]").data("habitId");
            const subEntryId = $target.data("subEntryId");
            const date = $target.data("date");
            if (!habitId || !subEntryId || !date) {
                return;
            }
            if (event?.metaKey || event?.ctrlKey || event?.altKey || event?.shiftKey) {
                await this.openSubEntryEditorFromChip(habitId, date, subEntryId, "sub-entry-chip-keypress");
                return;
            }
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            await this.performSubEntryQuickAction(habit, date, subEntryId);
        }

        async openSubEntryEditorFromChip(habitId, date, subEntryId, trigger = "sub-entry-chip") {
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            const hasTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
            if (!hasTemplates) {
                await this.performHabitQuickAction(habitId, date);
                return;
            }
            const entries = this.getEntryForDate(habit.id, date) || [];
            const matching = entries.find((item) => item?.subEntryId === subEntryId) || null;
            this.openEntryEditor(habit, date, matching || null, {
                entryKey: matching?.key || null,
                focusSubEntryId: subEntryId,
                trigger
            });
        }

        async moveHabitByOffset(habitId, offset) {
            if (!offset) {
                return;
            }
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            const normalizedGroupId = habit.groupId || "__none__";
            const habitsInGroup = this.state.habits
                .filter((item) => (item.groupId || "__none__") === normalizedGroupId)
                .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));

            const currentIndex = habitsInGroup.findIndex((item) => item.id === habitId);
            if (currentIndex === -1) {
                return;
            }
            const targetIndex = currentIndex + offset;
            if (targetIndex < 0 || targetIndex >= habitsInGroup.length) {
                return;
            }

            const orderedIds = habitsInGroup.map((item) => item.id);
            const [moved] = orderedIds.splice(currentIndex, 1);
            orderedIds.splice(targetIndex, 0, moved);
            await this.persistHabitOrder(habit.groupId || null, orderedIds);
        }

        ensureToastContainer() {
            if (this.toastContainer && this.toastContainer.length) {
                return this.toastContainer;
            }
            const $container = $("<div class='habit-dashboard__toast-container'>");
            $(document.body).append($container);
            this.toastContainer = $container;
            return $container;
        }

        clearAllToasts() {
            if (this.toastTimeouts && this.toastTimeouts.size) {
                this.toastTimeouts.forEach((id) => runtimeTimers.clearTimeout(id));
                this.toastTimeouts.clear();
            }
            if (this.toastContainer && this.toastContainer.length) {
                this.toastContainer.remove();
                this.toastContainer = null;
            }
        }

        showToast(message, duration = 2200) {
            if (!message) {
                return;
            }
            const $container = this.ensureToastContainer();
            const $toast = $("<div class='habit-dashboard__toast' role='status' aria-live='polite'>").text(message);
            $container.append($toast);

            runtimeTimers.requestAnimationFrame(() => {
                $toast.addClass("is-visible");
            });

            const registerTimeout = (id) => {
                if (id !== undefined && id !== null) {
                    this.toastTimeouts.add(id);
                }
                return id;
            };

            const releaseTimeout = (id) => {
                if (id !== undefined && id !== null) {
                    this.toastTimeouts.delete(id);
                }
            };

            const scheduleRemoval = () => {
                const removeId = registerTimeout(runtimeTimers.setTimeout(() => {
                    releaseTimeout(removeId);
                    $toast.remove();
                    if (this.toastContainer && !this.toastContainer.children().length) {
                        this.toastContainer.remove();
                        this.toastContainer = null;
                    }
                }, 300));
                return removeId;
            };

            const hideTimeout = registerTimeout(runtimeTimers.setTimeout(() => {
                releaseTimeout(hideTimeout);
                $toast.removeClass("is-visible");
                scheduleRemoval();
            }, duration));
        }

        resolveGroupIdFromElement($element) {
            const groupId = $element.closest("[data-group-id]").data("groupId");
            if (groupId) {
                return groupId;
            }
            const habitId = $element.closest("[data-habit-id]").data("habitId");
            if (!habitId) {
                return null;
            }
            const habit = this.findHabit(habitId);
            return habit?.groupId || null;
        }

        handleHabitDragStart(event) {
            const $target = $(event.currentTarget);
            const habitId = $target.data("habitId") || $target.closest("[data-habit-id]").data("habitId");
            if (!habitId) {
                event.preventDefault?.();
                return;
            }
            const groupId = this.resolveGroupIdFromElement($target) || this.findHabit(habitId)?.groupId || null;
            const dataTransfer = event.originalEvent?.dataTransfer;
            if (dataTransfer) {
                try {
                    dataTransfer.setData("text/plain", habitId);
                } catch (error) {
                    // ignore data transfer errors
                }
                dataTransfer.effectAllowed = "move";
            }
            $target.addClass("is-dragging");
            this.cancelHabitPressByHabit(habitId, true);
            this.dragState = {
                habitId,
                groupId,
                $element: $target
            };
        }

        handleHabitDragOver(event) {
            if (!this.dragState || !this.dragState.habitId) {
                return;
            }
            const $target = $(event.currentTarget);
            const targetHabitId = $target.data("habitId") || $target.closest("[data-habit-id]").data("habitId");
            if (!targetHabitId || targetHabitId === this.dragState.habitId) {
                return;
            }
            const targetGroupId = this.resolveGroupIdFromElement($target);
            if (targetGroupId && this.dragState.groupId && targetGroupId !== this.dragState.groupId) {
                return;
            }
            event.preventDefault();
            const dataTransfer = event.originalEvent?.dataTransfer;
            if (dataTransfer) {
                dataTransfer.dropEffect = "move";
            }
            this.dom.root.find("[data-role='habit-draggable'].is-drag-over").not($target).removeClass("is-drag-over");
            $target.addClass("is-drag-over");
            if (targetGroupId) {
                this.highlightGroupDragTarget(targetGroupId);
            }
        }

        handleHabitDragLeave(event) {
            $(event.currentTarget).removeClass("is-drag-over");
        }

        handleHabitDrop(event) {
            if (!this.dragState) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const $target = $(event.currentTarget);
            const targetHabitId = $target.data("habitId") || $target.closest("[data-habit-id]").data("habitId");
            const sourceHabitId = this.dragState.habitId;
            this.dom.root.find("[data-role='habit-draggable'].is-drag-over").removeClass("is-drag-over");
            this.clearGroupDragHighlight();
            if (!targetHabitId || targetHabitId === sourceHabitId) {
                return;
            }
            const targetGroupId = this.resolveGroupIdFromElement($target);
            if (targetGroupId && this.dragState.groupId && targetGroupId !== this.dragState.groupId) {
                this.updateStatus("Reorder within the same group");
                return;
            }
            let placeBefore = true;
            const rect = event.currentTarget?.getBoundingClientRect?.();
            if (rect && event.originalEvent) {
                const clientY = event.originalEvent.clientY ?? 0;
                placeBefore = clientY < rect.top + rect.height / 2;
            }
            this.reorderHabitRelative(sourceHabitId, targetHabitId, placeBefore);
        }

        handleHabitDragEnd() {
            if (this.dragState?.$element) {
                this.dragState.$element.removeClass("is-dragging");
            }
            this.dom.root.find("[data-role='habit-draggable'].is-drag-over").removeClass("is-drag-over");
            this.clearGroupDragHighlight();
            this.dragState = null;
        }

        highlightGroupDragTarget(groupId) {
            const targetId = groupId || "";
            this.dom.root.find(".habit-dashboard__group-row.is-drag-target").removeClass("is-drag-target");
            this.dom.root.find(".habit-dashboard__summary-group.is-drag-target").removeClass("is-drag-target");
            if (this.dom.tbody?.length) {
                this.dom.tbody.find(`.habit-dashboard__group-row[data-group-id='${targetId}']`).addClass("is-drag-target");
            }
            if (this.dom.rangeSummary?.length) {
                this.dom.rangeSummary.find(`.habit-dashboard__summary-group[data-group-id='${targetId}']`).addClass("is-drag-target");
            }
        }

        clearGroupDragHighlight() {
            this.dom.root.find(".habit-dashboard__group-row.is-drag-target").removeClass("is-drag-target");
            this.dom.root.find(".habit-dashboard__summary-group.is-drag-target").removeClass("is-drag-target");
        }

        async reorderHabitRelative(sourceHabitId, targetHabitId, placeBefore) {
            const sourceHabit = this.findHabit(sourceHabitId);
            const targetHabit = this.findHabit(targetHabitId);
            if (!sourceHabit || !targetHabit) {
                return;
            }
            const groupId = sourceHabit.groupId || targetHabit.groupId || null;
            const normalizedGroupId = groupId || "__none__";
            const targetGroupNormalized = targetHabit.groupId || "__none__";
            if (normalizedGroupId !== targetGroupNormalized) {
                return;
            }
            const habitsInGroup = this.state.habits.filter((habit) => (habit.groupId || "__none__") === normalizedGroupId);
            if (!habitsInGroup.length) {
                return;
            }
            const orderedIds = habitsInGroup.map((habit) => habit.id).filter((id) => id !== sourceHabitId);
            const targetIndex = orderedIds.indexOf(targetHabitId);
            if (targetIndex === -1) {
                return;
            }
            const insertIndex = placeBefore ? targetIndex : targetIndex + 1;
            orderedIds.splice(insertIndex, 0, sourceHabitId);
            await this.persistHabitOrder(groupId, orderedIds);
        }

        async persistHabitOrder(groupId, habitIds) {
            if (!Array.isArray(habitIds) || !habitIds.length) {
                return;
            }
            const orderMap = new Map();
            habitIds.forEach((id, index) => {
                orderMap.set(id, (index + 1) * 10);
            });

            const hasChanges = habitIds.some((id) => {
                const habit = this.findHabit(id);
                if (!habit) {
                    return false;
                }
                const currentOrder = Number(habit.order) || 0;
                const nextOrder = orderMap.get(id);
                return currentOrder !== nextOrder;
            });

            if (!hasChanges) {
                this.handleHabitDragEnd();
                return;
            }

            this.updateStatus("Reordering…");
            try {
                await Promise.all(habitIds.map((id) => this.backend.updateHabit({ habitId: id, order: orderMap.get(id) })));
                this.handleHabitDragEnd();
                this.state.habits = this.state.habits
                    .map((habit) => orderMap.has(habit.id)
                        ? { ...habit, order: orderMap.get(habit.id) }
                        : habit)
                    .sort((a, b) => {
                        const groupOrder = (id) => {
                            const group = this.state.groups.find((g) => g.id === id);
                            return group ? group.order : 99999;
                        };
                        const groupCompare = groupOrder(a.groupId) - groupOrder(b.groupId);
                        if (groupCompare !== 0) {
                            return groupCompare;
                        }
                        if (a.order !== b.order) {
                            return a.order - b.order;
                        }
                        return a.title.localeCompare(b.title);
                    });
                this.render();
                this.updateStatus("Reordered");
                this.showToast("Habit order updated", 1600);
            } catch (error) {
                this.handleHabitDragEnd();
                this.logger.error("habit.reorder.failed", { error: error.message });
                this.api.showError?.(`Failed to reorder habits: ${error.message}`);
                this.updateStatus("Reorder failed");
            }
        }

        findHabit(habitId) {
            return this.state.habits.find((habit) => habit.id === habitId) || null;
        }

        getGroupedHabits() {
            const groups = this.state.groups.length ? this.state.groups.slice() : [{ id: "_default", title: "Habits", order: 0 }];
            const groupMap = new Map(groups.map((group) => [group.id, { group, habits: [] }]));
            let fallback = groupMap.get(groups[0].id);

            this.state.habits.forEach((habit) => {
                let bucket = groupMap.get(habit.groupId || "");
                if (!bucket) {
                    if (!groupMap.has("_other")) {
                        const placeholder = { id: "_other", title: "Other", order: 99999 };
                        groupMap.set("_other", { group: placeholder, habits: [] });
                    }
                    bucket = groupMap.get("_other");
                }
                bucket.habits.push(habit);
            });

            return Array.from(groupMap.values())
                .filter(({ habits }) => habits.length > 0)
                .sort((a, b) => (a.group.order === b.group.order ? a.group.title.localeCompare(b.group.title) : a.group.order - b.group.order))
                .map(({ group, habits }) => ({
                    group,
                    habits: habits.sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order))
                }));
        }

        applySnapshot(snapshot) {
            this.state.view = snapshot.view || this.state.view;
            this.state.habits = snapshot.habits || [];
            this.state.groups = (snapshot.groups || []).slice().sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));
            const compactSource = snapshot.compactLevel !== undefined ? snapshot.compactLevel : snapshot.compactMode;
            this.state.compactLevel = normalizeCompactLevelClient(compactSource);
            this.state.dates = snapshot.dates || [this.state.dateISO];
            this.state.summary = snapshot.summary || {};
            this.state.debugEnabled = !!snapshot.debugEnabled;
            const subentriesExpanded = snapshot.subentriesExpanded !== false;
            if (!this.ui) {
                this.ui = {
                    rangeSubentryExpansion: new Map(),
                    expandAllSubEntries: subentriesExpanded
                };
            } else {
                this.ui.expandAllSubEntries = subentriesExpanded;
                if (!this.ui.rangeSubentryExpansion) {
                    this.ui.rangeSubentryExpansion = new Map();
                }
            }

            const knownHabitIds = new Set((this.state.habits || []).map((habit) => habit.id));
            if (this.ui?.rangeSubentryExpansion) {
                Array.from(this.ui.rangeSubentryExpansion.keys()).forEach((habitId) => {
                    if (!knownHabitIds.has(habitId)) {
                        this.ui.rangeSubentryExpansion.delete(habitId);
                    }
                });
                knownHabitIds.forEach((habitId) => {
                    if (!this.ui.rangeSubentryExpansion.has(habitId)) {
                        this.ui.rangeSubentryExpansion.set(habitId, subentriesExpanded);
                    }
                });
            }

            this.state.alignRangeByDay = snapshot.rangeAlignment === "grid";

            // normalize entries
            this.state.entries = new Map();
            const rangeEntries = {};
            if (snapshot.view === "day") {
                const date = snapshot.dates?.[0] || this.state.dateISO;
                Object.entries(snapshot.entries || {}).forEach(([habitId, entries]) => {
                    const list = Array.isArray(entries) ? entries.slice() : entries ? [entries] : [];
                    this.state.entries.set(habitId, list);
                    rangeEntries[habitId] = { [date]: list };
                });
            } else {
                Object.keys(snapshot.entries || {}).forEach((habitId) => {
                    rangeEntries[habitId] = snapshot.entries[habitId];
                });
            }
            this.state.rangeEntries = rangeEntries;

            if (this.dom.dateInput?.length) {
                this.dom.dateInput.val(this.state.dateISO);
            }
            if (this.dom.viewSelect?.length) {
                this.dom.viewSelect.val(this.state.view);
            }

            this.render();
        }

        toggleActionMenu(force = null) {
            const isOpen = !!this.dom?.actionMenu?.hasClass("is-open");
            const shouldOpen = typeof force === "boolean" ? force : !isOpen;
            if (shouldOpen) {
                this.openActionMenu();
            } else {
                this.closeActionMenu();
            }
        }

        openActionMenu() {
            if (!this.dom?.actionMenu?.length) {
                return;
            }
            this.dom.actionMenu.addClass("is-open");
            this.dom.actionMenuTrigger?.attr("aria-expanded", "true");
            this.dom.actionMenuSurface?.attr("data-open", "true");

            if (hasWindow) {
                const doc = globalScope.document || document;
                if (!this.menuOutsideHandler) {
                    this.menuOutsideHandler = (event) => {
                        const menuEl = this.dom?.actionMenu?.get?.(0);
                        if (!menuEl) {
                            return;
                        }
                        if (menuEl.contains(event.target)) {
                            return;
                        }
                        this.closeActionMenu();
                    };
                    doc.addEventListener("pointerdown", this.menuOutsideHandler, true);
                    doc.addEventListener("touchstart", this.menuOutsideHandler, true);
                }
                if (!this.menuKeyHandler) {
                    this.menuKeyHandler = (event) => {
                        if (event.key === "Escape" || event.key === "Esc") {
                            this.closeActionMenu();
                            this.dom.actionMenuTrigger?.focus?.();
                        }
                    };
                    doc.addEventListener("keydown", this.menuKeyHandler, true);
                }
            }
        }

        closeActionMenu() {
            if (this.dom?.actionMenu?.length) {
                this.dom.actionMenu.removeClass("is-open");
            }
            this.dom?.actionMenuTrigger?.attr("aria-expanded", "false");
            this.dom?.actionMenuSurface?.removeAttr("data-open");

            if (hasWindow) {
                const doc = globalScope.document || document;
                if (this.menuOutsideHandler) {
                    doc.removeEventListener("pointerdown", this.menuOutsideHandler, true);
                    doc.removeEventListener("touchstart", this.menuOutsideHandler, true);
                    this.menuOutsideHandler = null;
                }
                if (this.menuKeyHandler) {
                    doc.removeEventListener("keydown", this.menuKeyHandler, true);
                    this.menuKeyHandler = null;
                }
            }
        }

        updateCompactLevelUI() {
            const level = normalizeCompactLevelClient(this.state.compactLevel);
            if (this.dom.root) {
                this.dom.root.removeClass("is-compact is-compact-level-1 is-compact-level-2 is-compact-level-3");
                if (level > 0) {
                    this.dom.root.addClass("is-compact");
                    this.dom.root.addClass(`is-compact-level-${level}`);
                }
            }

            if (this.dom.compactButton?.length) {
                const isActive = level > 0;
                const levelMeta = COMPACT_LEVELS[level] || COMPACT_LEVELS[0];
                this.dom.compactButton.toggleClass("is-active", isActive);
                this.dom.compactButton.attr("aria-pressed", isActive ? "true" : "false");
                this.dom.compactButton.attr("data-compact-level", String(level));
                const densityLabel = levelMeta?.label ? `Layout density: ${levelMeta.label}` : null;
                const $label = this.dom.compactButton.find("[data-role='compact-label']");
                if ($label.length) {
                    $label.text(levelMeta.label);
                } else {
                    this.dom.compactButton.attr("title", levelMeta.label ? `Compact: ${levelMeta.label}` : "Compact Mode");
                }
                if (densityLabel) {
                    this.dom.compactButton.attr("aria-label", densityLabel).attr("title", densityLabel);
                }
            }
        }

        render() {
            const alignByDay = !!this.state.alignRangeByDay && this.state.view !== "day";
            if (this.dom.root) {
                this.dom.root.toggleClass("habit-dashboard--align-dates", alignByDay);
                if (alignByDay) {
                    const dateCount = Array.isArray(this.state.dates) ? Math.max(1, this.state.dates.length) : 1;
                    this.dom.root.css("--hd-range-date-template", `repeat(${dateCount}, minmax(0, 1fr))`);
                } else {
                    this.dom.root.css("--hd-range-date-template", "");
                }
            }
            this.updateCompactLevelUI();
            this.updateRangeAlignmentButton();
            this.renderHead();
            this.renderHabits();
            this.updateRangeSummary();
            this.updateStatus("Ready");
        }

        renderHead() {
            if (!this.dom.headRow?.length) {
                return;
            }

            const $head = this.dom.headRow.empty();
            if (this.state.view !== "day") {
                return;
            }

            $head.append(`<th scope="col" class="habit-dashboard__head-habit">Habit</th>`);
            $head.append(`<th scope="col" class="habit-dashboard__head-range">Entry</th>`);
            $head.append(`<th scope="col" class="habit-dashboard__head-actions">Actions</th>`);
        }

        renderHabits() {
            if (!this.dom.tbody?.length) {
                return;
            }

            this.updateSubentryToggleButton();

            if (this.state.view === "day") {
                this.renderDayTable();
            } else {
                this.renderRangeTable();
            }

            const hasHabits = this.state.habits.length > 0;
            this.dom.empty.toggle(!hasHabits);
            this.dom.root.toggleClass("habit-dashboard--empty", !hasHabits);
        }

        renderHabitRow(habit, entries) {
            const group = this.state.groups.find((g) => g.id === habit.groupId);
            const accent = habit.meta?.color || group?.color || "#4ba3ff";
            const groupId = group?.id || habit.groupId || "_default";
            const $row = $("<tr>")
                .attr("data-habit-id", habit.id)
                .attr("data-group-id", groupId)
                .attr("data-role", "habit-draggable")
                .attr("draggable", "true")
                .addClass("habit-dashboard__row");
            $row.css("--habit-row-accent", accent);

            const daySummary = this.summarizeEntriesForDay(habit, entries);
            const allSkipped = daySummary.entries.length > 0 && daySummary.entries.every((item) => item.skipped);
            if (daySummary.primary?.skipped || allSkipped) {
                $row.addClass("habit-dashboard__row--skipped");
            }

            const habitCell = this.renderHabitInfoCell(habit);
            const controlCell = this.renderDayControlCell(habit, daySummary);
            const actionCell = this.renderDayActionsCell(habit, daySummary);

            $row.append(habitCell, controlCell, actionCell);

            return { $row, habit };
        }

        renderDayTable() {
            const grouped = this.getGroupedHabits();
            const columnCount = 3;

            if (this.dom.rangeSummary) {
                this.dom.rangeSummary.removeClass("is-visible").empty();
            }
            const $table = this.dom.tbody?.closest("table");
            if ($table) {
                $table.show();
            }

            this.dom.tbody.empty();

            grouped.forEach(({ group, habits }) => {
                const $groupRow = $("<tr>").addClass("habit-dashboard__group-row").attr("data-group-id", group.id);
                $groupRow.css("--habit-group-color", group.color || "#4ba3ff");
                const $groupCell = $("<td>").attr("colspan", columnCount);
                const $groupHeader = $("<div>").addClass("habit-dashboard__group-header");
                $groupHeader.append($("<span>").text(group.title));

                if (!group.id.startsWith("_")) {
                    const $buttons = $("<span>").addClass("habit-dashboard__group-actions");
                    $buttons.append(`<button type="button" data-action="edit-group" data-group-id="${group.id}" title="Edit group"><span class="bx bx-edit"></span></button>`);
                    $buttons.append(`<button type="button" data-action="delete-group" data-group-id="${group.id}" title="Delete group"><span class="bx bx-trash"></span></button>`);
                    $groupHeader.append($buttons);
                }

                $groupCell.append($groupHeader);
                $groupRow.append($groupCell);
                this.dom.tbody.append($groupRow);

                habits.forEach((habit) => {
                    const entries = this.state.entries.get(habit.id) || [];
                    const { $row } = this.renderHabitRow(habit, entries);
                    this.dom.tbody.append($row);
                });
            });
        }

        renderRangeTable() {
            const $table = this.dom.tbody?.closest("table");
            if ($table) {
                $table.hide();
            }

            this.dom.tbody.empty();

            const grouped = this.getGroupedHabits();
            const dates = this.state.dates;

            if (this.dom.rangeSummary?.length) {
                this.renderRangeSummaryCards(grouped, dates);
            }
        }


        renderRangeSummaryCards(grouped, dates) {
            if (!this.dom.rangeSummary?.length) {
                return;
            }

            if (!grouped.length) {
                this.dom.rangeSummary.removeClass("is-visible").empty();
                return;
            }

            const $summary = this.dom.rangeSummary.addClass("is-visible").empty();
            const labelFormat = this.state.view === "month" ? "DD" : "ddd DD MMM";
            if (dates.length) {
                const viewLabels = {
                    last7: "Last 7 Days",
                    last14: "Last 14 Days",
                    week: "Week",
                    twoWeeks: "Two Weeks",
                    month: "Month"
                };
                const startLabel = this.api.dayjs(dates[0]).format("MMM DD, YYYY");
                const endLabel = this.api.dayjs(dates[dates.length - 1]).format("MMM DD, YYYY");
                const viewLabel = viewLabels[this.state.view] || "Range";
                const habitCount = this.state.habits.length;
                const $rangeHeader = $("<div>").addClass("habit-dashboard__range-header");
                $rangeHeader.append($("<span>").text(`${viewLabel} · ${startLabel} → ${endLabel}`));
                $rangeHeader.append($("<span>").text(`${habitCount} habit${habitCount === 1 ? "" : "s"}`));
                $summary.append($rangeHeader);
            }

            grouped.forEach(({ group, habits }) => {
                const groupAccent = group.color || "#4ba3ff";
                const $groupSection = $("<div>")
                    .addClass("habit-dashboard__summary-group")
                    .attr("data-group-id", group.id)
                    .css("--habit-group-color", groupAccent);

                const $header = $("<div>").addClass("habit-dashboard__group-header");
                $header.append($("<span>").text(group.title));
                if (!group.id.startsWith("_")) {
                    const $buttons = $("<span>").addClass("habit-dashboard__group-actions");
                    $buttons.append(`<button type="button" data-action="edit-group" data-group-id="${group.id}" title="Edit group"><span class="bx bx-edit"></span></button>`);
                    $buttons.append(`<button type="button" data-action="delete-group" data-group-id="${group.id}" title="Delete group"><span class="bx bx-trash"></span></button>`);
                    $header.append($buttons);
                }
                $groupSection.append($header);

                habits.forEach((habit) => {
                    const summary = {
                        days: dates.length,
                        skipped: 0,
                        targetsMet: 0,
                        total: 0,
                        average: 0,
                        completed: 0,
                        count: 0,
                        activeDays: 0,
                        currentStreak: 0,
                        longestStreak: 0,
                        max: null,
                        min: null,
                        ...this.state.summary[habit.id]
                    };
                    const entries = this.state.rangeEntries[habit.id] || {};
                    const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
                    const subSummaries = hasSubEntryTemplates
                        ? this.buildRangeSubEntrySummaries(habit, entries, dates, labelFormat)
                        : [];
                    const hasSubEntrySummaries = subSummaries.length > 0;
                    const subentryToggleId = `habit-subentries-${habit.id}`;
                    const expansionState = this.ui?.rangeSubentryExpansion;
                    const globalSubentryExpanded = this.ui?.expandAllSubEntries !== false;
                    let subentriesExpanded = hasSubEntrySummaries ? globalSubentryExpanded : false;
                    if (hasSubEntrySummaries && expansionState) {
                        if (expansionState.has(habit.id)) {
                            subentriesExpanded = !!expansionState.get(habit.id);
                        } else {
                            expansionState.set(habit.id, subentriesExpanded);
                        }
                    }
                    const percent = this.computeProgressPercent(habit, summary);
                    const accent = habit.meta?.color || groupAccent;

                    const $card = $("<div>")
                        .addClass("habit-dashboard__summary-card")
                        .attr("data-habit-id", habit.id)
                        .attr("data-group-id", group.id)
                        .attr("data-role", "habit-draggable")
                        .attr("draggable", "true")
                        .css("--habit-accent", accent);

                    const progressValue = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
                    const completedDays = summary.completed || 0;
                    const possibleDays = Math.max(1, (summary.days || 0) - (summary.skipped || 0));
                    const progressDisplay = habit.type === "check"
                        ? `${completedDays}/${possibleDays}`
                        : `${Math.round(progressValue)}%`;
                    const $circle = $("<div>")
                        .addClass("habit-dashboard__progress-circle")
                        .css("--habit-progress", progressValue)
                        .attr("aria-label", `Progress ${progressDisplay}`)
                        .append($("<span class='habit-dashboard__progress-circle-label'>").text(progressDisplay));

                    const $content = $("<div>").addClass("habit-dashboard__summary-content");

                    const $mainRow = $("<div>").addClass("habit-dashboard__summary-main");
                    const $infoContainer = $("<div>").addClass("habit-dashboard__summary-info");
                    const $heading = $("<div>").addClass("habit-dashboard__summary-heading");
                    const iconClasses = habit.icon ? habit.icon.split(/\s+/).filter(Boolean) : [];
                    if (iconClasses.length && !iconClasses.some((cls) => cls.startsWith("bx"))) {
                        iconClasses.unshift("bx");
                    }
                    let $subentryToggle = null;
                    if (hasSubEntrySummaries) {
                        const $toggleButton = $("<button type='button' class='habit-dashboard__summary-subentry-toggle'></button>")
                            .attr("aria-controls", subentryToggleId)
                            .attr("aria-expanded", subentriesExpanded ? "true" : "false");
                        const $toggleIcon = $("<span class='habit-dashboard__summary-toggle-icon bx bx-chevron-right'></span>");
                        $toggleButton.append($toggleIcon);
                        if (iconClasses.length) {
                            $toggleButton.append($("<span aria-hidden='true'></span>").addClass(iconClasses.join(" ")));
                        }
                        $toggleButton.append($("<span class='habit-dashboard__summary-title'></span>").text(habit.title));
                        if (subentriesExpanded) {
                            $toggleButton.addClass("is-expanded");
                        }
                        $subentryToggle = $toggleButton;
                        $heading.append($toggleButton);
                    } else {
                        if (iconClasses.length) {
                            $heading.append($("<span>").addClass(iconClasses.join(" ")));
                        }
                        $heading.append($("<span class='habit-dashboard__summary-title'></span>").text(habit.title));
                    }

                    const summaryText = this.describeSummary(habit, summary);
                    const $stat = $("<span>")
                        .addClass("habit-dashboard__summary-stat")
                        .text(summaryText)
                        .attr("title", summaryText);

                    $infoContainer.append($heading, $stat);

                    const badgeElements = this.buildSummaryBadges(habit, summary);
                    if (badgeElements.length) {
                        const $badgeWrap = $("<div>").addClass("habit-dashboard__summary-badges");
                        badgeElements.forEach(($badge) => $badgeWrap.append($badge));
                        $infoContainer.append($badgeWrap);
                    }

                    const $actions = $("<div>").addClass("habit-dashboard__summary-actions");
                    $actions.append(`<button type="button" data-action="move-habit-up" title="Move up" aria-label="Move habit up"><span class="bx bx-chevron-up"></span></button>`);
                    $actions.append(`<button type="button" data-action="move-habit-down" title="Move down" aria-label="Move habit down"><span class="bx bx-chevron-down"></span></button>`);
                    $actions.append(`<button type="button" data-action="edit-habit" title="Edit habit"><span class="bx bx-edit"></span></button>`);
                    $actions.append(`<button type="button" data-action="delete-habit" title="Delete habit"><span class="bx bx-trash"></span></button>`);

                    $mainRow.append($infoContainer, $actions);

                    const $dates = $("<div>").addClass("habit-dashboard__summary-dates");
                    const focusDate = this.getQuickActionDate();
                    const todayISO = this.api.dayjs().format("YYYY-MM-DD");
                    dates.forEach((date) => {
                        const entryForDate = entries[date];
                        const list = Array.isArray(entryForDate) ? entryForDate.slice() : entryForDate ? [entryForDate] : [];
                        if (list.length > 1) {
                            list.sort((a, b) => (a?.recordedAt || `${date}T00:00:00Z`).localeCompare(b?.recordedAt || `${date}T00:00:00Z`));
                        }
                        const latest = list.length ? list[list.length - 1] : null;
                        const label = this.api.dayjs(date).format(labelFormat);
                        const chipClasses = ["habit-dashboard__date-chip"];
                        const chipLabel = this.formatChipText(habit, list, label);

                        if (!list.length) {
                            chipClasses.push("is-empty");
                        } else if (list.every((item) => item.skipped)) {
                            chipClasses.push("is-skipped");
                        } else {
                            chipClasses.push("is-complete");
                            if (latest && this.isEntryTargetMet(habit, latest)) {
                                chipClasses.push("is-target-met");
                            } else if (latest && this.isEntryMiss(habit, latest)) {
                                chipClasses.push("is-missed");
                            }
                        }

                        if (date === focusDate) {
                            chipClasses.push("is-current-day");
                        }
                        if (date === todayISO) {
                            chipClasses.push("is-today");
                        }

                        const $chip = $("<button type='button'>")
                            .addClass(chipClasses.join(" "))
                            .attr("data-date", date)
                            .attr("title", `${habit.title} · ${label}`)
                            .attr("data-habit-trigger", "primary")
                            .text(chipLabel);

                        $dates.append($chip);
                    });

                    const $datesRow = $("<div class='habit-dashboard__summary-dates-row'></div>");
                    $datesRow.append($dates);

                    let $subSection = null;
                    const syncSubentryExpansion = (expanded) => {
                        subentriesExpanded = expanded;
                        if ($subSection) {
                            $subSection.toggleClass("is-expanded", expanded);
                            $subSection.toggleClass("is-collapsed", !expanded);
                        }
                        if ($subentryToggle) {
                            $subentryToggle
                                .attr("aria-expanded", expanded ? "true" : "false")
                                .toggleClass("is-expanded", expanded);
                        }
                        if (expansionState) {
                            expansionState.set(habit.id, expanded);
                        }
                    };

                    if (hasSubEntrySummaries) {
                        const $list = $("<div class='habit-dashboard__summary-subentry-list'></div>");
                        subSummaries.forEach(({ template, averageLabel, chips }) => {
                            const $row = $("<div class='habit-dashboard__summary-subentry-row'></div>")
                                .attr("data-sub-entry-id", template.id);
                            const title = template.title || template.name || template.id;
                            $row.append($("<span class='habit-dashboard__summary-subentry-title'></span>").text(title));
                            $row.append($("<span class='habit-dashboard__summary-subentry-average'></span>").text(averageLabel));

                            const $chipset = $("<div class='habit-dashboard__summary-subentry-chips'></div>");
                            chips.forEach(({ date: chipDate, label: chipLabel, classes, title: chipTitle, subEntryId }) => {
                                const chipClasses = ["habit-dashboard__date-chip", "habit-dashboard__date-chip--sub-entry"]
                                    .concat(Array.isArray(classes) ? classes : []);
                                const $chip = $("<button type='button'></button>")
                                    .addClass(chipClasses.filter(Boolean).join(" "))
                                    .attr("data-date", chipDate)
                                    .attr("data-sub-entry-id", subEntryId)
                                    .attr("data-habit-trigger", "sub-entry")
                                    .attr("title", chipTitle || "")
                                    .text(chipLabel);
                                $chipset.append($chip);
                            });

                            $row.append($chipset);
                            $list.append($row);
                        });

                        const sectionClasses = [
                            "habit-dashboard__summary-subentry-section",
                            subentriesExpanded ? "is-expanded" : "is-collapsed"
                        ].join(" ");
                        $subSection = $("<div></div>")
                            .addClass(sectionClasses)
                            .attr("id", subentryToggleId)
                            .append($list);

                        syncSubentryExpansion(subentriesExpanded);

                        if ($subentryToggle) {
                            $subentryToggle.off("click").on("click", (event) => {
                                event.preventDefault();
                                syncSubentryExpansion(!subentriesExpanded);
                            });
                        }
                    }

                    $content.append($mainRow, $datesRow);
                    if ($subSection) {
                        $content.append($subSection);
                    }

                    const streakGoalValue = Number.isFinite(Number(summary.streakGoal))
                        ? Number(summary.streakGoal)
                        : (Number.isFinite(Number(habit.meta?.streakTarget)) ? Number(habit.meta.streakTarget) : null);
                    const hasStreak = Number.isFinite(streakGoalValue) && streakGoalValue > 0;
                    const hasDebugData = summary.streakDebug && Object.keys(summary.streakDebug).length > 0;
                    if (this.state.debugEnabled && (hasStreak || summary.currentStreak || summary.longestStreak || hasDebugData)) {
                        const streakWindowValue = Number.isFinite(Number(summary.streakWindowDays))
                            ? Number(summary.streakWindowDays)
                            : (Number.isFinite(Number(habit.meta?.streakWindow)) ? Number(habit.meta.streakWindow) : CONSTANTS.streakWindowDays);
                        const debugInfo = summary.streakDebug || {};
                        const pattern = debugInfo.pattern || "";
                        const evalDate = debugInfo.evaluationDate || "–";
                        const evalIndex = Number.isFinite(Number(debugInfo.evaluationIndex)) ? debugInfo.evaluationIndex : null;
                        const windowCounts = Array.isArray(debugInfo.windowCounts) ? debugInfo.windowCounts : [];
                        const debugParts = [
                            `habit=${habit.type}`,
                            pattern ? `pattern=${pattern}` : null,
                            `eval=${evalDate}`,
                            evalIndex !== null ? `evalIdx=${evalIndex}` : null,
                            `active=${summary.streakActive ? "yes" : "no"}`,
                            `goal=${streakGoalValue ?? "–"}/${streakWindowValue}`,
                            `current=${summary.currentStreak || 0}`,
                            `longest=${summary.longestStreak || 0}`,
                            `span=${summary.streakSpanDays || 0}`,
                            `start=${summary.streakStart || "–"}`,
                            `end=${summary.streakEnd || "–"}`,
                            windowCounts.length ? `windows=${windowCounts.join("/")}` : null
                        ].filter(Boolean);
                        const $debug = $("<div>")
                            .addClass("habit-dashboard__streak-debug")
                            .text(`Streak debug: ${debugParts.join(" · ")}`);
                        $content.append($debug);
                    }

                    $card.append($circle, $content);
                    $groupSection.append($card);
                });

                $summary.append($groupSection);
            });
        }

        buildRangeSubEntrySummaries(habit, entriesByDate, dates, labelFormat) {
            const templates = Array.isArray(habit.meta?.subEntries) ? habit.meta.subEntries : [];
            if (!templates.length) {
                return [];
            }
            return templates.map((template) => {
                const activeEntries = [];
                let loggedDays = 0;
                let skippedDays = 0;
                const focusDate = this.getQuickActionDate();
                const todayISO = this.api.dayjs().format("YYYY-MM-DD");

                const chips = dates.map((date) => {
                    const daily = entriesByDate?.[date];
                    const list = Array.isArray(daily) ? daily.slice() : daily ? [daily] : [];
                    const matching = list.filter((entry) => entry?.subEntryId === template.id);
                    if (matching.length > 1) {
                        matching.sort((a, b) => (a?.recordedAt || `${date}T00:00:00Z`).localeCompare(b?.recordedAt || `${date}T00:00:00Z`));
                    }

                    const active = matching.filter((entry) => !entry.skipped);
                    if (active.length) {
                        activeEntries.push(...active);
                        loggedDays += 1;
                    } else if (matching.length) {
                        skippedDays += 1;
                    }

                    const classes = [];
                    if (!matching.length) {
                        classes.push("is-empty");
                    } else if (!active.length) {
                        classes.push("is-skipped");
                    } else {
                        classes.push("is-complete");
                        const latest = matching[matching.length - 1];
                        if (latest && this.isEntryTargetMet(habit, latest)) {
                            classes.push("is-target-met");
                        } else if (latest && this.isEntryMiss(habit, latest)) {
                            classes.push("is-missed");
                        }
                    }

                    if (date === focusDate) {
                        classes.push("is-current-day");
                    }
                    if (date === todayISO) {
                        classes.push("is-today");
                    }

                    const label = this.formatChipText(habit, matching, this.api.dayjs(date).format(labelFormat));
                    const chipTitle = `${template.title || template.name || template.id} · ${this.api.dayjs(date).format("MMM DD, YYYY")}`;

                    return {
                        date,
                        label,
                        classes,
                        title: chipTitle,
                        subEntryId: template.id
                    };
                });

                const averageLabel = this.formatRangeSubEntryAverage(habit, activeEntries, loggedDays, skippedDays);

                return {
                    template,
                    averageLabel,
                    chips
                };
            });
        }

        formatRangeSubEntryAverage(habit, entries, loggedDays, skippedDays) {
            const totalDays = loggedDays + skippedDays;

            if (!entries.length) {
                if (skippedDays) {
                    return skippedDays === 1 ? "Skipped once" : `Skipped ${skippedDays}×`;
                }
                return "No data";
            }

            switch (habit.type) {
                case "rating": {
                    const values = entries
                        .map((entry) => Number(entry.value))
                        .filter((value) => Number.isFinite(value));
                    if (!values.length) {
                        return skippedDays ? (skippedDays === 1 ? "Skipped once" : `Skipped ${skippedDays}×`) : "No ratings";
                    }
                    const sum = values.reduce((acc, value) => acc + value, 0);
                    const avg = sum / values.length;
                    const scaleMax = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                    return `Avg ${avg.toFixed(1)} / ${scaleMax}`;
                }
                case "time": {
                    const totalMinutes = entries.reduce((acc, entry) => acc + Number(entry.value || 0), 0);
                    const averageMinutes = entries.length ? totalMinutes / entries.length : 0;
                    return `Avg ${this.formatMinutesLabel(averageMinutes)}`;
                }
                case "count":
                case "value": {
                    const total = entries.reduce((acc, entry) => acc + Number(entry.value || 0), 0);
                    const average = entries.length ? total / entries.length : 0;
                    const unit = habit.meta?.unit ? ` ${habit.meta.unit}` : "";
                    return `Avg ${average.toFixed(1)}${unit}`;
                }
                case "check": {
                    const completed = entries.filter((entry) => Number(entry.value)).length;
                    const denominator = totalDays || entries.length;
                    return `${completed}/${denominator} done`;
                }
                default: {
                    const count = entries.length;
                    return `${count} entr${count === 1 ? "y" : "ies"}`;
                }
            }
        }

        updateRangeSummary() {
            if (this.state.view === "day" && this.dom.rangeSummary?.length) {
                this.dom.rangeSummary.removeClass("is-visible").empty();
            }
        }

        describeSummary(habit, summary) {
            const daysTracked = summary.days || 0;
            const skipped = summary.skipped || 0;
            const activeDays = Math.max(0, daysTracked - skipped);
            const coverage = daysTracked > 0 ? Math.round((summary.count / daysTracked) * 100) : 0;

            switch (habit.type) {
                case "check": {
                    const completionRate = activeDays > 0 ? Math.round((summary.completed / activeDays) * 100) : 0;
                    const effectiveGoal = Number.isFinite(Number(summary.streakGoal))
                        ? Number(summary.streakGoal)
                        : (Number.isFinite(Number(habit.meta?.streakTarget)) ? Number(habit.meta.streakTarget) : null);
                    const windowDays = Number.isFinite(Number(summary.streakWindowDays))
                        ? Number(summary.streakWindowDays)
                        : CONSTANTS.streakWindowDays;
                    let streakInfo = "";
                    if (effectiveGoal && (summary.currentStreak || summary.longestStreak)) {
                        const stateLabel = summary.streakActive ? "" : " (paused)";
                        const bestLabel = summary.longestStreak ? ` (best ${summary.longestStreak}d)` : "";
                        streakInfo = ` · streak ${summary.currentStreak || 0}d${stateLabel}${bestLabel}`;
                    }
                    const goalInfo = effectiveGoal
                        ? ` · goal ${effectiveGoal}d/${windowDays}d`
                        : "";
                    return `Completed ${summary.completed || 0} of ${activeDays} (${completionRate}%)${streakInfo}${goalInfo}`;
                }
                case "rating": {
                    const avg = summary.average || 0;
                    const max = habit.meta?.scaleMax || 5;
                    const rangeInfo = summary.max !== null
                        ? ` · range ${summary.min ?? "–"}–${summary.max ?? "–"}`
                        : "";
                    const targetInfo = Number.isFinite(Number(habit.meta?.target))
                        ? ` · target ${habit.meta.target}+`
                        : "";
                    const streakInfo = Number.isFinite(Number(summary.streakGoal)) && summary.currentStreak
                        ? ` · streak ${summary.currentStreak || 0}d${summary.streakActive ? "" : " (paused)"}`
                        : "";
                    return `Average ${avg.toFixed(1)} / ${max}${rangeInfo}${targetInfo}${streakInfo}`;
                }
                case "time": {
                    const totalMinutes = summary.total || 0;
                    const averageMinutes = summary.average || 0;
                    const targetInfo = summary.targetsMet ? ` · target met ${summary.targetsMet}×` : "";
                    const targetLabel = Number.isFinite(Number(habit.meta?.target))
                        ? ` · target ${this.formatMinutesLabel(habit.meta.target)} /day`
                        : "";
                    const streakInfo = Number.isFinite(Number(summary.streakGoal)) && summary.currentStreak
                        ? ` · streak ${summary.currentStreak || 0}d${summary.streakActive ? "" : " (paused)"}`
                        : "";
                    return `Total ${this.formatMinutesLabel(totalMinutes)} · avg ${this.formatMinutesLabel(averageMinutes)}${targetInfo}${targetLabel}${streakInfo}`;
                }
                case "count":
                case "value": {
                    const unit = habit.meta?.unit ? ` ${habit.meta.unit}` : "";
                    const total = summary.total || 0;
                    const average = summary.average || 0;
                    const targetInfo = summary.targetsMet ? ` · target met ${summary.targetsMet}×` : "";
                    const targetLabel = Number.isFinite(Number(habit.meta?.target))
                        ? ` · target ${habit.meta.target}${unit} /day`
                        : "";
                    const streakInfo = Number.isFinite(Number(summary.streakGoal)) && summary.currentStreak
                        ? ` · streak ${summary.currentStreak || 0}d${summary.streakActive ? "" : " (paused)"}`
                        : "";
                    return `Total ${total}${unit} · avg ${average.toFixed(1)}${unit}${targetInfo}${targetLabel}${streakInfo}`;
                }
                default:
                    return `${summary.count || 0} entries · ${coverage}% coverage`;
            }
        }

        buildSummaryBadges(habit, summary) {
            const badges = [];
            const streak = summary.currentStreak || 0;
            if (streak >= 3) {
                const label = streak >= 10 ? `${streak}-day streak` : `${streak}d streak`;
                badges.push($("<span class='habit-dashboard__summary-badge habit-dashboard__summary-badge--streak'>")
                    .append("<span class='bx bx-fire'></span>")
                    .append($("<span>").text(label)));
            }

            const daysTracked = summary.days || 0;
            const skipped = summary.skipped || 0;
            const activeDays = Math.max(0, daysTracked - skipped);
            const targetsMet = summary.targetsMet || 0;
            if (activeDays > 0) {
                if (targetsMet >= activeDays) {
                    badges.push($("<span class='habit-dashboard__summary-badge habit-dashboard__summary-badge--perfect'>")
                        .append("<span class='bx bx-trophy'></span>")
                        .append($("<span>").text("Perfect")));
                } else if (targetsMet >= Math.max(1, Math.round(activeDays * 0.75))) {
                    badges.push($("<span class='habit-dashboard__summary-badge'>")
                        .append("<span class='bx bx-star'></span>")
                        .append($("<span>").text(`${targetsMet}/${activeDays} targets`)));
                }
            }

            const average = summary.average || 0;
            if (habit.type === "rating") {
                const target = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;
                const scaleMax = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                const threshold = target !== null ? target : scaleMax * 0.8;
                if (average >= threshold) {
                    badges.push($("<span class='habit-dashboard__summary-badge'>")
                        .append("<span class='bx bx-happy-beaming'></span>")
                        .append($("<span>").text(`Avg ${average.toFixed(1)}`)));
                }
            }

            return badges;
        }

        computeProgressPercent(habit, summary) {
            const activeDays = Math.max(1, (summary.days || 0) - (summary.skipped || 0));
            const target = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;

            if (habit.type === "check") {
                return (summary.completed || 0) / activeDays * 100;
            }

            if (habit.type === "rating") {
                const max = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                if (!max) {
                    return 0;
                }
                return (summary.average || 0) / max * 100;
            }

            if (["count", "value", "time"].includes(habit.type)) {
                if (target && target > 0) {
                    const effectiveDays = Math.max(1, summary.activeDays || activeDays);
                    return (summary.total || 0) / (target * effectiveDays) * 100;
                }
                return (summary.count || 0) / Math.max(1, summary.days || 1) * 100;
            }

            return (summary.count || 0) / Math.max(1, summary.days || 1) * 100;
        }

        isEntryTargetMet(habit, entry) {
            if (!entry || entry.skipped) {
                return false;
            }
            const target = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;
            if (habit.type === "check") {
                return !!entry.value;
            }
            if (target === null) {
                return false;
            }
            if (entry.value === null || entry.value === undefined) {
                return false;
            }
            return Number(entry.value) >= target;
        }

        isEntryMiss(habit, entry) {
            if (!entry || entry.skipped) {
                return false;
            }
            if (habit.type === "check") {
                return !entry.value;
            }
            const target = Number.isFinite(Number(habit.meta?.target)) ? Number(habit.meta.target) : null;
            if (target === null) {
                return false;
            }
            if (entry.value === null || entry.value === undefined) {
                return false;
            }
            return Number(entry.value) < target;
        }

        formatChipText(habit, entry, label) {
            const list = Array.isArray(entry) ? entry : entry ? [entry] : [];
            if (!list.length) {
                return label;
            }
            const active = list.filter((item) => !item.skipped);
            const last = active.length ? active[active.length - 1] : (list.length ? list[list.length - 1] : null);
            if (!last || last.skipped) {
                return `⏭ ${label}`;
            }
            const targetMet = this.isEntryTargetMet(habit, last);
            switch (habit.type) {
                case "check": {
                    const completed = active.filter((item) => item.value).length;
                    return completed ? `✔ ${completed}/${list.length}` : `○ ${list.length}`;
                }
                case "rating": {
                    if (!active.length) {
                        return `☆ –`;
                    }
                    const avg = active.reduce((acc, item) => acc + Number(item.value || 0), 0) / active.length;
                    return `${targetMet ? "★ " : ""}${avg.toFixed(1)}`;
                }
                case "time": {
                    const total = active.reduce((acc, item) => acc + Number(item.value || 0), 0);
                    const prefix = targetMet ? "★ " : "";
                    return `${prefix}${this.minutesToHHMM(total)}`;
                }
                case "count":
                case "value": {
                    const total = active.reduce((acc, item) => acc + Number(item.value || 0), 0);
                    const prefix = targetMet ? "★ " : "";
                    return `${prefix}${total}`;
                }
                default:
                    return label;
            }
        }

        mountModal($content) {
            this.closeModal();
            const $modal = $("<div class='habit-dashboard__modal'>").append($content);
            $(document.body).append($modal);
            this.activeModal = $modal;
            $modal.on("click", (event) => {
                if (event.target === $modal[0]) {
                    this.closeModal();
                }
            });
        }

        closeModal() {
            if (this.activeModal) {
                this.activeModal.remove();
                this.activeModal = null;
            }
        }

        openEntryEditor(habit, date, entry = null, options = {}) {
            const formattedDate = this.api.dayjs(date).format("ddd, DD MMM YYYY");
            const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
            const allowMultiple = !!habit.meta?.multiEntries;
            const entries = this.getEntryForDate(habit.id, date);
            if (hasSubEntryTemplates) {
                this.openTemplatedEntryEditor(habit, date, entries, {
                    ...options,
                    initialEntry: entry || null
                });
                return;
            }

            let activeEntry = entry || (allowMultiple && options.mode === "create" ? null : (entries[entries.length - 1] || null));
            let activeKey = options.entryKey || activeEntry?.key || null;

            const $content = $("<div class='habit-dashboard__modal-content'>");
            $content.append(`<h3>${habit.title} · ${formattedDate}</h3>`);
            $content.attr("data-habit-id", habit.id);
            $content.attr("data-habit-date", date);

            const $listContainer = allowMultiple ? $("<div class='habit-dashboard__multi-list'></div>") : null;
            if ($listContainer) {
                const renderList = () => {
                    $listContainer.empty();
                    entries
                        .slice()
                        .sort((a, b) => (a.recordedAt || 0) > (b.recordedAt || 0) ? 1 : -1)
                        .forEach((item) => {
                            const label = item.recordedAt
                                ? this.api.dayjs(item.recordedAt).format("HH:mm")
                                : "Entry";
                            const valueText = this.formatEntryDisplay(habit, item);
                            const $row = $("<div class='habit-dashboard__multi-item'></div>")
                                .toggleClass("is-active", item.key === activeKey)
                                .on("click", () => {
                                    activeEntry = item;
                                    activeKey = item.key || null;
                                    setFormValues(activeEntry);
                                    $listContainer.find(".habit-dashboard__multi-item").removeClass("is-active");
                                    $row.addClass("is-active");
                                });
                            $row.append($("<span class='habit-dashboard__multi-label'>").text(`${label}: ${valueText}`));
                            $listContainer.append($row);
                        });

                    const $add = $("<button type='button' class='habit-dashboard__multi-add'>Log new entry</button>")
                        .on("click", () => {
                            activeEntry = null;
                            activeKey = null;
                            setFormValues(null);
                            $listContainer.find(".habit-dashboard__multi-item").removeClass("is-active");
                        });
                    $listContainer.append($add);
                };
                renderList();
                $content.append($listContainer);
            }

            const $form = $("<form class='habit-dashboard__form-grid'></form>");
            let valueField;
            let $deleteButton = null;
            let ratingControl = null;

            if (habit.type === "check") {
                const $select = $("<select name='status'></select>")
                    .append("<option value='done'>Completed</option>")
                    .append("<option value='pending'>Not done</option>")
                    .append("<option value='skip'>Skipped</option>");
                valueField = $select;
                $form.append($("<label class='habit-dashboard__form-field'>Outcome</label>").append($select));
            } else if (habit.type === "rating") {
                const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                const maxCandidate = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                const max = maxCandidate >= min ? maxCandidate : min;
                const $hidden = $("<input type='hidden'>");
                valueField = $hidden;
                ratingControl = this.createRatingGroup({
                    habit,
                    min,
                    max,
                    currentValue: null,
                    disabled: false,
                    context: "modal",
                    onSelect: (selected) => {
                        $hidden.val(String(selected));
                        return true;
                    }
                });
                const $field = $("<label class='habit-dashboard__form-field habit-dashboard__form-field--full'>Rating</label>")
                    .append(ratingControl.$group, $hidden);
                $form.append($field);
            } else if (habit.type === "time") {
                const $input = $("<input type='number' min='0'>");
                valueField = $input;
                $form.append($("<label class='habit-dashboard__form-field'>Minutes</label>").append($input));
            } else {
                const $input = $("<input type='number'>");
                valueField = $input;
                $form.append($("<label class='habit-dashboard__form-field'>Value</label>").append($input));
            }

            let skipState = !!entry?.skipped;
            const $skipField = $("<div class='habit-dashboard__form-field habit-dashboard__form-field--inline'></div>");
            const $skipLabel = $("<span>Skip entry</span>");
            const $skipToggle = $("<button type='button' class='habit-dashboard__toggle habit-dashboard__toggle--skip' aria-pressed='false'>Skip</button>");
            const updateSkipToggle = () => {
                $skipToggle.toggleClass("is-active", skipState);
                $skipToggle.attr("aria-pressed", skipState ? "true" : "false");
                $skipToggle.text(skipState ? "Skipped" : "Skip");
                if (ratingControl) {
                    ratingControl.setDisabled(skipState);
                    if (skipState) {
                        ratingControl.setValue(null);
                        if (valueField && typeof valueField.val === "function") {
                            valueField.val("");
                        }
                    }
                } else if (valueField && typeof valueField.prop === "function") {
                    valueField.prop("disabled", skipState);
                    if (typeof valueField.toggleClass === "function") {
                        valueField.toggleClass("is-disabled", skipState);
                    }
                    if (skipState && typeof valueField.val === "function") {
                        valueField.val("");
                    }
                }
            };
            $skipToggle.on("click", () => {
                skipState = !skipState;
                updateSkipToggle();
            });
            updateSkipToggle();
            $skipField.append($skipLabel, $skipToggle);
            if (habit.type === "check") {
                $skipField.hide();
            }
            $form.append($skipField);

            const $actions = $("<div class='habit-dashboard__form-actions'>");
            const $cancel = $("<button type='button'>Cancel</button>").on("click", () => this.closeModal());
            const $save = $("<button type='submit'>Save</button>");
            $actions.append($cancel, $save);

            if (!allowMultiple && entry) {
                const $clear = $("<button type='button'>Clear</button>").on("click", async () => {
                    const entryKey = `${habit.id}:${date}`;
                    this.logger.info("entry-editor.clear", {
                        habitId: habit.id,
                        date,
                        entryKey
                    });
                    await this.deleteEntryKeys([entryKey]);
                    this.closeModal();
                    await this.refresh({ reason: "entry-clear", silent: true });
                });
                $actions.prepend($clear);
            }

            if (allowMultiple) {
                $deleteButton = $("<button type='button'>Delete entry</button>")
                    .toggle(!!activeKey)
                    .on("click", async () => {
                        if (!activeKey) {
                            return;
                        }
                        const confirmed = await this.confirm("Delete this entry?", "Delete");
                        if (!confirmed) {
                            return;
                        }
                        this.logger.info("entry-editor.delete", {
                            habitId: habit.id,
                            date,
                            entryKey: activeKey
                        });
                        await this.deleteEntryKeys([activeKey]);
                        this.closeModal();
                        await this.refresh({ reason: "entry-delete", silent: true });
                    });
                $actions.prepend($deleteButton);
            }

            $form.append($actions);
            $content.append($form);

            this.logger.info("entry-editor.open", {
                trigger: options.trigger || "unknown",
                habitId: habit.id,
                habitTitle: habit.title,
                date,
                entryKey: activeKey || null,
                allowMultiple
            });

            this.mountModal($content);

            const emitActiveEntryChange = () => {
                this.logger.info("entry-editor.selection", {
                    habitId: habit.id,
                    date,
                    entryKey: activeKey || null
                });
            };

            const setFormValues = (entryData) => {
                if (habit.type === "check") {
                    const status = entryData?.skipped ? "skip" : entryData?.value ? "done" : "pending";
                    valueField.val(status || "pending");
                } else if (habit.type === "rating") {
                    if (ratingControl) {
                        const numeric = Number.isFinite(Number(entryData?.value)) ? Number(entryData.value) : null;
                        ratingControl.setValue(numeric);
                        valueField.val(Number.isFinite(numeric) ? String(numeric) : "");
                    }
                } else if (habit.type === "time" || habit.type === "count" || habit.type === "value") {
                    valueField.val(entryData?.value ?? "");
                }
                skipState = !!entryData?.skipped;
                updateSkipToggle();
                if (allowMultiple) {
                    activeKey = entryData?.key || null;
                    if ($deleteButton) {
                        $deleteButton.toggle(!!activeKey);
                    }
                    emitActiveEntryChange();
                }
            };

            setFormValues(activeEntry);
            emitActiveEntryChange();

            $form.on("submit", async (event) => {
                event.preventDefault();
                let value = null;
                let skip = false;

                if (habit.type === "check") {
                    const status = valueField.val();
                    if (status === "skip") {
                        skip = true;
                        value = null;
                    } else if (status === "done") {
                        value = 1;
                    } else {
                        value = 0;
                    }
                } else {
                    skip = skipState;
                    const raw = typeof valueField.val === "function" ? valueField.val() : null;
                    value = raw === "" || raw === null || raw === undefined ? null : Number(raw);
                    if (skip) {
                        value = null;
                    }
                }

                const success = await this.persistEntry(habit, {
                    value,
                    skip,
                    source: allowMultiple ? "multi-edit" : "range-edit",
                    date,
                    entryKey: activeKey
                });
                if (success) {
                    this.closeModal();
                }
            });
        }

        openTemplatedEntryEditor(habit, date, entries = [], options = {}) {
            const formattedDate = this.api.dayjs(date).format("ddd, DD MMM YYYY");
            const focusSubEntryId = options.focusSubEntryId || options.initialEntry?.subEntryId || null;
            const entryMap = new Map();
            entries.forEach((item) => {
                if (item?.subEntryId) {
                    entryMap.set(item.subEntryId, item);
                }
            });
            if (options.initialEntry?.subEntryId && !entryMap.has(options.initialEntry.subEntryId)) {
                entryMap.set(options.initialEntry.subEntryId, options.initialEntry);
            }

            const $content = $("<div class='habit-dashboard__modal-content'>");
            $content.append(`<h3>${habit.title} · ${formattedDate}</h3>`);
            $content.attr("data-habit-id", habit.id);
            $content.attr("data-habit-date", date);

            const $form = $("<form class='habit-dashboard__form-grid habit-dashboard__form-grid--subentries'></form>");
            const templateRows = [];

            const inputType = (() => {
                switch (habit.type) {
                    case "time":
                        return "text";
                    case "check":
                        return "number";
                    case "rating":
                    case "count":
                    case "value":
                        return "number";
                    default:
                        return "text";
                }
            })();

            habit.meta.subEntries.forEach((template) => {
                const templateId = template.id;
                const templateEntry = entryMap.get(templateId) || null;
                const $field = $("<div class='habit-dashboard__form-field habit-dashboard__form-field--full habit-dashboard__form-field--subentry'></div>")
                    .attr("data-sub-entry-id", templateId);
                $field.append($("<span class='habit-dashboard__subentry-label'>").text(template.title || template.name || templateId));

                let $valueInput;
                let ratingControl = null;
                let ratingMin = null;
                const initialNumericValue = Number.isFinite(Number(templateEntry?.value)) ? Number(templateEntry.value) : null;

                if (habit.type === "rating") {
                    const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                    const maxCandidate = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                    const max = maxCandidate >= min ? maxCandidate : min;
                    ratingMin = min;
                    $valueInput = $("<input type='hidden' data-field='value'>");
                    if (initialNumericValue !== null) {
                        $valueInput.val(String(initialNumericValue));
                    }
                    ratingControl = this.createRatingGroup({
                        habit,
                        min,
                        max,
                        currentValue: initialNumericValue,
                        disabled: !!templateEntry?.skipped,
                        context: "modal",
                        onSelect: (selected) => {
                            $valueInput.val(String(selected));
                            return true;
                        }
                    });
                    const $control = $("<span class='habit-dashboard__subentry-control'></span>").append(ratingControl.$group);
                    $field.append($control, $valueInput);
                } else {
                    const inputKind = habit.type === "time" ? "text" : inputType;
                    $valueInput = $(`<input type='${inputKind}'>`).attr("aria-label", `${template.title || templateId} value`);
                    if (habit.type === "time") {
                        $valueInput.attr("placeholder", "hh:mm or minutes");
                        if (templateEntry && !templateEntry.skipped && templateEntry.value !== undefined && templateEntry.value !== null) {
                            $valueInput.val(String(templateEntry.value));
                        }
                    } else if (["count", "value"].includes(habit.type)) {
                        if (templateEntry && !templateEntry.skipped && Number.isFinite(Number(templateEntry.value))) {
                            $valueInput.val(String(templateEntry.value));
                        }
                    } else if (habit.type === "check") {
                        if (templateEntry && !templateEntry.skipped && Number.isFinite(Number(templateEntry.value))) {
                            $valueInput.val(String(Number(templateEntry.value)));
                        }
                    } else if (templateEntry && !templateEntry.skipped && templateEntry.value !== undefined && templateEntry.value !== null) {
                        $valueInput.val(String(templateEntry.value));
                    }
                    $field.append($valueInput);
                }

                let skipState = !!templateEntry?.skipped;
                const $skipToggle = $("<button type='button' class='habit-dashboard__toggle habit-dashboard__toggle--skip' aria-pressed='false'></button>");
                const updateSkipUi = () => {
                    $skipToggle.toggleClass("is-active", skipState);
                    $skipToggle.attr("aria-pressed", skipState ? "true" : "false");
                    $skipToggle.text(skipState ? "Skipped" : "Skip");
                    if (ratingControl) {
                        ratingControl.setDisabled(skipState);
                        if (skipState) {
                            ratingControl.setValue(null);
                            $valueInput.val("");
                        }
                    } else {
                        $valueInput.prop("disabled", skipState);
                        if (skipState) {
                            $valueInput.addClass("is-disabled");
                        } else {
                            $valueInput.removeClass("is-disabled");
                        }
                    }
                };

                $skipToggle.on("click", () => {
                    skipState = !skipState;
                    updateSkipUi();
                });

                updateSkipUi();

                if (focusSubEntryId && focusSubEntryId === templateId) {
                    setTimeout(() => {
                        if (ratingControl && !skipState) {
                            ratingControl.focusValue(initialNumericValue ?? ratingMin);
                        } else if (!skipState) {
                            $valueInput.trigger("focus");
                        }
                    }, 0);
                }

                $field.append($skipToggle);
                $form.append($field);

                templateRows.push({
                    templateId,
                    $valueInput,
                    entry: templateEntry || null,
                    entryKey: templateEntry?.key || null,
                    initialValue: templateEntry?.value ?? null,
                    initialSkipped: !!templateEntry?.skipped,
                    ratingControl,
                    getSkip: () => skipState
                });
            });

            const $actions = $("<div class='habit-dashboard__form-actions'>");
            const $cancel = $("<button type='button'>Cancel</button>").on("click", () => this.closeModal());
            const $save = $("<button type='submit'>Save</button>");
            $actions.append($cancel, $save);
            $form.append($actions);
            $content.append($form);

            this.logger.info("entry-editor.open", {
                trigger: options.trigger || "unknown",
                habitId: habit.id,
                habitTitle: habit.title,
                date,
                focusSubEntryId: focusSubEntryId || null,
                allowMultiple: true
            });

            this.mountModal($content);

            const normalizeForComparison = (val, type) => {
                if (val === null || val === undefined) {
                    return null;
                }
                if (["rating", "count", "value", "check"].includes(type)) {
                    const asNumber = Number(val);
                    return Number.isFinite(asNumber) ? asNumber : null;
                }
                if (type === "time") {
                    return String(val);
                }
                return String(val);
            };

            $form.on("submit", async (event) => {
                event.preventDefault();
                const requests = [];

                templateRows.forEach(({ templateId, $valueInput, getSkip, entry, entryKey, initialValue, initialSkipped }) => {
                    const skip = typeof getSkip === "function" ? !!getSkip() : false;
                    let value = null;
                    const raw = ($valueInput.val() ?? "").toString().trim();

                    if (!skip) {
                        if (habit.type === "time") {
                            value = raw === "" ? null : raw;
                        } else if (["rating", "count", "value", "check"].includes(habit.type)) {
                            const numeric = Number(raw);
                            value = raw === "" || !Number.isFinite(numeric) ? null : numeric;
                        } else {
                            value = raw === "" ? null : raw;
                        }
                    }

                    if (!skip && value === null) {
                        if (entryKey) {
                            requests.push(this.deleteEntryKeys([entryKey]));
                        }
                        return;
                    }

                    const previousValue = initialValue ?? null;
                    const previousSkip = initialSkipped;
                    const normalizedCurrent = normalizeForComparison(value, habit.type);
                    const normalizedPrevious = normalizeForComparison(previousValue, habit.type);

                    const changed = skip !== previousSkip || normalizedCurrent !== normalizedPrevious;
                    if (!changed) {
                        return;
                    }

                    requests.push(this.persistEntry(habit, {
                        subEntryId: templateId,
                        value,
                        skip,
                        source: "sub-entry-modal",
                        date,
                        entryKey: entryKey || null
                    }));
                });

                if (!requests.length) {
                    this.closeModal();
                    return;
                }

                const results = await Promise.all(requests);
                if (results.every(Boolean)) {
                    this.closeModal();
                }
            });
        }

        normalizeHexColor(value) {
            if (value === null || value === undefined) {
                return null;
            }
            const trimmed = String(value).trim();
            if (!trimmed) {
                return null;
            }
            const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
            if (!match) {
                return null;
            }
            let hex = match[1];
            if (hex.length === 3) {
                hex = hex
                    .split("")
                    .map((ch) => ch + ch)
                    .join("");
            }
            return `#${hex.toLowerCase()}`;
        }

        buildColorField(initialValue = "") {
            const placeholder = "#4ba3ff";
            const sanitized = this.normalizeHexColor(initialValue);
            const initialHex = sanitized || "";
            const pickerValue = sanitized || placeholder;

            const $picker = $("<input type='color' class='habit-dashboard__color-input'>").val(pickerValue);
            if (!sanitized) {
                $picker.addClass("is-empty");
            }
            const $text = $("<input type='text' class='habit-dashboard__color-text' placeholder='#4ba3ff'>").val(initialHex);
            const $swatches = $("<div class='habit-dashboard__color-swatches'>");
            const $wrapper = $("<div class='habit-dashboard__color-field'>").append($picker, $text, $swatches);

            const applyValue = (value) => {
                const normalized = this.normalizeHexColor(value);
                if (normalized) {
                    $text.val(normalized);
                    $picker.val(normalized).removeClass("is-empty");
                } else {
                    $text.val("");
                    $picker.val(placeholder).addClass("is-empty");
                }
            };

            const syncFromPicker = () => {
                const normalized = this.normalizeHexColor($picker.val());
                if (normalized) {
                    $text.val(normalized);
                    $picker.removeClass("is-empty");
                }
            };

            const syncFromText = () => {
                applyValue($text.val());
            };

            $picker.on("input change", syncFromPicker);
            $text.on("input", syncFromText);

            const swatches = ["#4ba3ff", "#60dea9", "#ffb347", "#c95353", "#909090"];
            swatches.forEach((hex) => {
                const $btn = $("<button type='button' class='habit-dashboard__color-swatch'></button>")
                    .attr("title", hex)
                    .attr("aria-label", `Use colour ${hex}`)
                    .css("--habit-color-swatch", hex)
                    .on("click", () => applyValue(hex));
                $swatches.append($btn);
            });

            const $reset = $("<button type='button' class='habit-dashboard__color-reset'>Reset to theme</button>")
                .on("click", () => applyValue(null));
            $swatches.append($reset);

            return {
                $field: $wrapper,
                getValue: () => this.normalizeHexColor($text.val()),
                setValue: (value) => applyValue(value)
            };
        }

        openHabitEditor(habit = null) {
            const isEdit = !!habit;
            const title = isEdit ? "Edit Habit" : "New Habit";
            const data = habit || { meta: {} };
            const $content = $("<div class='habit-dashboard__modal-content'>").append(`<h3>${title}</h3>`);
            const $form = $("<form class='habit-dashboard__form-grid'></form>");

            const toSafeNumber = (input) => {
                if (input === "" || input === null || input === undefined) {
                    return null;
                }
                const num = Number(input);
                return Number.isFinite(num) ? num : null;
            };

            const cleanString = (input) => {
                if (input === null || input === undefined) {
                    return null;
                }
                const trimmed = String(input).trim();
                return trimmed.length ? trimmed : null;
            };

            const addField = (labelText, $input, { full = false } = {}) => {
                const classes = ["habit-dashboard__form-field"];
                if (full) {
                    classes.push("habit-dashboard__form-field--full");
                }
                const $field = $("<label>")
                    .addClass(classes.join(" "))
                    .text(labelText)
                    .append($input);
                $form.append($field);
                return $field;
            };

            const $title = $("<input type='text' required>").val(data.title || "");
            addField("Title", $title);

            const $type = $("<select required></select>")
                .append("<option value='check'>Check</option>")
                .append("<option value='count'>Count</option>")
                .append("<option value='time'>Time</option>")
                .append("<option value='rating'>Rating</option>")
                .append("<option value='value'>Value</option>")
                .val(data.type || "check");
            addField("Type", $type);

            const $group = $("<select></select>");
            this.state.groups.forEach((group) => {
                $group.append(`<option value='${group.id}'>${group.title}</option>`);
            });
            if (!this.state.groups.length) {
                $group.append("<option value=''>General</option>");
            }
            $group.val(data.groupId || this.state.groups[0]?.id || "");
            addField("Group", $group);

            const $description = $("<textarea rows='3'></textarea>").val(data.meta?.description || "");
            addField("Description", $description, { full: true });

            const $slug = $("<input type='text' placeholder='auto-generated'>").val(data.slug || "");
            addField("Slug", $slug);

            const $unit = $("<input type='text'>").val(data.meta?.unit || "");
            const $target = $("<input type='number'>").val(data.meta?.target ?? "");
            addField("Unit", $unit);
            addField("Target", $target);

            const $reminder = $("<input type='time'>").val(data.meta?.reminderTime || "");
            addField("Reminder time", $reminder);

            const $streakTarget = $("<input type='number' min='1'>").val(data.meta?.streakTarget ?? "");
            const $streakWindow = $("<input type='number' min='1'>").val(data.meta?.streakWindow ?? CONSTANTS.streakWindowDays);
            addField("Streak goal (days)", $streakTarget);
            addField("Streak window (days)", $streakWindow);

            const $decimals = $("<input type='number'>").val(data.meta?.decimals ?? "");
            const $scaleMin = $("<input type='number'>").val(data.meta?.scaleMin ?? "");
            const $scaleMax = $("<input type='number'>").val(data.meta?.scaleMax ?? "");
            const $quickStep = $("<input type='number' min='0' step='0.1'>").val(data.meta?.quickStep ?? "");
            addField("Decimals", $decimals);
            addField("Scale min", $scaleMin);
            addField("Scale max", $scaleMax);
            addField("Quick increment", $quickStep);
            let multiEntriesState = !!data.meta?.multiEntries;
            const $multiToggle = $("<button type='button' class='habit-dashboard__toggle' aria-pressed='false'>Disabled</button>");
            const updateMultiToggle = () => {
                $multiToggle.toggleClass("is-active", multiEntriesState);
                $multiToggle.attr("aria-pressed", multiEntriesState ? "true" : "false");
                $multiToggle.text(multiEntriesState ? "Enabled" : "Disabled");
            };
            $multiToggle.on("click", () => {
                multiEntriesState = !multiEntriesState;
                updateMultiToggle();
                syncSubEntryVisibility();
            });
            const $multiField = $("<div class='habit-dashboard__form-field habit-dashboard__form-field--full habit-dashboard__form-field--inline'></div>")
                .append($("<span>Multiple entries per day</span>"))
                .append($multiToggle);
            $form.append($multiField);

            const existingSubEntries = Array.isArray(data.meta?.subEntries) ? data.meta.subEntries : [];
            if (existingSubEntries.length && !multiEntriesState) {
                multiEntriesState = true;
            }
            updateMultiToggle();

            const subEntryHelpMessage = "Keep titles consistent; identifiers become part of the saved entry key and must stay unique.";
            const $subEntrySection = $(
                "<fieldset class='habit-dashboard__subentry-config-section habit-dashboard__form-field--full'></fieldset>"
            ).hide();
            $subEntrySection.append("<legend>Sub-entries</legend>");
            const $subEntryHelp = $("<p class='habit-dashboard__subentry-config-help'></p>").text(subEntryHelpMessage);
            const $subEntryList = $("<div class='habit-dashboard__subentry-config-list'></div>");
            const $addSubEntry = $("<button type='button' class='habit-dashboard__subentry-add'>Add sub-entry</button>");

            const addSubEntryRow = (initial = {}) => {
                const $row = $("<div class='habit-dashboard__subentry-config'></div>");
                const $idInput = $("<input type='text' data-field='id'>")
                    .attr("placeholder", "Identifier")
                    .attr("aria-label", "Sub-entry identifier")
                    .attr("title", "Sub-entry identifier")
                    .addClass("habit-dashboard__subentry-config-id")
                    .val(initial.id || "");
                const $titleInput = $("<input type='text' data-field='title'>")
                    .attr("placeholder", "Display label")
                    .attr("aria-label", "Sub-entry title")
                    .attr("title", "Sub-entry title")
                    .addClass("habit-dashboard__subentry-config-title")
                    .val(initial.title || "");
                const $idField = $("<div class='habit-dashboard__subentry-field'></div>").append($idInput);
                const $titleField = $("<div class='habit-dashboard__subentry-field'></div>").append($titleInput);
                let requiredState = initial.required === true;
                const $requiredToggle = $("<button type='button' class='habit-dashboard__toggle' aria-pressed='false'>Optional</button>");
                const updateRequiredToggle = () => {
                    $requiredToggle.toggleClass("is-active", requiredState);
                    $requiredToggle.attr("aria-pressed", requiredState ? "true" : "false");
                    $requiredToggle.text(requiredState ? "Required" : "Optional");
                    $row.data("requiredState", requiredState);
                };
                $requiredToggle.on("click", () => {
                    requiredState = !requiredState;
                    updateRequiredToggle();
                });
                updateRequiredToggle();
                $row.data("getRequired", () => requiredState);
                const $requiredLabel = $("<span class='habit-dashboard__subentry-required'></span>").append($requiredToggle);
                const $remove = $("<button type='button'>Remove</button>");
                const $actions = $("<span class='habit-dashboard__subentry-config-actions'></span>")
                    .append($requiredLabel)
                    .append($remove);

                const applySlug = (value) => {
                    const safe = cleanString(value);
                    if (!safe) {
                        return;
                    }
                    $idInput.val(slugify(safe));
                };

                $titleInput.on("blur", () => {
                    if (!cleanString($idInput.val())) {
                        applySlug($titleInput.val());
                    }
                });

                $idInput.on("blur", () => {
                    const normalized = cleanString($idInput.val());
                    if (normalized) {
                        $idInput.val(slugify(normalized));
                    }
                });

                $remove.on("click", () => {
                    $row.remove();
                    if (!$subEntryList.children().length) {
                        $subEntryHelp.text("Add at least one sub-entry to template multiple rows.");
                    }
                });

                $row.append($idField, $titleField, $actions);
                $subEntryList.append($row);
                $subEntryHelp.text(subEntryHelpMessage);
                return $row;
            };

            $addSubEntry.on("click", () => {
                if (!multiEntriesState) {
                    multiEntriesState = true;
                    updateMultiToggle();
                    syncSubEntryVisibility();
                }
                const $row = addSubEntryRow();
                $row.find("input[data-field='title']").trigger("focus");
            });

            $subEntrySection.append($subEntryHelp, $subEntryList, $addSubEntry);
            $form.append($subEntrySection);

            const syncSubEntryVisibility = () => {
                const visible = multiEntriesState || $subEntryList.children().length > 0;
                $subEntrySection.toggle(visible);
                if (visible && !$subEntryList.children().length) {
                    addSubEntryRow();
                }
                updateMultiToggle();
            };

            existingSubEntries.forEach((entry) => addSubEntryRow(entry));
            syncSubEntryVisibility();

            const colorField = this.buildColorField(data.meta?.color || "");
            const $icon = $("<input type='text' placeholder='bx bx-star'>").val(data.icon || "");
            addField("Accent color", colorField.$field);
            addField("Icon class", $icon);

            const $actions = $("<div class='habit-dashboard__form-actions'>");
            const $cancel = $("<button type='button'>Cancel</button>").on("click", () => this.closeModal());
            const $save = $("<button type='submit'>Save</button>");
            $actions.append($cancel, $save);

            $form.append($actions);
            $content.append($form);
            this.mountModal($content);

            $form.on("submit", async (event) => {
                event.preventDefault();
                const slug = cleanString($slug.val());
                const description = cleanString($description.val());
                const unit = cleanString($unit.val());
                const color = colorField.getValue();
                const icon = cleanString($icon.val());
                const reminderTime = cleanString($reminder.val());
                const subEntriesPayload = [];
                const hasSubEntryRows = $subEntryList.children(".habit-dashboard__subentry-config").length > 0;

                if (multiEntriesState || hasSubEntryRows) {
                    const seenIds = new Set();
                    let validationError = null;
                    $subEntryList.children(".habit-dashboard__subentry-config").each((_, element) => {
                        const $row = $(element);
                        let idValue = cleanString($row.find("input[data-field='id']").val());
                        const titleValue = cleanString($row.find("input[data-field='title']").val());
                        if (!idValue && titleValue) {
                            idValue = slugify(titleValue);
                        }
                        if (!idValue) {
                            validationError = "Each sub-entry needs an identifier.";
                            return false;
                        }
                        if (seenIds.has(idValue)) {
                            validationError = "Sub-entry identifiers must be unique.";
                            return false;
                        }
                        seenIds.add(idValue);
                        const getRequired = $row.data("getRequired");
                        const required = typeof getRequired === "function"
                            ? !!getRequired()
                            : !!$row.data("requiredState");
                        subEntriesPayload.push({
                            id: idValue,
                            title: titleValue || idValue,
                            required
                        });
                        return true;
                    });
                    if (validationError) {
                        this.api.showError?.(validationError);
                        return;
                    }
                }
                const multiEntriesEnabled = multiEntriesState || subEntriesPayload.length > 0;
                const payload = {
                    title: cleanString($title.val()) || "",
                    type: $type.val(),
                    groupId: $group.val() || undefined,
                    slug: slug || undefined,
                    description,
                    unit,
                    target: toSafeNumber($target.val()),
                    decimals: toSafeNumber($decimals.val()),
                    scaleMin: toSafeNumber($scaleMin.val()),
                    scaleMax: toSafeNumber($scaleMax.val()),
                    quickStep: toSafeNumber($quickStep.val()),
                    multiEntries: multiEntriesEnabled,
                    subEntries: subEntriesPayload,
                    color: color ?? null,
                    icon: icon || null,
                    reminderTime: reminderTime || null,
                    streakTarget: toSafeNumber($streakTarget.val()),
                    streakWindow: toSafeNumber($streakWindow.val())
                };

                if (isEdit) {
                    await this.backend.updateHabit({ habitId: habit.id, ...payload });
                } else {
                    await this.backend.createHabit(payload);
                }

                this.closeModal();
                await this.refresh({ reason: "habit-edit" });
            });
        }

        openGroupEditor(group = null) {
            const isEdit = !!group;
            const $content = $("<div class='habit-dashboard__modal-content'>").append(`<h3>${isEdit ? "Edit Group" : "New Group"}</h3>`);
            const $form = $("<form class='habit-dashboard__form-grid'></form>");

            const addField = (labelText, $input, { full = false } = {}) => {
                const classes = ["habit-dashboard__form-field"];
                if (full) {
                    classes.push("habit-dashboard__form-field--full");
                }
                const $field = $("<label>")
                    .addClass(classes.join(" "))
                    .text(labelText)
                    .append($input);
                $form.append($field);
                return $field;
            };

            const $title = $("<input type='text' required>").val(group?.title || "");
            const colorField = this.buildColorField(group?.color || "");
            const $order = $("<input type='number'>").val(group?.order ?? "");

            addField("Title", $title);
            addField("Color", colorField.$field);
            addField("Order", $order);

            const $actions = $("<div class='habit-dashboard__form-actions'>");
            const $cancel = $("<button type='button'>Cancel</button>").on("click", () => this.closeModal());
            const $save = $("<button type='submit'>Save</button>");
            $actions.append($cancel, $save);

            $form.append($actions);
            $content.append($form);
            this.mountModal($content);

            $form.on("submit", async (event) => {
                event.preventDefault();
                const cleanString = (input) => {
                    if (input === null || input === undefined) {
                        return null;
                    }
                    const trimmed = String(input).trim();
                    return trimmed.length ? trimmed : null;
                };
                const toSafeNumber = (input) => {
                    if (input === "" || input === null || input === undefined) {
                        return null;
                    }
                    const num = Number(input);
                    return Number.isFinite(num) ? num : null;
                };
                const colorValue = colorField.getValue();
                const payload = {
                    title: cleanString($title.val()) || undefined,
                    color: colorValue === null ? null : colorValue,
                    order: toSafeNumber($order.val()) ?? undefined
                };

                if (isEdit) {
                    await this.backend.updateGroup({ groupId: group.id, ...payload });
                } else {
                    await this.backend.createGroup(payload);
                }

                this.closeModal();
                await this.refresh({ reason: "group-edit" });
            });
        }

        async deleteHabitFlow(habitId) {
            const habit = this.findHabit(habitId);
            if (!habit) {
                return;
            }
            const confirmed = await this.confirm(`Delete habit “${habit.title}”?`, "Delete");
            if (!confirmed) {
                return;
            }
            const entryCount = this.countEntriesForHabit(habitId);
            await this.backend.deleteHabit({ habitId, deleteEntries: true });
            if (entryCount > 0) {
                this.showToast(`Deleted ${habit.title} and ${entryCount} entr${entryCount === 1 ? "y" : "ies"}.`);
            } else {
                this.showToast(`Deleted ${habit.title}.`);
            }
            await this.refresh({ reason: "habit-delete" });
        }

        async deleteGroupFlow(groupId) {
            const group = this.state.groups.find((g) => g.id === groupId);
            if (!group) {
                return;
            }
            const fallback = this.state.groups.find((g) => g.id !== groupId);
            if (!fallback) {
                this.api.showError?.("Cannot delete the only group.");
                return;
            }
            const confirmed = await this.confirm(`Delete group “${group.title}”?`, "Delete");
            if (!confirmed) {
                return;
            }
            await this.backend.deleteGroup({ groupId, fallbackGroupId: fallback.id });
            await this.refresh({ reason: "group-delete" });
        }

        async confirm(message, okTitle = "OK") {
            if (this.api.showConfirmDialog) {
                try {
                    const result = await this.api.showConfirmDialog({ message, okTitle });
                    return !!result;
                } catch {
                    try {
                        const fallback = await this.api.showConfirmDialog(message);
                        return !!fallback;
                    } catch {
                        if (hasWindow && typeof globalScope.confirm === "function") {
                            return globalScope.confirm(message);
                        }
                        return true;
                    }
                }
            }
            if (hasWindow && typeof globalScope.confirm === "function") {
                return globalScope.confirm(message);
            }
            return true;
        }

        renderHabitInfoCell(habit) {
            const $cell = $("<td>")
                .addClass("habit-dashboard__habit")
                .attr("data-habit-trigger", "primary")
                .attr("role", "button")
                .attr("tabindex", "0");
            const group = this.state.groups.find((g) => g.id === habit.groupId);
            const $name = $("<div>").addClass("habit-dashboard__habit-name");
            const $title = $("<strong>").text(habit.title);
            if (habit.icon) {
                const iconClasses = habit.icon.split(/\s+/).filter(Boolean);
                if (!iconClasses.some((cls) => cls.startsWith("bx"))) {
                    iconClasses.unshift("bx");
                }
                const $icon = $("<span>").addClass(iconClasses.join(" "));
                $title.prepend($icon);
            }
            const $meta = $("<div>").addClass("habit-dashboard__habit-meta");
            const $type = $("<span>").addClass("habit-dashboard__type-badge").text(habit.type);

            $meta.append($type);

            const groupName = group?.title || (habit.groupId === "_other" ? "Other" : null);
            if (groupName) {
                $meta.append($("<span>").text(`Group: ${groupName}`));
            }

            if (habit.meta?.target) {
                const unit = habit.meta.unit ? habit.meta.unit : "";
                $meta.append($("<span>").text(`Target: ${habit.meta.target}${unit ? ` ${unit}` : ""}`));
            }

            if (habit.meta?.reminderTime) {
                $meta.append($("<span>").text(`Reminder: ${habit.meta.reminderTime}`));
            }

            if (habit.meta?.streakTarget) {
                const windowDays = Number.isFinite(Number(habit.meta?.streakWindow)) && Number(habit.meta.streakWindow) > 0
                    ? Number(habit.meta.streakWindow)
                    : CONSTANTS.streakWindowDays;
                $meta.append($("<span>").text(`Streak goal: ${habit.meta.streakTarget}/${windowDays}`));
            }

            if (habit.meta?.description) {
                $meta.append($("<span>").text(habit.meta.description));
            }

            $name.append($title, $meta);
            $cell.append($name);
            return $cell;
        }

        createRatingGroup({ habit, min, max, currentValue, disabled = false, onSelect, context = "day" }) {
            const resolvedMin = Number.isFinite(Number(min)) ? Number(min) : 1;
            const resolvedMaxCandidate = Number.isFinite(Number(max)) ? Number(max) : resolvedMin;
            const resolvedMax = resolvedMaxCandidate >= resolvedMin ? resolvedMaxCandidate : resolvedMin;
            let value = Number.isFinite(Number(currentValue)) ? Number(currentValue) : null;
            let pending = false;

            const $group = $("<div class='habit-dashboard__rating-group' data-role='rating-group'>")
                .attr("role", "radiogroup")
                .attr("aria-label", `${habit.title} rating`)
                .attr("data-rating-min", resolvedMin)
                .attr("data-rating-max", resolvedMax);

            if (context === "modal") {
                $group.addClass("habit-dashboard__rating-group--modal");
            }

            const $starList = $("<div class='habit-dashboard__rating-star-list'>");
            const $valueLabel = $("<span class='habit-dashboard__rating-value' data-role='rating-display'>");
            const buttons = [];

            const updateVisual = () => {
                buttons.forEach(($btn) => {
                    const starValue = Number($btn.attr("data-rating-value"));
                    const isActive = value === starValue;
                    $btn.toggleClass("is-active", isActive);
                    $btn.attr("aria-checked", isActive ? "true" : "false");
                    const $icon = $btn.find(".habit-dashboard__rating-icon");
                    $icon.removeClass("bx-star bxs-star");
                    $icon.addClass(isActive ? "bxs-star" : "bx-star");
                });
                $valueLabel.text(Number.isFinite(value) ? `${value}/${resolvedMax}` : `–/${resolvedMax}`);
            };

            const updateDisabledState = () => {
                const effectiveDisabled = !!disabled || pending;
                if (effectiveDisabled) {
                    $group.attr("aria-disabled", "true");
                } else {
                    $group.removeAttr("aria-disabled");
                }
                buttons.forEach(($btn) => {
                    $btn.prop("disabled", effectiveDisabled);
                    if (effectiveDisabled) {
                        $btn.attr("aria-disabled", "true");
                    } else {
                        $btn.removeAttr("aria-disabled");
                    }
                });
            };

            const commitSelection = (nextValue) => {
                if (disabled || pending) {
                    return;
                }
                const numeric = Number(nextValue);
                if (!Number.isFinite(numeric)) {
                    return;
                }
                const previous = value;
                value = numeric;
                pending = true;
                updateVisual();
                updateDisabledState();
                const handleResult = (result) => {
                    if (result === false) {
                        value = previous;
                        updateVisual();
                    }
                    pending = false;
                    updateDisabledState();
                    return result;
                };

                const maybePromise = onSelect ? onSelect(numeric) : true;
                if (maybePromise && typeof maybePromise.then === "function") {
                    return maybePromise.then(handleResult).catch(() => handleResult(false));
                }
                return handleResult(maybePromise);
            };

            for (let rating = resolvedMin; rating <= resolvedMax; rating += 1) {
                const isActive = value === rating;
                const $icon = $("<span class='bx habit-dashboard__rating-icon'>")
                    .addClass(isActive ? "bxs-star" : "bx-star");
                const $button = $("<button type='button'>")
                    .addClass("habit-dashboard__rating-star")
                    .attr("data-rating-value", rating)
                    .attr("role", "radio")
                    .attr("aria-checked", isActive ? "true" : "false")
                    .attr("aria-label", `${rating} of ${resolvedMax}`)
                    .toggleClass("is-active", isActive)
                    .append($icon);
                if (context === "day") {
                    $button.attr("data-habit-id", habit.id);
                }
                $button.on("click", (event) => {
                    event.preventDefault();
                    commitSelection(rating);
                });
                $button.on("keydown", (event) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                        return;
                    }
                    event.preventDefault();
                    if (disabled || pending) {
                        return;
                    }
                    let target = rating;
                    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                        target = rating > resolvedMin ? rating - 1 : resolvedMax;
                    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                        target = rating < resolvedMax ? rating + 1 : resolvedMin;
                    } else if (event.key === "Home") {
                        target = resolvedMin;
                    } else if (event.key === "End") {
                        target = resolvedMax;
                    }
                    const $target = buttons[target - resolvedMin];
                    if ($target) {
                        $target.focus();
                        commitSelection(target);
                    }
                });
                buttons.push($button);
                $starList.append($button);
            }

            $group.append($starList, $valueLabel);
            updateVisual();
            updateDisabledState();

            return {
                $group,
                setValue: (nextValue) => {
                    if (nextValue === null || nextValue === undefined || nextValue === "") {
                        value = null;
                        updateVisual();
                        return;
                    }
                    const numeric = Number(nextValue);
                    value = Number.isFinite(numeric) ? numeric : null;
                    updateVisual();
                },
                getValue: () => value,
                setDisabled: (nextDisabled) => {
                    disabled = !!nextDisabled;
                    updateDisabledState();
                },
                focusValue: (targetValue) => {
                    if (targetValue === null || targetValue === undefined || targetValue === "") {
                        return;
                    }
                    const numeric = Number(targetValue);
                    if (!Number.isFinite(numeric)) {
                        return;
                    }
                    const index = numeric - resolvedMin;
                    if (index >= 0 && index < buttons.length) {
                        buttons[index].focus();
                    }
                }
            };
        }

        renderDayControlCell(habit, daySummary) {
            const $cell = $("<td>").addClass("habit-dashboard__control");
            const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
            const allowMultiple = hasSubEntryTemplates || !!habit.meta?.multiEntries;
            const primary = daySummary?.primary || null;
            const skipped = !!primary?.skipped;

            if (habit.type === "check") {
                const complete = !!primary?.value;
                const $button = $("<button>")
                    .attr("type", "button")
                    .attr("data-control", "check")
                    .attr("aria-pressed", complete ? "true" : "false")
                    .toggleClass("is-active", complete)
                    .text(complete ? "Completed" : "Mark done");

                if (skipped) {
                    $button.prop("disabled", true);
                }

                $cell.append($button);
                return $cell;
            }

            if (allowMultiple && habit.type !== "check") {
                const text = daySummary?.display || "No entry yet";
                $cell.append($("<span class='habit-dashboard__value-display'>").text(text));
                return $cell;
            }

            if (habit.type === "count") {
                const value = primary?.value ?? "";
                const $input = $("<input>")
                    .attr("type", "number")
                    .attr("data-control", "count")
                    .attr("min", "0")
                    .attr("step", "1")
                    .val(value);

                if (skipped) {
                    $input.prop("disabled", true);
                }

                $cell.append($input);
                return $cell;
            }

            if (habit.type === "value") {
                const value = primary?.value ?? "";
                const decimals = Number.isFinite(habit.meta?.decimals) ? Number(habit.meta.decimals) : 2;
                const step = decimals === 0 ? 1 : (1 / Math.pow(10, decimals));
                const $input = $("<input>")
                    .attr("type", "number")
                    .attr("data-control", "value")
                    .attr("step", step)
                    .val(value);

                if (skipped) {
                    $input.prop("disabled", true);
                }

                $cell.append($input);
                return $cell;
            }

            if (habit.type === "time") {
                const value = primary?.value ?? "";
                const display = typeof value === "number" ? this.minutesToHHMM(value) : value;
                const $input = $("<input>")
                    .attr("type", "text")
                    .attr("data-control", "time")
                    .attr("placeholder", "hh:mm or minutes")
                    .val(display || "");

                if (skipped) {
                    $input.prop("disabled", true);
                }

                $cell.append($input);
                return $cell;
            }

            if (habit.type === "rating") {
                const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                const maxCandidate = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                const max = maxCandidate >= min ? maxCandidate : min;
                const currentValue = Number.isFinite(Number(primary?.value)) ? Number(primary.value) : null;
                const ratingControl = this.createRatingGroup({
                    habit,
                    min,
                    max,
                    currentValue,
                    disabled: skipped,
                    context: "day",
                    onSelect: async (selected) => {
                        const result = await this.persistEntry(habit, {
                            value: selected,
                            skip: false,
                            source: "rating-inline",
                            date: this.state.dateISO,
                            entryKey: primary?.key || null
                        });
                        return result;
                    }
                });
                $cell.append(ratingControl.$group);
                return $cell;
            }

            const label = skipped ? "Skipped" : (primary?.value ?? "—");
            const $text = $("<span>").text(label);
            $cell.append($text);
            return $cell;
        }

        renderDayActionsCell(habit, daySummary) {
            const $cell = $("<td>").addClass("habit-dashboard__row-actions");
            const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
            const allowMultiple = hasSubEntryTemplates || !!habit.meta?.multiEntries;
            const entries = daySummary?.entries || [];
            const primary = daySummary?.primary || null;
            const skipped = !!primary?.skipped;

            if (hasSubEntryTemplates) {
                const entriesBySubId = new Map();
                entries.forEach((entry) => {
                    if (entry && entry.subEntryId) {
                        entriesBySubId.set(entry.subEntryId, entry);
                    }
                });

                const $summary = $("<div class='habit-dashboard__value-display'>").text(daySummary?.display || "No entry yet");
                const $list = $("<div class='habit-dashboard__subentry-list'>");

                habit.meta.subEntries.forEach((template) => {
                    const entry = entriesBySubId.get(template.id) || null;
                    const $row = $("<div class='habit-dashboard__subentry-row'>").attr("data-sub-entry-id", template.id);
                    const title = template.title || template.name || template.id;
                    $row.append($("<span class='habit-dashboard__subentry-title'>").text(title));

                    const valueLabel = entry
                        ? (entry.skipped ? "Skipped" : (entry.display || entry.value || "—"))
                        : "—";
                    const isSkipped = !!entry?.skipped;
                    $row.append($("<span class='habit-dashboard__subentry-value'>").text(valueLabel));

                    if (habit.type === "rating") {
                        const min = Number.isFinite(Number(habit.meta?.scaleMin)) ? Number(habit.meta.scaleMin) : 1;
                        const maxCandidate = Number.isFinite(Number(habit.meta?.scaleMax)) ? Number(habit.meta.scaleMax) : 5;
                        const max = maxCandidate >= min ? maxCandidate : min;
                        const currentValue = Number.isFinite(Number(entry?.value)) ? Number(entry.value) : null;
                        const ratingControl = this.createRatingGroup({
                            habit,
                            min,
                            max,
                            currentValue,
                            disabled: isSkipped,
                            context: "sub-entry",
                            onSelect: async (selected) => this.persistEntry(habit, {
                                value: selected,
                                skip: false,
                                source: "sub-entry-inline",
                                date: this.state.dateISO,
                                subEntryId: template.id,
                                entryKey: entry?.key || null
                            })
                        });
                        $row.append($("<span class='habit-dashboard__subentry-control'>").append(ratingControl.$group));
                    }

                    const $actions = $("<span class='habit-dashboard__subentry-actions'>");
                    const $skipToggle = $("<button type='button' class='habit-dashboard__subentry-skip'>")
                        .text(isSkipped ? "Unskip" : "Skip")
                        .on("click", async () => {
                            await this.persistEntry(habit, {
                                subEntryId: template.id,
                                value: entry?.value ?? null,
                                skip: !isSkipped,
                                source: "sub-entry-skip",
                                entryKey: entry?.key || null
                            });
                        });
                    $actions.append($skipToggle);

                    const $edit = $("<button type='button' class='habit-dashboard__subentry-edit'>")
                        .text("Edit")
                        .on("click", () => this.openEntryEditor(habit, this.state.dateISO, entry || null, {
                            entryKey: entry?.key || null,
                            focusSubEntryId: template.id
                        }));
                    $actions.append($edit);

                    $row.append($actions);
                    $list.append($row);
                });

                $cell.append($summary, $list);
                return $cell;
            }

            if (!allowMultiple) {
                const $skipButton = $("<button>")
                    .attr("type", "button")
                    .attr("data-action", "toggle-skip")
                    .text(skipped ? "Unskip" : "Skip");

                const $valueDisplay = $("<span>")
                    .addClass("habit-dashboard__value-display")
                    .text(daySummary?.display || "No entry yet");

                if (skipped) {
                    $valueDisplay.text("Skipped");
                }

                $cell.append($skipButton, $valueDisplay);
            } else {
                const $summary = $("<div class='habit-dashboard__value-display'>").text(daySummary?.display || "No entry yet");
                const $list = $("<div class='habit-dashboard__multi-list'>");

                entries.forEach((entry) => {
                    const $row = $("<div class='habit-dashboard__multi-item'>");
                    if (entry.key && entry.key === daySummary?.primary?.key) {
                        $row.addClass("is-active");
                    }
                    const label = entry.recordedAt
                        ? this.api.dayjs(entry.recordedAt).format("HH:mm")
                        : "Entry";
                    const valueText = this.formatEntryDisplay(habit, entry);
                    $row.append($("<span class='habit-dashboard__multi-label'>").text(`${label}: ${valueText}`));

                    const $edit = $("<button type='button' class='habit-dashboard__multi-action'>")
                        .attr("data-action", "edit-entry")
                        .attr("data-entry-key", entry.key || "")
                        .attr("data-entry-date", entry.date)
                        .attr("title", "Edit entry")
                        .html("<span class='bx bx-edit'></span>");

                    const $delete = $("<button type='button' class='habit-dashboard__multi-action'>")
                        .attr("data-action", "delete-entry")
                        .attr("data-entry-key", entry.key || "")
                        .attr("data-entry-date", entry.date)
                        .attr("title", "Delete entry")
                        .html("<span class='bx bx-trash'></span>");

                    if (entry.entryId) {
                        const entryId = String(entry.entryId);
                        $edit.attr("data-entry-id", entryId);
                        $delete.attr("data-entry-id", entryId);
                    }
                    if (entry.recordedAt) {
                        const recordedAt = String(entry.recordedAt);
                        $edit.attr("data-entry-recorded-at", recordedAt);
                        $delete.attr("data-entry-recorded-at", recordedAt);
                    }

                    $row.append($edit, $delete);
                    $list.append($row);
                });

                const $add = $("<button type='button' class='habit-dashboard__multi-add'>Log entry</button>")
                    .attr("data-action", "add-entry")
                    .attr("data-entry-date", this.state.dateISO);

                $cell.append($summary, $list, $add);
            }

            const $moveUp = $("<button>")
                .attr("type", "button")
                .attr("data-action", "move-habit-up")
                .attr("title", "Move up")
                .attr("aria-label", "Move habit up")
                .html("<span class='bx bx-chevron-up'></span>");

            const $moveDown = $("<button>")
                .attr("type", "button")
                .attr("data-action", "move-habit-down")
                .attr("title", "Move down")
                .attr("aria-label", "Move habit down")
                .html("<span class='bx bx-chevron-down'></span>");

            const $editButton = $("<button>")
                .attr("type", "button")
                .attr("data-action", "edit-habit")
                .attr("title", "Edit habit")
                .html("<span class='bx bx-edit'></span>");

            const $deleteButton = $("<button>")
                .attr("type", "button")
                .attr("data-action", "delete-habit")
                .attr("title", "Delete habit")
                .html("<span class='bx bx-trash'></span>");

            $cell.append($moveUp, $moveDown, $editButton, $deleteButton);
            return $cell;
        }

        formatEntryDisplay(habit, entry) {
            if (entry.skipped) {
                return "Skipped";
            }
            if (entry.display) {
                return entry.display;
            }

            switch (habit.type) {
                case "check":
                    return entry.value ? "Completed" : "Not done";
                case "count":
                case "value": {
                    const unit = habit.meta?.unit ? ` ${habit.meta.unit}` : "";
                    return `${entry.value ?? "—"}${unit}`;
                }
                case "time":
                    return typeof entry.value === "number" ? this.formatMinutesLabel(entry.value) : entry.value || "—";
                case "rating": {
                    const max = habit.meta?.scaleMax || 5;
                    return `${entry.value ?? "—"}/${max}`;
                }
                default:
                    return entry.value ?? "—";
            }
        }

        summarizeEntriesForDay(habit, entries) {
            const list = Array.isArray(entries) ? entries.filter(Boolean) : entries ? [entries] : [];
            const sorted = list
                .slice()
                .sort((a, b) => (a?.recordedAt || "").localeCompare(b?.recordedAt || ""));
            if (!sorted.length) {
                return {
                    entries: [],
                    primary: null,
                    display: "No entry yet",
                    skippedCount: 0,
                    completedCount: 0,
                    average: null
                };
            }

            const primary = sorted[sorted.length - 1];
            const skippedCount = sorted.filter((entry) => entry.skipped).length;
            const active = sorted.filter((entry) => !entry.skipped);
            let display = this.formatEntryDisplay(habit, primary);
            let average = null;

            if (habit.type === "rating" && active.length) {
                const sum = active.reduce((acc, entry) => acc + Number(entry.value || 0), 0);
                average = sum / active.length;
                display = `Avg ${average.toFixed(1)} (${active.length})`;
            } else if (["count", "value", "time"].includes(habit.type) && active.length > 1) {
                const total = active.reduce((acc, entry) => acc + Number(entry.value || 0), 0);
                average = total / active.length;
                if (habit.type === "time") {
                    display = `${this.formatMinutesLabel(total)} · avg ${this.formatMinutesLabel(average)} (${active.length})`;
                } else {
                    const unit = habit.meta?.unit ? ` ${habit.meta.unit}` : "";
                    display = `${total}${unit} today (${active.length})`;
                }
            } else if (habit.type === "check") {
                const completed = active.filter((entry) => entry.value).length;
                display = completed ? `${completed}/${sorted.length} done` : "Not done";
            }

            return {
                entries: sorted,
                primary,
                display,
                skippedCount,
                completedCount: active.filter((entry) => !!entry.value).length,
                average
            };
        }

        minutesToHHMM(value) {
            if (!Number.isFinite(value)) {
                return "";
            }
            const minutes = Math.max(0, Math.round(value));
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }

        formatMinutesLabel(value) {
            if (!Number.isFinite(value)) {
                return "0m";
            }
            const minutes = Math.max(0, Math.round(value));
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours && mins) {
                return `${hours}h ${mins}m`;
            }
            if (hours) {
                return `${hours}h`;
            }
            return `${mins}m`;
        }

        async persistEntry(habit, options) {
            const targetDate = options.date || this.state.dateISO;
            const hasSubEntryTemplates = Array.isArray(habit.meta?.subEntries) && habit.meta.subEntries.length > 0;
            const allowMultiple = hasSubEntryTemplates || !!habit.meta?.multiEntries;
            const payload = {
                habitId: habit.id,
                habitTitle: habit.title,
                date: targetDate,
                value: options.value,
                skip: !!options.skip,
                source: options.source,
                entryKey: options.entryKey || null,
                subEntryId: options.subEntryId ?? null
            };

            this.setRowState(habit.id, "dirty", true);
            this.updateStatus("Saving…");
            this.logger.info("entry.save.start", { habitId: habit.id, source: options.source });

            try {
                const result = await this.backend.saveEntry(payload);
                this.state.habits = this.state.habits.map((h) => (h.id === result.habit.id ? result.habit : h));
                this.state.rangeEntries[result.habit.id] = this.state.rangeEntries[result.habit.id] || {};
                if (!allowMultiple) {
                    this.state.rangeEntries[result.habit.id][payload.date] = [result.entry];
                } else {
                    const dateEntries = this.state.rangeEntries[result.habit.id][payload.date];
                    if (Array.isArray(dateEntries)) {
                        const existingIndex = dateEntries.findIndex((item) => item.key === result.entry.key);
                        if (existingIndex >= 0) {
                            dateEntries[existingIndex] = result.entry;
                        } else {
                            dateEntries.push(result.entry);
                            dateEntries.sort((a, b) => {
                                const aTime = a.recordedAt || `${payload.date}T00:00:00Z`;
                                const bTime = b.recordedAt || `${payload.date}T00:00:00Z`;
                                return aTime.localeCompare(bTime);
                            });
                        }
                    } else if (dateEntries) {
                        const list = [dateEntries, result.entry];
                        list.sort((a, b) => {
                            const aTime = a.recordedAt || `${payload.date}T00:00:00Z`;
                            const bTime = b.recordedAt || `${payload.date}T00:00:00Z`;
                            return aTime.localeCompare(bTime);
                        });
                        this.state.rangeEntries[result.habit.id][payload.date] = list;
                    } else {
                        this.state.rangeEntries[result.habit.id][payload.date] = [result.entry];
                    }
                }
                const celebration = this.buildCelebrationPayload(result.habit, result.entry);
                if (payload.date === this.state.dateISO && this.state.view === "day") {
                    if (!allowMultiple) {
                        this.state.entries.set(result.habit.id, [result.entry]);
                    } else {
                        const existingDayEntries = this.state.entries.get(result.habit.id);
                        if (Array.isArray(existingDayEntries)) {
                            const idx = existingDayEntries.findIndex((item) => item.key === result.entry.key);
                            if (idx >= 0) {
                                existingDayEntries[idx] = result.entry;
                            } else {
                                existingDayEntries.push(result.entry);
                                existingDayEntries.sort((a, b) => {
                                    const aTime = a.recordedAt || `${payload.date}T00:00:00Z`;
                                    const bTime = b.recordedAt || `${payload.date}T00:00:00Z`;
                                    return aTime.localeCompare(bTime);
                                });
                            }
                        } else if (existingDayEntries) {
                            const list = [existingDayEntries, result.entry];
                            list.sort((a, b) => {
                                const aTime = a.recordedAt || `${payload.date}T00:00:00Z`;
                                const bTime = b.recordedAt || `${payload.date}T00:00:00Z`;
                                return aTime.localeCompare(bTime);
                            });
                            this.state.entries.set(result.habit.id, list);
                        } else {
                            this.state.entries.set(result.habit.id, [result.entry]);
                        }
                    }
                    this.renderHabitRowUpdate(result.habit, this.state.entries.get(result.habit.id));
                    if (celebration) {
                        this.triggerCelebration(result.habit.id, celebration);
                    } else {
                        this.flashHabitVisual(result.habit.id);
                    }
                } else if (this.state.view !== "day") {
                    if (celebration) {
                        this.pendingCelebration = { habitId: result.habit.id, payload: celebration };
                    }
                    await this.refresh({ reason: "entry-save", silent: true });
                }
                if (this.state.view !== "day" && !celebration) {
                    this.flashHabitVisual(result.habit.id);
                }
                if (this.pendingCelebration && (!this.state.loading)) {
                    const { habitId, payload: pending } = this.pendingCelebration;
                    this.pendingCelebration = null;
                    this.triggerCelebration(habitId, pending);
                }
                this.setRowState(habit.id, "dirty", false);
                this.updateStatus("Saved");
                this.logger.info("entry.save.success", { habitId: habit.id, source: options.source });
                return true;
            } catch (error) {
                this.setRowState(habit.id, "dirty", false);
                this.updateStatus("Save failed");
                this.logger.error("entry.save.failed", { habitId: habit.id, error: error.message });
                this.api.showError?.(`Failed to save entry: ${error.message}`);
                return false;
            }
        }

        async deleteEntryKeys(keys) {
            const list = Array.isArray(keys) ? keys.filter((key) => typeof key === "string" && key.length) : (keys ? [keys] : []);
            if (!list.length) {
                this.logger.info("entry.delete.skip-empty", { keys });
                return { deleted: 0 };
            }

            this.logger.info("entry.delete.start", {
                keyCount: list.length,
                keys: list.slice(0, 3)
            });

            try {
                const result = await this.backend.deleteEntries(list);

                this.logger.info("entry.delete.success", {
                    keyCount: list.length,
                    deleted: result?.deleted ?? 0,
                    hadErrors: !!result?.errors
                });

                if (result?.errors && result.errors.length > 0) {
                    this.logger.warn("entry.delete.partial-errors", {
                        errorCount: result.errors.length,
                        errors: result.errors.slice(0, 3)
                    });
                }

                return result;
            } catch (error) {
                this.logger.error("entry.delete.failed", {
                    keyCount: list.length,
                    keys: list,
                    message: error?.message || String(error),
                    stack: error?.stack || null
                });
                throw error;
            }
        }

        renderHabitRowUpdate(habit, entries) {
            if (this.state.view !== "day") {
                return;
            }
            const $existing = this.dom.tbody.find(`[data-habit-id='${habit.id}']`);
            if (!$existing.length) {
                const { $row } = this.renderHabitRow(habit, entries);
                this.dom.tbody.append($row);
                return;
            }

            const { $row } = this.renderHabitRow(habit, entries);
            $existing.replaceWith($row);
        }

        setRowState(habitId, state, enabled) {
            if (this.state.view !== "day") {
                return;
            }
            const $row = this.dom.tbody.find(`[data-habit-id='${habitId}']`);
            if (!$row.length) {
                return;
            }
            const className = state === "dirty" ? "habit-dashboard__row--dirty" : null;
            if (!className) {
                return;
            }
            $row.toggleClass(className, !!enabled);
        }

        normalizeDateForView(view, dateISO) {
            const base = this.api.dayjs(dateISO);
            if (!base.isValid()) {
                return this.api.dayjs().format("YYYY-MM-DD");
            }
            if (view === "last7" || view === "last14") {
                return base.startOf("day").format("YYYY-MM-DD");
            }
            if (view === "week" || view === "twoWeeks") {
                const weekday = base.day();
                const diff = (weekday + 6) % 7;
                return base.subtract(diff, "day").startOf("day").format("YYYY-MM-DD");
            }
            if (view === "month") {
                return base.startOf("month").format("YYYY-MM-DD");
            }
            return base.startOf("day").format("YYYY-MM-DD");
        }

        normalizeDateForCurrentView(dateISO) {
            return this.normalizeDateForView(this.state.view, dateISO);
        }

        async refresh({ reason = "auto", silent = false } = {}) {
            if (this.suspended) {
                this.logger.info("refresh.skipped.suspended", { reason });
                return;
            }
            const rootId = this.backend.getResolvedRootNoteId();
            if (!rootId) {
                this.logger.warn("refresh.no-root", { reason });
                return;
            }
            if (this.state.loading) {
                return;
            }
            this.state.loading = true;
            if (!silent) {
                this.updateStatus("Refreshing…");
            }
            try {
                let snapshot;
                if (this.state.view === "day") {
                    snapshot = await this.backend.snapshot(this.state.dateISO);
                } else {
                    snapshot = await this.backend.rangeSnapshot(this.state.view, this.state.dateISO);
                }
                this.applySnapshot(snapshot);
                this.logger.info("refresh.success", { reason, habitCount: this.state.habits.length });
            } catch (error) {
                this.logger.error("refresh.failed", { reason, error: error.message });
                if (!silent) {
                    this.api.showError?.(`Failed to refresh habit dashboard: ${error.message}`);
                }
            } finally {
                this.state.loading = false;
            }
        }

        updateStatus(text) {
            const habitCount = this.state.habits.length;
            let rangeLabel = this.state.dateISO;
            if (this.state.view !== "day") {
                rangeLabel = `${this.state.dates[0]} → ${this.state.dates[this.state.dates.length - 1]}`;
            }
            const suffix = `· ${habitCount} habit${habitCount === 1 ? "" : "s"} · ${rangeLabel}`;
            const encouragement = this.buildStatusEncouragement();
            const message = encouragement ? `${text} ${suffix} · ${encouragement}` : `${text} ${suffix}`;
            this.dom.status.text(message);
        }

        buildStatusEncouragement() {
            if (!this.state.habits.length) {
                return "";
            }
            if (this.state.view === "day") {
                const total = this.state.habits.length;
                let completed = 0;
                this.state.habits.forEach((habit) => {
                    const entries = this.state.entries.get(habit.id);
                    const summary = this.summarizeEntriesForDay(habit, entries);
                    if (habit.type === "check") {
                        if (summary.completedCount > 0) {
                            completed += 1;
                        }
                    } else if (summary.entries.some((item) => !item.skipped && item.value !== null && item.value !== undefined)) {
                        completed += 1;
                    }
                });
                if (!completed) {
                    return "Claim your first win";
                }
                if (completed === total) {
                    return "All habits crushed!";
                }
                return `${completed}/${total} locked in`;
            }

            const summaries = Object.values(this.state.summary || {});
            if (!summaries.length) {
                return "";
            }
            const totalTargets = summaries.reduce((acc, summary) => acc + (summary.targetsMet || 0), 0);
            const totalActiveDays = summaries.reduce((acc, summary) => acc + Math.max(0, (summary.days || 0) - (summary.skipped || 0)), 0);
            if (!totalActiveDays) {
                return "Set your streaks in motion";
            }
            const ratio = totalTargets / totalActiveDays;
            if (ratio >= 0.95) {
                return "Legendary streaks!";
            }
            if (ratio >= 0.75) {
                return "Momentum is on your side";
            }
            if (ratio >= 0.5) {
                return "Keep stacking those wins";
            }
            return "You’re building the habit – stay with it";
        }

        updateSubentryToggleButton() {
            const $button = this.dom?.subentryToggle;
            if (!$button || !$button.length) {
                return;
            }
            const expanded = this.ui?.expandAllSubEntries !== false;
            const icon = expanded ? "bx-collapse" : "bx-expand";
            const label = expanded ? "Collapse Sub-entries" : "Expand Sub-entries";
            $button.attr("aria-pressed", expanded ? "true" : "false");
            const $icon = $button.find("[data-role='menu-item-icon']").first();
            if ($icon.length) {
                $icon.attr("class", `bx ${icon}`);
            }
            const $label = $button.find("[data-role='menu-item-label']").first();
            if ($label.length) {
                $label.text(label);
            } else {
                $button.html(`<span class="bx ${icon}"></span> ${label}`);
            }
        }

        updateRangeAlignmentButton() {
            const $button = this.dom?.rangeAlignButton;
            if (!$button || !$button.length) {
                return;
            }
            const isRangeView = this.state.view !== "day";
            const aligned = !!this.state.alignRangeByDay && isRangeView;
            const icon = aligned ? "bx bx-layer" : "bx bx-grid-alt";
            const label = aligned ? "Float Day Chips" : "Align Day Columns";
            $button
                .attr("aria-pressed", aligned ? "true" : "false")
                .attr("aria-disabled", isRangeView ? "false" : "true")
                .attr("title", label)
                .attr("aria-label", label)
                .prop("disabled", !isRangeView)
                .toggleClass("is-disabled", !isRangeView);
            const $icon = $button.find("[data-role='menu-item-icon']").first();
            if ($icon.length) {
                $icon.attr("class", icon);
            }
            const $label = $button.find("[data-role='menu-item-label']").first();
            if ($label.length) {
                $label.text(label);
            } else {
                $button.html(`<span class="${icon}"></span> ${label}`);
            }
        }

        async toggleAllSubEntries(force = null) {
            const current = this.ui?.expandAllSubEntries !== false;
            const next = typeof force === "boolean" ? force : !current;
            if (!this.ui) {
                this.ui = {
                    rangeSubentryExpansion: new Map(),
                    expandAllSubEntries: next
                };
            } else {
                this.ui.expandAllSubEntries = next;
                if (!this.ui.rangeSubentryExpansion) {
                    this.ui.rangeSubentryExpansion = new Map();
                }
            }
            if (this.ui.rangeSubentryExpansion?.clear) {
                this.ui.rangeSubentryExpansion.clear();
                this.state.habits.forEach((habit) => {
                    this.ui.rangeSubentryExpansion.set(habit.id, next);
                });
            }
            this.updateSubentryToggleButton();
            this.renderHabits();
            try {
                await this.backend.setSubentryExpansion(next);
            } catch (error) {
                this.logger.warn("subentry.toggle.persist-failed", { message: error?.message || error });
            }
        }

        async toggleRangeAlignment(force = null) {
            if (this.state.view === "day" && typeof force !== "boolean") {
                this.updateRangeAlignmentButton();
                return;
            }
            const current = !!this.state.alignRangeByDay;
            const next = typeof force === "boolean" ? force : !current;
            this.state.alignRangeByDay = next;
            this.render();
            try {
                await this.backend.setRangeAlignment(next ? "grid" : "float");
            } catch (error) {
                this.logger.warn("range-align.persist-failed", { message: error?.message || error });
            }
        }

        async toggleCompact() {
            const current = normalizeCompactLevelClient(this.state.compactLevel);
            const next = current >= MAX_COMPACT_LEVEL ? 0 : current + 1;
            this.state.compactLevel = next;
            this.updateCompactLevelUI();
            const levelMeta = COMPACT_LEVELS[next] || COMPACT_LEVELS[0];
            try {
                await this.backend.setCompactMode(next);
            } catch (error) {
                this.logger.warn("compact.toggle.persist-failed", { message: error?.message || error, level: next });
            }
            if (levelMeta?.label) {
                this.showToast(`Layout density: ${levelMeta.label}`, 1600);
            }
            this.logger.info("compact.toggle", { level: next, key: levelMeta?.key || null });
        }

        async setDate(dateISO) {
            if (!dateISO || typeof dateISO !== "string") {
                this.logger.warn("set-date.invalid-input", { dateISO });
                return;
            }
            const parsed = this.api.dayjs(dateISO);
            if (!parsed.isValid()) {
                this.logger.warn("set-date.invalid-format", { dateISO });
                this.api.showError?.("Invalid date format. Please use YYYY-MM-DD.");
                if (this.dom.dateInput?.length) {
                    this.dom.dateInput.val(this.state.dateISO);
                }
                return;
            }

            const normalized = this.normalizeDateForCurrentView(parsed.format("YYYY-MM-DD"));
            if (normalized === this.state.dateISO) {
                return;
            }
            this.state.dateISO = normalized;
            if (this.dom.dateInput?.length) {
                this.dom.dateInput.val(normalized);
            }
            await this.refresh({ reason: "date-change" });
        }

        async goToCurrentWeek() {
            const today = this.api.dayjs().format("YYYY-MM-DD");
            await this.setView("week", { anchorDate: today, reason: "jump-week" });
        }

        async shiftDate(deltaDays) {
            const base = this.normalizeDateForCurrentView(this.state.dateISO);
            let nextMoment = this.api.dayjs(base);
            if (this.state.view === "month") {
                nextMoment = nextMoment.add(deltaDays, "month").startOf("month");
            } else if (this.state.view === "twoWeeks") {
                nextMoment = nextMoment.add(deltaDays * 14, "day");
                const weekday = nextMoment.day();
                const diff = (weekday + 6) % 7;
                nextMoment = nextMoment.subtract(diff, "day").startOf("day");
            } else if (this.state.view === "week") {
                nextMoment = nextMoment.add(deltaDays * 7, "day");
                const weekday = nextMoment.day();
                const diff = (weekday + 6) % 7;
                nextMoment = nextMoment.subtract(diff, "day").startOf("day");
            } else if (this.state.view === "last14") {
                nextMoment = nextMoment.add(deltaDays * 14, "day").startOf("day");
            } else if (this.state.view === "last7") {
                nextMoment = nextMoment.add(deltaDays * 7, "day").startOf("day");
            } else {
                nextMoment = nextMoment.add(deltaDays, "day");
            }
            const next = nextMoment.format("YYYY-MM-DD");
            await this.setDate(next);
        }

        async setView(view, options = {}) {
            if (!CONSTANTS.views.includes(view)) {
                return;
            }
            const anchorDate = options.anchorDate;
            const reason = options.reason || (view === this.state.view ? "view-refresh" : "view-change");
            const changingView = view !== this.state.view;
            if (!changingView && !anchorDate) {
                return;
            }

            this.state.view = view;
            if (anchorDate) {
                this.state.dateISO = this.normalizeDateForView(view, anchorDate);
            } else {
                this.state.dateISO = this.normalizeDateForView(view, this.state.dateISO);
            }

            if (this.dom.viewSelect?.length) {
                this.dom.viewSelect.val(view);
            }
            if (this.dom.dateInput?.length) {
                this.dom.dateInput.val(this.state.dateISO);
            }
            await this.refresh({ reason, silent: options.silent ?? false });
        }
    }

    async function bootstrap() {
        if (!hasWindow) {
            return;
        }
        if (typeof api === "undefined") {
            console.error("Habit dashboard: missing api context");
            return;
        }

        if (!api.$container || !api.$container.length) {
            if (bootstrapRetryCount >= BOOTSTRAP_MAX_RETRIES) {
                console.error("Habit dashboard: container not available after retries");
                try {
                    api?.log?.(`[${LOG_PREFIX}] container.retry-exhausted`);
                } catch (error) {
                    // ignore logging failure when container is absent
                }
                return;
            }
            bootstrapRetryCount += 1;
            runtimeTimers.setTimeout(() => {
                runBootstrapWithCatch();
            }, BOOTSTRAP_RETRY_DELAY_MS);
            return;
        }

        bootstrapRetryCount = 0;

        const $root = ensureRootStructure(api);
        const globalStore = globalScope[GLOBAL_KEY] = globalScope[GLOBAL_KEY] || {};
        let noteId = api.startNote?.noteId || api.currentNote?.noteId || api.note?.noteId || "root";
        try {
            const context = api.getActiveContextNote?.();
            if (context?.noteId) {
                noteId = context.noteId;
            }
        } catch (error) {
            // falls back to start note
        }

        if (globalStore[noteId]) {
            await globalStore[noteId].adopt(api, $root);
            return;
        }

        const app = new HabitDashboardApp(api, $root);
        globalStore[noteId] = app;
        await app.init();
    }

    function runBootstrapWithCatch() {
        bootstrap().catch((error) => {
            console.error("Habit dashboard bootstrap failed", error);
            try {
                api?.log?.(`[habit-dashboard/v${CONSTANTS.version}] bootstrap failed: ${error.message}`);
            } catch (e) {
                // ignore
            }
        });
    }

    if (hasWindow) {
        runBootstrapWithCatch();
    }
} catch (error) {
    try {
        apiRef?.log?.(`[${LOG_PREFIX}] evaluation.failed ${error?.stack || error?.message || error}`);
    } catch (loggingError) {
        // ignore logging failure during evaluation catch
    }
    throw error;
}
})();
