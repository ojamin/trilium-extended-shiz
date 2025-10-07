'use strict';

(function () {
    const SERVICE_LABEL = 'taskService';
    const UTILS_LABEL = 'taskUtils';
    const STYLES_LABEL = 'taskStyles';
    const DEFAULT_CSS = '';

    const STATUS_OPTIONS = [
        { id: 'backlog', label: 'Backlog' },
        { id: 'todo', label: 'To Do' },
        { id: 'in-progress', label: 'In Progress' },
        { id: 'blocked', label: 'Blocked' },
        { id: 'done', label: 'Done' },
        { id: 'archived', label: 'Archived' }
    ];

    const PRIORITY_OPTIONS = [
        { value: 1, label: '1 · Low' },
        { value: 2, label: '2 · Normal' },
        { value: 3, label: '3 · High' },
        { value: 4, label: '4 · Urgent' },
        { value: 5, label: '5 · Critical' }
    ];

    const LIST_STATUS_ORDER = ['in-progress', 'todo', 'blocked', 'backlog', 'done', 'archived'];

    const DEFAULT_LIST_SORT = [
        { key: 'status', direction: 'asc' }
    ];

    const SORT_DEFAULT_DIRECTION = {
        status: 'asc',
        title: 'asc',
        due: 'asc',
        priority: 'desc',
        location: 'asc',
        tags: 'asc',
        roles: 'asc'
    };

    const DEFAULT_FILTERS = {
        status: [],
        tags: [],
        roles: [],
        search: '',
        includeDescendants: true,
        showCompleted: true,
        hideBacklog: false,
        hideArchived: true,
        dueRange: 'all',
        statusChangedWithin: '',
        pinnedOnly: false
    };

    const DUE_RANGE_LABELS = {
        overdue: 'Overdue',
        today: 'Due today',
        week: 'Due next 7 days',
        none: 'No due date',
        future: 'Upcoming',
        past: 'Past due'
    };

    const STATUS_CHANGED_WITHIN_LABELS = {
        '7': 'Updated within 7 days',
        '14': 'Updated within 14 days',
        '30': 'Updated within 30 days',
        '60': 'Updated within 60 days',
        '90': 'Updated within 90 days'
    };

    function clonePayload(payload) {
        if (!payload) {
            return {};
        }
        try {
            return JSON.parse(JSON.stringify(payload));
        } catch (error) {
            return payload;
        }
    }

    async function callService(action, payload = {}) {
        const safePayload = clonePayload(payload);
        return await api.runOnBackend(function (serviceLabel, utilsLabel, actionName, payloadValue) {
            const cache = {};

            function loadScript(label) {
                if (cache[label]) {
                    return cache[label];
                }

                const note = api.getNoteWithLabel(label);
                if (!note) {
                    throw new Error(`Script note with label '${label}' not found.`);
                }

                const rawContent = note.getContent();
                const text = rawContent ? rawContent.toString() : '';
                const module = { exports: {} };

                function localRequire(requestedLabel) {
                    if (cache[requestedLabel]) {
                        return cache[requestedLabel];
                    }
                    if (requestedLabel === label) {
                        return module.exports;
                    }
                    return loadScript(requestedLabel);
                }

                const runner = new Function('api', 'module', 'exports', 'require', text);
                runner(api, module, module.exports, localRequire);
                cache[label] = module.exports;
                return cache[label];
            }

            const service = loadScript(serviceLabel);
            if (!service || typeof service.handle !== 'function') {
                throw new Error('TaskService handle(action) is not defined.');
            }

            return service.handle(actionName, payloadValue || {}, loadScript, api);
        }, [SERVICE_LABEL, UTILS_LABEL, action, safePayload]);
    }

    async function ensureStylesInjected() {
        if (document.head.querySelector('style[data-task-dashboard]')) {
            return;
        }

        let css = '';
        try {
            css = await api.runOnBackend(function (styleLabel) {
                const note = api.getNoteWithLabel(styleLabel);
                if (!note) {
                    return '';
                }
                const raw = note.getContent();
                return raw ? raw.toString() : '';
            }, [STYLES_LABEL]);
        } catch (error) {
            css = '';
        }

        if (!css) {
            css = DEFAULT_CSS;
        }

        if (!css) {
            return;
        }

        const style = document.createElement('style');
        style.dataset.taskDashboard = 'true';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (typeof text === 'string') {
            node.textContent = text;
        }
        return node;
    }

    function titleCase(value) {
        if (!value) {
            return '';
        }
        return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function formatNumber(num) {
        if (num === undefined || num === null) {
            return '0';
        }
        return Intl.NumberFormat().format(num);
    }

    const DAY_IN_MS = 24 * 60 * 60 * 1000;

    function toIsoDate(dateString) {
        if (!dateString) {
            return null;
        }
        const parts = dateString.split('-').map((part) => Number.parseInt(part, 10));
        if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
            return null;
        }
        const [year, month, day] = parts;
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        return utcDate.toISOString();
    }

    function parseIsoDateParts(isoString) {
        if (typeof isoString !== 'string') {
            return null;
        }
        const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) {
            return null;
        }
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        if (![year, month, day].every((value) => Number.isFinite(value))) {
            return null;
        }
        return { year, month, day };
    }

    function localDateFromIso(isoString) {
        const parts = parseIsoDateParts(isoString);
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

    function formatDateInputValue(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function createStatusPill(status) {
        const pill = el('span', 'task-status-pill', titleCase(status));
        pill.dataset.status = status;
        pill.title = `Status: ${titleCase(status)}`;
        return pill;
    }

    function createTagChip(label, className = 'task-tag') {
        const chip = el('span', className, label);
        chip.title = label;
        return chip;
    }

    function formatRelativeTime(isoString) {
        if (!isoString) {
            return '';
        }
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diffMs < minute) {
            return 'just now';
        }
        if (diffMs < hour) {
            const minutes = Math.floor(diffMs / minute);
            return `${minutes} min ago`;
        }
        if (diffMs < day) {
            const hours = Math.floor(diffMs / hour);
            return `${hours} hr${hours === 1 ? '' : 's'} ago`;
        }
        const days = Math.floor(diffMs / day);
        if (days < 7) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }
        const weeks = Math.floor(days / 7);
        if (weeks < 5) {
            return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
        }
        const months = Math.floor(days / 30);
        if (months < 12) {
            return `${months} mo${months === 1 ? '' : 's'} ago`;
        }
        const years = Math.floor(days / 365);
        return `${years} yr${years === 1 ? '' : 's'} ago`;
    }

    function formatDateTime(isoString) {
        if (!isoString) {
            return '';
        }
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDue(dateIso) {
        if (!dateIso) {
            return null;
        }
        const dueDate = localDateFromIso(dateIso);
        if (!dueDate) {
            return null;
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffFromToday = dueDate.getTime() - today.getTime();
        const diffDays = Math.round(diffFromToday / DAY_IN_MS);
        let variant = '';
        let relative;

        if (dueDate.getTime() < today.getTime()) {
            const overdueDays = Math.max(1, Math.round((today.getTime() - dueDate.getTime()) / DAY_IN_MS));
            relative = overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
            variant = 'overdue';
        } else if (diffDays === 0) {
            relative = 'Due today';
            variant = 'due-soon';
        } else if (diffDays === 1) {
            relative = 'Due tomorrow';
            variant = 'due-soon';
        } else if (diffDays <= 7) {
            relative = `Due in ${diffDays} days`;
            variant = 'due-soon';
        } else {
            relative = `Due in ${diffDays} days`;
        }

        const absolute = dueDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return {
            label: relative,
            helper: absolute,
            variant
        };
    }

    function buildTokenInput({ values = [], suggestions = [], placeholder = '', onChange = () => {} }) {
        const normalizedSuggestions = Array.from(new Set((suggestions || []).filter(Boolean).map((item) => String(item)))).sort((a, b) => a.localeCompare(b));
        const state = {
            values: Array.from(new Set((values || []).filter(Boolean).map((item) => item.trim()).filter(Boolean))),
            suggestions: normalizedSuggestions,
            highlightedIndex: -1
        };

        const wrapper = el('div', 'task-token-input');
        const chips = el('div', 'task-token-chips');
        const input = el('input', 'task-token-input-field');
        input.type = 'text';
        input.placeholder = placeholder || '';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        const suggestionsList = el('ul', 'task-token-suggestions');
        suggestionsList.setAttribute('role', 'listbox');
        suggestionsList.hidden = true;

        chips.appendChild(input);
        wrapper.appendChild(chips);
        wrapper.appendChild(suggestionsList);

        function notifyChange() {
            onChange([...state.values]);
        }

        function closeSuggestions() {
            suggestionsList.hidden = true;
            state.highlightedIndex = -1;
        }

        function renderTokens() {
            chips.querySelectorAll('.task-token').forEach((node) => node.remove());
            state.values.forEach((value) => {
                const token = el('span', 'task-token');
                token.textContent = value;
                const removeBtn = el('button', 'task-token-remove');
                removeBtn.type = 'button';
                removeBtn.setAttribute('aria-label', `Remove ${value}`);
                removeBtn.innerHTML = '<span class="bx bx-x"></span>';
                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    state.values = state.values.filter((entry) => entry !== value);
                    renderTokens();
                    notifyChange();
                });
                token.appendChild(removeBtn);
                chips.insertBefore(token, input);
            });
        }

        function highlightSuggestion(index) {
            const items = suggestionsList.querySelectorAll('li');
            items.forEach((item, idx) => {
                item.classList.toggle('active', idx === index);
                if (idx === index) {
                    item.setAttribute('aria-selected', 'true');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.removeAttribute('aria-selected');
                }
            });
            state.highlightedIndex = index;
        }

        function addToken(rawValue) {
            if (!rawValue) {
                return;
            }
            const value = String(rawValue).trim();
            if (!value) {
                return;
            }
            if (!state.values.includes(value)) {
                state.values.push(value);
                if (!state.suggestions.includes(value)) {
                    state.suggestions.push(value);
                    state.suggestions.sort((a, b) => a.localeCompare(b));
                }
                renderTokens();
                notifyChange();
            }
            input.value = '';
            closeSuggestions();
        }

        function flushInput() {
            if (input.value && input.value.trim()) {
                addToken(input.value);
            }
        }

        function handleSuggestionClick(value) {
            addToken(value);
        }

        function updateSuggestions(filterValue = '') {
            const query = filterValue.trim().toLowerCase();
            const filtered = state.suggestions.filter((item) => {
                if (state.values.includes(item)) {
                    return false;
                }
                if (!query) {
                    return true;
                }
                return item.toLowerCase().includes(query);
            }).slice(0, 8);

            suggestionsList.innerHTML = '';

            if (filtered.length === 0) {
                closeSuggestions();
                return;
            }

            filtered.forEach((item, index) => {
                const option = el('li', 'task-token-suggestion', item);
                option.setAttribute('role', 'option');
                option.addEventListener('mousedown', (event) => {
                    event.preventDefault();
                });
                option.addEventListener('click', (event) => {
                    event.preventDefault();
                    handleSuggestionClick(item);
                });
                suggestionsList.appendChild(option);
                if (index === 0) {
                    option.classList.add('active');
                    option.setAttribute('aria-selected', 'true');
                    state.highlightedIndex = 0;
                }
            });

            suggestionsList.hidden = false;
        }

        input.addEventListener('focus', () => {
            updateSuggestions(input.value);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => closeSuggestions(), 120);
        });

        input.addEventListener('input', (event) => {
            updateSuggestions(event.target.value || '');
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',') {
                if (!suggestionsList.hidden && state.highlightedIndex >= 0) {
                    const option = suggestionsList.querySelectorAll('li')[state.highlightedIndex];
                    if (option) {
                        event.preventDefault();
                        addToken(option.textContent || '');
                        return;
                    }
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                }
                addToken(input.value);
            } else if (event.key === 'Backspace' && !input.value) {
                if (state.values.length > 0) {
                    state.values.pop();
                    renderTokens();
                    notifyChange();
                }
            } else if (event.key === 'ArrowDown') {
                if (!suggestionsList.hidden) {
                    event.preventDefault();
                    const items = suggestionsList.querySelectorAll('li');
                    const next = Math.min(items.length - 1, state.highlightedIndex + 1);
                    highlightSuggestion(next);
                } else {
                    updateSuggestions(input.value);
                }
            } else if (event.key === 'ArrowUp') {
                if (!suggestionsList.hidden) {
                    event.preventDefault();
                    const items = suggestionsList.querySelectorAll('li');
                    const next = Math.max(0, state.highlightedIndex - 1);
                    highlightSuggestion(next);
                }
            } else if (event.key === 'Escape') {
                if (!suggestionsList.hidden) {
                    event.preventDefault();
                    closeSuggestions();
                }
            }
        });

        wrapper.addEventListener('click', () => {
            input.focus({ preventScroll: true });
        });

        renderTokens();

        return {
            element: wrapper,
            getValues() {
                flushInput();
                return [...state.values];
            },
            setValues(nextValues) {
                state.values = Array.from(new Set((nextValues || []).filter(Boolean).map((item) => item.trim()).filter(Boolean)));
                renderTokens();
            },
            setSuggestions(nextSuggestions) {
                state.suggestions = Array.from(new Set((nextSuggestions || []).filter(Boolean).map((item) => String(item)))).sort((a, b) => a.localeCompare(b));
                updateSuggestions(input.value || '');
            },
            focus() {
                input.focus({ preventScroll: true });
            },
            commitPending() {
                flushInput();
            }
        };
    }

    class TaskDashboardApp {
        constructor(dashboardNote) {
            this.dashboardNote = dashboardNote;
            this.state = {
                dashboards: [],
                dashboard: null,
                dashboardRootTitle: '',
                tasks: [],
                insights: null,
                filters: { ...DEFAULT_FILTERS },
                availableTags: [],
                availableRoles: [],
                selectedTask: null,
                loading: false,
                quickAddOpen: false,
                calendarMonthOffset: 0,
                currentView: null,
                filtersExpanded: false,
                compactMode: false,
                headerCollapsed: false,
                quickAddMode: 'single',
                listSort: DEFAULT_LIST_SORT.map((item) => ({ ...item })),
                selectedTaskIds: new Set(),
                kanbanSort: { key: 'priority', direction: 'desc' },
                kanbanShowEmptyColumns: false
            };
            this.container = null;
            this.root = null;
            this.detailDrawer = null;
            this.quickAddForm = null;
            this.cleanupFns = [];
            this.searchInputNode = null;
            this.pendingFocus = null;
            this.searchDebounce = null;
            this.quickAddOverlay = null;
            this.dragState = null;
            this.dropState = null;
            this.pendingSelection = null;
            this.lastSelectedTaskId = null;
            this.savedFiltersExpanded = undefined;
            this.savedHeaderCollapsed = undefined;
            this.bulkMenuContainers = [];
            this.bulkMenuHandlersAttached = false;
            this.boundBulkMenuOutsideHandler = null;
            this.boundBulkMenuKeyHandler = null;
        }

        async init() {
            await ensureStylesInjected();
            this.mount();
            this.registerShortcuts();
            await this.bootstrap();
        }

        registerShortcuts() {
            // Keyboard shortcuts have been intentionally disabled.
        }

        mount() {
            const container = api.$container && api.$container.length ? api.$container.get(0) : null;
            if (container) {
                container.innerHTML = '';
                this.container = container;
            } else {
                const fallback = el('div', 'task-dashboard-host');
                document.body.appendChild(fallback);
                this.container = fallback;
            }

            this.root = el('section', 'task-dashboard-root');
            this.container.appendChild(this.root);

            this.detailDrawer = el('aside', 'task-detail-drawer');
            this.container.appendChild(this.detailDrawer);
        }

        async bootstrap() {
            await this.setLoading(true);
            try {
                const result = await callService('bootstrap', {
                    dashboardNoteId: this.dashboardNote.noteId
                });
                this.applyBootstrapResult(result);
                await this.resolveRootTitle();
            } catch (error) {
                api.showError(`Failed to load Task Dashboard: ${error.message}`);
            } finally {
                await this.setLoading(false);
                this.render();
            }
        }

        applyBootstrapResult(result) {
            const previousDashboardId = this.state.dashboard?.noteId;
            const previousView = this.state.currentView ?? this.state.dashboard?.view ?? 'list';
            this.state.dashboards = result.dashboards || [];
            const dashboard = result.dashboard ? { ...result.dashboard } : null;
            this.state.tasks = result.tasks || [];
            this.state.filters = {
                ...DEFAULT_FILTERS,
                ...(result.filters || result.dashboard?.filters || {})
            };
            this.state.insights = result.insights || null;
            this.state.availableTags = result.availableTags || [];
            this.state.availableRoles = result.availableRoles || [];
            if (!this.state.dashboardRootTitle || (dashboard && dashboard.noteId !== previousDashboardId)) {
                this.state.dashboardRootTitle = '';
            }
            if (dashboard && dashboard.depth !== undefined) {
                const parsedDepth = Number(dashboard.depth);
                dashboard.depth = Number.isFinite(parsedDepth) ? parsedDepth : 10;
            }
            if (dashboard) {
                const resolvedView = dashboard.view || 'list';
                const viewToUse = (dashboard.noteId && dashboard.noteId !== previousDashboardId && this.state.currentView === null)
                    ? resolvedView
                    : previousView;
                dashboard.view = viewToUse;
                this.state.currentView = viewToUse;
            } else {
                this.state.currentView = previousView;
            }
            this.state.dashboard = dashboard;
            this.reconcileSelectionWithTasks();
        }

        async resolveRootTitle() {
            if (!this.state.dashboard) {
                return;
            }
            try {
                const note = await api.getNote(this.state.dashboard.rootNoteId);
                const title = note ? note.title : '';
                if (title && title !== this.state.dashboardRootTitle) {
                    this.state.dashboardRootTitle = title;
                }
            } catch (error) {
                // ignore resolution errors
            }
        }

        async refresh(extra = {}) {
            await this.setLoading(true);
            const previousView = this.state.currentView;
            const previousDashboardId = this.state.dashboard ? this.state.dashboard.noteId : null;
            try {
                const payload = Object.assign({
                    dashboardNoteId: (extra.dashboardNoteId || (this.state.dashboard ? this.state.dashboard.noteId : this.dashboardNote.noteId)),
                    filters: this.state.filters,
                    includeContent: !!extra.includeContent
                }, extra || {});

                const result = await callService('loadDashboard', payload);
                this.applyBootstrapResult(result);
                const activeDashboardId = this.state.dashboard ? this.state.dashboard.noteId : null;
                if (previousView && activeDashboardId && (payload.dashboardNoteId ? payload.dashboardNoteId === activeDashboardId : activeDashboardId === previousDashboardId)) {
                    this.state.currentView = previousView;
                    if (this.state.dashboard) {
                        this.state.dashboard.view = previousView;
                    }
                }
                await this.resolveRootTitle();
            } catch (error) {
                api.showError(`Failed to refresh dashboard: ${error.message}`);
            } finally {
                await this.setLoading(false);
                this.render();
            }
        }

        async setLoading(value) {
            this.state.loading = value;
            this.renderLoading();
        }

        renderLoading() {
            if (!this.root) {
                return;
            }
            this.root.toggleAttribute('data-loading', this.state.loading);
            let overlay = this.root.querySelector('.task-loading');
            if (this.state.loading) {
                if (!overlay) {
                    overlay = el('div', 'task-loading');
                    overlay.innerHTML = '<span class="task-spinner"></span><span>Syncing changes…</span>';
                    this.root.prepend(overlay);
                }
            } else if (overlay) {
                overlay.remove();
            }
        }

        render() {
            if (!this.root) {
                return;
            }

            this.dropState = null;
            this.dragState = null;

            this.syncLayoutWithSelection();
            this.root.toggleAttribute('data-selection-mode', this.state.compactMode);

            this.root.innerHTML = '';
            this.searchInputNode = null;

            if (!this.state.dashboard) {
                this.root.appendChild(this.createEmpty('No dashboard configuration found. Create one to get started.'));
                this.restoreFocus();
                return;
            }

            this.root.appendChild(this.renderHeader());

            const filtersPanel = this.renderFiltersPanel();
            if (filtersPanel) {
                this.root.appendChild(filtersPanel);
            }

            const bulkBar = this.renderBulkSelectionBar();
            if (bulkBar) {
                this.root.appendChild(bulkBar);
            }

            const mainView = this.renderMainView();
            this.root.appendChild(mainView);

            this.renderDetailDrawer();
            if (this.state.quickAddOpen) {
                this.renderQuickAddModal();
            } else {
                this.destroyQuickAddModal();
            }
            this.restoreFocus();
        }

        renderHeader() {
            const header = el('div', 'task-dashboard-header');

            const collapsed = this.state.headerCollapsed === true;
            header.classList.toggle('is-collapsed', collapsed);
            header.dataset.collapsed = collapsed ? 'true' : 'false';

            const selector = this.createDashboardSelector();
            if (selector) {
                selector.classList.add('task-header-selector');
                if (!selector.getAttribute('aria-label')) {
                    selector.setAttribute('aria-label', 'Switch dashboard');
                }
                const selectorGroup = el('div', 'task-header-selector-group');
                const selectorIcon = el('span', 'task-header-selector-icon bx bx-compass');
                selectorIcon.setAttribute('aria-hidden', 'true');
                selectorGroup.appendChild(selectorIcon);
                selectorGroup.appendChild(selector);
                header.appendChild(selectorGroup);
            }

            const name = el('span', 'task-header-name');
            const nameIcon = el('span', 'task-header-icon bx bx-planet');
            nameIcon.setAttribute('aria-hidden', 'true');
            name.appendChild(nameIcon);
            name.appendChild(el('span', 'task-header-name-text', this.state.dashboard.title || 'Task Dashboard'));
            header.appendChild(name);

            return header;
        }

        renderActionToolbar() {
            if (!this.state.dashboard) {
                return null;
            }

            const toolbar = el('div', 'task-action-toolbar');

            const searchControl = this.renderSearchControl();
            toolbar.appendChild(searchControl);

            const actions = el('div', 'task-action-buttons');

            const viewSwitch = this.createViewSwitch();
            actions.appendChild(viewSwitch);

            const quickAddBtn = this.createButton('Quick Add', 'bx bx-plus-circle', this.state.quickAddOpen ? 'primary active' : 'primary');
            quickAddBtn.title = 'Open Quick Add';
            quickAddBtn.addEventListener('click', () => this.toggleQuickAdd(!this.state.quickAddOpen, true));
            actions.appendChild(quickAddBtn);

            const archiveBtn = this.createButton('Archive Done', 'bx bx-archive-in', 'ghost');
            archiveBtn.addEventListener('click', () => this.archiveCompleted());
            const hasDoneTasks = this.state.tasks.some((task) => task.status === 'done');
            archiveBtn.disabled = !hasDoneTasks;
            archiveBtn.title = 'Archive all tasks marked Done';
            actions.appendChild(archiveBtn);

            const refreshBtn = this.createButton('', 'bx bx-refresh', 'ghost icon');
            refreshBtn.title = 'Refresh dashboard';
            refreshBtn.setAttribute('aria-label', 'Refresh dashboard');
            refreshBtn.addEventListener('click', () => this.refresh());
            actions.appendChild(refreshBtn);

            toolbar.appendChild(actions);
            return toolbar;
        }

        renderBulkSelectionBar() {
            if (!this.hasSelection()) {
                this.closeAllBulkMenus();
                return null;
            }

            const selectedIds = this.getSelectedTaskIds();
            const count = selectedIds.length;
            const bar = el('div', 'task-bulk-bar');
            const summary = el('div', 'task-bulk-summary');
            summary.textContent = `${count} task${count === 1 ? '' : 's'} selected`;
            bar.appendChild(summary);

            const insights = this.getSelectionInsights();
            if (insights) {
                const insightRow = el('div', 'task-bulk-insights');
                if (insights.earliestDue !== null) {
                    const date = new Date(insights.earliestDue);
                    insightRow.appendChild(this.createBulkChip('Earliest due', date.toLocaleDateString()));
                }
                if (insights.pinned > 0) {
                    insightRow.appendChild(this.createBulkChip('Pinned', `${insights.pinned}`));
                }
                const statusEntries = Array.from(insights.statuses.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                statusEntries.forEach(([status, total]) => {
                    insightRow.appendChild(this.createBulkChip(titleCase(status), String(total)));
                });
                if (insightRow.childNodes.length > 0) {
                    bar.appendChild(insightRow);
                }
            }

            const actions = el('div', 'task-bulk-actions task-bulk-actions--menus');
            this.bulkMenuContainers = [];

            const menuConfigs = [
                { label: 'Status', icon: 'bx bx-adjust', buildContent: () => this.renderBulkStatusControls() },
                { label: 'Priority', icon: 'bx bx-layer', buildContent: () => this.renderBulkPriorityControls() },
                { label: 'Dashboard', icon: 'bx bx-layout', buildContent: () => this.renderBulkDashboardControls() },
                { label: 'Due Date', icon: 'bx bx-calendar-event', buildContent: () => this.renderBulkDueControls() },
                { label: 'Pin', icon: 'bx bx-pin', buildContent: () => this.renderBulkPinControls() },
                { label: 'Tags', icon: 'bx bx-purchase-tag', buildContent: () => this.renderBulkTagControls() },
                { label: 'Roles', icon: 'bx bx-user-circle', buildContent: () => this.renderBulkRoleControls() }
            ];

            menuConfigs.forEach((config) => {
                const menu = this.createBulkMenu(config);
                actions.appendChild(menu);
            });

            this.ensureBulkMenuHandlers();

            const clearBtn = this.createButton('Clear selection', 'bx bx-x-circle', 'ghost task-bulk-clear');
            clearBtn.addEventListener('click', () => this.clearSelection());
            actions.appendChild(clearBtn);

            bar.appendChild(actions);
            return bar;
        }

        createBulkMenu({ label, icon, buildContent }) {
            const container = el('div', 'task-bulk-menu');
            const button = this.createButton(label, icon, 'ghost task-bulk-menu-button');
            button.setAttribute('aria-haspopup', 'true');
            button.setAttribute('aria-expanded', 'false');
            const panel = el('div', 'task-bulk-menu-panel');
            panel.setAttribute('role', 'group');
            panel.hidden = true;

            const content = typeof buildContent === 'function' ? buildContent() : null;
            if (content) {
                panel.appendChild(content);
            } else {
                panel.appendChild(this.createEmpty('No actions available.'));
            }

            container.appendChild(button);
            container.appendChild(panel);
            container._menuButton = button;
            container._menuPanel = panel;

            button.addEventListener('click', (event) => {
                event.preventDefault();
                if (container.classList.contains('is-open')) {
                    this.closeBulkMenu(container);
                } else {
                    this.closeAllBulkMenus();
                    this.openBulkMenu(container);
                }
            });

            button.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.closeBulkMenu(container);
                }
            });

            this.bulkMenuContainers.push(container);
            return container;
        }

        openBulkMenu(container) {
            if (!container) {
                return;
            }
            container.classList.add('is-open');
            if (container._menuButton) {
                container._menuButton.setAttribute('aria-expanded', 'true');
            }
            if (container._menuPanel) {
                container._menuPanel.hidden = false;
            }
        }

        closeBulkMenu(container) {
            if (!container) {
                return;
            }
            container.classList.remove('is-open');
            if (container._menuButton) {
                container._menuButton.setAttribute('aria-expanded', 'false');
            }
            if (container._menuPanel) {
                container._menuPanel.hidden = true;
            }
        }

        closeAllBulkMenus(except = null) {
            if (!Array.isArray(this.bulkMenuContainers)) {
                return;
            }
            this.bulkMenuContainers.forEach((container) => {
                if (container !== except) {
                    this.closeBulkMenu(container);
                }
            });
        }

        ensureBulkMenuHandlers() {
            if (this.bulkMenuHandlersAttached) {
                return;
            }
            this.bulkMenuHandlersAttached = true;
            this.boundBulkMenuOutsideHandler = (event) => this.handleBulkMenuOutsideClick(event);
            this.boundBulkMenuKeyHandler = (event) => this.handleBulkMenuKeydown(event);
            document.addEventListener('click', this.boundBulkMenuOutsideHandler);
            document.addEventListener('keydown', this.boundBulkMenuKeyHandler);
            this.cleanupFns.push(() => {
                document.removeEventListener('click', this.boundBulkMenuOutsideHandler);
                document.removeEventListener('keydown', this.boundBulkMenuKeyHandler);
                this.bulkMenuHandlersAttached = false;
                this.boundBulkMenuOutsideHandler = null;
                this.boundBulkMenuKeyHandler = null;
            });
        }

        handleBulkMenuOutsideClick(event) {
            if (!Array.isArray(this.bulkMenuContainers) || this.bulkMenuContainers.length === 0) {
                return;
            }
            const target = event.target;
            const clickedInside = this.bulkMenuContainers.some((container) => container.contains(target));
            if (!clickedInside) {
                this.closeAllBulkMenus();
            }
        }

        handleBulkMenuKeydown(event) {
            if (event.key === 'Escape') {
                this.closeAllBulkMenus();
            }
        }

        renderBulkStatusControls() {
            const list = el('div', 'task-bulk-menu-list');
            STATUS_OPTIONS.forEach((option) => {
                const btn = this.createButton(option.label, '', 'ghost task-bulk-menu-item');
                btn.dataset.status = option.id;
                btn.title = `Set status to ${option.label}`;
                btn.addEventListener('click', async () => {
                    await this.bulkUpdateSelected({ status: option.id });
                    this.closeAllBulkMenus();
                });
                list.appendChild(btn);
            });
            return list;
        }

        renderBulkPriorityControls() {
            const list = el('div', 'task-bulk-menu-list');
            PRIORITY_OPTIONS.forEach((option) => {
                const label = `P${option.value}`;
                const btn = this.createButton(label, '', 'ghost task-bulk-menu-item');
                btn.dataset.priority = String(option.value);
                btn.title = `Set priority to ${option.label}`;
                btn.addEventListener('click', async () => {
                    await this.bulkUpdateSelected({ priority: option.value });
                    this.closeAllBulkMenus();
                });
                list.appendChild(btn);
            });
            return list;
        }

        renderBulkDashboardControls() {
            const dashboards = this.getSortedDashboards();
            if (!dashboards.length) {
                const empty = el('div', 'task-bulk-menu-empty', 'No dashboards available');
                return empty;
            }

            const wrapper = el('div', 'task-bulk-menu-column');
            const row = el('div', 'task-bulk-dashboard');
            const select = el('select', 'task-select task-bulk-dashboard-select');
            select.setAttribute('aria-label', 'Select dashboard');

            const currentRoot = this.state.dashboard?.rootNoteId || '';
            let initialRoot = currentRoot;

            dashboards.forEach((dashboard) => {
                const option = document.createElement('option');
                option.value = dashboard.rootNoteId;
                option.textContent = this.formatDashboardLabel(dashboard);
                select.appendChild(option);
            });

            const hasInitial = dashboards.some((dashboard) => dashboard.rootNoteId === initialRoot);
            if (!hasInitial && dashboards.length > 0) {
                initialRoot = dashboards[0].rootNoteId;
            }
            if (initialRoot) {
                select.value = initialRoot;
            }

            const actions = el('div', 'task-bulk-menu-actions task-bulk-dashboard-actions');
            const addBtn = this.createButton('Add', 'bx bx-link-alt', 'ghost task-bulk-menu-item');
            addBtn.title = 'Link selected tasks to this dashboard';
            const moveBtn = this.createButton('Move', 'bx bx-transfer-alt', 'ghost task-bulk-menu-item');
            moveBtn.title = 'Move selected tasks to this dashboard';

            const updateActionState = () => {
                const value = select.value;
                const hasTarget = !!value;
                addBtn.disabled = !hasTarget;
                moveBtn.disabled = !hasTarget || (!!currentRoot && value === currentRoot);
            };

            select.addEventListener('change', updateActionState);

            addBtn.addEventListener('click', () => this.handleBulkDashboardAssign({
                rootNoteId: select.value,
                mode: 'add'
            }));

            moveBtn.addEventListener('click', () => this.handleBulkDashboardAssign({
                rootNoteId: select.value,
                mode: 'move'
            }));

            actions.appendChild(addBtn);
            actions.appendChild(moveBtn);

            row.appendChild(select);
            row.appendChild(actions);
            wrapper.appendChild(row);

            updateActionState();

            return wrapper;
        }

        renderBulkDueControls() {
            const wrapper = el('div', 'task-bulk-menu-column');

            const dateInput = el('input', 'task-input task-input-date task-bulk-menu-date');
            dateInput.type = 'date';
            dateInput.setAttribute('aria-label', 'Set due date');
            dateInput.addEventListener('change', async (event) => {
                const value = event.target.value;
                if (!value) {
                    return;
                }
                const iso = toIsoDate(value);
                if (!iso) {
                    api.showError('Invalid date.');
                    return;
                }
                await this.bulkUpdateSelected({ dueDate: iso });
                event.target.value = '';
                this.closeAllBulkMenus();
            });
            wrapper.appendChild(dateInput);

            const quick = el('div', 'task-bulk-menu-actions task-bulk-quick-actions');
            const quickOptions = [
                { label: 'Today', icon: 'bx bx-calendar-star', offset: 0 },
                { label: 'Tomorrow', icon: 'bx bx-calendar', offset: 1 },
                { label: '+7d', icon: 'bx bx-calendar-week', offset: 7 }
            ];
            quickOptions.forEach((option) => {
                const btn = this.createButton(option.label, option.icon, 'ghost task-bulk-menu-item task-bulk-quiet');
                btn.addEventListener('click', async () => {
                    await this.bulkUpdateSelected({ dueDate: this.isoFromOffset(option.offset) });
                    this.closeAllBulkMenus();
                });
                quick.appendChild(btn);
            });
            const clearBtn = this.createButton('Clear', 'bx bx-calendar-x', 'ghost task-bulk-menu-item task-bulk-quiet');
            clearBtn.addEventListener('click', async () => {
                await this.bulkUpdateSelected({ dueDate: null });
                this.closeAllBulkMenus();
            });
            quick.appendChild(clearBtn);

            wrapper.appendChild(quick);
            return wrapper;
        }

        renderBulkPinControls() {
            const actions = el('div', 'task-bulk-menu-actions');
            const pinBtn = this.createButton('Pin', 'bx bx-pin', 'ghost task-bulk-menu-item');
            pinBtn.addEventListener('click', async () => {
                await this.bulkUpdateSelected({ isPinned: true });
                this.closeAllBulkMenus();
            });
            const unpinBtn = this.createButton('Unpin', 'bx bx-pin-off', 'ghost task-bulk-menu-item');
            unpinBtn.addEventListener('click', async () => {
                await this.bulkUpdateSelected({ isPinned: false });
                this.closeAllBulkMenus();
            });
            actions.appendChild(pinBtn);
            actions.appendChild(unpinBtn);
            return actions;
        }

        renderBulkTagControls() {
            return this.renderBulkTokenControls({
                label: 'Tags',
                suggestions: this.state.availableTags,
                add: {
                    placeholder: 'Add tags…',
                    buttonLabel: 'Add',
                    icon: 'bx bx-purchase-tag',
                    handler: (values) => this.bulkUpdateSelected({ tagsAdd: values })
                },
                remove: {
                    placeholder: 'Remove tags…',
                    buttonLabel: 'Remove',
                    icon: 'bx bx-tag-x',
                    handler: (values) => this.bulkUpdateSelected({ tagsRemove: values })
                }
            });
        }

        renderBulkRoleControls() {
            return this.renderBulkTokenControls({
                label: 'Roles',
                suggestions: this.state.availableRoles,
                add: {
                    placeholder: 'Add roles…',
                    buttonLabel: 'Add',
                    icon: 'bx bx-user-plus',
                    handler: (values) => this.bulkUpdateSelected({ rolesAdd: values })
                },
                remove: {
                    placeholder: 'Remove roles…',
                    buttonLabel: 'Remove',
                    icon: 'bx bx-user-minus',
                    handler: (values) => this.bulkUpdateSelected({ rolesRemove: values })
                }
            });
        }

        async handleBulkDashboardAssign({ rootNoteId, mode }) {
            const value = typeof rootNoteId === 'string' ? rootNoteId.trim() : '';
            if (!value) {
                return;
            }
            const updates = {
                dashboardRootNoteId: value,
                dashboardMode: mode === 'move' ? 'move' : 'add'
            };
            if (mode === 'move') {
                const previous = this.state.dashboard?.rootNoteId || '';
                if (previous && previous !== value) {
                    updates.previousDashboardRootNoteId = previous;
                }
            }
            await this.bulkUpdateSelected(updates);
            this.closeAllBulkMenus();
        }

        renderBulkTokenControls(config) {
            const stack = el('div', 'task-bulk-menu-stack');
            if (config.label) {
                stack.appendChild(el('span', 'task-bulk-menu-subheading', config.label));
            }
            if (config.add) {
                stack.appendChild(this.createTokenActionForm({
                    placeholder: config.add.placeholder,
                    buttonLabel: config.add.buttonLabel,
                    icon: config.add.icon,
                    suggestions: config.suggestions,
                    handler: config.add.handler,
                    ariaLabel: `${config.label}: ${config.add.buttonLabel}`
                }));
            }
            if (config.remove) {
                stack.appendChild(this.createTokenActionForm({
                    placeholder: config.remove.placeholder,
                    buttonLabel: config.remove.buttonLabel,
                    icon: config.remove.icon,
                    suggestions: config.suggestions,
                    handler: config.remove.handler,
                    ariaLabel: `${config.label}: ${config.remove.buttonLabel}`
                }));
            }
            return stack;
        }

        createTokenActionForm({ placeholder, buttonLabel, icon, suggestions, handler, ariaLabel }) {
            const form = document.createElement('form');
            form.className = 'task-bulk-menu-form';
            if (ariaLabel) {
                form.setAttribute('aria-label', ariaLabel);
            }
            const tokenInput = buildTokenInput({
                suggestions: suggestions || [],
                placeholder
            });
            form.appendChild(tokenInput.element);
            const button = this.createButton(buttonLabel, icon, 'ghost task-bulk-menu-item');
            button.type = 'submit';
            form.appendChild(button);
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const values = tokenInput.getValues();
                if (!values.length) {
                    return;
                }
                await handler(values);
                tokenInput.setValues([]);
                this.closeAllBulkMenus();
            });
            return form;
        }

        isoFromOffset(days) {
            const base = new Date();
            base.setHours(0, 0, 0, 0);
            base.setDate(base.getDate() + days);
            const utc = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
            return utc.toISOString();
        }

        renderSearchControl() {
            const wrapper = el('div', 'task-search-group');
            const icon = el('span', 'task-search-icon bx bx-search');
            wrapper.appendChild(icon);

            const input = el('input', 'task-search');
            input.type = 'search';
            input.placeholder = 'Search tasks…';
            input.value = this.state.filters.search || '';
            input.setAttribute('aria-label', 'Search tasks');
            input.addEventListener('input', (event) => {
                this.state.filters.search = event.target.value;
                if (this.searchDebounce) {
                    clearTimeout(this.searchDebounce);
                }
                clearBtn.toggleAttribute('hidden', !(event.target.value && event.target.value.trim().length));
                this.searchDebounce = setTimeout(() => {
                    const latest = this.searchInputNode ? this.searchInputNode.value : event.target.value;
                    this.state.filters.search = latest.trim();
                    this.pendingFocus = 'search';
                    if (this.hasSelection()) {
                        this.clearSelection({ render: false });
                    }
                    this.searchDebounce = null;
                    this.refresh();
                }, 220);
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    if (this.searchDebounce) {
                        clearTimeout(this.searchDebounce);
                        this.searchDebounce = null;
                    }
                    this.state.filters.search = event.target.value.trim();
                    clearBtn.toggleAttribute('hidden', !(event.target.value && event.target.value.trim().length));
                    this.pendingFocus = 'search';
                    if (this.hasSelection()) {
                        this.clearSelection({ render: false });
                    }
                    this.refresh();
                }
            });
            this.searchInputNode = input;
            wrapper.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'task-search-clear';
            clearBtn.innerHTML = '<span class="bx bx-x"></span>';
            clearBtn.title = 'Clear search';
            clearBtn.addEventListener('click', () => {
                if (this.searchDebounce) {
                    clearTimeout(this.searchDebounce);
                    this.searchDebounce = null;
                }
                this.state.filters.search = '';
                input.value = '';
                clearBtn.toggleAttribute('hidden', true);
                this.pendingFocus = 'search';
                if (this.hasSelection()) {
                    this.clearSelection({ render: false });
                }
                this.refresh();
            });
            clearBtn.toggleAttribute('hidden', !(this.state.filters.search && this.state.filters.search.length));
            wrapper.appendChild(clearBtn);

            return wrapper;
        }

        createHeroProgressCard({ total = 0, completed = 0, visible = 0, percent = 0 }) {
            const safeTotal = Number.isFinite(total) ? total : 0;
            const safeCompleted = Number.isFinite(completed) ? completed : 0;
            const safeVisible = Number.isFinite(visible) ? visible : 0;
            const base = safeTotal || safeVisible || 0;
            const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;

            const card = el('div', 'task-hero-progress');
            card.setAttribute('role', 'progressbar');
            card.setAttribute('aria-valuemin', '0');
            card.setAttribute('aria-valuemax', '100');
            card.setAttribute('aria-valuenow', String(safePercent));
            if (base === 0) {
                card.dataset.empty = 'true';
            }

            card.appendChild(el('span', 'task-hero-progress-label', 'Completion'));

            const track = el('div', 'task-hero-progress-track');
            const fill = el('div', 'task-hero-progress-fill');
            fill.style.width = `${safePercent}%`;
            fill.style.setProperty('--task-hero-progress', `${safePercent}%`);
            track.appendChild(fill);
            card.appendChild(track);

            const meta = el('div', 'task-hero-progress-meta');
            meta.appendChild(el('span', 'task-hero-progress-value', `${safePercent}%`));

            const statusParts = [];
            if (base > 0) {
                statusParts.push(`${formatNumber(safeCompleted)} of ${formatNumber(base)} done`);
            } else {
                statusParts.push('No tasks tracked yet');
            }
            if (safeVisible > 0) {
                const visibleText = `${formatNumber(safeVisible)} visible`;
                statusParts.push(visibleText);
            }

            const status = el('span', 'task-hero-progress-counts', statusParts.join(' • '));
            status.title = status.textContent;
            meta.appendChild(status);
            card.appendChild(meta);

            return card;
        }

        renderSummaryMetrics() {
            if (!this.state.insights) {
                return null;
            }

            const wrapper = el('div', 'task-header-metrics');
            const metrics = [
                { label: 'Total', value: this.state.insights.total },
                { label: 'Done', value: this.state.insights.completed, variant: 'success' },
                { label: 'Overdue', value: this.state.insights.overdue, variant: this.state.insights.overdue ? 'danger' : undefined },
                { label: 'Due Soon', value: this.state.insights.dueSoon, variant: this.state.insights.dueSoon ? 'warning' : undefined }
            ];

            metrics.forEach((metric) => {
                const chip = el('div', 'task-header-metric');
                chip.appendChild(el('span', '', metric.label));
                chip.appendChild(el('strong', '', formatNumber(metric.value || 0)));
                if (metric.variant) {
                    chip.dataset.variant = metric.variant;
                }
                wrapper.appendChild(chip);
            });

            return wrapper;
        }

        renderHeaderSummary() {
            const chips = [];

            const rootLabel = this.state.dashboardRootTitle || this.state.dashboard?.rootNoteId || '';
            if (rootLabel) {
                chips.push(this.createHeaderChip('Root', rootLabel));
            }

            const visibleCount = formatNumber(Array.isArray(this.state.tasks) ? this.state.tasks.length : 0);
            chips.push(this.createHeaderChip('Visible', visibleCount));

            if (this.state.insights) {
                const { overdue = 0, dueSoon = 0, pinned = 0 } = this.state.insights;
                if (overdue > 0) {
                    chips.push(this.createHeaderChip('Overdue', formatNumber(overdue), 'danger'));
                }
                if (dueSoon > 0) {
                    chips.push(this.createHeaderChip('Due Soon', formatNumber(dueSoon), 'warning'));
                }
                if (pinned > 0) {
                    chips.push(this.createHeaderChip('Pinned', formatNumber(pinned)));
                }
            }

            const selectionCount = this.ensureSelectionSet().size;
            if (selectionCount > 0) {
                chips.push(this.createHeaderChip('Selected', formatNumber(selectionCount), 'accent'));
            }

            if (this.hasActiveFilters(true)) {
                let summary = this.getFiltersSummaryText();
                if (summary.length > 80) {
                    summary = `${summary.slice(0, 77)}…`;
                }
                chips.push(this.createHeaderChip('Filters', summary, 'muted'));
            }

            if (chips.length === 0) {
                return null;
            }

            const row = el('div', 'task-header-summary');
            chips.forEach((chip) => row.appendChild(chip));
            return row;
        }

        createHeaderChip(label, value, variant) {
            const chip = el('div', 'task-header-chip');
            if (variant) {
                chip.dataset.variant = variant;
            }
            chip.appendChild(el('span', 'task-header-chip-label', label));
            chip.appendChild(el('span', 'task-header-chip-value', value));
            return chip;
        }

        renderFiltersPanel() {
            if (!this.state.dashboard) {
                return null;
            }
            const panel = el('section', 'task-filters-panel');
            const collapsed = !this.state.filtersExpanded;
            panel.classList.toggle('task-filters-collapsed', collapsed);
            panel.classList.toggle('is-collapsed', collapsed);
            panel.dataset.collapsed = collapsed ? 'true' : 'false';

            const activeFilterCount = this.getActiveFilterCount();
            const quickFilters = this.renderHeaderQuickFilters();
            const filterToggle = this.createSectionToggle({
                label: 'Filters',
                collapsed,
                summary: this.getFiltersSummaryText(),
                badge: activeFilterCount > 0 ? `${activeFilterCount} active` : '',
                accessory: quickFilters,
                onToggle: () => {
                    const next = !this.state.filtersExpanded;
                    this.state.filtersExpanded = next;
                    if (this.state.compactMode && typeof this.savedFiltersExpanded === 'boolean') {
                        this.savedFiltersExpanded = next;
                    }
                    this.render();
                }
            });
            panel.appendChild(filterToggle);

            const body = el('div', 'task-filters-body');
            const grid = el('div', 'task-filters-grid');

            const statusField = el('div', 'task-filter-field');
            statusField.appendChild(el('label', '', 'Status'));
            const statusGroup = el('div', 'task-chip-group');
            STATUS_OPTIONS.forEach((entry) => {
                const chip = el('button', 'task-chip task-chip-button', titleCase(entry.label));
                chip.type = 'button';
                if (this.state.filters.status.includes(entry.id)) {
                    chip.classList.add('active');
                }
                chip.addEventListener('click', () => this.toggleFilterValue('status', entry.id));
                statusGroup.appendChild(chip);
            });
            statusField.appendChild(statusGroup);
            grid.appendChild(statusField);

            if (this.state.availableTags.length > 0) {
                const tagField = el('div', 'task-filter-field');
                tagField.appendChild(el('label', '', 'Tags'));
                const tagGroup = el('div', 'task-chip-group');
                this.state.availableTags.forEach((tag) => {
                    const chip = el('button', 'task-chip task-chip-button', tag);
                    chip.type = 'button';
                    if (this.state.filters.tags.includes(tag)) {
                        chip.classList.add('active');
                    }
                    chip.addEventListener('click', () => this.toggleFilterValue('tags', tag));
                    tagGroup.appendChild(chip);
                });
                tagField.appendChild(tagGroup);
                grid.appendChild(tagField);
            }

            if (this.state.availableRoles.length > 0) {
                const roleField = el('div', 'task-filter-field');
                roleField.appendChild(el('label', '', 'Roles'));
                const roleGroup = el('div', 'task-chip-group');
                this.state.availableRoles.forEach((role) => {
                    const chip = el('button', 'task-chip task-chip-button', role);
                    chip.type = 'button';
                    if (this.state.filters.roles.includes(role)) {
                        chip.classList.add('active');
                    }
                    chip.addEventListener('click', () => this.toggleFilterValue('roles', role));
                    roleGroup.appendChild(chip);
                });
                roleField.appendChild(roleGroup);
                grid.appendChild(roleField);
            }

            const depthField = el('div', 'task-filter-field');
            depthField.appendChild(el('label', '', 'Depth (levels)'));
            const depthInput = el('input', 'task-input task-depth-input');
            depthInput.type = 'number';
            depthInput.min = '1';
            depthInput.max = '25';
            depthInput.value = this.state.dashboard?.depth ?? 10;
            depthInput.addEventListener('change', (event) => this.handleDepthChange(event.target.value));
            depthInput.addEventListener('blur', (event) => this.handleDepthChange(event.target.value));
            depthField.appendChild(depthInput);
            grid.appendChild(depthField);

            const toggleField = el('div', 'task-filter-field');
            toggleField.appendChild(el('label', '', 'Options'));
            const toggleRow = el('div', 'task-chip-group');
            toggleRow.appendChild(this.createToggle('Include descendants', this.state.filters.includeDescendants !== false, (value) => {
                this.state.filters.includeDescendants = value;
                this.clearSelection({ render: false });
                this.refresh();
            }));
            toggleRow.appendChild(this.createToggle('Show completed', this.state.filters.showCompleted !== false, (value) => {
                this.state.filters.showCompleted = value;
                this.clearSelection({ render: false });
                this.refresh();
            }));
            toggleRow.appendChild(this.createToggle('Show backlog', this.state.filters.hideBacklog === false, (value) => {
                this.state.filters.hideBacklog = !value;
                this.clearSelection({ render: false });
                this.refresh();
            }));
            toggleRow.appendChild(this.createToggle('Show archived', this.state.filters.hideArchived === false, (value) => {
                this.state.filters.hideArchived = !value;
                this.clearSelection({ render: false });
                this.refresh();
            }));
            toggleField.appendChild(toggleRow);
            grid.appendChild(toggleField);

            const recencyField = el('div', 'task-filter-field');
            recencyField.appendChild(el('label', '', 'Updated within'));
            const recencySelect = el('select', 'task-select');
            const recencyOptions = [
                { value: '', label: 'Any time' },
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' }
            ];
            recencyOptions.forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.value;
                if ((this.state.filters.statusChangedWithin || '') === option.value) {
                    opt.selected = true;
                }
                recencySelect.appendChild(opt);
            });
            recencySelect.addEventListener('change', (event) => {
                const value = event.target.value;
                this.state.filters.statusChangedWithin = value || '';
                this.clearSelection({ render: false });
                this.refresh();
            });
            recencyField.appendChild(recencySelect);
            grid.appendChild(recencyField);

            body.appendChild(grid);

            const resetRow = el('div', 'task-dashboard-actions');
            const resetBtn = this.createButton('Reset Filters', 'bx bx-eraser');
            resetBtn.addEventListener('click', () => {
                this.state.filters = { ...DEFAULT_FILTERS };
                this.state.filtersExpanded = false;
                this.clearSelection({ render: false });
                this.refresh();
            });
            resetRow.appendChild(resetBtn);
            body.appendChild(resetRow);

            panel.appendChild(body);

            return panel;
        }

        getHeaderSummaryText() {
            if (!this.state.dashboard) {
                return '';
            }
            const parts = [];
            const rootLabel = this.state.dashboardRootTitle || this.state.dashboard.rootNoteId || '';
            if (rootLabel) {
                parts.push(`Root · ${rootLabel}`);
            }
            parts.push(`${formatNumber(this.state.tasks.length)} visible`);
            const activeView = this.state.currentView || this.state.dashboard.view;
            if (activeView) {
                parts.push(`View · ${titleCase(activeView)}`);
            }
            return parts.join(' • ');
        }

        getActiveFilterCount() {
            const filters = this.state.filters || DEFAULT_FILTERS;
            if (!filters) {
                return 0;
            }
            let total = 0;
            if (filters.search && filters.search.trim()) {
                total += 1;
            }
            if (Array.isArray(filters.status)) {
                total += filters.status.length;
            }
            if (Array.isArray(filters.tags)) {
                total += filters.tags.length;
            }
            if (Array.isArray(filters.roles)) {
                total += filters.roles.length;
            }
            if (filters.includeDescendants === false) {
                total += 1;
            }
            if (filters.showCompleted === false) {
                total += 1;
            }
            if (filters.hideBacklog === true) {
                total += 1;
            }
            if (filters.hideArchived === false) {
                total += 1;
            }
            if (filters.dueRange && filters.dueRange !== 'all') {
                total += 1;
            }
            if (filters.statusChangedWithin) {
                total += 1;
            }
            if (filters.pinnedOnly) {
                total += 1;
            }
            return total;
        }

        getFiltersSummaryText() {
            const filters = this.state.filters || DEFAULT_FILTERS;
            if (!filters) {
                return 'No filters applied';
            }
            const tokens = [];
            if (filters.search && filters.search.trim()) {
                tokens.push(`Search "${filters.search.trim()}"`);
            }
            if (Array.isArray(filters.status) && filters.status.length > 0) {
                tokens.push(`Status · ${filters.status.map((value) => titleCase(value)).join(', ')}`);
            }
            if (Array.isArray(filters.tags) && filters.tags.length > 0) {
                tokens.push(`Tags · ${filters.tags.join(', ')}`);
            }
            if (Array.isArray(filters.roles) && filters.roles.length > 0) {
                tokens.push(`Roles · ${filters.roles.join(', ')}`);
            }
            if (filters.includeDescendants === false) {
                tokens.push('Descendants hidden');
            }
            if (filters.showCompleted === false) {
                tokens.push('Completed hidden');
            }
            if (filters.hideBacklog === true) {
                tokens.push('Backlog hidden');
            }
            if (filters.hideArchived === false) {
                tokens.push('Archived shown');
            }
            if (filters.dueRange && filters.dueRange !== 'all') {
                const label = DUE_RANGE_LABELS[filters.dueRange] || `Due · ${titleCase(filters.dueRange)}`;
                tokens.push(label);
            }
            if (filters.statusChangedWithin) {
                const label = STATUS_CHANGED_WITHIN_LABELS[filters.statusChangedWithin] || `Updated within ${filters.statusChangedWithin} days`;
                tokens.push(label);
            }
            if (filters.pinnedOnly) {
                tokens.push('Pinned only');
            }
            if (tokens.length === 0) {
                return 'No filters applied';
            }
            return tokens.join(' • ');
        }

        createSectionToggle({ label, collapsed, summary, badge, accessory, actions = [], onToggle }) {
            const row = el('div', 'task-section-toggle');

            const hasLabel = typeof label === 'string' && label.trim().length > 0;
            const hasSummary = typeof summary === 'string' && summary.trim().length > 0;
            if (hasLabel || hasSummary) {
                const heading = el('div', 'task-section-heading');
                if (hasLabel) {
                    heading.appendChild(el('span', 'task-section-title', label));
                }
                if (hasSummary) {
                    const summaryNode = el('span', 'task-section-summary', summary);
                    summaryNode.title = summary;
                    heading.appendChild(summaryNode);
                }
                row.appendChild(heading);
            }

            if (accessory) {
                const accessoryWrap = el('div', 'task-section-accessory');
                accessoryWrap.appendChild(accessory);
                row.appendChild(accessoryWrap);
            }

            const actionsWrap = el('div', 'task-section-toggle-actions');
            if (badge) {
                actionsWrap.appendChild(el('span', 'task-section-badge', badge));
            }
            actions.forEach((node) => {
                if (node) {
                    actionsWrap.appendChild(node);
                }
            });
            const button = el('button', 'task-collapse-toggle');
            const regionLabel = (typeof label === 'string' && label.trim().length)
                ? label.trim()
                : 'section';
            button.type = 'button';
            button.setAttribute('aria-expanded', (!collapsed).toString());
            button.setAttribute('aria-label', collapsed ? `Expand ${regionLabel}` : `Collapse ${regionLabel}`);
            const icon = el('span', collapsed ? 'bx bx-chevron-down' : 'bx bx-chevron-up');
            button.appendChild(icon);
            button.addEventListener('click', () => {
                if (typeof onToggle === 'function') {
                    onToggle();
                }
            });
            actionsWrap.appendChild(button);
            row.appendChild(actionsWrap);

            return row;
        }

        renderQuickAddModal(focusFirstField = false) {
            if (!this.state.quickAddOpen) {
                this.destroyQuickAddModal();
                return;
            }

            if (!this.quickAddOverlay) {
                this.quickAddOverlay = el('div', 'task-modal-overlay');
                this.quickAddOverlay.addEventListener('click', (event) => {
                    if (event.target === this.quickAddOverlay) {
                        this.toggleQuickAdd(false);
                    }
                });
                this.container.appendChild(this.quickAddOverlay);
            }

            this.quickAddOverlay.innerHTML = '';

            const modal = el('div', 'task-modal');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-label', 'Quick add tasks');
            this.quickAddOverlay.appendChild(modal);

            const header = el('header', 'task-modal-header');
            header.appendChild(el('h2', '', 'Quick Add Tasks'));
            const closeBtn = this.createButton('', 'bx bx-x', 'ghost icon');
            closeBtn.setAttribute('aria-label', 'Close quick add');
            closeBtn.addEventListener('click', () => this.toggleQuickAdd(false));
            header.appendChild(closeBtn);
            modal.appendChild(header);

            const modeSwitch = el('div', 'task-modal-mode');
            const singleBtn = this.createButton('Single', '', this.state.quickAddMode === 'single' ? 'ghost active' : 'ghost');
            singleBtn.addEventListener('click', () => {
                if (this.state.quickAddMode !== 'single') {
                    this.state.quickAddMode = 'single';
                    this.renderQuickAddModal(true);
                }
            });
            modeSwitch.appendChild(singleBtn);

            const multiBtn = this.createButton('Multiple', '', this.state.quickAddMode === 'multi' ? 'ghost active' : 'ghost');
            multiBtn.addEventListener('click', () => {
                if (this.state.quickAddMode !== 'multi') {
                    this.state.quickAddMode = 'multi';
                    this.renderQuickAddModal(true);
                }
            });
            modeSwitch.appendChild(multiBtn);
            modal.appendChild(modeSwitch);

            const body = el('div', 'task-modal-body');
            modal.appendChild(body);

            if (this.state.quickAddMode === 'multi') {
                this.buildQuickAddMulti(body, focusFirstField);
            } else {
                this.buildQuickAddSingle(body, focusFirstField);
            }
        }

        destroyQuickAddModal() {
            if (this.quickAddOverlay) {
                this.quickAddOverlay.remove();
                this.quickAddOverlay = null;
            }
            this.quickAddForm = null;
        }

        buildQuickAddSingle(container, focusFirstField) {
            const form = document.createElement('form');
            form.className = 'task-modal-form';

            const titleField = this.createField('Title');
            const titleInput = el('input', 'task-input');
            titleInput.type = 'text';
            titleInput.placeholder = 'Task summary';
            titleInput.required = true;
            titleField.appendChild(titleInput);
            form.appendChild(titleField);

            const descField = this.createField('Description');
            const descInput = el('textarea', 'task-input');
            descInput.placeholder = 'Optional details…';
            descField.appendChild(descInput);
            form.appendChild(descField);

            const dashboardsField = this.createField('Dashboard');
            const dashboardSelect = el('select', 'task-select');
            const dashboards = this.getSortedDashboards();
            let selectedRoot = this.state.dashboard?.rootNoteId || '';
            dashboards.forEach((dashboard) => {
                const option = document.createElement('option');
                option.textContent = this.formatDashboardLabel(dashboard);
                option.value = dashboard.rootNoteId;
                dashboardSelect.appendChild(option);
            });
            if (!selectedRoot && dashboards.length > 0) {
                selectedRoot = dashboards[0].rootNoteId;
            }
            if (selectedRoot) {
                dashboardSelect.value = selectedRoot;
            }
            dashboardsField.appendChild(dashboardSelect);
            form.appendChild(dashboardsField);

            const metaRow = el('div', 'task-modal-row');
            const statusField = this.createField('Status');
            const statusSelect = el('select', 'task-select');
            STATUS_OPTIONS.filter((option) => option.id !== 'archived').forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.id;
                statusSelect.appendChild(opt);
            });
            statusField.appendChild(statusSelect);
            metaRow.appendChild(statusField);

            const dueField = this.createField('Due date');
            const dueInput = el('input', 'task-input');
            dueInput.type = 'date';
            dueField.appendChild(dueInput);
            metaRow.appendChild(dueField);

            const priorityField = this.createField('Priority');
            const prioritySelect = el('select', 'task-select');
            PRIORITY_OPTIONS.forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.value;
                if (option.value === 2) {
                    opt.selected = true;
                }
                prioritySelect.appendChild(opt);
            });
            priorityField.appendChild(prioritySelect);
            metaRow.appendChild(priorityField);

            form.appendChild(metaRow);

            const tagsField = this.createField('Tags');
            const tagsInput = buildTokenInput({
                values: [],
                suggestions: this.state.availableTags,
                placeholder: 'Add tag'
            });
            tagsField.appendChild(tagsInput.element);
            form.appendChild(tagsField);

            const rolesField = this.createField('Roles');
            const rolesInput = buildTokenInput({
                values: [],
                suggestions: this.state.availableRoles,
                placeholder: 'Add role'
            });
            rolesField.appendChild(rolesInput.element);
            form.appendChild(rolesField);

            const buttonsRow = el('div', 'task-modal-actions');
            const cancelBtn = this.createButton('Cancel', 'bx bx-x', 'ghost');
            cancelBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleQuickAdd(false);
            });
            const saveBtn = this.createButton('Create Task', 'bx bx-check-circle', 'primary');
            buttonsRow.appendChild(cancelBtn);
            buttonsRow.appendChild(saveBtn);
            form.appendChild(buttonsRow);

            const handleSubmit = async () => {
                const title = titleInput.value.trim();
                if (!title) {
                    api.showError('Task title is required.');
                    titleInput.focus();
                    return;
                }
                try {
                    const targetRoot = dashboardSelect.value || this.state.dashboard?.rootNoteId || (dashboards[0]?.rootNoteId ?? null);
                    const priorityValue = Number.parseInt(prioritySelect.value, 10);
                    const createPayload = {
                        title,
                        description: descInput.value.trim(),
                        status: statusSelect.value,
                        dueDate: toIsoDate(dueInput.value),
                        tags: tagsInput.getValues(),
                        roles: rolesInput.getValues(),
                        dashboardRootNoteId: targetRoot,
                        parentNoteId: targetRoot
                    };
                    if (Number.isFinite(priorityValue)) {
                        createPayload.priority = priorityValue;
                    }
                    await this.createTask(createPayload);
                    this.toggleQuickAdd(false);
                } catch (error) {
                    api.showError(`Failed to create task: ${error.message}`);
                }
            };

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleSubmit();
            });
            saveBtn.addEventListener('click', (event) => {
                event.preventDefault();
                handleSubmit();
            });

            container.appendChild(form);
            this.quickAddForm = form;
            if (focusFirstField) {
                setTimeout(() => titleInput.focus({ preventScroll: true }), 30);
            }
        }

        buildQuickAddMulti(container, focusFirstField) {
            const form = document.createElement('form');
            form.className = 'task-modal-form';

            const intro = el('p', 'task-modal-help', 'Enter one task per line. Use "Title" or "Title: description". All tasks will use the same fields below.');
            form.appendChild(intro);

            const tasksField = this.createField('Tasks');
            const tasksInput = el('textarea', 'task-input task-multi-input');
            tasksInput.placeholder = 'Feature planning\nUI polish\nWrite docs: Draft quick guide';
            tasksInput.required = true;
            tasksField.appendChild(tasksInput);
            form.appendChild(tasksField);

            const dashboardsField = this.createField('Dashboard');
            const dashboardSelect = el('select', 'task-select');
            const dashboards = this.getSortedDashboards();
            let selectedRoot = this.state.dashboard?.rootNoteId || '';
            dashboards.forEach((dashboard) => {
                const option = document.createElement('option');
                option.textContent = this.formatDashboardLabel(dashboard);
                option.value = dashboard.rootNoteId;
                dashboardSelect.appendChild(option);
            });
            if (!selectedRoot && dashboards.length > 0) {
                selectedRoot = dashboards[0].rootNoteId;
            }
            if (selectedRoot) {
                dashboardSelect.value = selectedRoot;
            }
            dashboardsField.appendChild(dashboardSelect);
            form.appendChild(dashboardsField);

            const metaRow = el('div', 'task-modal-row');
            const statusField = this.createField('Status');
            const statusSelect = el('select', 'task-select');
            STATUS_OPTIONS.filter((option) => option.id !== 'archived').forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.id;
                statusSelect.appendChild(opt);
            });
            statusField.appendChild(statusSelect);
            metaRow.appendChild(statusField);

            const dueField = this.createField('Due date');
            const dueInput = el('input', 'task-input');
            dueInput.type = 'date';
            dueField.appendChild(dueInput);
            metaRow.appendChild(dueField);

            const priorityField = this.createField('Priority');
            const prioritySelect = el('select', 'task-select');
            PRIORITY_OPTIONS.forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.value;
                if (option.value === 2) {
                    opt.selected = true;
                }
                prioritySelect.appendChild(opt);
            });
            priorityField.appendChild(prioritySelect);
            metaRow.appendChild(priorityField);

            form.appendChild(metaRow);

            const tagsField = this.createField('Tags');
            const tagsInput = buildTokenInput({
                values: [],
                suggestions: this.state.availableTags,
                placeholder: 'Add tag'
            });
            tagsField.appendChild(tagsInput.element);
            form.appendChild(tagsField);

            const rolesField = this.createField('Roles');
            const rolesInput = buildTokenInput({
                values: [],
                suggestions: this.state.availableRoles,
                placeholder: 'Add role'
            });
            rolesField.appendChild(rolesInput.element);
            form.appendChild(rolesField);

            const buttonsRow = el('div', 'task-modal-actions');
            const cancelBtn = this.createButton('Cancel', 'bx bx-x', 'ghost');
            cancelBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleQuickAdd(false);
            });
            const saveBtn = this.createButton('Create Tasks', 'bx bx-check-double', 'primary');
            buttonsRow.appendChild(cancelBtn);
            buttonsRow.appendChild(saveBtn);
            form.appendChild(buttonsRow);

            const handleSubmit = async () => {
                const lines = tasksInput.value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                if (lines.length === 0) {
                    api.showError('Enter at least one task.');
                    tasksInput.focus();
                    return;
                }

                const parsedTasks = lines.map((line) => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > -1) {
                        const title = line.slice(0, colonIndex).trim();
                        const description = line.slice(colonIndex + 1).trim();
                        return {
                            title: title || description,
                            description: description || ''
                        };
                    }
                    return {
                        title: line,
                        description: ''
                    };
                }).filter((item) => item.title && item.title.trim());

                if (parsedTasks.length === 0) {
                    api.showError('Each line must include a task title.');
                    tasksInput.focus();
                    return;
                }

                const parsedPriority = Number.parseInt(prioritySelect.value, 10);
                const sharedPayload = {
                    status: statusSelect.value,
                    dueDate: toIsoDate(dueInput.value),
                    tags: tagsInput.getValues(),
                    roles: rolesInput.getValues()
                };
                if (Number.isFinite(parsedPriority)) {
                    sharedPayload.priority = parsedPriority;
                }
                const targetRoot = dashboardSelect.value || this.state.dashboard?.rootNoteId || (dashboards[0]?.rootNoteId ?? null);
                if (targetRoot) {
                    sharedPayload.dashboardRootNoteId = targetRoot;
                    sharedPayload.parentNoteId = targetRoot;
                }

                try {
                    for (const task of parsedTasks) {
                        await callService('createTask', Object.assign({}, sharedPayload, {
                            title: task.title,
                            description: task.description,
                            dashboardRootNoteId: this.state.dashboard.rootNoteId,
                            parentNoteId: this.state.dashboard.rootNoteId
                        }));
                    }
                    this.toggleQuickAdd(false);
                    await this.refresh();
                } catch (error) {
                    api.showError(`Failed to create tasks: ${error.message}`);
                }
            };

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleSubmit();
            });
            saveBtn.addEventListener('click', (event) => {
                event.preventDefault();
                handleSubmit();
            });

            container.appendChild(form);
            this.quickAddForm = form;
            if (focusFirstField) {
                setTimeout(() => tasksInput.focus({ preventScroll: true }), 30);
            }
        }

        toggleQuickAdd(open, focusFirstField = false) {
            this.state.quickAddOpen = open;
            this.render();
            if (open) {
                this.renderQuickAddModal(focusFirstField);
            } else {
                this.destroyQuickAddModal();
            }
        }

        statusIndexForList(status) {
            const index = LIST_STATUS_ORDER.indexOf(status);
            return index === -1 ? LIST_STATUS_ORDER.length : index;
        }

        ensureSelectionSet() {
            if (!(this.state.selectedTaskIds instanceof Set)) {
                const current = Array.isArray(this.state.selectedTaskIds) ? this.state.selectedTaskIds : [];
                this.state.selectedTaskIds = new Set(current);
            }
            return this.state.selectedTaskIds;
        }

        hasSelection() {
            return this.ensureSelectionSet().size > 0;
        }

        getSelectedTaskIds() {
            return Array.from(this.ensureSelectionSet());
        }

        isTaskSelected(noteId) {
            return this.ensureSelectionSet().has(noteId);
        }

        syncLayoutWithSelection() {
            const hasSelection = this.hasSelection();
            const enteringCompact = hasSelection && !this.state.compactMode;
            const leavingCompact = !hasSelection && this.state.compactMode;

            if (enteringCompact) {
                if (this.savedFiltersExpanded === undefined) {
                    this.savedFiltersExpanded = this.state.filtersExpanded;
                }
                if (this.savedHeaderCollapsed === undefined) {
                    this.savedHeaderCollapsed = this.state.headerCollapsed;
                }
                this.state.compactMode = true;
                this.state.headerCollapsed = true;
                this.state.filtersExpanded = false;
                return;
            }

            if (leavingCompact) {
                this.state.compactMode = false;
                const headerRestore = this.savedHeaderCollapsed;
                this.state.headerCollapsed = typeof headerRestore === 'boolean' ? headerRestore : false;
                if (typeof this.savedFiltersExpanded === 'boolean') {
                    this.state.filtersExpanded = this.savedFiltersExpanded;
                } else if (!this.hasActiveFilters()) {
                    this.state.filtersExpanded = false;
                }
                this.savedFiltersExpanded = undefined;
                this.savedHeaderCollapsed = undefined;
            }
        }

        clearSelection({ render = true } = {}) {
            this.ensureSelectionSet().clear();
            this.lastSelectedTaskId = null;
            this.pendingSelection = null;
            this.syncLayoutWithSelection();
            if (render) {
                this.render();
            }
        }

        selectVisibleTasks(selectAll) {
            const selection = this.ensureSelectionSet();
            const tasks = this.getListSortedTasks();
            if (selectAll) {
                this.pendingSelection = new Set(tasks.map((task) => task.noteId));
                tasks.forEach((task) => selection.add(task.noteId));
                if (tasks.length > 0) {
                    this.lastSelectedTaskId = tasks[tasks.length - 1].noteId;
                }
            } else {
                tasks.forEach((task) => selection.delete(task.noteId));
                if (selection.size === 0) {
                    this.lastSelectedTaskId = null;
                }
            }
            this.syncLayoutWithSelection();
            this.render();
        }

        setTaskSelection(noteId, selected, useRange = false) {
            const selection = this.ensureSelectionSet();
            const tasks = this.getListSortedTasks();
            if (useRange && this.lastSelectedTaskId && this.lastSelectedTaskId !== noteId) {
                const startIndex = tasks.findIndex((task) => task.noteId === this.lastSelectedTaskId);
                const endIndex = tasks.findIndex((task) => task.noteId === noteId);
                if (startIndex !== -1 && endIndex !== -1) {
                    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
                    for (let index = from; index <= to; index += 1) {
                        const currentId = tasks[index].noteId;
                        if (selected) {
                            selection.add(currentId);
                        } else {
                            selection.delete(currentId);
                        }
                    }
                    if (selected) {
                        this.lastSelectedTaskId = noteId;
                    } else if (!selection.has(this.lastSelectedTaskId)) {
                        this.lastSelectedTaskId = selection.size > 0 ? Array.from(selection).pop() : null;
                    }
                    this.syncLayoutWithSelection();
                    this.render();
                    return;
                }
            }

            if (selected) {
                selection.add(noteId);
                this.lastSelectedTaskId = noteId;
                if (!this.pendingSelection) {
                    this.pendingSelection = new Set();
                }
                this.pendingSelection.add(noteId);
            } else {
                selection.delete(noteId);
                if (!selection.has(this.lastSelectedTaskId)) {
                    this.lastSelectedTaskId = selection.size > 0 ? Array.from(selection).pop() : null;
                }
            }
            this.syncLayoutWithSelection();
            this.render();
        }

        reconcileSelectionWithTasks() {
            const tasks = Array.isArray(this.state.tasks) ? this.state.tasks : [];
            const selection = this.ensureSelectionSet();
            if (this.pendingSelection instanceof Set && this.pendingSelection.size > 0) {
                this.pendingSelection.forEach((noteId) => selection.add(noteId));
                this.pendingSelection = null;
            }
            if (selection.size === 0) {
                return;
            }
            const validIds = new Set(tasks.map((task) => task.noteId));
            const nextSelection = new Set();
            selection.forEach((noteId) => {
                if (validIds.has(noteId)) {
                    nextSelection.add(noteId);
                }
            });
            this.state.selectedTaskIds = nextSelection;
            if (!nextSelection.has(this.lastSelectedTaskId)) {
                this.lastSelectedTaskId = nextSelection.size > 0 ? Array.from(nextSelection).pop() : null;
            }
            this.syncLayoutWithSelection();
        }

        getSelectionInsights() {
            if (!this.hasSelection()) {
                return null;
            }
            const tasksById = new Map(this.state.tasks.map((task) => [task.noteId, task]));
            const selection = this.ensureSelectionSet();
            const statusCounts = new Map();
            let earliestDue = null;
            let pinnedCount = 0;

            selection.forEach((noteId) => {
                const task = tasksById.get(noteId);
                if (!task) {
                    return;
                }
                statusCounts.set(task.status, (statusCounts.get(task.status) || 0) + 1);
                if (task.isPinned) {
                    pinnedCount += 1;
                }
                if (task.dueDate) {
                    const due = localDateFromIso(task.dueDate);
                    if (due) {
                        const time = due.getTime();
                        earliestDue = earliestDue === null ? time : Math.min(earliestDue, time);
                    }
                }
            });

            return {
                statuses: statusCounts,
                earliestDue,
                pinned: pinnedCount
            };
        }

        getDefaultListSort() {
            return DEFAULT_LIST_SORT.map((item) => ({ ...item }));
        }

        getActiveListSort() {
            if (!Array.isArray(this.state.listSort) || this.state.listSort.length === 0) {
                this.state.listSort = this.getDefaultListSort();
            }
            return this.state.listSort;
        }

        getSortDescriptor(key) {
            if (!Array.isArray(this.state.listSort)) {
                return null;
            }
            return this.state.listSort.find((item) => item.key === key) || null;
        }

        setListSort(nextSort) {
            if (!Array.isArray(nextSort) || nextSort.length === 0) {
                this.state.listSort = this.getDefaultListSort();
            } else {
                this.state.listSort = nextSort.map((item) => ({ key: item.key, direction: item.direction === 'desc' ? 'desc' : 'asc' }));
            }
        }

        getKanbanSortState() {
            if (!this.state.kanbanSort || !this.state.kanbanSort.key) {
                this.state.kanbanSort = { key: 'priority', direction: 'desc' };
            }
            if (this.state.kanbanSort.key === 'manual') {
                this.state.kanbanSort.direction = 'manual';
                return this.state.kanbanSort;
            }
            if (this.state.kanbanSort.direction !== 'asc' && this.state.kanbanSort.direction !== 'desc') {
                this.state.kanbanSort.direction = this.getDefaultKanbanDirection(this.state.kanbanSort.key);
            }
            return this.state.kanbanSort;
        }

        getDefaultKanbanDirection(key) {
            switch (key) {
                case 'priority':
                    return 'desc';
                case 'due':
                    return 'asc';
                case 'statusChanged':
                    return 'desc';
                case 'title':
                    return 'asc';
                default:
                    return 'desc';
            }
        }

        setKanbanSortKey(key) {
            if (key === 'manual') {
                this.state.kanbanSort = { key: 'manual', direction: 'manual' };
                return;
            }
            const direction = this.getDefaultKanbanDirection(key);
            this.state.kanbanSort = { key, direction };
        }

        toggleKanbanSortDirection() {
            const sort = this.getKanbanSortState();
            if (sort.key === 'manual') {
                return;
            }
            sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
            this.render();
        }

        isKanbanDragEnabled() {
            const sort = this.getKanbanSortState();
            return sort.key === 'priority' || sort.key === 'manual';
        }

        isStatusVisible(statusId) {
            const filters = this.state.filters || {};
            const normalizedStatus = statusId || '';
            if (Array.isArray(filters.status) && filters.status.length > 0 && !filters.status.includes(normalizedStatus)) {
                return false;
            }
            if (normalizedStatus === 'backlog' && filters.hideBacklog) {
                return false;
            }
            if (normalizedStatus === 'archived' && filters.hideArchived) {
                return false;
            }
            return true;
        }

        toggleKanbanEmptyColumns() {
            this.state.kanbanShowEmptyColumns = !this.state.kanbanShowEmptyColumns;
            this.render();
        }

        getDueTimestamp(task) {
            if (!task || !task.dueDate) {
                return null;
            }
            const date = localDateFromIso(task.dueDate);
            return date ? date.getTime() : null;
        }

        getStatusChangedTimestamp(task) {
            if (!task || !task.statusChangedAt) {
                return null;
            }
            const time = Date.parse(task.statusChangedAt);
            return Number.isFinite(time) ? time : null;
        }

        handleListHeaderClick(key, useMulti = false) {
            const defaultDirection = SORT_DEFAULT_DIRECTION[key] || 'asc';
            const defaultSort = this.getDefaultListSort();
            const current = Array.isArray(this.state.listSort) ? this.state.listSort.map((item) => ({ ...item })) : this.getDefaultListSort();
            const existingIndex = current.findIndex((item) => item.key === key);

            if (!useMulti) {
                if (existingIndex === -1) {
                    this.setListSort([{ key, direction: defaultDirection }]);
                } else {
                    const existing = current[existingIndex];
                    if (existing.direction === 'asc') {
                        this.setListSort([{ key, direction: 'desc' }]);
                    } else if (existing.direction === 'desc') {
                        this.setListSort(defaultSort);
                    } else {
                        this.setListSort([{ key, direction: defaultDirection }]);
                    }
                }
            } else {
                if (existingIndex === -1) {
                    current.push({ key, direction: defaultDirection });
                } else {
                    const existing = current[existingIndex];
                    if (existing.direction === 'asc') {
                        current[existingIndex] = { key, direction: 'desc' };
                    } else if (existing.direction === 'desc') {
                        current.splice(existingIndex, 1);
                    } else {
                        current[existingIndex] = { key, direction: defaultDirection };
                    }
                }
                this.setListSort(current);
            }

            this.render();
        }

        compareTasksBySort(a, b, sort, caches) {
            const key = sort.key;
            switch (key) {
                case 'status':
                    return this.statusIndexForList(a.status) - this.statusIndexForList(b.status);
                case 'priority': {
                    const priorityA = Number.isFinite(a.priority) ? a.priority : 0;
                    const priorityB = Number.isFinite(b.priority) ? b.priority : 0;
                    return priorityA - priorityB;
                }
                case 'due': {
                    const dueA = caches.getDueValue(a);
                    const dueB = caches.getDueValue(b);
                    if (dueA !== null && dueB !== null) {
                        return dueA - dueB;
                    }
                    if (dueA !== null) {
                        return -1;
                    }
                    if (dueB !== null) {
                        return 1;
                    }
                    return 0;
                }
                case 'location':
                    return caches.getLocationValue(a).localeCompare(caches.getLocationValue(b), undefined, { sensitivity: 'base', numeric: true });
                case 'title':
                    return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });
                case 'tags':
                    return caches.getTagsValue(a).localeCompare(caches.getTagsValue(b), undefined, { sensitivity: 'base', numeric: true });
                case 'roles':
                    return caches.getRolesValue(a).localeCompare(caches.getRolesValue(b), undefined, { sensitivity: 'base', numeric: true });
                default:
                    return 0;
            }
        }

        getListSortedTasks() {
            const sorts = this.getActiveListSort();
            const locationCache = new Map();
            const tagsCache = new Map();
            const rolesCache = new Map();
            const dueCache = new Map();

            const caches = {
                getLocationValue: (task) => {
                    if (!locationCache.has(task.noteId)) {
                        const location = this.getTaskLocation(task);
                        const normalized = !location || location === '—' ? '' : location.toLowerCase();
                        locationCache.set(task.noteId, normalized);
                    }
                    return locationCache.get(task.noteId);
                },
                getTagsValue: (task) => {
                    if (!tagsCache.has(task.noteId)) {
                        const normalized = Array.isArray(task.tags) && task.tags.length
                            ? task.tags.map((tag) => tag.toLowerCase()).sort().join(' | ')
                            : '';
                        tagsCache.set(task.noteId, normalized);
                    }
                    return tagsCache.get(task.noteId);
                },
                getRolesValue: (task) => {
                    if (!rolesCache.has(task.noteId)) {
                        const normalized = Array.isArray(task.roles) && task.roles.length
                            ? task.roles.map((role) => role.toLowerCase()).sort().join(' | ')
                            : '';
                        rolesCache.set(task.noteId, normalized);
                    }
                    return rolesCache.get(task.noteId);
                },
                getDueValue: (task) => {
                    if (!dueCache.has(task.noteId)) {
                        if (!task.dueDate) {
                            dueCache.set(task.noteId, null);
                        } else {
                            const date = localDateFromIso(task.dueDate);
                            dueCache.set(task.noteId, date ? date.getTime() : null);
                        }
                    }
                    return dueCache.get(task.noteId);
                }
            };

            return this.state.tasks
                .slice()
                .sort((a, b) => {
                    if (a.isPinned !== b.isPinned) {
                        return a.isPinned ? -1 : 1;
                    }

                    for (const sort of sorts) {
                        const base = this.compareTasksBySort(a, b, sort, caches);
                        if (base !== 0) {
                            return sort.direction === 'desc' ? -base : base;
                        }
                    }

                    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
                    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }

                    return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });
                });
        }

        getKanbanColumnTasks(status) {
            const sort = this.getKanbanSortState();
            const directionFactor = sort.direction === 'asc' ? 1 : (sort.direction === 'desc' ? -1 : 1);
            const dragEnabled = this.isKanbanDragEnabled();
            return this.state.tasks
                .filter((task) => task.status === status)
                .slice()
                .sort((a, b) => {
                    if (a.isPinned !== b.isPinned) {
                        return a.isPinned ? -1 : 1;
                    }
                    let comparison = 0;
                    switch (sort.key) {
                        case 'manual':
                            comparison = 0;
                            break;
                        case 'priority': {
                            const priorityA = Number.isFinite(a.priority) ? a.priority : 0;
                            const priorityB = Number.isFinite(b.priority) ? b.priority : 0;
                            comparison = priorityA - priorityB;
                            break;
                        }
                        case 'due': {
                            const dueA = this.getDueTimestamp(a);
                            const dueB = this.getDueTimestamp(b);
                            if (dueA !== null && dueB !== null) {
                                comparison = dueA - dueB;
                            } else if (dueA !== null) {
                                comparison = -1;
                            } else if (dueB !== null) {
                                comparison = 1;
                            } else {
                                comparison = 0;
                            }
                            break;
                        }
                        case 'statusChanged': {
                            const changedA = this.getStatusChangedTimestamp(a);
                            const changedB = this.getStatusChangedTimestamp(b);
                            if (changedA !== null && changedB !== null) {
                                comparison = changedA - changedB;
                            } else if (changedA !== null) {
                                comparison = -1;
                            } else if (changedB !== null) {
                                comparison = 1;
                            } else {
                                comparison = 0;
                            }
                            break;
                        }
                        case 'title':
                            comparison = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });
                            break;
                        default:
                            comparison = 0;
                            break;
                    }
                    if (comparison !== 0) {
                        if (sort.key === 'priority') {
                            // priority values higher should appear first when direction is desc
                            return comparison * (sort.direction === 'desc' ? -1 : 1);
                        }
                        return comparison * directionFactor;
                    }
                    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
                    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
                    if (orderA !== orderB) {
                        if (dragEnabled) {
                            return orderA - orderB;
                        }
                        return (orderA - orderB) * directionFactor;
                    }
                    return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });
                });
        }

        getTaskLocation(task) {
            if (!task || !Array.isArray(task.parentNoteIds) || !Array.isArray(this.state.dashboards)) {
                return '—';
            }
            const parentSet = new Set(task.parentNoteIds);
            const owners = this.state.dashboards
                .filter((dashboard) => parentSet.has(dashboard.rootNoteId))
                .map((dashboard) => dashboard.title || dashboard.noteId)
                .filter(Boolean);
            if (owners.length === 0 && this.state.dashboard) {
                return this.state.dashboard.title || this.state.dashboard.noteId || '—';
            }
            return owners.length > 0 ? owners.join(', ') : '—';
        }

        getTopRoles(limit = 5) {
            const counts = new Map();
            this.state.tasks.forEach((task) => {
                (task.roles || []).forEach((role) => {
                    if (!role) {
                        return;
                    }
                    counts.set(role, (counts.get(role) || 0) + 1);
                });
            });
            return Array.from(counts.entries())
                .sort((a, b) => {
                    if (b[1] !== a[1]) {
                        return b[1] - a[1];
                    }
                    return a[0].localeCompare(b[0]);
                })
                .slice(0, limit);
        }

        getTopTags(limit = 5) {
            const counts = new Map();
            this.state.tasks.forEach((task) => {
                (task.tags || []).forEach((tag) => {
                    if (!tag) {
                        return;
                    }
                    counts.set(tag, (counts.get(tag) || 0) + 1);
                });
            });
            return Array.from(counts.entries())
                .sort((a, b) => {
                    if (b[1] !== a[1]) {
                        return b[1] - a[1];
                    }
                    return a[0].localeCompare(b[0]);
                })
                .slice(0, limit);
        }

        renderHeaderQuickFilters() {
            const wrapper = el('div', 'task-header-quick');

            const dueFilters = this.renderDueQuickFilters();
            if (dueFilters) {
                wrapper.appendChild(dueFilters);
            }

            const pinnedToggle = this.renderPinnedToggleChip();
            if (pinnedToggle) {
                wrapper.appendChild(pinnedToggle);
            }

            const roleFilters = this.renderQuickRoleFilters();
            if (roleFilters) {
                wrapper.appendChild(roleFilters);
            }

            const tagFilters = this.renderQuickTagFilters();
            if (tagFilters) {
                wrapper.appendChild(tagFilters);
            }

            return wrapper.childNodes.length > 0 ? wrapper : null;
        }

        renderDueQuickFilters() {
            const options = [
                { value: 'all', label: 'All' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Next 7 days' },
                { value: 'none', label: 'No due' }
            ];
            const group = el('div', 'task-quick-group');
            group.appendChild(el('span', 'task-quick-label', 'Due:'));
            const chips = el('div', 'task-quick-chips');
            options.forEach((option) => {
                const chip = el('button', 'task-chip task-chip-button');
                chip.type = 'button';
                chip.textContent = option.label;
                if ((this.state.filters.dueRange || 'all') === option.value) {
                    chip.classList.add('active');
                }
                chip.addEventListener('click', () => this.handleDueFilterSelect(option.value));
                chips.appendChild(chip);
            });
            group.appendChild(chips);
            return group;
        }

        handleDueFilterSelect(value) {
            const current = this.state.filters.dueRange || 'all';
            const next = current === value ? 'all' : value;
            this.state.filters.dueRange = next;
            this.clearSelection({ render: false });
            this.refresh();
        }

        renderPinnedToggleChip() {
            const group = el('div', 'task-quick-group');
            group.appendChild(el('span', 'task-quick-label', 'Focus:'));
            const chips = el('div', 'task-quick-chips');
            const chip = el('button', 'task-chip task-chip-button');
            chip.type = 'button';
            chip.textContent = 'Pinned only';
            if (this.state.filters.pinnedOnly) {
                chip.classList.add('active');
            }
            chip.addEventListener('click', () => this.togglePinnedOnly());
            chips.appendChild(chip);
            group.appendChild(chips);
            return group;
        }

        togglePinnedOnly(forceValue = undefined) {
            const next = forceValue !== undefined ? forceValue : !this.state.filters.pinnedOnly;
            this.state.filters.pinnedOnly = next;
            this.clearSelection({ render: false });
            this.refresh();
        }

        renderQuickRoleFilters() {
            const topRoles = this.getTopRoles();
            if (!topRoles.length) {
                return null;
            }
            const group = el('div', 'task-quick-group');
            group.appendChild(el('span', 'task-quick-label', 'Roles:'));
            const chips = el('div', 'task-quick-chips');
            topRoles.forEach(([role, count]) => {
                const chip = el('button', 'task-chip task-chip-button');
                chip.type = 'button';
                chip.textContent = `${role} (${count})`;
                if (this.state.filters.roles.includes(role)) {
                    chip.classList.add('active');
                }
                chip.addEventListener('click', () => this.toggleFilterValue('roles', role));
                chips.appendChild(chip);
            });
            group.appendChild(chips);
            return group;
        }

        renderQuickTagFilters() {
            const topTags = this.getTopTags();
            if (!topTags.length) {
                return null;
            }
            const group = el('div', 'task-quick-group');
            group.appendChild(el('span', 'task-quick-label', 'Tags:'));
            const chips = el('div', 'task-quick-chips');
            topTags.forEach(([tag, count]) => {
                const chip = el('button', 'task-chip task-chip-button');
                chip.type = 'button';
                chip.textContent = `${tag} (${count})`;
                if (this.state.filters.tags.includes(tag)) {
                    chip.classList.add('active');
                }
                chip.addEventListener('click', () => this.toggleFilterValue('tags', tag));
                chips.appendChild(chip);
            });
            group.appendChild(chips);
            return group;
        }

        renderPinButton(task) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'task-icon-btn';
            const iconClass = task.isPinned ? 'bx bxs-pin' : 'bx bx-pin';
            const icon = el('span', iconClass);
            button.appendChild(icon);
            button.title = task.isPinned ? 'Unpin task' : 'Pin task';
            if (task.isPinned) {
                button.classList.add('is-active');
            }
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await this.togglePinned(task);
            });
            return button;
        }

        async togglePinned(task) {
            try {
                await callService('updatePinned', {
                    noteId: task.noteId,
                    isPinned: !task.isPinned
                });
                await this.refresh();
            } catch (error) {
                api.showError(`Failed to update pin: ${error.message}`);
            }
        }

        async bulkUpdateSelected(updates, options = {}) {
            const noteIds = this.getSelectedTaskIds();
            if (!noteIds.length) {
                return;
            }
            try {
                this.pendingSelection = new Set(noteIds);
                const response = await callService('bulkUpdateTasks', {
                    noteIds,
                    updates
                });
                const updatedCount = Array.isArray(response?.updated) ? response.updated.length : noteIds.length;
                await this.refresh();
                if (options.silent !== true) {
                    api.showMessage(`Updated ${updatedCount} task${updatedCount === 1 ? '' : 's'}.`);
                }
            } catch (error) {
                this.pendingSelection = null;
                api.showError(`Failed to update tasks: ${error.message}`);
            }
        }

        renderDashboardLocations(task) {
            if (!task || !Array.isArray(task.parentNoteIds)) {
                return this.createEmpty('No linked dashboards');
            }
            const parentSet = new Set(task.parentNoteIds);
            const owners = (this.state.dashboards || []).filter((dashboard) => parentSet.has(dashboard.rootNoteId));
            if (owners.length === 0) {
                return this.createEmpty('No linked dashboards');
            }
            const chips = el('div', 'task-location-chips');
            owners.forEach((dashboard) => {
                const chip = el('button', 'task-chip task-chip-button');
                chip.type = 'button';
                chip.textContent = dashboard.title || dashboard.noteId;
                chip.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this.refresh({ dashboardNoteId: dashboard.noteId });
                });
                chips.appendChild(chip);
            });
            return chips;
        }

        renderStatusTimeline(task) {
            const history = Array.isArray(task.statusHistory) ? task.statusHistory.slice().reverse() : [];
            if (!history.length) {
                return this.createEmpty('No status changes yet');
            }
            const list = el('ul', 'task-status-timeline');
            history.forEach((entry) => {
                const status = titleCase(entry.status || '');
                const when = entry.changedAt || entry.changed_at || entry.date;
                const relative = formatRelativeTime(when);
                const item = document.createElement('li');
                const label = el('span', 'task-status-timeline-status', status || 'Unknown');
                const time = document.createElement('time');
                time.dateTime = when || '';
                time.textContent = relative || formatDateTime(when);
                time.title = formatDateTime(when);
                item.appendChild(label);
                item.appendChild(time);
                list.appendChild(item);
            });
            return list;
        }

        compareDashboardPaths(a, b) {
            const pathA = Array.isArray(a?.treePath) ? a.treePath : [];
            const pathB = Array.isArray(b?.treePath) ? b.treePath : [];
            const idsA = Array.isArray(a?.treePathIds) ? a.treePathIds : [];
            const idsB = Array.isArray(b?.treePathIds) ? b.treePathIds : [];
            const maxLength = Math.max(pathA.length, pathB.length);
            for (let index = 0; index < maxLength; index += 1) {
                const segA = pathA[index];
                const segB = pathB[index];
                if (segA === undefined && segB === undefined) {
                    break;
                }
                if (segA === undefined) {
                    return -1;
                }
                if (segB === undefined) {
                    return 1;
                }
                const numA = Number(segA);
                const numB = Number(segB);
                if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
                    return numA - numB;
                }
                const strA = String(segA);
                const strB = String(segB);
                const diff = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
                if (diff !== 0) {
                    return diff;
                }
                const idA = idsA[index] || '';
                const idB = idsB[index] || '';
                const idDiff = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
                if (idDiff !== 0) {
                    return idDiff;
                }
            }
            const depthA = Number.isFinite(Number(a?.treeDepth)) ? Number(a.treeDepth) : 0;
            const depthB = Number.isFinite(Number(b?.treeDepth)) ? Number(b.treeDepth) : 0;
            if (depthA !== depthB) {
                return depthA - depthB;
            }
            const titleA = a?.title || '';
            const titleB = b?.title || '';
            const titleDiff = titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
            if (titleDiff !== 0) {
                return titleDiff;
            }
            return (a?.noteId || '').localeCompare(b?.noteId || '');
        }

        getSortedDashboards() {
            if (!Array.isArray(this.state.dashboards)) {
                return [];
            }
            return [...this.state.dashboards].sort((a, b) => this.compareDashboardPaths(a, b));
        }

        formatDashboardLabel(dashboard) {
            if (!dashboard) {
                return '';
            }
            const depth = Math.max(0, dashboard.treeDepth || 0);
            const spaces = String.fromCharCode(160).repeat(depth * 2);
            const prefix = depth > 0 ? `${spaces}› ` : '';
            const title = dashboard.title || dashboard.noteId;
            return `${prefix}${title}`;
        }

        renderListHeaderCell(column, primarySort) {
            const th = document.createElement('th');
            if (!column.sortable) {
                th.textContent = column.label;
                return th;
            }

            const descriptor = this.getSortDescriptor(column.key);
            const sortIndex = Array.isArray(this.state.listSort)
                ? this.state.listSort.findIndex((item) => item.key === column.key)
                : -1;
            const isActive = descriptor && sortIndex !== -1;
            if (isActive) {
                if (primarySort && primarySort.key === column.key) {
                    th.setAttribute('aria-sort', descriptor.direction === 'desc' ? 'descending' : 'ascending');
                } else {
                    th.setAttribute('aria-sort', 'other');
                }
            } else {
                th.setAttribute('aria-sort', 'none');
            }

            const button = el('button', 'task-sort-button');
            button.type = 'button';
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            button.title = `Sort by ${column.label}. Click to cycle direction. Shift+Click (or Ctrl/Cmd+Click) to add/remove as a secondary sort.`;

            const label = el('span', 'task-sort-label', column.label);
            button.appendChild(label);

            const iconClass = isActive
                ? (descriptor.direction === 'desc' ? 'bx bx-chevron-down' : 'bx bx-chevron-up')
                : 'bx bx-sort-alt-2';
            const icon = el('span', `task-sort-icon ${iconClass}`);
            button.appendChild(icon);

            if (isActive && sortIndex > -1) {
                const badge = el('span', 'task-sort-rank', String(sortIndex + 1));
                button.appendChild(badge);
            }

            if (isActive) {
                button.classList.add('is-active');
            }

            button.addEventListener('click', (event) => {
                event.preventDefault();
                const multi = event.shiftKey || event.metaKey || event.ctrlKey;
                this.handleListHeaderClick(column.key, multi);
            });

            th.appendChild(button);
            return th;
        }

        renderMainView() {
            const view = this.state.currentView || this.state.dashboard.view || 'list';
            if (view === 'kanban') {
                return this.renderKanban();
            }
            if (view === 'calendar') {
                return this.renderCalendar();
            }
            if (view === 'overview') {
                return this.renderOverview();
            }
            return this.renderList();
        }

        renderList() {
            const section = el('section', 'task-section-card');
            const toolbar = this.renderActionToolbar();
            if (toolbar) {
                section.appendChild(toolbar);
            }
            const table = el('table', 'task-table');
            const tasks = this.getListSortedTasks();
            const selection = this.ensureSelectionSet();

            const visibleSelectedCount = tasks.filter((task) => selection.has(task.noteId)).length;

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const sortOrder = this.getActiveListSort();
            const primarySort = sortOrder.length > 0 ? sortOrder[0] : null;
            const selectTh = document.createElement('th');
            selectTh.className = 'task-table-select-header';
            const masterCheckbox = document.createElement('input');
            masterCheckbox.type = 'checkbox';
            masterCheckbox.className = 'task-select-checkbox';
            masterCheckbox.checked = tasks.length > 0 && visibleSelectedCount === tasks.length;
            masterCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < tasks.length;
            masterCheckbox.setAttribute('aria-label', 'Select all visible tasks');
            masterCheckbox.addEventListener('click', (event) => {
                event.stopPropagation();
                this.selectVisibleTasks(event.target.checked);
            });
            selectTh.appendChild(masterCheckbox);
            headerRow.appendChild(selectTh);
            const columns = [
                { key: 'status', label: 'Status', sortable: true },
                { key: 'title', label: 'Title', sortable: true },
                { key: 'due', label: 'Due', sortable: true },
                { key: 'priority', label: 'Priority', sortable: true },
                { key: 'tags', label: 'Tags', sortable: true },
                { key: 'roles', label: 'Roles', sortable: true },
                { key: 'location', label: 'Location', sortable: true }
            ];
            columns.forEach((column) => {
                headerRow.appendChild(this.renderListHeaderCell(column, primarySort));
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            if (tasks.length === 0) {
                const emptyRow = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = columns.length + 1;
                cell.appendChild(this.createEmpty('No tasks match the current filters.'));
                emptyRow.appendChild(cell);
                tbody.appendChild(emptyRow);
            } else {
                tasks.forEach((task) => {
                    const row = document.createElement('tr');
                    row.classList.add('task-row', `status-${task.status}`);
                    row.dataset.status = task.status;
                    if (task.priority) {
                        row.classList.add(`priority-${task.priority}`);
                        row.dataset.priority = String(task.priority);
                    }
                    row.dataset.noteId = task.noteId;
                    if (this.isTaskSelected(task.noteId)) {
                        row.classList.add('is-selected');
                    }
                    row.addEventListener('click', (event) => {
                        if (event.target.closest('.task-table-select-cell')) {
                            return;
                        }
                        if (event.shiftKey || event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            const shouldSelect = !this.isTaskSelected(task.noteId);
                            this.setTaskSelection(task.noteId, shouldSelect, event.shiftKey);
                            return;
                        }
                        this.openTaskDetail(task.noteId);
                    });

                    const selectCell = document.createElement('td');
                    selectCell.className = 'task-table-select-cell';
                    const selectBox = document.createElement('input');
                    selectBox.type = 'checkbox';
                    selectBox.className = 'task-select-checkbox';
                    selectBox.checked = this.isTaskSelected(task.noteId);
                    selectBox.setAttribute('aria-label', `Select task ${task.title}`);
                    selectBox.addEventListener('click', (event) => {
                        event.stopPropagation();
                        this.setTaskSelection(task.noteId, event.target.checked, event.shiftKey);
                    });
                    selectCell.appendChild(selectBox);
                    row.appendChild(selectCell);

                    const statusCell = document.createElement('td');
                    statusCell.appendChild(createStatusPill(task.status));
                    const statusAge = formatRelativeTime(task.statusChangedAt);
                    if (statusAge) {
                        const ageChip = el('span', 'task-status-age', statusAge);
                        ageChip.title = formatDateTime(task.statusChangedAt);
                        statusCell.appendChild(ageChip);
                    }
                    row.appendChild(statusCell);

                    const titleCell = document.createElement('td');
                    const titleWrap = el('div', 'task-title-wrap');
                    const titleText = el('span', 'task-title-text', task.title);
                    titleWrap.appendChild(titleText);
                    const titleActions = el('div', 'task-row-actions');
                    titleActions.appendChild(this.renderPinButton(task));
                    titleWrap.appendChild(titleActions);
                    titleCell.appendChild(titleWrap);
                    row.appendChild(titleCell);

                    const dueCell = document.createElement('td');
                    const due = formatDue(task.dueDate);
                    if (due) {
                        const dueSpan = el('span', 'task-due', due.label);
                        dueSpan.title = due.helper;
                        if (due.variant) {
                            dueSpan.classList.add(due.variant);
                        }
                        dueCell.appendChild(dueSpan);
                    }
                    row.appendChild(dueCell);

                    const priorityCell = document.createElement('td');
                    priorityCell.textContent = task.priorityLabel;
                    row.appendChild(priorityCell);

                    const tagsCell = document.createElement('td');
                    const tagsWrap = el('div', 'task-tags');
                    task.tags.forEach((tag) => tagsWrap.appendChild(createTagChip(tag)));
                    tagsCell.appendChild(tagsWrap);
                    row.appendChild(tagsCell);

                    const rolesCell = document.createElement('td');
                    const roleWrap = el('div', 'task-tags');
                    (task.roles || []).forEach((role) => roleWrap.appendChild(createTagChip(role, 'task-role-chip')));
                    rolesCell.appendChild(roleWrap);
                    row.appendChild(rolesCell);

                    const locationCell = document.createElement('td');
                    locationCell.textContent = this.getTaskLocation(task);
                    row.appendChild(locationCell);

                    tbody.appendChild(row);
                });
            }

            table.appendChild(tbody);
            section.appendChild(table);
            return section;
        }

        renderKanbanControls(context) {
            const controls = el('div', 'task-kanban-controls');
            const sort = this.getKanbanSortState();
            const dragEnabled = this.isKanbanDragEnabled();

            const leftGroup = el('div', 'task-kanban-controls-left');
            const rightGroup = el('div', 'task-kanban-controls-right');

            const sortLabel = el('span', 'task-kanban-controls-label', 'Sort by');
            const sortSelect = el('select', 'task-select task-kanban-sort-select');
            const sortOptions = [
                { key: 'priority', label: 'Priority' },
                { key: 'due', label: 'Due date' },
                { key: 'statusChanged', label: 'Last changed' },
                { key: 'title', label: 'Title' },
                { key: 'manual', label: 'Manual (drag order only)' }
            ];
            sortOptions.forEach((option) => {
                const opt = document.createElement('option');
                opt.value = option.key;
                opt.textContent = option.label;
                if (sort.key === option.key) {
                    opt.selected = true;
                }
                sortSelect.appendChild(opt);
            });
            sortSelect.addEventListener('change', (event) => {
                const value = event.target.value;
                this.setKanbanSortKey(value);
                this.render();
            });

            const directionBtn = this.createButton('', sort.direction === 'asc' ? 'bx bx-sort-up' : 'bx bx-sort-down', 'ghost icon');
            directionBtn.title = sort.key === 'manual'
                ? 'Sorting is manual; drag tasks to reorder.'
                : `Toggle sort direction (${sort.direction === 'asc' ? 'ascending' : 'descending'})`;
            directionBtn.disabled = sort.key === 'manual';
            directionBtn.addEventListener('click', () => this.toggleKanbanSortDirection());

            leftGroup.appendChild(sortLabel);
            leftGroup.appendChild(sortSelect);
            leftGroup.appendChild(directionBtn);

            const showEmptyToggle = this.createButton('', 'bx bx-grid-horizontal', 'ghost');
            showEmptyToggle.classList.add('task-kanban-empty-toggle');
            const emptyLabelText = this.state.kanbanShowEmptyColumns ? 'Hide empty columns' : 'Show empty columns';
            const emptyLabel = el('span', '', emptyLabelText);
            showEmptyToggle.appendChild(emptyLabel);
            if (this.state.kanbanShowEmptyColumns) {
                showEmptyToggle.classList.add('is-active');
            }
            showEmptyToggle.addEventListener('click', () => this.toggleKanbanEmptyColumns());
            rightGroup.appendChild(showEmptyToggle);

            if (!dragEnabled) {
                const notice = el('span', 'task-kanban-info-pill', 'Drag reorder disabled while custom sort active');
                rightGroup.appendChild(notice);
            }

            if (context.hiddenStatuses.length > 0) {
                const hiddenLabel = el('span', 'task-kanban-info-pill', `Hidden: ${context.hiddenStatuses.map((status) => status.label || titleCase(status.id)).join(', ')}`);
                rightGroup.appendChild(hiddenLabel);
            }

            if (context.collapsedStatuses && context.collapsedStatuses.length > 0) {
                const collapsedLabel = el('span', 'task-kanban-info-pill', `Collapsed: ${context.collapsedStatuses.map((status) => status.label || titleCase(status.id)).join(', ')}`);
                rightGroup.appendChild(collapsedLabel);
            }

            controls.appendChild(leftGroup);
            controls.appendChild(rightGroup);
            return controls;
        }

        renderKanban() {
            const section = el('section', 'task-section-card');
            const toolbar = this.renderActionToolbar();
            if (toolbar) {
                section.appendChild(toolbar);
            }
            const baseColumns = (this.state.dashboard.kanban && Array.isArray(this.state.dashboard.kanban.columns))
                ? this.state.dashboard.kanban.columns
                : STATUS_OPTIONS;

            const dragEnabled = this.isKanbanDragEnabled();
            const showEmptyColumns = this.state.kanbanShowEmptyColumns === true;
            const tasksByStatus = new Map();

            const hiddenStatuses = [];
            const collapsedStatuses = [];
            const visibleCandidates = [];

            baseColumns.forEach((column) => {
                const isVisible = this.isStatusVisible(column.id);
                const columnTasks = this.getKanbanColumnTasks(column.id);
                tasksByStatus.set(column.id, columnTasks);
                if (!isVisible) {
                    hiddenStatuses.push(column);
                } else {
                    if (showEmptyColumns || columnTasks.length > 0) {
                        visibleCandidates.push(column);
                    } else {
                        collapsedStatuses.push(column);
                    }
                }
            });

            const context = {
                hiddenStatuses,
                collapsedStatuses,
                visibleCount: visibleCandidates.length
            };

            section.appendChild(this.renderKanbanControls(context));

            if (visibleCandidates.length === 0) {
                const empty = this.createEmpty('No columns to display with the current filters. Adjust filters or enable empty columns to see more.');
                empty.classList.add('task-kanban-empty-board');
                section.appendChild(empty);
                return section;
            }

            const board = el('div', 'task-kanban');

            visibleCandidates.forEach((column) => {
                const columnTasks = tasksByStatus.get(column.id) || [];
                const columnEl = el('section', 'task-kanban-column');
                columnEl.dataset.status = column.id;

                if (dragEnabled) {
                    columnEl.addEventListener('dragover', (event) => this.handleColumnDragOver(event, column.id));
                    columnEl.addEventListener('dragleave', (event) => this.handleColumnDragLeave(event.currentTarget));
                    columnEl.addEventListener('drop', (event) => this.handleDrop(event, column.id));
                }

                const header = el('div', 'task-kanban-column-header');
                const name = el('span', 'task-status-label', column.label || titleCase(column.id));
                header.appendChild(name);
                const countBadge = el('span', 'task-kanban-count', formatNumber(columnTasks.length));
                header.appendChild(countBadge);
                columnEl.appendChild(header);

                if (columnTasks.length === 0) {
                    const placeholder = this.createEmpty('No tasks');
                    placeholder.classList.add('task-kanban-empty');
                    columnEl.appendChild(placeholder);
                } else {
                    columnTasks.forEach((task) => {
                        const card = el('article', 'task-card');
                        card.dataset.noteId = task.noteId;
                        card.dataset.status = task.status;
                        card.dataset.priority = task.priority;
                        card.classList.add(`status-${task.status}`);
                        if (task.priority) {
                            card.classList.add(`priority-${task.priority}`);
                        }

                        const location = this.getTaskLocation(task);
                        const statusAge = formatRelativeTime(task.statusChangedAt);
                        const due = formatDue(task.dueDate);
                        const taskRoles = Array.isArray(task.roles) ? task.roles : [];
                        const taskTags = Array.isArray(task.tags) ? task.tags : [];
                        const tooltipLines = [task.title];
                        if (location && location !== '—') {
                            tooltipLines.push(`Location: ${location}`);
                        }
                        tooltipLines.push(`Status: ${titleCase(task.status)}`);
                        if (due) {
                            tooltipLines.push(`Due: ${due.helper}`);
                        }
                        if (statusAge) {
                            tooltipLines.push(`Updated: ${formatDateTime(task.statusChangedAt)}`);
                        }
                        if (taskRoles.length > 0) {
                            tooltipLines.push(`Roles: ${taskRoles.join(', ')}`);
                        }
                        if (taskTags.length > 0) {
                            tooltipLines.push(`Tags: ${taskTags.join(', ')}`);
                        }
                        card.title = tooltipLines.join('\n');

                        const cardActions = el('div', 'task-card-actions');
                        cardActions.appendChild(this.renderPinButton(task));
                        card.appendChild(cardActions);

                        if (dragEnabled) {
                            card.draggable = true;
                            card.classList.add('is-draggable');
                            card.addEventListener('dragstart', (event) => this.handleDragStart(event, task));
                            card.addEventListener('dragover', (event) => this.handleCardDragOver(event, column.id, task.noteId));
                            card.addEventListener('dragenter', (event) => this.handleCardDragOver(event, column.id, task.noteId));
                            card.addEventListener('dragleave', () => this.handleCardDragLeave(card));
                            card.addEventListener('dragend', () => this.handleDragEnd());
                        }

                        card.addEventListener('click', () => this.openTaskDetail(task.noteId));

                        const titleLine = el('div', 'task-card-title');
                        titleLine.textContent = task.title;
                        card.appendChild(titleLine);

                        const meta = el('div', 'task-card-meta');
                        if (due) {
                            const dueBadge = el('span', 'task-due', due.label);
                            dueBadge.title = due.helper;
                            if (due.variant) {
                                dueBadge.classList.add(due.variant);
                            }
                            meta.appendChild(dueBadge);
                        }
                        if (task.priorityLabel) {
                            meta.appendChild(el('span', 'task-card-priority', task.priorityLabel));
                        }
                        if (statusAge) {
                            const ageChip = el('span', 'task-status-age', statusAge);
                            ageChip.title = formatDateTime(task.statusChangedAt);
                            meta.appendChild(ageChip);
                        }
                        card.appendChild(meta);

                        if (location && location !== '—') {
                            const subline = el('div', 'task-card-subtitle');
                            const locationSpan = el('span', 'task-card-location');
                            const locationIcon = el('span', 'bx bx-category');
                            locationSpan.appendChild(locationIcon);
                            locationSpan.appendChild(el('span', '', location));
                            subline.appendChild(locationSpan);
                            card.appendChild(subline);
                        }

                        if (taskRoles.length > 0) {
                            const rolesLine = el('div', 'task-card-roles');
                            taskRoles.slice(0, 3).forEach((role) => {
                                rolesLine.appendChild(createTagChip(role, 'task-role-chip'));
                            });
                            if (taskRoles.length > 3) {
                                rolesLine.appendChild(el('span', 'task-role-chip task-role-chip-more', `+${taskRoles.length - 3}`));
                            }
                            card.appendChild(rolesLine);
                        }

                        if (taskTags.length > 0) {
                            const tags = el('div', 'task-tags');
                            taskTags.slice(0, 4).forEach((tag) => tags.appendChild(createTagChip(tag)));
                            if (taskTags.length > 4) {
                                tags.appendChild(el('span', 'task-tag task-tag-more', `+${taskTags.length - 4}`));
                            }
                            card.appendChild(tags);
                        }

                        columnEl.appendChild(card);
                    });
                }

                board.appendChild(columnEl);
            });

            section.appendChild(board);
            return section;
        }

        handleDragStart(event, task) {
            this.dragState = { noteId: task.noteId, status: task.status, priority: task.priority };
            this.dropState = { status: task.status, beforeNoteId: null };
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('application/json', JSON.stringify({
                    noteId: task.noteId,
                    status: task.status,
                    priority: task.priority
                }));
            }
        }

        async handleDrop(event, newStatus) {
            event.preventDefault();
            this.clearDragIndicators();
            const data = event.dataTransfer.getData('application/json');
            if (!data) {
                this.handleDragEnd();
                return;
            }
            try {
                const parsed = JSON.parse(data);
                const noteId = parsed.noteId;
                if (!noteId) {
                    return;
                }
                const sourceStatus = parsed.status;
                const beforeNoteId = (this.dropState && this.dropState.status === newStatus) ? this.dropState.beforeNoteId : null;
                if (sourceStatus !== newStatus) {
                    await callService('moveTask', {
                        noteId,
                        status: newStatus
                    });
                }
                await this.updateColumnOrderAfterDrop(newStatus, noteId, beforeNoteId);
                await this.refresh();
            } catch (error) {
                api.showError(`Unable to move task: ${error.message}`);
            } finally {
                this.handleDragEnd();
            }
        }

        handleColumnDragOver(event, status) {
            event.preventDefault();
            const column = event.currentTarget;
            column.classList.add('drag-over');
            if (this.root) {
                this.root.querySelectorAll('.drag-before').forEach((node) => node.classList.remove('drag-before'));
            }
            this.dropState = { status, beforeNoteId: null };
        }

        handleColumnDragLeave(column) {
            if (column) {
                column.classList.remove('drag-over');
            }
        }

        handleCardDragOver(event, status, beforeNoteId) {
            event.preventDefault();
            const card = event.currentTarget;
            if (this.root) {
                this.root.querySelectorAll('.drag-before').forEach((node) => {
                    if (node !== card) {
                        node.classList.remove('drag-before');
                    }
                });
            }
            card.classList.add('drag-before');
            this.dropState = { status, beforeNoteId };
        }

        handleCardDragLeave(card) {
            if (card) {
                card.classList.remove('drag-before');
            }
        }

        clearDragIndicators() {
            if (!this.root) {
                return;
            }
            this.root.querySelectorAll('.drag-over').forEach((node) => node.classList.remove('drag-over'));
            this.root.querySelectorAll('.drag-before').forEach((node) => node.classList.remove('drag-before'));
        }

        handleDragEnd() {
            this.clearDragIndicators();
            this.dragState = null;
            this.dropState = null;
        }

        async updateColumnOrderAfterDrop(status, movingNoteId, beforeNoteId) {
            const movingTask = this.state.tasks.find((task) => task.noteId === movingNoteId);
            if (!movingTask) {
                return;
            }
            const priority = movingTask.priority || 0;
            const peers = this.state.tasks
                .filter((task) => task.status === status && task.priority === priority && task.noteId !== movingNoteId)
                .map((task) => ({ noteId: task.noteId }));

            let insertIndex = peers.length;
            if (beforeNoteId) {
                const beforeTask = this.state.tasks.find((task) => task.noteId === beforeNoteId);
                if (beforeTask && beforeTask.priority === priority && beforeTask.status === status) {
                    insertIndex = peers.findIndex((task) => task.noteId === beforeNoteId);
                    if (insertIndex === -1) {
                        insertIndex = peers.length;
                    }
                } else if (beforeTask && beforeTask.priority > priority) {
                    insertIndex = 0;
                }
            }

            peers.splice(insertIndex, 0, { noteId: movingNoteId });

            const payload = peers.map((entry, index) => ({ noteId: entry.noteId, order: index + 1 }));
            if (payload.length === 0) {
                return;
            }
            await callService('updateTaskOrders', { tasks: payload });
        }

        async archiveCompleted() {
            if (!this.state.dashboard) {
                return;
            }
            const hasDone = this.state.tasks.some((task) => task.status === 'done');
            if (!hasDone) {
                return;
            }
            const confirmed = await api.showConfirmDialog('Archive all done tasks?');
            if (!confirmed) {
                return;
            }
            try {
                const result = await callService('archiveCompleted', {
                    rootNoteId: this.state.dashboard.rootNoteId,
                    depth: this.state.dashboard.depth
                });
                const count = result && typeof result.archived === 'number' ? result.archived : 0;
                await this.refresh();
                if (count > 0) {
                    api.showMessage(`${count} task${count === 1 ? '' : 's'} archived.`);
                } else {
                    api.showMessage('No completed tasks to archive.');
                }
            } catch (error) {
                api.showError(`Failed to archive tasks: ${error.message}`);
            }
        }

        renderCalendar() {
            const section = el('section', 'task-section-card task-calendar');
            const globalToolbar = this.renderActionToolbar();
            if (globalToolbar) {
                section.appendChild(globalToolbar);
            }
            const toolbar = el('div', 'task-calendar-toolbar');

            const prevBtn = this.createButton('', 'bx bx-chevron-left');
            prevBtn.addEventListener('click', () => {
                this.state.calendarMonthOffset -= 1;
                this.render();
            });

            const todayBtn = this.createButton('Today', 'bx bx-target-lock');
            todayBtn.addEventListener('click', () => {
                this.state.calendarMonthOffset = 0;
                this.render();
            });

            const nextBtn = this.createButton('', 'bx bx-chevron-right');
            nextBtn.addEventListener('click', () => {
                this.state.calendarMonthOffset += 1;
                this.render();
            });

            const base = new Date();
            base.setMonth(base.getMonth() + this.state.calendarMonthOffset);
            const monthLabel = el('strong', '', base.toLocaleString(undefined, { month: 'long', year: 'numeric' }));

            toolbar.appendChild(prevBtn);
            toolbar.appendChild(todayBtn);
            toolbar.appendChild(nextBtn);
            toolbar.appendChild(monthLabel);
            section.appendChild(toolbar);

            const heading = el('div', 'task-calendar-heading');
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => heading.appendChild(el('span', '', day)));
            section.appendChild(heading);

            const grid = el('div', 'task-calendar-grid');
            const start = new Date(base.getFullYear(), base.getMonth(), 1);
            const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
            const offset = start.getDay();
            for (let i = 0; i < offset; i += 1) {
                grid.appendChild(el('div', 'task-calendar-cell task-calendar-empty'));
            }

            for (let day = 1; day <= end.getDate(); day += 1) {
                const date = new Date(base.getFullYear(), base.getMonth(), day);
                const cell = el('div', 'task-calendar-cell');
                if (this.isSameDay(date, new Date()) && this.state.calendarMonthOffset === 0) {
                    cell.classList.add('is-today');
                }
                const dateLabel = el('div', 'task-calendar-date', day.toString());
                cell.appendChild(dateLabel);

                const tasks = this.state.tasks.filter((task) => {
                    if (!task.dueDate) {
                        return false;
                    }
                    const dueLocal = localDateFromIso(task.dueDate);
                    return dueLocal ? this.isSameDay(dueLocal, date) : false;
                });
                tasks.sort((a, b) => a.priority - b.priority);
                tasks.forEach((task, index) => {
                    if (index > 4) {
                        return;
                    }
                    const badge = el('div', 'task-calendar-task', task.title);
                    badge.title = `Priority ${task.priorityLabel}\n${task.tags.join(', ')}`;
                    badge.addEventListener('click', () => this.openTaskDetail(task.noteId));
                    cell.appendChild(badge);
                });

                if (tasks.length > 5) {
                    cell.appendChild(el('div', 'task-calendar-task', `+${tasks.length - 5} more`));
                }

                grid.appendChild(cell);
            }

            section.appendChild(grid);
            return section;
        }

        isSameDay(a, b) {
            return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        }

        renderOverview() {
            const section = el('section', 'task-section-card');
            const toolbar = this.renderActionToolbar();
            if (toolbar) {
                section.appendChild(toolbar);
            }
            if (!this.state.insights) {
                section.appendChild(this.createEmpty('No insights available yet.'));
                return section;
            }

            const grid = el('div', 'task-insights-grid');

            const addMetricCard = (title, value, variant) => {
                const card = el('div', 'task-insight-card');
                if (variant) {
                    card.dataset.variant = variant;
                }
                card.appendChild(el('h3', '', title));
                card.appendChild(el('strong', '', formatNumber(value)));
                grid.appendChild(card);
            };

            addMetricCard('Total tasks', this.state.insights.total);
            addMetricCard('Completed', this.state.insights.completed, 'success');
            addMetricCard('Overdue', this.state.insights.overdue, this.state.insights.overdue ? 'danger' : undefined);
            addMetricCard('Due soon (7 days)', this.state.insights.dueSoon, this.state.insights.dueSoon ? 'warning' : undefined);

            const progressCard = el('div', 'task-insight-card');
            progressCard.appendChild(el('h3', '', 'Completion'));
            progressCard.appendChild(el('strong', '', `${this.state.insights.completionPercent || 0}%`));
            const progressBar = el('div', 'task-progress');
            const progressFill = el('div', 'task-progress-fill');
            progressFill.style.width = `${Math.min(this.state.insights.completionPercent || 0, 100)}%`;
            progressBar.appendChild(progressFill);
            progressCard.appendChild(progressBar);
            grid.appendChild(progressCard);

            if (this.state.insights.byStatus) {
                const statusCard = el('div', 'task-insight-card');
                statusCard.appendChild(el('h3', '', 'By status'));
                const list = document.createElement('ul');
                Object.entries(this.state.insights.byStatus).forEach(([status, count]) => {
                    const item = document.createElement('li');
                    item.textContent = `${titleCase(status)} · ${formatNumber(count)}`;
                    list.appendChild(item);
                });
                statusCard.appendChild(list);
                grid.appendChild(statusCard);
            }

            if (this.state.insights.byTag && Object.keys(this.state.insights.byTag).length > 0) {
                const tagCard = el('div', 'task-insight-card');
                tagCard.appendChild(el('h3', '', 'By tag'));
                const list = document.createElement('ul');
                Object.entries(this.state.insights.byTag).forEach(([tag, count]) => {
                    const item = document.createElement('li');
                    item.textContent = `${tag} · ${formatNumber(count)}`;
                    list.appendChild(item);
                });
                tagCard.appendChild(list);
                grid.appendChild(tagCard);
            }

            if (this.state.insights.byRole && Object.keys(this.state.insights.byRole).length > 0) {
                const roleCard = el('div', 'task-insight-card');
                roleCard.appendChild(el('h3', '', 'By role'));
                const list = document.createElement('ul');
                Object.entries(this.state.insights.byRole).forEach(([role, count]) => {
                    const item = document.createElement('li');
                    item.textContent = `${role} · ${formatNumber(count)}`;
                    list.appendChild(item);
                });
                roleCard.appendChild(list);
                grid.appendChild(roleCard);
            }

            section.appendChild(grid);
            return section;
        }

        createDashboardSelector() {
            const select = el('select', 'task-select');
            const dashboards = this.getSortedDashboards();
            const currentId = this.state.dashboard ? this.state.dashboard.noteId : null;
            dashboards.forEach((dashboard) => {
                const option = document.createElement('option');
                option.textContent = this.formatDashboardLabel(dashboard);
                option.value = dashboard.noteId;
                if (dashboard.noteId === currentId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            select.addEventListener('change', (event) => {
                const noteId = event.target.value;
                this.state.currentView = null;
                this.refresh({ dashboardNoteId: noteId });
            });
            return select;
        }

        createViewSwitch() {
            const wrapper = el('div', 'task-view-switch');
            const views = [
                { id: 'list', label: 'List', icon: 'bx bx-list-ul' },
                { id: 'kanban', label: 'Kanban', icon: 'bx bx-columns' },
                { id: 'calendar', label: 'Calendar', icon: 'bx bx-calendar' },
                { id: 'overview', label: 'Overview', icon: 'bx bx-analyse' }
            ];

            views.forEach((view) => {
                const btn = this.createButton(view.label, view.icon, 'ghost');
                if ((this.state.currentView || this.state.dashboard.view || 'list') === view.id) {
                    btn.classList.add('active');
                }
                btn.addEventListener('click', () => {
                    this.state.currentView = view.id;
                    if (this.state.dashboard) {
                        this.state.dashboard.view = view.id;
                    }
                    this.render();
                });
                wrapper.appendChild(btn);
            });

            return wrapper;
        }

        createToggle(labelText, initialValue, onChange) {
            const wrapper = el('label', 'task-toggle');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = initialValue;
            checkbox.addEventListener('change', (event) => onChange(event.target.checked));
            wrapper.appendChild(checkbox);
            wrapper.appendChild(el('span', '', labelText));
            return wrapper;
        }

        toggleFilterValue(key, value) {
            if (!Array.isArray(this.state.filters[key])) {
                this.state.filters[key] = [];
            }
            const values = new Set(this.state.filters[key]);
            if (values.has(value)) {
                values.delete(value);
            } else {
                values.add(value);
            }
            this.state.filters[key] = Array.from(values);
            this.clearSelection({ render: false });
            this.refresh();
        }

        async handleDepthChange(rawValue) {
            if (!this.state.dashboard) {
                return;
            }
            const parsed = Number.parseInt(rawValue, 10);
            if (!Number.isFinite(parsed)) {
                return;
            }
            const depth = Math.min(Math.max(parsed, 1), 25);
            if (depth === this.state.dashboard.depth) {
                return;
            }
            this.state.dashboard.depth = depth;
            await this.updateDashboardConfig({ depth });
        }

        async updateDashboardConfig(updates = {}, options = {}) {
            if (!this.state.dashboard) {
                return;
            }

            const nextDashboard = {
                ...this.state.dashboard,
                ...updates,
                filters: {
                    ...this.state.dashboard.filters,
                    ...(updates.filters || {})
                },
                kanban: {
                    ...this.state.dashboard.kanban,
                    ...(updates.kanban || {})
                },
                calendar: {
                    ...this.state.dashboard.calendar,
                    ...(updates.calendar || {})
                },
                overview: {
                    ...this.state.dashboard.overview,
                    ...(updates.overview || {})
                }
            };

            try {
                if (options.refresh !== false) {
                    await this.setLoading(true);
                }
                const result = await callService('saveDashboard', {
                    dashboard: nextDashboard
                });

                if (result.dashboard) {
                    this.state.dashboard = result.dashboard;
                } else {
                    this.state.dashboard = nextDashboard;
                }

                if (Array.isArray(result.dashboards)) {
                    this.state.dashboards = result.dashboards;
                }

                if (options.refresh === false) {
                    this.render();
                } else {
                    await this.refresh();
                }
            } catch (error) {
                api.showError(`Failed to update dashboard: ${error.message}`);
            } finally {
                if (options.refresh === false) {
                    await this.setLoading(false);
                }
            }
        }

        async createTask(data) {
            try {
                const desiredRoot = (data && (data.parentNoteId || data.dashboardRootNoteId)) || this.state.dashboard?.rootNoteId || null;
                const payload = Object.assign({}, data);
                if (desiredRoot) {
                    payload.dashboardRootNoteId = desiredRoot;
                    payload.parentNoteId = desiredRoot;
                }
                await callService('createTask', payload);
                await this.refresh();
            } catch (error) {
                api.showError(`Failed to create task: ${error.message}`);
            }
        }

        async openTaskDetail(noteId) {
            try {
                const task = await callService('getTask', {
                    noteId,
                    rootNoteId: this.state.dashboard.rootNoteId
                });
                this.state.selectedTask = task;
                this.renderDetailDrawer();
            } catch (error) {
                api.showError(`Failed to load task detail: ${error.message}`);
            }
        }

        renderDetailDrawer() {
            if (!this.detailDrawer) {
                return;
            }

            this.detailDrawer.innerHTML = '';
            if (!this.state.selectedTask) {
                this.detailDrawer.classList.remove('open');
                return;
            }

            this.detailDrawer.classList.add('open');
            const task = this.state.selectedTask;

            const header = el('div', 'task-detail-header');
            header.appendChild(el('strong', '', task.title));
            const closeBtn = this.createButton('', 'bx bx-x');
            closeBtn.addEventListener('click', () => {
                this.state.selectedTask = null;
                this.renderDetailDrawer();
            });
            header.appendChild(closeBtn);
            this.detailDrawer.appendChild(header);

            const body = el('div', 'task-detail-body');

            const statusRow = el('div', 'task-tags');
            statusRow.appendChild(createStatusPill(task.status));
            const due = formatDue(task.dueDate);
            if (due) {
                const dueSpan = el('span', `task-due ${due.variant || ''}`, due.label);
                dueSpan.title = due.helper;
                statusRow.appendChild(dueSpan);
            }
            body.appendChild(statusRow);

            const titleField = this.createField('Title');
            const titleInput = el('input', 'task-input');
            titleInput.type = 'text';
            titleInput.value = task.title || '';
            titleField.appendChild(titleInput);
            body.appendChild(titleField);

            const formGrid = el('div', 'task-form-grid');

            const dashboardsField = this.createField('Dashboard');
            const dashboardSelect = el('select', 'task-select');
            const parentSet = new Set(task.parentNoteIds || []);
            const dashboards = this.getSortedDashboards();
            let selectedDashboardRoot = this.state.dashboard?.rootNoteId || null;
            dashboards.forEach((dashboard) => {
                const option = document.createElement('option');
                option.textContent = this.formatDashboardLabel(dashboard);
                option.value = dashboard.rootNoteId;
                dashboardSelect.appendChild(option);
                if (parentSet.has(dashboard.rootNoteId)) {
                    selectedDashboardRoot = dashboard.rootNoteId;
                }
            });
            if (!selectedDashboardRoot && dashboards.length > 0) {
                selectedDashboardRoot = dashboards[0].rootNoteId;
            }
            if (selectedDashboardRoot) {
                dashboardSelect.value = selectedDashboardRoot;
            }
            dashboardsField.appendChild(dashboardSelect);
            formGrid.appendChild(dashboardsField);

            const statusField = this.createField('Status');
            const statusSelect = el('select', 'task-select');
            STATUS_OPTIONS.forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.id;
                if (option.id === task.status) {
                    opt.selected = true;
                }
                statusSelect.appendChild(opt);
            });
            statusField.appendChild(statusSelect);
            formGrid.appendChild(statusField);

            const priorityField = this.createField('Priority');
            const prioritySelect = el('select', 'task-select');
            PRIORITY_OPTIONS.forEach((option) => {
                const opt = el('option', null, option.label);
                opt.value = option.value;
                if (option.value === task.priority) {
                    opt.selected = true;
                }
                prioritySelect.appendChild(opt);
            });
            priorityField.appendChild(prioritySelect);
            formGrid.appendChild(priorityField);

            const dueField = this.createField('Due date');
            const dueInput = el('input', 'task-input');
            dueInput.type = 'date';
            if (task.dueDate) {
                const dueLocal = localDateFromIso(task.dueDate);
                const formatted = formatDateInputValue(dueLocal);
                if (formatted) {
                    dueInput.value = formatted;
                }
            }
            dueField.appendChild(dueInput);
            formGrid.appendChild(dueField);

            const pinnedField = this.createField('Pinned');
            const pinnedToggle = document.createElement('input');
            pinnedToggle.type = 'checkbox';
            pinnedToggle.checked = !!task.isPinned;
            pinnedField.appendChild(pinnedToggle);
            formGrid.appendChild(pinnedField);

            body.appendChild(formGrid);

            const tagsField = this.createField('Tags');
            const tagsInput = buildTokenInput({
                values: task.tags,
                suggestions: this.state.availableTags,
                placeholder: 'Add tag'
            });
            tagsField.appendChild(tagsInput.element);
            body.appendChild(tagsField);

            const rolesField = this.createField('Roles');
            const rolesInput = buildTokenInput({
                values: task.roles || [],
                suggestions: this.state.availableRoles,
                placeholder: 'Add role'
            });
            rolesField.appendChild(rolesInput.element);
            body.appendChild(rolesField);

            const contentField = this.createField('Description');
            const contentInput = el('textarea', 'task-input');
            contentInput.value = task.content || '';
            contentField.appendChild(contentInput);
            body.appendChild(contentField);

            const locationsField = this.createField('Locations');
            locationsField.appendChild(this.renderDashboardLocations(task));
            body.appendChild(locationsField);

            const pathField = this.createField('Hierarchy');
            pathField.appendChild(this.createPathBreadcrumb(task.path, false));
            body.appendChild(pathField);

            const timelineField = this.createField('Status history');
            timelineField.appendChild(this.renderStatusTimeline(task));
            body.appendChild(timelineField);

            const actions = el('div', 'task-detail-actions');
            const openBtn = this.createButton('Open Note', 'bx bx-share');
            openBtn.addEventListener('click', () => api.activateNote(task.noteId));
            actions.appendChild(openBtn);

            const actionGroup = el('div', 'task-dashboard-actions');
            const deleteBtn = this.createButton('Delete', 'bx bx-trash');
            const saveBtn = this.createButton('Save', 'bx bx-save', 'primary');
            actionGroup.appendChild(deleteBtn);
            actionGroup.appendChild(saveBtn);
            actions.appendChild(actionGroup);

            saveBtn.addEventListener('click', async () => {
                try {
                    const selectedDashboardRootNoteId = dashboardSelect.value || null;
                    const previousDashboardRootNoteId = this.state.dashboard ? this.state.dashboard.rootNoteId : null;
                    await callService('updateTask', {
                        noteId: task.noteId,
                        title: titleInput.value.trim(),
                        status: statusSelect.value,
                        priority: Number(prioritySelect.value),
                        dueDate: toIsoDate(dueInput.value),
                        tags: tagsInput.getValues(),
                        roles: rolesInput.getValues(),
                        isPinned: pinnedToggle.checked,
                        description: contentInput.value,
                        dashboardRootNoteId: selectedDashboardRootNoteId,
                        previousDashboardRootNoteId
                    });
                    this.state.selectedTask = null;
                    await this.refresh();
                } catch (error) {
                    api.showError(`Failed to save task: ${error.message}`);
                }
            });

            deleteBtn.addEventListener('click', async () => {
                const confirmed = await api.showConfirmDialog('Delete this task?');
                if (!confirmed) {
                    return;
                }
                try {
                    await callService('deleteTask', { noteId: task.noteId });
                    this.state.selectedTask = null;
                    await this.refresh();
                } catch (error) {
                    api.showError(`Failed to delete task: ${error.message}`);
                }
            });

            body.appendChild(actions);
            this.detailDrawer.appendChild(body);
        }

        createPathBreadcrumb(path, includeRoot = true) {
            const wrapper = el('div', 'task-path');
            const segments = [];
            if (includeRoot) {
                segments.push({ noteId: this.state.dashboard.rootNoteId, title: this.state.dashboardRootTitle || 'Root' });
            }
            if (Array.isArray(path)) {
                segments.push(...path);
            }
            if (segments.length === 0) {
                return el('span', '', '—');
            }
            segments.forEach((segment, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = segment.title;
                button.addEventListener('click', () => api.activateNote(segment.noteId));
                wrapper.appendChild(button);
                if (index < segments.length - 1) {
                    wrapper.appendChild(el('span', 'task-breadcrumb-separator', '›'));
                }
            });
            return wrapper;
        }

        createField(labelText) {
            const wrapper = el('div', 'task-field');
            const label = el('label', '', labelText);
            wrapper.appendChild(label);
            return wrapper;
        }

        createButton(label, icon, styleClass = '') {
            const btn = el('button', 'task-btn');
            btn.type = 'button';
            if (styleClass) {
                styleClass
                    .split(/\s+/)
                    .filter(Boolean)
                    .forEach((cls) => btn.classList.add(cls));
            }
            if (icon) {
                const span = el('span', icon);
                btn.appendChild(span);
            }
            if (label) {
                btn.appendChild(el('span', '', label));
            }
            return btn;
        }

        createBulkChip(label, value) {
            const chip = el('span', 'task-bulk-chip');
            const labelSpan = el('span', 'task-bulk-chip-label', label);
            const valueSpan = el('span', 'task-bulk-chip-value', value);
            chip.appendChild(labelSpan);
            chip.appendChild(valueSpan);
            return chip;
        }

        createEmpty(message) {
            return el('div', 'task-empty', message);
        }

        restoreFocus() {
            if (this.pendingFocus === 'search' && this.searchInputNode) {
                const length = this.searchInputNode.value.length;
                this.searchInputNode.focus({ preventScroll: true });
                try {
                    this.searchInputNode.setSelectionRange(length, length);
                } catch (error) {
                    // ignore selection errors on unsupported browsers
                }
            }
            this.pendingFocus = null;
        }

        hasActiveFilters(includeSearch = false) {
            const filters = this.state.filters || DEFAULT_FILTERS;
            if (!filters) {
                return false;
            }
            if (includeSearch && filters.search && filters.search.trim()) {
                return true;
            }
            if (Array.isArray(filters.status) && filters.status.length > 0) {
                return true;
            }
            if (Array.isArray(filters.tags) && filters.tags.length > 0) {
                return true;
            }
            if (Array.isArray(filters.roles) && filters.roles.length > 0) {
                return true;
            }
            if (filters.includeDescendants === false) {
                return true;
            }
            if (filters.showCompleted === false) {
                return true;
            }
            if (filters.hideBacklog === true) {
                return true;
            }
            if (filters.hideArchived === false) {
                return true;
            }
            if (filters.dueRange && filters.dueRange !== 'all') {
                return true;
            }
            if (filters.statusChangedWithin) {
                return true;
            }
            if (filters.pinnedOnly) {
                return true;
            }
            return false;
        }
    }

    async function main() {
        try {
            const dashboardNote = await api.getActiveContextNote();
            const app = new TaskDashboardApp(dashboardNote);
            await app.init();
        } catch (error) {
            api.showError(`Task dashboard failed to start: ${error.message}`);
            console.error(error);
        }
    }

    main();
})();
