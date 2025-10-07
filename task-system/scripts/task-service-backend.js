'use strict';

module.exports = (function () {
    const LABEL_TASK_TYPE = 'taskType';
    const LABEL_DASHBOARD = 'taskDashboard';

    function requireUtils(requireFn) {
        return requireFn('taskUtils');
    }

    function ensureTaskLabel(note) {
        if (!note.hasLabel(LABEL_TASK_TYPE, 'task')) {
            note.setLabel(LABEL_TASK_TYPE, 'task');
        }
    }

    function setLabel(note, name, value) {
        if (value === undefined || value === null || value === '') {
            note.removeLabel(name);
        } else {
            note.setLabel(name, String(value));
        }
    }

    function updateTags(note, tags) {
        const existing = note.getOwnedLabels('taskTag');
        for (const attr of existing) {
            note.removeLabel('taskTag', attr.value);
        }

        if (Array.isArray(tags)) {
            for (const tag of tags) {
                const trimmed = String(tag || '').trim();
                if (trimmed) {
                    note.addLabel('taskTag', trimmed);
                }
            }
        }
    }

    function updateRoles(note, roles) {
        const existing = note.getOwnedLabels('taskRole');
        for (const attr of existing) {
            note.removeLabel('taskRole', attr.value);
        }

        if (Array.isArray(roles)) {
            for (const role of roles) {
                const trimmed = String(role || '').trim();
                if (trimmed) {
                    note.addLabel('taskRole', trimmed);
                }
            }
        }
    }

    function normalizeStringSet(values) {
        if (!Array.isArray(values)) {
            return [];
        }
        const set = new Set();
        for (const value of values) {
            const trimmed = String(value || '').trim();
            if (trimmed) {
                set.add(trimmed);
            }
        }
        return Array.from(set);
    }

    function readStatus(note) {
        return note.getAttributeValue('label', 'taskStatus') || 'backlog';
    }

    function appendStatusLog(note, status) {
        const iso = new Date().toISOString();
        const raw = note.getAttributeValue('label', 'taskStatusLog');
        let history = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    history = parsed;
                }
            } catch (error) {
                history = [];
            }
        }
        history.push({ status, changedAt: iso });
        if (history.length > 100) {
            history = history.slice(history.length - 100);
        }
        note.setLabel('taskStatusLog', JSON.stringify(history));
        note.setLabel('taskStatusChangedAt', iso);
    }

    function applyTaskUpdates(note, payload, utils, options = {}) {
        const { applyDefaults = false } = options;

        ensureTaskLabel(note);

        const previousStatus = readStatus(note);
        let nextStatus = previousStatus;
        const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

        if (owns(payload, 'title')) {
            const trimmed = typeof payload.title === 'string' ? payload.title.trim() : '';
            if (trimmed && trimmed !== note.title) {
                note.title = trimmed;
            }
        }

        if (owns(payload, 'description')) {
            note.setContent(typeof payload.description === 'string' ? payload.description : '');
        }

        if (applyDefaults && !owns(payload, 'status')) {
            payload.status = previousStatus || 'backlog';
        }

        if (owns(payload, 'status')) {
            const candidate = String(payload.status || 'backlog').trim() || 'backlog';
            note.setLabel('taskStatus', candidate);
            nextStatus = candidate;
        }

        if (applyDefaults && !owns(payload, 'dueDate')) {
            payload.dueDate = null;
        }

        if (owns(payload, 'dueDate')) {
            const dueDate = payload.dueDate;
            if (typeof dueDate === 'string' && dueDate.trim().length > 0) {
                note.setLabel('taskDueDate', dueDate);
            } else {
                note.removeLabel('taskDueDate');
            }
        }

        if (applyDefaults && !owns(payload, 'priority')) {
            payload.priority = utils.DEFAULT_PRIORITY;
        }

        if (owns(payload, 'priority')) {
            const numeric = Number(payload.priority);
            const priority = Number.isFinite(numeric)
                ? Math.min(Math.max(Math.round(numeric), 1), 5)
                : utils.DEFAULT_PRIORITY;
            note.setLabel('taskPriority', String(priority));
        }

        if (owns(payload, 'order')) {
            note.setLabel('taskOrder', String(payload.order));
        }

        if (applyDefaults && !owns(payload, 'isPinned')) {
            payload.isPinned = false;
        }

        if (owns(payload, 'isPinned')) {
            note.setLabel('taskPinned', payload.isPinned ? 'true' : 'false');
        }

        if (applyDefaults && !owns(payload, 'tags')) {
            payload.tags = [];
        }

        if (owns(payload, 'tags')) {
            updateTags(note, payload.tags);
        }

        if (applyDefaults && !owns(payload, 'roles')) {
            payload.roles = [];
        }

        if (owns(payload, 'roles')) {
            updateRoles(note, payload.roles);
        }

        note.save();

        if (nextStatus !== previousStatus) {
            appendStatusLog(note, nextStatus);
        }

        return note;
    }

    function computeDashboardDepth(api, note) {
        let depth = 0;
        let current = note;
        let safety = 0;
        while (current && safety < 50) {
            const branch = current.getParentBranches()[0];
            if (!branch) {
                break;
            }
            depth += 1;
            const parentNote = branch.parentNote || api.getNote(branch.parentNoteId);
            current = parentNote;
            safety += 1;
            if (!current || current.noteId === 'root') {
                break;
            }
        }
        return Math.max(depth - 1, 0);
    }

    function loadDashboardNotes(api) {
        const dashboards = api.getNotesWithLabel(LABEL_DASHBOARD) || [];

        function buildPathSegments(note) {
            const segments = [];
            let current = note;
            let guard = 0;
            while (current && guard < 60) {
                const branch = current.getParentBranches()[0];
                if (!branch) {
                    break;
                }
                const parentNote = branch.parentNote || api.getNote(branch.parentNoteId);
                const rawPosition = branch.position;
                const numericPosition = Number(rawPosition);
                const position = Number.isFinite(numericPosition) ? numericPosition : 0;
                segments.unshift({
                    noteId: current.noteId,
                    parentNoteId: parentNote ? parentNote.noteId : null,
                    position
                });
                current = parentNote;
                guard += 1;
                if (!current || current.noteId === 'root') {
                    break;
                }
            }
            return segments;
        }

        const withOrder = dashboards.map((note) => {
            const pathSegments = buildPathSegments(note);
            const depth = computeDashboardDepth(api, note);
            return {
                note,
                depth,
                pathSegments
            };
        });

        withOrder.sort((a, b) => {
            const maxLength = Math.max(a.pathSegments.length, b.pathSegments.length);
            for (let index = 0; index < maxLength; index += 1) {
                const segA = a.pathSegments[index];
                const segB = b.pathSegments[index];
                if (!segA && segB) {
                    return -1;
                }
                if (!segB && segA) {
                    return 1;
                }
                if (!segA && !segB) {
                    break;
                }
                if (segA.position !== segB.position) {
                    return segA.position - segB.position;
                }
            }
            const titleA = a.note.title || '';
            const titleB = b.note.title || '';
            return titleA.localeCompare(titleB);
        });

        return withOrder;
    }

    function parseDashboardConfig(note, utils) {
        let parsed = null;
        try {
            const raw = note.getContent();
            const text = raw ? raw.toString() : '';
            parsed = text ? JSON.parse(text) : null;
        } catch (error) {
            parsed = null;
        }

        return utils.mergeDashboardConfig(note, parsed || {});
    }

    function collectTasks(api, utils, rootNoteId, depth, options = {}) {
        const rootNote = api.getNote(rootNoteId);
        if (!rootNote) {
            throw new Error(`Root note ${rootNoteId} not found.`);
        }

        const normalizedDepth = Number.isFinite(depth) ? depth : utils.DEFAULT_DASHBOARD_DEPTH;
        const maxDepth = Math.min(Math.max(normalizedDepth, 1), 25);
        const includeContent = options.includeContent === true;
        const stack = [{ note: rootNote, depth: 0, path: [{ noteId: rootNote.noteId, title: rootNote.title }] }];
        const tasks = [];

        while (stack.length > 0) {
            const frame = stack.pop();
            const note = frame.note;
            const currentDepth = frame.depth;
            const path = frame.path;

            if (note.hasLabel(LABEL_TASK_TYPE, 'task')) {
                const relativePath = path.slice(1);
                const normalized = utils.normalizeTask(note, relativePath, { includeContent });
                tasks.push(normalized);
            }

            if (currentDepth >= maxDepth) {
                continue;
            }

            const children = note.getChildNotes() || [];
            for (const child of children) {
                if (path.some((segment) => segment.noteId === child.noteId)) {
                    continue;
                }

                const childPath = path.concat([{ noteId: child.noteId, title: child.title }]);
                stack.push({ note: child, depth: currentDepth + 1, path: childPath });
            }
        }

        return tasks;
    }

    function saveDashboardConfig(note, config) {
        note.setContent(JSON.stringify(config, null, 2));
        note.setLabel(LABEL_DASHBOARD, 'true');
        setLabel(note, 'taskRootNoteId', config.rootNoteId);
        setLabel(note, 'taskDepth', config.depth);
        setLabel(note, 'taskView', config.view);
        setLabel(note, 'taskIncludeDescendants', config.filters?.includeDescendants ? 'true' : 'false');
        setLabel(note, 'taskShowCompleted', config.filters?.showCompleted ? 'true' : 'false');
        setLabel(note, 'taskHideBacklog', config.filters?.hideBacklog ? 'true' : 'false');
        setLabel(note, 'taskHideArchived', config.filters?.hideArchived ? 'true' : 'false');
        setLabel(note, 'taskDueRange', config.filters?.dueRange || 'all');
        setLabel(note, 'taskStatusChangedWithin', config.filters?.statusChangedWithin || '');
        setLabel(note, 'taskPinnedOnly', config.filters?.pinnedOnly ? 'true' : 'false');
        setLabel(note, 'taskCalendarRange', config.calendar?.range || 'month');
        setLabel(note, 'taskCalendarShowOverdue', config.calendar?.showOverdue ? 'true' : 'false');
        note.save();
    }

    function createDashboard(api, payload, utils) {
        const parentNoteId = payload.parentNoteId || 'root';
        const dashboardTitle = payload.title || 'New Dashboard';
        const { note } = api.createTextNote(parentNoteId, dashboardTitle, '{}');
        note.setLabel(LABEL_DASHBOARD, 'true');
        note.save();

        const config = utils.mergeDashboardConfig(note, {
            title: dashboardTitle,
            rootNoteId: payload.rootNoteId || payload.parentNoteId || 'root',
            view: payload.view || 'list'
        });

        saveDashboardConfig(note, config);
        config.treeDepth = computeDashboardDepth(api, note);
        return config;
    }

    function deleteDashboard(api, dashboardNoteId) {
        const note = api.getNote(dashboardNoteId);
        if (!note) {
            throw new Error(`Dashboard note ${dashboardNoteId} not found.`);
        }
        note.deleteNote();
        return true;
    }

    function getDefaultDashboard(api, dashboards, utils) {
        if (dashboards.length > 0) {
            return dashboards[0];
        }

        const defaultRoot = api.getNote('root');
        const defaultNote = defaultRoot || api.startNote;
        return {
            noteId: defaultNote.noteId,
            title: defaultNote.title,
            rootNoteId: defaultNote.noteId,
            depth: utils.DEFAULT_DASHBOARD_DEPTH,
            view: 'list',
            filters: {
                status: [],
                tags: [],
                includeDescendants: true,
                showCompleted: true,
                hideBacklog: false,
                hideArchived: true,
                dueRange: 'all',
                statusChangedWithin: '',
                pinnedOnly: false,
                roles: []
            },
            kanban: {
                columns: utils.STATUS_ORDER.map((id) => ({ id, label: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
            },
            calendar: {
                range: 'month',
                showOverdue: true
            },
            overview: {
                insights: ['statusBreakdown', 'dueSoon', 'recentActivity']
            },
            treeDepth: 0
        };
    }

    function createTask(api, utils, payload) {
        const parentNoteId = payload.parentNoteId || payload.rootNoteId || payload.dashboardRootNoteId || api.startNote.noteId;
        const title = payload.title && payload.title.trim() ? payload.title.trim() : 'New Task';
        const description = typeof payload.description === 'string' ? payload.description : '';
        const { note } = api.createTextNote(parentNoteId, title, description);
        ensureTaskLabel(note);
        const patch = Object.assign({}, payload);
        const updated = applyTaskUpdates(note, patch, utils, { applyDefaults: true });
        if (!updated.getAttributeValue('label', 'taskStatusLog')) {
            appendStatusLog(updated, readStatus(updated));
        }
        return updated;
    }

    function updateTask(api, utils, payload) {
        const note = api.getNote(payload.noteId);
        if (!note) {
            throw new Error(`Task ${payload.noteId} not found.`);
        }
        applyTaskUpdates(note, payload, utils);
        return note;
    }

    function deleteTask(api, payload) {
        const note = api.getNote(payload.noteId);
        if (!note) {
            throw new Error(`Task ${payload.noteId} not found.`);
        }
        note.deleteNote();
        return true;
    }

    function bulkUpdateStatus(api, utils, payload) {
        const updates = Array.isArray(payload.updates) ? payload.updates : [];
        const responses = [];
        for (const item of updates) {
            const note = api.getNote(item.noteId);
            if (!note) {
                continue;
            }
            const nextStatus = item.status || 'backlog';
            const previousStatus = readStatus(note);
            note.setLabel('taskStatus', nextStatus);
            if (item.order !== undefined) {
                note.setLabel('taskOrder', String(item.order));
            }
            note.save();
            if (previousStatus !== nextStatus) {
                appendStatusLog(note, nextStatus);
            }
            responses.push(note.noteId);
        }
        return responses;
    }

    function moveTask(api, payload) {
        const note = api.getNote(payload.noteId);
        if (!note) {
            throw new Error(`Task ${payload.noteId} not found.`);
        }

        const previousStatus = readStatus(note);

        if (payload.targetParentNoteId) {
            api.ensureNoteIsPresentInParent(note.noteId, payload.targetParentNoteId);
        }

        if (payload.status) {
            note.setLabel('taskStatus', payload.status);
        }

        if (payload.order !== undefined) {
            note.setLabel('taskOrder', String(payload.order));
        }

        note.save();

        if (payload.status && payload.status !== previousStatus) {
            appendStatusLog(note, payload.status);
        }
        return true;
    }

    function handleLoadDashboard(api, utils, payload) {
        const dashboardEntries = loadDashboardNotes(api);
        const serviceDashboards = dashboardEntries.map(({ note, depth, pathSegments }) => {
            const config = parseDashboardConfig(note, utils);
            config.treeDepth = depth;
            config.treePath = pathSegments.map((segment) => segment.position);
            config.treePathIds = pathSegments.map((segment) => segment.noteId);
            config.parentDashboardNoteId = pathSegments.length > 1
                ? pathSegments[pathSegments.length - 2].noteId
                : null;
            return config;
        });
        const requestedId = payload.dashboardNoteId;
        const dashboardConfig = requestedId ? serviceDashboards.find((d) => d.noteId === requestedId) : null;
        const activeDashboard = dashboardConfig || getDefaultDashboard(api, serviceDashboards, utils);
        if (activeDashboard && typeof activeDashboard.treeDepth !== 'number') {
            activeDashboard.treeDepth = 0;
        }

        const filters = {
            ...activeDashboard.filters,
            ...(payload.filters || {})
        };

        const tasks = collectTasks(api, utils, activeDashboard.rootNoteId, activeDashboard.depth, {
            includeContent: payload.includeContent === true
        });

        const filtered = tasks.filter((task) => utils.matchesFilters(task, filters));
        const sorted = utils.sortTasks(filtered);
        const insights = utils.computeInsights(filtered);
        const tags = utils.deriveTagSet(tasks);
        const roles = utils.deriveRoleSet(tasks);

        return {
            dashboard: activeDashboard,
            dashboards: serviceDashboards,
            tasks: sorted,
            availableTags: tags,
            availableRoles: roles,
            filters,
            insights
        };
    }

    function handleSaveDashboard(api, utils, payload) {
        const note = api.getNote(payload.dashboard.noteId);
        if (!note) {
            throw new Error(`Dashboard ${payload.dashboard.noteId} not found.`);
        }

        const merged = utils.mergeDashboardConfig(note, payload.dashboard);
        saveDashboardConfig(note, merged);
        merged.treeDepth = computeDashboardDepth(api, note);

        const dashboards = loadDashboardNotes(api).map(({ note, depth, pathSegments }) => {
            const config = parseDashboardConfig(note, utils);
            config.treeDepth = depth;
            config.treePath = pathSegments.map((segment) => segment.position);
            return config;
        });

        return {
            dashboard: merged,
            dashboards
        };
    }

    function handleCreateDashboard(api, utils, payload) {
        const config = createDashboard(api, payload, utils);
        const dashboards = loadDashboardNotes(api).map(({ note, depth, pathSegments }) => {
            const config = parseDashboardConfig(note, utils);
            config.treeDepth = depth;
            config.treePath = pathSegments.map((segment) => segment.position);
            return config;
        });
        return {
            dashboard: config,
            dashboards
        };
    }

    function handleDeleteDashboard(api, utils, payload) {
        deleteDashboard(api, payload.dashboardNoteId);
        const dashboards = loadDashboardNotes(api).map(({ note, depth, pathSegments }) => {
            const config = parseDashboardConfig(note, utils);
            config.treeDepth = depth;
            config.treePath = pathSegments.map((segment) => segment.position);
            return config;
        });
        return {
            dashboards
        };
    }

    function handleCreateTask(api, utils, payload) {
        const note = createTask(api, utils, payload);
        return {
            noteId: note.noteId
        };
    }

    function handleUpdateTask(api, utils, payload) {
        const note = updateTask(api, utils, payload);
        if (payload.dashboardRootNoteId) {
            const targetParent = payload.dashboardRootNoteId;
            const parents = note.getParentNotes();
            const isAlreadyLinked = parents.some((parent) => parent.noteId === targetParent);
            if (!isAlreadyLinked) {
                api.ensureNoteIsPresentInParent(note.noteId, targetParent);
            }
            const previousParent = payload.previousDashboardRootNoteId;
            if (previousParent && previousParent !== targetParent) {
                const hasPrevious = parents.some((parent) => parent.noteId === previousParent);
                if (hasPrevious) {
                    api.ensureNoteIsAbsentFromParent(note.noteId, previousParent);
                }
            }
        }
        return {
            noteId: note.noteId
        };
    }

    function handleListTasks(api, utils, payload) {
        const tasks = collectTasks(api, utils, payload.rootNoteId, payload.depth, {
            includeContent: payload.includeContent === true
        });
        const filtered = tasks.filter((task) => utils.matchesFilters(task, payload.filters || {}));
        return {
            tasks: utils.sortTasks(filtered),
            insights: utils.computeInsights(filtered)
        };
    }

    function handleMoveTask(api, utils, payload) {
        moveTask(api, payload);
        return true;
    }

    function handleUpdatePinned(api, payload) {
        const note = api.getNote(payload.noteId);
        if (!note) {
            throw new Error(`Task ${payload.noteId} not found.`);
        }
        const isPinned = payload.isPinned === true;
        note.setLabel('taskPinned', isPinned ? 'true' : 'false');
        note.save();
        return true;
    }

    function handleBulkUpdateTasks(api, utils, payload) {
        const noteIds = Array.isArray(payload.noteIds)
            ? Array.from(new Set(payload.noteIds.filter((id) => typeof id === 'string' && id.trim().length)))
            : [];
        if (!noteIds.length) {
            return { updated: [] };
        }

        const updates = payload && typeof payload.updates === 'object' ? payload.updates : {};
        if (!updates || Object.keys(updates).length === 0) {
            return { updated: [] };
        }

        const targetDashboard = typeof updates.dashboardRootNoteId === 'string'
            ? updates.dashboardRootNoteId.trim()
            : '';
        const dashboardMode = updates.dashboardMode === 'move' ? 'move' : 'add';
        const removalCandidates = new Set();
        if (dashboardMode === 'move') {
            if (typeof updates.previousDashboardRootNoteId === 'string') {
                const trimmed = updates.previousDashboardRootNoteId.trim();
                if (trimmed && trimmed !== targetDashboard) {
                    removalCandidates.add(trimmed);
                }
            }
            const extraRemovals = Array.isArray(updates.removeDashboardRootNoteIds) ? updates.removeDashboardRootNoteIds : [];
            extraRemovals
                .filter((value) => typeof value === 'string')
                .map((value) => value.trim())
                .filter((value) => value && value !== targetDashboard)
                .forEach((value) => removalCandidates.add(value));
        }

        const updated = [];

        for (const noteId of noteIds) {
            const note = api.getNote(noteId);
            if (!note) {
                continue;
            }

            const patch = {};

            if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
                const status = String(updates.status || '').trim();
                if (status && utils.STATUS_ORDER.includes(status)) {
                    patch.status = status;
                }
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'priority')) {
                const numericPriority = Number(updates.priority);
                if (Number.isFinite(numericPriority)) {
                    const clamped = Math.min(Math.max(Math.round(numericPriority), 1), 5);
                    patch.priority = clamped;
                }
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
                const dueDate = updates.dueDate;
                if (typeof dueDate === 'string' && dueDate.trim().length) {
                    patch.dueDate = dueDate;
                } else {
                    patch.dueDate = null;
                }
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'isPinned')) {
                patch.isPinned = updates.isPinned === true;
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
                if (updates.tags === null) {
                    patch.tags = [];
                } else {
                    patch.tags = normalizeStringSet(updates.tags);
                }
            }

            if (!Object.prototype.hasOwnProperty.call(patch, 'tags')) {
                const tagsAdd = normalizeStringSet(updates.tagsAdd);
                const tagsRemove = normalizeStringSet(updates.tagsRemove);
                if (tagsAdd.length > 0 || tagsRemove.length > 0) {
                    const existing = note.getOwnedLabels('taskTag') || [];
                    const current = new Set(existing.map((attr) => String(attr.value || '').trim()).filter(Boolean));
                    for (const tag of tagsAdd) {
                        current.add(tag);
                    }
                    for (const tag of tagsRemove) {
                        current.delete(tag);
                    }
                    patch.tags = Array.from(current);
                }
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'roles')) {
                if (updates.roles === null) {
                    patch.roles = [];
                } else {
                    patch.roles = normalizeStringSet(updates.roles);
                }
            }

            if (!Object.prototype.hasOwnProperty.call(patch, 'roles')) {
                const rolesAdd = normalizeStringSet(updates.rolesAdd);
                const rolesRemove = normalizeStringSet(updates.rolesRemove);
                if (rolesAdd.length > 0 || rolesRemove.length > 0) {
                    const existing = note.getOwnedLabels('taskRole') || [];
                    const current = new Set(existing.map((attr) => String(attr.value || '').trim()).filter(Boolean));
                    for (const role of rolesAdd) {
                        current.add(role);
                    }
                    for (const role of rolesRemove) {
                        current.delete(role);
                    }
                    patch.roles = Array.from(current);
                }
            }

            let hasChanges = false;

            if (Object.keys(patch).length > 0) {
                applyTaskUpdates(note, patch, utils);
                hasChanges = true;
            }

            if (targetDashboard) {
                const parents = note.getParentNotes();
                const parentIds = new Set(parents.map((parent) => parent.noteId));
                if (!parentIds.has(targetDashboard)) {
                    api.ensureNoteIsPresentInParent(note.noteId, targetDashboard);
                    parentIds.add(targetDashboard);
                    hasChanges = true;
                }
                if (dashboardMode === 'move' && removalCandidates.size > 0) {
                    removalCandidates.forEach((parentId) => {
                        if (parentId && parentId !== targetDashboard && parentIds.has(parentId)) {
                            api.ensureNoteIsAbsentFromParent(note.noteId, parentId);
                            parentIds.delete(parentId);
                            hasChanges = true;
                        }
                    });
                }
            }

            if (hasChanges) {
                updated.push(noteId);
            }
        }

        return { updated };
    }

    function updateTaskOrders(api, payload) {
        const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
        for (const entry of tasks) {
            const note = api.getNote(entry.noteId);
            if (!note) {
                continue;
            }
            const previousStatus = readStatus(note);
            if (entry.status && entry.status !== previousStatus) {
                note.setLabel('taskStatus', entry.status);
            }
            if (entry.order !== undefined) {
                note.setLabel('taskOrder', String(entry.order));
            }
            note.save();
            const nextStatus = readStatus(note);
            if (nextStatus !== previousStatus) {
                appendStatusLog(note, nextStatus);
            }
        }
        return true;
    }

    function archiveCompleted(api, utils, payload) {
        const rootNoteId = payload.rootNoteId;
        if (!rootNoteId) {
            throw new Error('rootNoteId is required to archive completed tasks.');
        }
        const depth = Number.isFinite(payload.depth) ? payload.depth : utils.DEFAULT_DASHBOARD_DEPTH;
        const tasks = collectTasks(api, utils, rootNoteId, depth, {});
        let count = 0;
        for (const task of tasks) {
            if (task.status !== 'done') {
                continue;
            }
            const note = api.getNote(task.noteId);
            if (!note) {
                continue;
            }
            note.setLabel('taskStatus', 'archived');
            note.save();
            appendStatusLog(note, 'archived');
            count += 1;
        }
        return { archived: count };
    }

    function buildPathFromNote(note, stopNoteId) {
        const path = [];
        const visited = new Set();
        let current = note;

        while (current) {
            const parents = current.getParentNotes();
            if (!parents || parents.length === 0) {
                break;
            }

            const parent = parents[0];

            if (stopNoteId && parent.noteId === stopNoteId) {
                break;
            }

            if (parent.noteId === 'root') {
                break;
            }

            if (visited.has(parent.noteId)) {
                break;
            }

            path.unshift({ noteId: parent.noteId, title: parent.title });
            visited.add(parent.noteId);
            current = parent;
        }

        return path;
    }

    function handleGetTask(api, utils, payload) {
        const note = api.getNote(payload.noteId);
        if (!note) {
            throw new Error(`Task ${payload.noteId} not found.`);
        }

        const path = buildPathFromNote(note, payload.rootNoteId || null);
        const normalized = utils.normalizeTask(note, path, { includeContent: true });
        return normalized;
    }

    return {
        handle(action, payload = {}, requireFn, api) {
            const utils = requireUtils(requireFn);

            switch (action) {
                case 'bootstrap':
                case 'loadDashboard':
                    return handleLoadDashboard(api, utils, payload);
                case 'saveDashboard':
                    return handleSaveDashboard(api, utils, payload);
                case 'createDashboard':
                    return handleCreateDashboard(api, utils, payload);
                case 'deleteDashboard':
                    return handleDeleteDashboard(api, utils, payload);
                case 'createTask':
                    return handleCreateTask(api, utils, payload);
                case 'updateTask':
                    return handleUpdateTask(api, utils, payload);
                case 'deleteTask':
                    return deleteTask(api, payload);
                case 'bulkUpdateStatus':
                    return bulkUpdateStatus(api, utils, payload);
                case 'moveTask':
                    return handleMoveTask(api, utils, payload);
                case 'updatePinned':
                    return handleUpdatePinned(api, payload);
                case 'bulkUpdateTasks':
                    return handleBulkUpdateTasks(api, utils, payload);
                case 'updateTaskOrders':
                    return updateTaskOrders(api, payload);
                case 'archiveCompleted':
                    return archiveCompleted(api, utils, payload);
                case 'listTasks':
                    return handleListTasks(api, utils, payload);
                case 'getTask':
                    return handleGetTask(api, utils, payload);
                default:
                    throw new Error(`Unsupported TaskService action '${action}'`);
            }
        }
    };
})();
