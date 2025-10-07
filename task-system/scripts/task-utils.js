'use strict';

const STATUS_ORDER = ['backlog', 'todo', 'in-progress', 'blocked', 'done', 'archived'];
const DEFAULT_PRIORITY = 2;
const DEFAULT_DASHBOARD_DEPTH = 10;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PRIORITY_LABELS = {
    1: 'Low',
    2: 'Normal',
    3: 'High',
    4: 'Urgent',
    5: 'Critical'
};

function parseIsoDateParts(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
        return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (![year, month, day].every((part) => Number.isFinite(part))) {
        return null;
    }
    return { year, month, day };
}

function localDateFromIso(value) {
    const parts = parseIsoDateParts(value);
    if (!parts) {
        return null;
    }
    const date = new Date(parts.year, parts.month - 1, parts.day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) {
        return null;
    }
    return date;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function readLabel(note, name, fallback = null) {
    const value = note.getAttributeValue('label', name);
    return value !== null && value !== undefined && value !== '' ? value : fallback;
}

function readNumberLabel(note, name, fallback = 0) {
    const raw = readLabel(note, name, null);
    if (raw === null) {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanLabel(note, name, fallback = false) {
    const raw = readLabel(note, name, null);
    if (raw === null) {
        return fallback;
    }
    return raw === 'true' || raw === '1';
}

function readDateLabel(note, name) {
    const raw = readLabel(note, name, null);
    if (!raw) {
        return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getTagValues(note) {
    return note.getOwnedLabelValues('taskTag');
}

function getRoleValues(note) {
    return note.getOwnedLabelValues('taskRole');
}

function normalizeTask(note, notePath, options = {}) {
    const status = readLabel(note, 'taskStatus', 'backlog');
    const dueDate = readDateLabel(note, 'taskDueDate');
    const priority = readNumberLabel(note, 'taskPriority', DEFAULT_PRIORITY);
    const tags = getTagValues(note);
    const roles = getRoleValues(note);
    const path = Array.isArray(notePath) ? notePath : [];
    const order = readNumberLabel(note, 'taskOrder', 0);
    const isPinned = readBooleanLabel(note, 'taskPinned', false);
    const includeContent = options.includeContent ?? false;
    const statusHistoryRaw = readLabel(note, 'taskStatusLog', null);
    let statusHistory = [];
    if (statusHistoryRaw) {
        try {
            const parsed = JSON.parse(statusHistoryRaw);
            if (Array.isArray(parsed)) {
                statusHistory = parsed;
            }
        } catch (error) {
            statusHistory = [];
        }
    }

    let content = null;
    if (includeContent) {
        const rawContent = note.getContent();
        content = rawContent ? rawContent.toString() : '';
    }

    return {
        noteId: note.noteId,
        title: note.title,
        status,
        dueDate,
        priority,
        priorityLabel: PRIORITY_LABELS[priority] || PRIORITY_LABELS[DEFAULT_PRIORITY],
        tags,
        roles,
        order,
        isPinned,
        path,
        parentNoteIds: note.getParentNotes().map((parent) => parent.noteId),
        createdAt: note.utcDateCreated,
        updatedAt: note.utcDateModified || note.utcDateCreated,
        isCompleted: status === 'done' || status === 'archived',
        isArchived: note.isArchived,
        hasChildren: note.hasChildren(),
        content,
        statusChangedAt: readLabel(note, 'taskStatusChangedAt', null),
        statusHistory
    };
}

function matchesFilters(task, filters = {}) {
    if (!filters) {
        return true;
    }

    const {
        search,
        status,
        tags,
        includeDescendants = true,
        showCompleted = true,
        roles,
        hideBacklog,
        hideArchived,
        dueRange,
        statusChangedWithin,
        pinnedOnly
    } = filters;

    if (!showCompleted && task.isCompleted) {
        return false;
    }

    const shouldHideBacklog = hideBacklog === true;
    if (shouldHideBacklog && task.status === 'backlog') {
        return false;
    }

    const shouldHideArchived = hideArchived === true;
    if (shouldHideArchived && task.status === 'archived') {
        return false;
    }

    if (Array.isArray(status) && status.length > 0 && !status.includes(task.status)) {
        return false;
    }

    if (Array.isArray(tags) && tags.length > 0) {
        const hasAll = tags.every((tag) => task.tags.includes(tag));
        if (!hasAll) {
            return false;
        }
    }

    if (Array.isArray(roles) && roles.length > 0) {
        const hasRole = roles.some((role) => task.roles.includes(role));
        if (!hasRole) {
            return false;
        }
    }

    if (pinnedOnly === true && !task.isPinned) {
        return false;
    }

    if (dueRange && dueRange !== 'all') {
        const now = new Date();
        const today = startOfDay(now);
        const endOfToday = new Date(today.getTime() + DAY_IN_MS);
        const endOfWeek = new Date(today.getTime() + 7 * DAY_IN_MS);
        const futureThreshold = endOfWeek;

        if (!task.dueDate) {
            if (dueRange !== 'none') {
                return false;
            }
        } else {
            const due = localDateFromIso(task.dueDate);
            if (!due) {
                return false;
            }
            if (dueRange === 'overdue' && !(due < today)) {
                return false;
            }
            if (dueRange === 'today' && !(due >= today && due < endOfToday)) {
                return false;
            }
            if (dueRange === 'week' && !(due >= today && due < endOfWeek)) {
                return false;
            }
            if (dueRange === 'past' && !(due < today)) {
                return false;
            }
            if (dueRange === 'future' && !(due >= futureThreshold)) {
                return false;
            }
            if (dueRange === 'none') {
                return false;
            }
        }
        if (dueRange === 'none' && task.dueDate) {
            return false;
        }
    }

    if (statusChangedWithin) {
        const windowDays = Number.parseInt(statusChangedWithin, 10);
        if (Number.isFinite(windowDays) && windowDays > 0) {
            const changedAt = task.statusChangedAt ? new Date(task.statusChangedAt) : null;
            if (!changedAt || Number.isNaN(changedAt.getTime())) {
                return false;
            }
            const now = Date.now();
            const diffDays = (now - changedAt.getTime()) / (24 * 60 * 60 * 1000);
            if (diffDays > windowDays) {
                return false;
            }
        }
    }

    if (!includeDescendants && task.path.length > 1) {
        return false;
    }

    if (search) {
        const lowered = search.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(lowered);
        const inTags = task.tags.some((tag) => tag.toLowerCase().includes(lowered));
        const inContent = task.content ? task.content.toLowerCase().includes(lowered) : false;
        const inPath = task.path.some((segment) => segment.title.toLowerCase().includes(lowered));

        if (!inTitle && !inTags && !inContent && !inPath) {
            return false;
        }
    }

    return true;
}

function deriveTagSet(tasks) {
    const tags = new Set();
    for (const task of tasks) {
        for (const tag of task.tags) {
            tags.add(tag);
        }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function deriveRoleSet(tasks) {
    const roles = new Set();
    for (const task of tasks) {
        for (const role of task.roles) {
            roles.add(role);
        }
    }
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
}

function sortTasks(tasks) {
    return tasks
        .slice()
        .sort((a, b) => {
            if (a.isPinned && !b.isPinned) {
                return -1;
            }
            if (!a.isPinned && b.isPinned) {
                return 1;
            }

            const statusOrderA = STATUS_ORDER.indexOf(a.status);
            const statusOrderB = STATUS_ORDER.indexOf(b.status);

            if (statusOrderA !== statusOrderB) {
                return statusOrderA - statusOrderB;
            }

            if (a.priority !== b.priority) {
                return b.priority - a.priority; // higher priority first
            }

            if (a.dueDate && b.dueDate) {
                return a.dueDate.localeCompare(b.dueDate);
            }

            if (a.dueDate) {
                return -1;
            }

            if (b.dueDate) {
                return 1;
            }

            return a.title.localeCompare(b.title);
        });
}

function computeInsights(tasks) {
    const counts = {
        total: tasks.length,
        overdue: 0,
        dueSoon: 0,
        completed: 0,
        byStatus: {},
        byTag: {},
        byRole: {}
    };

    const now = new Date();
    const today = startOfDay(now);
    const soon = new Date(today.getTime() + 7 * DAY_IN_MS);

    for (const status of STATUS_ORDER) {
        counts.byStatus[status] = 0;
    }

    for (const task of tasks) {
        counts.byStatus[task.status] = (counts.byStatus[task.status] || 0) + 1;

        if (task.isCompleted) {
            counts.completed += 1;
        }

        if (task.dueDate && !task.isCompleted) {
            const due = localDateFromIso(task.dueDate);
            if (due) {
                if (due < today) {
                    counts.overdue += 1;
                } else if (due < soon) {
                    counts.dueSoon += 1;
                }
            }
        }

        for (const tag of task.tags) {
            counts.byTag[tag] = (counts.byTag[tag] || 0) + 1;
        }

        for (const role of task.roles) {
            counts.byRole[role] = (counts.byRole[role] || 0) + 1;
        }
    }

    const completionRatio = counts.total > 0 ? counts.completed / counts.total : 0;

    return {
        ...counts,
        completionRatio,
        completionPercent: Math.round(completionRatio * 100)
    };
}

function clampDepth(value) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_DASHBOARD_DEPTH;
    }
    return Math.min(Math.max(numeric, 1), 25);
}

function normalizeKanbanColumns(columns) {
    const seen = new Set();
    const ordered = [];

    (Array.isArray(columns) ? columns : []).forEach((column) => {
        if (!column || !column.id) {
            return;
        }
        const id = String(column.id);
        if (seen.has(id)) {
            return;
        }
        seen.add(id);
        ordered.push({
            id,
            label: column.label || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        });
    });

    STATUS_ORDER.forEach((status) => {
        if (!seen.has(status)) {
            ordered.push({
                id: status,
                label: status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            });
        }
    });

    return ordered;
}

function defaultDashboardConfig(note) {
    return {
        noteId: note.noteId,
        title: note.title,
        rootNoteId: readLabel(note, 'taskRootNoteId', note.noteId),
        depth: clampDepth(readLabel(note, 'taskDepth', DEFAULT_DASHBOARD_DEPTH)),
        view: readLabel(note, 'taskView', 'list'),
        filters: {
            status: [],
            tags: [],
            includeDescendants: readBooleanLabel(note, 'taskIncludeDescendants', true),
            showCompleted: readBooleanLabel(note, 'taskShowCompleted', true),
            hideBacklog: readBooleanLabel(note, 'taskHideBacklog', false),
            hideArchived: readBooleanLabel(note, 'taskHideArchived', true),
            dueRange: readLabel(note, 'taskDueRange', 'all'),
            statusChangedWithin: readLabel(note, 'taskStatusChangedWithin', ''),
            pinnedOnly: readBooleanLabel(note, 'taskPinnedOnly', false),
            roles: []
        },
        kanban: {
            columns: STATUS_ORDER.map((id) => ({ id, label: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
        },
        calendar: {
            range: readLabel(note, 'taskCalendarRange', 'month'),
            showOverdue: readBooleanLabel(note, 'taskCalendarShowOverdue', true)
        },
        overview: {
            insights: ['statusBreakdown', 'dueSoon', 'recentActivity']
        }
    };
}

function mergeDashboardConfig(note, parsedContent) {
    const defaults = defaultDashboardConfig(note);

    if (parsedContent && typeof parsedContent === 'object') {
        const merged = {
            ...defaults,
            ...parsedContent,
            filters: {
                ...defaults.filters,
                ...(parsedContent.filters || {})
            },
            kanban: {
                ...defaults.kanban,
                ...(parsedContent.kanban || {})
            },
            calendar: {
                ...defaults.calendar,
                ...(parsedContent.calendar || {})
            },
            overview: {
                ...defaults.overview,
                ...(parsedContent.overview || {})
            }
        };

        merged.depth = clampDepth(merged.depth);
        merged.kanban.columns = normalizeKanbanColumns(merged.kanban.columns);

        return merged;
    }

    return defaults;
}

module.exports = {
    STATUS_ORDER,
    PRIORITY_LABELS,
    DEFAULT_PRIORITY,
    DEFAULT_DASHBOARD_DEPTH,
    normalizeTask,
    matchesFilters,
    computeInsights,
    deriveTagSet,
    deriveRoleSet,
    sortTasks,
    mergeDashboardConfig
};
