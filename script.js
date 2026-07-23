/* ============================================================
   Day Planner v3.0 — Calm Habit-Building Redesign
   Vanilla JavaScript
   ============================================================ */

(function () {
  'use strict';
  // Keep unexpected errors in the console instead of interrupting a planning
  // session with browser alert boxes.
  window.addEventListener('error', (event) => console.error('Day Planner error:', event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => console.error('Day Planner request failed:', event.reason));

  /* ========== 1. STATE & CONSTANTS ========== */
  const API_BASE = window.location.origin + '/api';
  const STORAGE_KEY_USER = 'dayplanner_username';
  const STORAGE_KEY_SESSION = 'dayplanner_session';
  const STORAGE_KEY_THEME = 'dayplanner_theme';
  const STORAGE_KEY_OFFLINE = 'dayplanner_offline_tasks';
  const STORAGE_KEY_ONBOARDED = 'dayplanner_onboarded';

  function readSession() {
    try {
      const session = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSION) || 'null');
      return session && session.username && session.token ? session : null;
    } catch (_) {
      return null;
    }
  }

  const savedSession = readSession();
  const LEGACY_USERNAME = localStorage.getItem(STORAGE_KEY_USER) || '';
  let USERNAME = savedSession?.username || '';
  let AUTH_TOKEN = savedSession?.token || '';
  let CURRENT_DATE = getTodayStr();

  let state = {
    tasks: [],
    momentum: { daysCaredFor: 0, events: [] },
    plan: null,
    user: savedSession?.user || null,
    accountMode: 'register',
    rendererStarted: false,
    focus: {
      active: false,
      taskId: null,
      duration: 25,
      remaining: 25 * 60,
      timerId: null,
      sessionId: null,
      sessionClosed: false
    }
  };

  /* ========== 2. UTILITIES ========== */
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  function generateId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch(e) {}
    return 'tmp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function isSynced() {
    return Boolean(USERNAME && AUTH_TOKEN);
  }

  function persistSession(user, token) {
    USERNAME = user.username;
    AUTH_TOKEN = token;
    state.user = user;
    localStorage.setItem(STORAGE_KEY_USER, USERNAME);
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({ username: USERNAME, token, user }));
  }

  function clearSession() {
    USERNAME = '';
    AUTH_TOKEN = '';
    state.user = null;
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  function toLocalDateKey(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().split('T')[0];
  }

  function getTodayStr() {
    return toLocalDateKey(new Date());
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /* ========== COMPLETION SOUND ========== */
  const CompletionSound = {
    ctx: null,
    play: function() {
      if (state.user?.accessibility?.soundOff) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } catch(_) {}
    }
  };

  function getTodayDayKey() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  function showToast(message, type = 'info', options = {}) {
    const container = $('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast`;
    
    let icon = '';
    if (type === 'success') {
      icon = `<div class="toast__icon toast__icon--success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
    } else {
      icon = `<div class="toast__icon toast__icon--info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>`;
    }

    toast.innerHTML = icon;
    const copy = document.createElement('span');
    copy.textContent = message;
    toast.appendChild(copy);

    if (options.action) {
      const btn = document.createElement('button');
      btn.className = 'toast__action';
      btn.textContent = options.action.label;
      btn.addEventListener('click', () => { options.action.handler(); dismiss(); });
      toast.appendChild(btn);
    }

    container.appendChild(toast);

    const duration = options.duration || 3000;
    let timer;
    function dismiss() {
      clearTimeout(timer);
      toast.classList.add('toast--removing');
      setTimeout(() => toast.remove(), 300);
    }
    timer = setTimeout(dismiss, duration);
    return dismiss;
  }

  /* ========== 3. THEME MANAGEMENT ========== */
  const ThemeManager = {
    init: function () {
      let saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved) {
        this.setTheme(saved);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
      }

      const btn = $('#theme-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const current = document.documentElement.getAttribute('data-theme');
          this.setTheme(current === 'dark' ? 'light' : 'dark', true);
        });
      }

      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
          if (!localStorage.getItem(STORAGE_KEY_THEME)) {
            this.setTheme(e.matches ? 'dark' : 'light', false);
          }
        });
      }
    },
    setTheme: function (theme, persist = false) {
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      if (persist) localStorage.setItem(STORAGE_KEY_THEME, theme);

      const meta = $('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#151A18' : '#2F6F68');
      }
    }
  };

  /* ========== 4. API SERVICE ========== */
  const Api = {
    getOfflineQueue: function() {
      try {
        const queue = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
        return Array.isArray(queue) ? queue : [];
      } catch (_) {
        return [];
      }
    },
    request: async function(method, endpoint, data = null) {
      const isAccountRequest = endpoint === '/user/register' || endpoint === '/user/login';
      if (!isSynced() && method !== 'GET' && !isAccountRequest) {
        this.saveOffline(method, endpoint, data);
        return { success: true, data: data || {}, offline: true };
      }
      
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (AUTH_TOKEN) options.headers.Authorization = `Bearer ${AUTH_TOKEN}`;
      if (data) options.body = JSON.stringify(data);

      try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          return { success: false, status: response.status, message: result.message || 'Request failed.' };
        }
        return result;
      } catch (err) {
        console.warn('Network request failed, saving offline.', err);
        if (method !== 'GET' && !isAccountRequest) this.saveOffline(method, endpoint, data);
        return { success: false, error: err, message: 'You appear to be offline. Your changes will sync when you reconnect.' };
      }
    },
    saveOffline: function(method, endpoint, data) {
      const offline = this.getOfflineQueue();
      offline.push({ method, endpoint, data, timestamp: Date.now() });
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(offline));
    },
    applyOfflineTaskChanges: function(baseTasks = []) {
      const tasks = baseTasks.map((task) => ({ ...task }));
      const findTaskIndex = (id) => tasks.findIndex((task) => task._id === id || task.tempId === id);

      this.getOfflineQueue().forEach((request) => {
        if (request.endpoint === '/tasks' && request.method === 'POST' && request.data?.title) {
          const temporaryId = request.data.tempId || generateId();
          if (findTaskIndex(temporaryId) === -1) {
            tasks.push({ ...request.data, tempId: temporaryId });
          }
          return;
        }

        const taskMatch = request.endpoint?.match(/^\/tasks\/([^/]+)$/);
        if (!taskMatch) return;
        const taskIndex = findTaskIndex(taskMatch[1]);
        if (request.method === 'PUT' && taskIndex !== -1) {
          tasks[taskIndex] = { ...tasks[taskIndex], ...(request.data || {}) };
        }
        if (request.method === 'DELETE' && taskIndex !== -1) {
          tasks.splice(taskIndex, 1);
        }
      });

      return tasks;
    },
    syncOffline: async function() {
      if (!isSynced()) return;
      const offline = this.getOfflineQueue();
      if (offline.length === 0) return;

      const pending = [];
      const taskIdMap = new Map();
      for (const queuedRequest of offline) {
        const req = { ...queuedRequest, data: queuedRequest.data ? { ...queuedRequest.data } : null };
        if (req.data?.tempId && taskIdMap.has(req.data.tempId)) req.data.tempId = taskIdMap.get(req.data.tempId);
        for (const [temporaryId, serverId] of taskIdMap.entries()) {
          req.endpoint = req.endpoint.replace(temporaryId, serverId);
        }
        try {
          const response = await fetch(`${API_BASE}${req.endpoint}`, {
            method: req.method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}` },
            ...(req.data ? { body: JSON.stringify(req.data) } : {})
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success === false) {
            pending.push(queuedRequest);
            continue;
          }
          if (req.method === 'POST' && req.endpoint === '/tasks' && queuedRequest.data?.tempId && result.data?._id) {
            taskIdMap.set(queuedRequest.data.tempId, result.data._id);
            const taskIndex = state.tasks.findIndex((task) => task.tempId === queuedRequest.data.tempId);
            if (taskIndex !== -1) state.tasks[taskIndex] = result.data;
          }
        } catch (error) {
          console.error('Offline sync failed', error);
          pending.push(queuedRequest);
        }
      }
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(pending));
      if (pending.length === 0) localStorage.removeItem(STORAGE_KEY_OFFLINE);
    }
  };

  /* ========== 5. RENDERER ========== */
  const Renderer = {
    init: function() {
      this.updateDateTime();
      if (!state.rendererStarted) {
        setInterval(() => {
          const today = getTodayStr();
          if (today !== CURRENT_DATE) {
            CURRENT_DATE = today;
            this.renderTasks();
            this.renderNowCard();
            this.renderWeekGrid();
          }
          this.updateDateTime();
        }, 60000);
        state.rendererStarted = true;
      }
      this.renderTasks();
      this.renderNowCard();
      this.renderWeekGrid();
      this.renderMomentum();
      this.renderWeeklyBars();
    },
    updateDateTime: function() {
      const now = new Date();
      if ($('#nav-date-text')) {
        $('#nav-date-text').textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      }
      if ($('#nav-time-text')) {
        $('#nav-time-text').textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      }
      
      if ($('#greeting-text')) {
        const hour = now.getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        const name = state.user?.displayName || USERNAME;
        $('#greeting-text').textContent = `${greeting}${name ? ', ' + name : '.'}`;
      }
    },
    renderTasks: function() {
      const list = $('#task-list');
      if (!list) return;
      
      list.innerHTML = '';
      
      const todayTasks = state.tasks.filter(t => t.date === CURRENT_DATE || (!t.date && t.day === getTodayDayKey()));
      
      if (todayTasks.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-tertiary); font-size: var(--fs-sm);">No tasks for today. Start small!</div>`;
      } else {
        todayTasks.sort((a, b) => a.order - b.order).forEach(task => {
          list.appendChild(this.createTaskElement(task));
        });
      }
      
      if ($('#task-count')) $('#task-count').textContent = `${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''}`;
      
      this.updateProgressRing(todayTasks);
    },
    createTaskElement: function(task) {
      const el = document.createElement('div');
      el.className = `task-item ${task.completed ? 'task-item--done' : ''}`;
      el.dataset.id = task._id || task.tempId;
      
      let priorityClass = '';
      if (task.priority === 'high') priorityClass = 'task-item__priority--high';
      else if (task.priority === 'low') priorityClass = 'task-item__priority--low';
      else priorityClass = 'task-item__priority--medium';

      let statusLabel = '';
      if (task.status === 'in_progress') statusLabel = `<span class="status-label status-label--now">Now</span>`;
      
      let catBadge = '';
      if (task.category && task.category !== 'none') {
        catBadge = `<span class="task-item__category task-item__category--${task.category}">${task.category}</span>`;
      }

      el.innerHTML = `
        <div class="task-item__priority ${priorityClass}"></div>
        <label class="task-item__check">
          <input type="checkbox" ${task.completed ? 'checked' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </label>
        <div class="task-item__body">
          <div class="task-item__title">${this.escapeHTML(task.title)}</div>
          <div class="task-item__details">
            ${statusLabel}
            ${catBadge}
            ${task.time ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${task.time}</span>` : ''}
            ${task.estimatedMinutes ? `<span>${task.estimatedMinutes}m</span>` : ''}
          </div>
        </div>
        <div class="task-item__actions">
          <button class="task-action focus-task-btn" title="Focus" aria-label="Focus on task">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </button>
          <button class="task-action edit-task-btn" title="Edit" aria-label="Edit task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-action task-action--danger delete-task-btn" title="Delete" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Event Listeners for Actions
      const checkbox = el.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => Logic.toggleTaskCompletion(task, e.target.checked));

      el.querySelector('.delete-task-btn').addEventListener('click', () => Logic.deleteTask(task));
      el.querySelector('.edit-task-btn').addEventListener('click', () => Logic.openEditModal(task));
      el.querySelector('.focus-task-btn').addEventListener('click', () => Logic.startFocus(task));

      return el;
    },
    renderNowCard: function() {
      const container = $('#now-card-container');
      if (!container) return;

      const todayTasks = state.tasks.filter(t => (t.date === CURRENT_DATE || (!t.date && t.day === getTodayDayKey())) && !t.completed);
      const nowTask = todayTasks.find(t => t.status === 'in_progress') || todayTasks[0];

      if (nowTask) {
        container.innerHTML = `
          <div class="now-card">
            <div class="now-card__label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Today's Focus
            </div>
            <div class="now-card__title">${this.escapeHTML(nowTask.title)}</div>
            <div class="now-card__meta">
              ${nowTask.estimatedMinutes ? `<div class="now-card__meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${nowTask.estimatedMinutes}m</div>` : ''}
              <div class="now-card__meta-item">Priority: <span style="text-transform: capitalize">${nowTask.priority}</span></div>
            </div>
            <div class="now-card__actions">
              <button class="btn btn--primary btn-start-focus" data-id="${nowTask._id || nowTask.tempId}">Start Focus</button>
              <button class="btn btn--secondary btn-complete-now" data-id="${nowTask._id || nowTask.tempId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Complete
              </button>
            </div>
          </div>
        `;
        
        container.querySelector('.btn-start-focus').addEventListener('click', () => Logic.startFocus(nowTask));
        container.querySelector('.btn-complete-now').addEventListener('click', () => Logic.toggleTaskCompletion(nowTask, true));
      } else {
        container.innerHTML = `
          <div class="now-card now-card--empty">
            <div class="now-card__illustration">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
            </div>
            <div class="now-card__title">Your day starts with one small win.</div>
            <div class="now-card__sub">Add a task below to get started.</div>
          </div>
        `;
      }
    },
    updateProgressRing: function(tasks) {
      const fill = $('#progress-ring-fill');
      const pctTxt = $('#progress-pct');
      const detailTxt = $('#progress-detail');
      
      if (!fill || !pctTxt || !detailTxt) return;

      const total = tasks.length;
      const done = tasks.filter(t => t.completed).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      
      // Circumference for r=34 is ~213.63
      const offset = 213.63 - (pct / 100) * 213.63;
      fill.style.strokeDashoffset = offset;
      
      pctTxt.textContent = `${pct}%`;
      detailTxt.textContent = `${done} / ${total} tasks`;
    },
    renderWeekGrid: function() {
      const grid = $('#week-grid');
      const rangeTxt = $('#week-range');
      if (!grid) return;

      // Calculate start of week (Monday)
      const now = new Date();
      const day = now.getDay() || 7; 
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      grid.innerHTML = '';
      
      let endOfWeek;

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        if (i===6) endOfWeek = d;

        const dateStr = toLocalDateKey(d);
        const isToday = dateStr === CURRENT_DATE;

        const col = document.createElement('div');
        col.className = `day-col ${isToday ? 'day-col--today' : ''}`;
        
        const dayTasks = state.tasks.filter(t => t.date === dateStr);
        
        let tasksHtml = '';
        if (dayTasks.length > 0) {
          tasksHtml = `<div class="day-col__tasks">`;
          dayTasks.slice(0, 5).forEach(t => {
            tasksHtml += `
              <div class="mini-task ${t.completed ? 'mini-task--done' : ''}" title="${this.escapeHTML(t.title)}">
                <div class="mini-task__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div class="mini-task__title">${this.escapeHTML(t.title)}</div>
              </div>
            `;
          });
          if (dayTasks.length > 5) {
            tasksHtml += `<div style="font-size: 10px; color: var(--text-tertiary); text-align: center; margin-top: 4px;">+${dayTasks.length - 5} more</div>`;
          }
          tasksHtml += `</div>`;
        } else {
          tasksHtml = `
            <div class="day-col__empty">
              <span>Rest day</span>
            </div>
          `;
        }

        col.innerHTML = `
          <div class="day-col__header">
            <span class="day-col__name">${days[i]}</span>
            <span class="day-col__date">${d.getDate()}</span>
          </div>
          ${tasksHtml}
          <button class="day-col__add btn-add-day" data-date="${dateStr}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        `;

        col.querySelector('.btn-add-day').addEventListener('click', (e) => {
           const dStr = e.currentTarget.dataset.date;
           Logic.openEditModal(null, dStr);
        });

        grid.appendChild(col);
      }

      if (rangeTxt && endOfWeek) {
        rangeTxt.textContent = `${monday.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${endOfWeek.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
      }
    },
    renderMomentum: function() {
      if ($('#momentum-value')) {
        $('#momentum-value').textContent = state.momentum.daysCaredFor;
      }
      const dotsContainer = $('#momentum-dots');
      if (dotsContainer) {
        dotsContainer.innerHTML = '';
        const totalDots = 14; 
        for(let i=0; i<totalDots; i++) {
          const dot = document.createElement('div');
          dot.className = 'momentum__dot';
          if (i < Math.min(state.momentum.daysCaredFor, totalDots)) {
            dot.classList.add('momentum__dot--active');
          }
          dotsContainer.appendChild(dot);
        }
        if (state.momentum.events.some(e => e.date === CURRENT_DATE)) {
           const active = dotsContainer.querySelectorAll('.momentum__dot--active');
           if (active.length > 0) {
             active[active.length-1].classList.remove('momentum__dot--active');
             active[active.length-1].classList.add('momentum__dot--today');
           }
        }
      }
    },
    renderWeeklyBars: function() {
      const barsContainer = $('#weekly-bars');
      const labelsContainer = $('#weekly-labels');
      if (!barsContainer || !labelsContainer) return;

      const now = new Date();
      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);

      const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      let maxTasks = 1;
      const dayCounts = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = toLocalDateKey(d);
        const dayTasks = state.tasks.filter(t => t.date === dateStr);
        const completed = dayTasks.filter(t => t.completed).length;
        const total = dayTasks.length;
        dayCounts.push({ completed, total, isToday: dateStr === CURRENT_DATE });
        if (total > maxTasks) maxTasks = total;
      }

      barsContainer.innerHTML = '';
      labelsContainer.innerHTML = '';

      dayCounts.forEach((day, i) => {
        const bar = document.createElement('div');
        bar.className = `weekly-bar${day.isToday ? ' weekly-bar--today' : ''}`;
        const height = day.total > 0 ? Math.max(8, (day.completed / maxTasks) * 100) : 4;
        bar.style.height = `${height}%`;
        bar.title = `${day.completed}/${day.total} completed`;
        barsContainer.appendChild(bar);

        const label = document.createElement('span');
        label.textContent = dayNames[i];
        labelsContainer.appendChild(label);
      });
    },
    escapeHTML: function (str) {
      if (!str) return '';
      return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
          }[tag] || tag)
      );
    }
  };

  /* ========== 6. LOGIC & DATA CONTROLLER ========== */
  const Logic = {
    init: async function() {
      ThemeManager.init();
      this.resetTransientUi();
      this.setupEventListeners();

      if (isSynced()) {
        const profile = await this.loadProfile();
        if (profile.success) {
          await Api.syncOffline();
          await this.loadData();
          this.startApp();
          return;
        }

        // An expired token needs a new sign-in. A temporary network issue does
        // not sign the person out or erase their local work.
        if (profile.status === 401 || profile.status === 404) clearSession();
      }

      // People upgrading from the old name-only experience should not be sent
      // through the welcome screen again just because they now need a secure
      // sync code.
      if (!localStorage.getItem(STORAGE_KEY_ONBOARDED) && LEGACY_USERNAME) {
        localStorage.setItem(STORAGE_KEY_ONBOARDED, '1');
      }

      if (localStorage.getItem(STORAGE_KEY_ONBOARDED)) {
        state.tasks = Api.applyOfflineTaskChanges();
        this.startApp();
      } else {
        this.showOnboarding();
      }
    },

    resetTransientUi: function() {
      if (state.focus.timerId) clearInterval(state.focus.timerId);
      state.focus = {
        active: false,
        taskId: null,
        duration: 25,
        remaining: 25 * 60,
        timerId: null,
        sessionId: null,
        sessionClosed: false
      };
      const focusOverlay = $('#focus-overlay');
      if (focusOverlay) {
        focusOverlay.classList.remove('active');
        focusOverlay.setAttribute('aria-hidden', 'true');
      }
      $('#reflection-overlay')?.classList.remove('active');
    },

    loadProfile: async function() {
      const result = await Api.request('GET', '/user/me');
      if (result.success && result.data) persistSession(result.data, AUTH_TOKEN);
      return result;
    },

    setAccountMode: function(mode) {
      state.accountMode = mode === 'login' ? 'login' : 'register';
      $$('[data-account-mode]').forEach((button) => {
        const active = button.dataset.accountMode === state.accountMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      const isLogin = state.accountMode === 'login';
      $('#sync-title').textContent = isLogin ? 'Connect this device' : 'Sync your plans';
      $('#sync-submit').textContent = isLogin ? 'Sign in & Sync' : 'Create & Sync';
      $('#sync-code').setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
      $('#sync-code-hint').textContent = isLogin
        ? 'Enter the private sync code you used on your other device.'
        : 'Keep it private. You will use it to connect another device.';
    },

    showOnboarding: function() {
      const welcome = $('#welcome');
      const app = $('#app');
      if (welcome) welcome.classList.remove('hidden');
      if (app) app.classList.remove('active');
      
      // Handle context chips
      $$('.context-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          $$('.context-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
      });
      
      // Handle template chips
      $$('.template-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
           const type = e.target.dataset.template;
           const p1 = $('#priority-1');
           const p2 = $('#priority-2');
           const p3 = $('#priority-3');
           
           if(type === 'deep-work') {
             p1.value = 'Deep work session (90m)'; p2.value = 'Review priorities'; p3.value = 'Reply to urgent emails';
           } else if(type === 'study') {
             p1.value = 'Read Chapter 4'; p2.value = 'Summarize notes'; p3.value = 'Review flashcards';
           } else if(type === 'workout') {
             p1.value = 'Morning run (5k)'; p2.value = 'Stretch routines'; p3.value = 'Drink 2L water';
           } else if(type === 'low-energy') {
             p1.value = 'Clear inbox'; p2.value = 'Pay bills'; p3.value = 'Read 10 pages';
           } else if(type === 'evening') {
             p1.value = 'Plan tomorrow'; p2.value = 'Tidy desk'; p3.value = 'Read before bed';
           }
        });
      });

      // Start buttons
      $('#welcome-start').addEventListener('click', async () => {
         const tasks = [
           $('#priority-1').value.trim(),
           $('#priority-2').value.trim(),
           $('#priority-3').value.trim()
         ].filter(Boolean);
         
         for (const title of tasks) {
           await this.addTask({ title, date: CURRENT_DATE, priority: 'high' });
         }
         if (tasks.length > 0) this.recordMomentum('plan_created');
         this.finishOnboarding();
      }, { once: true });

      $('#welcome-skip').addEventListener('click', () => this.finishOnboarding(), { once: true });
    },

    finishOnboarding: function() {
      localStorage.setItem(STORAGE_KEY_ONBOARDED, '1');
      $('#welcome').classList.add('hidden');
      this.startApp();
      this.showSyncPrompt('register');
    },

    showSyncPrompt: function(mode = 'register') {
       this.setAccountMode(mode);
       const syncModal = $('#sync-modal');
       const backdrop = $('#sync-backdrop');
       $('#sync-error').hidden = true;
       $('#sync-error').textContent = '';
       if (!$('#sync-username').value && (USERNAME || LEGACY_USERNAME)) {
         $('#sync-username').value = String(USERNAME || LEGACY_USERNAME).trim().toLowerCase();
       }
       syncModal.classList.add('active');
       backdrop.classList.add('active');
       setTimeout(() => $('#sync-username').focus(), 100);
    },

    closeSyncPrompt: function() {
       $('#sync-modal').classList.remove('active');
       $('#sync-backdrop').classList.remove('active');
    },

    submitSyncAccount: async function() {
      const username = $('#sync-username').value.trim().toLowerCase();
      const syncCode = $('#sync-code').value;
      const error = $('#sync-error');
      const submit = $('#sync-submit');
      error.hidden = true;

      if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) {
        error.textContent = 'Use a username with 3–30 lowercase letters, numbers, hyphens, or underscores.';
        error.hidden = false;
        return;
      }
      if (syncCode.length < 6) {
        error.textContent = 'Your private sync code must be at least 6 characters.';
        error.hidden = false;
        return;
      }

      submit.disabled = true;
      const originalLabel = submit.textContent;
      submit.textContent = state.accountMode === 'login' ? 'Signing in…' : 'Creating…';
      const endpoint = state.accountMode === 'login' ? '/user/login' : '/user/register';
      const result = await Api.request('POST', endpoint, {
        username,
        syncCode,
        displayName: username,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      });
      submit.disabled = false;
      submit.textContent = originalLabel;

      if (!result.success || !result.token || !result.data) {
        error.textContent = result.message || 'We could not connect this account. Please try again.';
        error.hidden = false;
        return;
      }

      persistSession(result.data, result.token);
      $('#sync-code').value = '';
      await Api.syncOffline();
      await this.loadData();
      this.startApp();
      this.closeSyncPrompt();
      showToast(result.claimedLegacyAccount ? 'Your existing plans are now protected and synced.' : 'This device is now synced.', 'success');
    },

    startApp: function() {
      $('#welcome')?.classList.add('hidden');
      $('#app').classList.add('active');
      Renderer.init();
      this.populateSettings();
    },

    loadData: async function() {
      if(!isSynced()) return;
      const [tasksRes, momentumRes] = await Promise.all([
        Api.request('GET', `/tasks/${USERNAME}`),
        Api.request('GET', `/momentum/${USERNAME}?days=30`)
      ]);

      if (tasksRes.success && tasksRes.data) {
        state.tasks = Api.applyOfflineTaskChanges(tasksRes.data);
      }
      
      if (momentumRes.success && momentumRes.data) {
        state.momentum = momentumRes.data;
      }
    },

    populateSettings: function() {
      const signedIn = isSynced();
      const user = state.user || {};
      const notifications = user.notifications || {};
      const syncStatus = $('#sync-status');
      const syncButton = $('#btn-open-sync');
      const disconnectButton = $('#btn-disconnect');

      if (signedIn) {
        syncStatus.textContent = `Connected as @${USERNAME}. Use this username and your private sync code to sign in on another device.`;
        syncButton.textContent = 'How to connect another device';
        disconnectButton.hidden = false;
      } else {
        syncStatus.textContent = 'This device is storing plans locally. Set up a secure account to sync them across devices.';
        syncButton.textContent = 'Set up sync';
        disconnectButton.hidden = true;
      }

      $('#setting-push').checked = Boolean(notifications.browserPush);
      $('#setting-email-toggle').checked = Boolean(notifications.emailReminders);
      $('#setting-email-input').value = user.email || '';
      $('#setting-email-time').value = notifications.emailReminderTime || '08:30';
      $('#setting-email-group').hidden = !notifications.emailReminders;
    },

    saveNotificationSettings: async function() {
      if (!isSynced()) {
        showToast('Set up sync before saving reminders.');
        this.showSyncPrompt('register');
        return;
      }

      const emailEnabled = $('#setting-email-toggle').checked;
      const email = $('#setting-email-input').value.trim().toLowerCase();
      const emailTime = $('#setting-email-time').value || '08:30';
      if (emailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Enter a valid email address to enable email reminders.');
        $('#setting-email-input').focus();
        return;
      }

      const result = await Api.request('PUT', '/user/me', {
        email,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || state.user?.timezone || 'UTC',
        notifications: {
          browserPush: $('#setting-push').checked,
          emailReminders: emailEnabled,
          emailReminderTime: emailTime
        }
      });
      if (!result.success || !result.data) {
        showToast(result.message || 'Could not save notification settings.');
        return;
      }

      persistSession(result.data, AUTH_TOKEN);
      this.populateSettings();
      showToast(emailEnabled ? `Email reminders are set for ${emailTime}.` : 'Notification settings saved.', 'success');
    },

    disconnectDevice: function() {
      clearSession();
      state.tasks = [];
      state.momentum = { daysCaredFor: 0, events: [] };
      localStorage.removeItem(STORAGE_KEY_OFFLINE);
      this.closeSyncPrompt();
      $('#settings-modal').classList.remove('active');
      $('#settings-backdrop').classList.remove('active');
      this.startApp();
      showToast('This device has been disconnected.');
    },

    addTask: async function(taskData) {
      const newTask = {
        title: taskData.title,
        date: taskData.date || CURRENT_DATE,
        category: taskData.category || 'none',
        priority: taskData.priority || 'medium',
        time: taskData.time || '',
        estimatedMinutes: taskData.estimatedMinutes || 0,
        notes: taskData.notes || '',
        status: 'planned',
        completed: false,
        tempId: generateId(),
        order: state.tasks.length
      };

      state.tasks.push(newTask);
      Renderer.renderTasks();
      Renderer.renderWeekGrid();
      Renderer.renderNowCard();

      if (isSynced()) {
        const res = await Api.request('POST', '/tasks', newTask);
        if (res.success && res.data) {
          // Replace tempId with actual _id
          const idx = state.tasks.findIndex(t => t.tempId === newTask.tempId);
          if (idx !== -1) state.tasks[idx] = res.data;
        }
      } else {
        Api.saveOffline('POST', '/tasks', newTask);
      }
      
      showToast('Task added');
    },

    updateTask: async function(id, updates) {
       const idx = state.tasks.findIndex(t => t._id === id || t.tempId === id);
       if (idx === -1) return;
       
       state.tasks[idx] = { ...state.tasks[idx], ...updates };
       Renderer.renderTasks();
       Renderer.renderWeekGrid();
       Renderer.renderNowCard();

       if (isSynced() && state.tasks[idx]._id) {
         await Api.request('PUT', `/tasks/${state.tasks[idx]._id}`, updates);
       } else {
         Api.saveOffline('PUT', `/tasks/${id}`, updates);
       }
    },

    deleteTask: async function(task) {
      // Remove from state immediately
      const removedIdx = state.tasks.findIndex(t => t._id === task._id && t._id || t.tempId === task.tempId);
      state.tasks = state.tasks.filter(t => t._id !== task._id && t.tempId !== task.tempId);
      Renderer.renderTasks();
      Renderer.renderWeekGrid();
      Renderer.renderNowCard();

      let undone = false;
      showToast('Task deleted', 'info', {
        duration: 5000,
        action: {
          label: 'Undo',
          handler: () => {
            undone = true;
            state.tasks.splice(removedIdx, 0, task);
            Renderer.renderTasks();
            Renderer.renderWeekGrid();
            Renderer.renderNowCard();
            showToast('Task restored', 'success');
          }
        }
      });

      // Delay the actual server delete to allow undo
      setTimeout(async () => {
        if (undone) return;
        if (isSynced() && task._id) {
          await Api.request('DELETE', `/tasks/${task._id}`);
        } else {
          Api.saveOffline('DELETE', `/tasks/${task.tempId}`, null);
        }
      }, 5200);
    },

    toggleTaskCompletion: async function(task, isCompleted) {
       await this.updateTask(task._id || task.tempId, { completed: isCompleted });
       if (isCompleted) {
         CompletionSound.play();
         this.recordMomentum('task_completed');
         showToast('Task completed! 🎉', 'success');
       } else {
         showToast('Task uncompleted');
       }
       Renderer.renderWeeklyBars();
    },

    openEditModal: function(task = null, dateStr = CURRENT_DATE) {
       const modal = $('#task-modal');
       const backdrop = $('#modal-backdrop');
       const form = $('#task-form');
       
       form.reset();
       $$('.priority-opt, .category-opt').forEach(el => el.classList.remove('active'));

       if (task) {
         $('#modal-title').textContent = 'Edit Task';
         $('#task-edit-id').value = task._id || task.tempId;
         $('#task-title-input').value = task.title || '';
         $('#task-time-input').value = task.time || '';
         $('#task-duration-input').value = task.estimatedMinutes || '';
         $('#task-notes-input').value = task.notes || '';
         
         const pOpt = $(`.priority-opt[data-priority="${task.priority || 'medium'}"]`);
         if(pOpt) { pOpt.classList.add('active'); pOpt.querySelector('input').checked = true; }
         
         const cOpt = $(`.category-opt[data-category="${task.category || 'none'}"]`);
         if(cOpt) { cOpt.classList.add('active'); cOpt.querySelector('input').checked = true; }
         
         $('#task-edit-date').value = task.date || CURRENT_DATE;
       } else {
         $('#modal-title').textContent = 'Add Task';
         $('#task-edit-id').value = '';
         $('#task-edit-date').value = dateStr;
         $(`.priority-opt[data-priority="medium"]`).classList.add('active');
         $(`.priority-opt[data-priority="medium"] input`).checked = true;
         $(`.category-opt[data-category="none"]`).classList.add('active');
         $(`.category-opt[data-category="none"] input`).checked = true;
       }
       
       modal.classList.add('active');
       backdrop.classList.add('active');
       setTimeout(() => $('#task-title-input').focus(), 100);
    },

    closeEditModal: function() {
       $('#task-modal').classList.remove('active');
       $('#modal-backdrop').classList.remove('active');
    },

    recordMomentum: async function(actionType) {
       if (!isSynced()) return;
       
       // Optimistic local update
       if (!state.momentum.events.some(e => e.date === CURRENT_DATE && e.actionType === actionType)) {
          state.momentum.events.unshift({ date: CURRENT_DATE, actionType, createdAt: new Date().toISOString() });
          // Recalculate days cared for
          const uniqueDays = new Set(state.momentum.events.map(e => e.date));
          state.momentum.daysCaredFor = uniqueDays.size;
          Renderer.renderMomentum();
       }

       const res = await Api.request('POST', '/momentum', {
         date: CURRENT_DATE,
         actionType
       });
       
       if (res.success && res.duplicate !== true) {
         // Optionally refresh data from server here, but optimistic is fine
       }
    },

    /* ========== FOCUS MODE ========== */
    startFocus: async function(task) {
      if (!task || task.completed || state.focus.active) return;
      
      state.focus.active = true;
      state.focus.taskId = task._id || task.tempId;
      state.focus.duration = task.estimatedMinutes || 25;
      state.focus.sessionId = null;
      state.focus.sessionClosed = false;
      
      // Update UI picker
      $$('.duration-opt').forEach(el => el.classList.remove('active'));
      let dOpt = $(`.duration-opt[data-duration="${state.focus.duration}"]`);
      if(!dOpt) dOpt = $(`.duration-opt[data-duration="25"]`);
      if(dOpt) dOpt.classList.add('active');

      state.focus.duration = parseInt(dOpt?.dataset.duration || '25', 10);
      state.focus.remaining = state.focus.duration * 60;
      
      $('#focus-task-name').textContent = task.title;
      $('#focus-timer').textContent = formatTime(state.focus.remaining);
      
      $('#focus-overlay').classList.add('active');
      $('#focus-overlay').setAttribute('aria-hidden', 'false');
      
      // Set task status to in_progress
      await this.updateTask(state.focus.taskId, { status: 'in_progress' });
      
      // Create session on backend
      if (isSynced() && task._id) {
         const res = await Api.request('POST', '/focus', {
           taskId: task._id,
           plannedDuration: state.focus.duration
         });
         if (res.success && res.data) {
           state.focus.sessionId = res.data._id;
         }
      }
    },
    
    toggleFocusTimer: function() {
      if (!state.focus.active) return;
      const btn = $('#focus-toggle');
      if (state.focus.timerId) {
        // Pause
        clearInterval(state.focus.timerId);
        state.focus.timerId = null;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      } else {
        // Start
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        state.focus.timerId = setInterval(() => {
          if (state.focus.remaining > 0) {
            state.focus.remaining--;
            $('#focus-timer').textContent = formatTime(state.focus.remaining);
          } else {
            this.finishFocusSession();
          }
        }, 1000);
      }
    },

    setFocusDuration: function(minutes) {
      if (state.focus.timerId) return; // Can't change while running
      state.focus.duration = minutes;
      state.focus.remaining = minutes * 60;
      $('#focus-timer').textContent = formatTime(state.focus.remaining);
    },

    endFocusSession: async function(status = 'abandoned') {
       if (state.focus.sessionClosed) return;
       if (state.focus.timerId) {
         clearInterval(state.focus.timerId);
         state.focus.timerId = null;
       }
       
       $('#focus-toggle').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
       
       const completedMins = state.focus.duration - Math.ceil(state.focus.remaining / 60);
       
       if (state.focus.sessionId && isSynced()) {
         await Api.request('PUT', `/focus/${state.focus.sessionId}`, {
           endTime: new Date(),
           completedDuration: completedMins,
           status: status
         });
       }
       state.focus.sessionClosed = true;

       if (status === 'completed' && completedMins > 0) {
         this.recordMomentum('focus_completed');
         if ('vibrate' in navigator) navigator.vibrate(200);
         showToast(`Focus session completed! (${completedMins}m)`, 'success');
       }
    },

    finishFocusSession: async function() {
       await this.endFocusSession('completed');
       await this.exitFocusView({ skipConfirm: true, taskStatus: 'planned' });
    },

    exitFocusView: async function(options = {}) {
       if (state.focus.active && !state.focus.sessionClosed) {
         if (state.focus.timerId && !options.skipConfirm && !confirm('End current focus session?')) return;
         await this.endFocusSession('abandoned');
       }
       $('#focus-overlay').classList.remove('active');
       $('#focus-overlay').setAttribute('aria-hidden', 'true');
       
       // Reset task status to planned if not completed
       const task = state.tasks.find(t => t._id === state.focus.taskId || t.tempId === state.focus.taskId);
       if (task && !task.completed) {
         await this.updateTask(task._id || task.tempId, { status: options.taskStatus || 'planned' });
       }
       
       state.focus.active = false;
       state.focus.taskId = null;
       state.focus.sessionId = null;
       state.focus.sessionClosed = false;
    },

    /* ========== REFLECTION FLOW ========== */
    startReflection: function() {
      $('#reflection-overlay').classList.add('active');
      $$('.reflection-card__step').forEach(s => s.classList.remove('active'));
      $(`.reflection-card__step[data-step="1"]`).classList.add('active');
      setTimeout(() => $('#reflection-well').focus(), 100);
    },

    saveReflection: async function() {
      $('#reflection-overlay').classList.remove('active');
      
      const reflection = {
        wentWell: $('#reflection-well').value,
        canWait: $('#reflection-wait').value,
        tomorrowFirstStep: $('#reflection-tomorrow').value,
        completed: true
      };

      if (isSynced()) {
        await Api.request('POST', '/plans', {
          date: CURRENT_DATE,
          reflection
        });
      }

      this.recordMomentum('reflection_done');
      showToast('Reflection saved. Rest well.', 'success');
      
      $('#reflection-well').value = '';
      $('#reflection-wait').value = '';
      $('#reflection-tomorrow').value = '';
    },

    /* ========== EVENT LISTENERS ========== */
    setupEventListeners: function() {
      // Form: Add/Edit Task
      $('#task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = $('#task-edit-id').value;
        const date = $('#task-edit-date').value || CURRENT_DATE;
        const title = $('#task-title-input').value.trim();
        const time = $('#task-time-input').value;
        const estimatedMinutes = parseInt($('#task-duration-input').value) || 0;
        const notes = $('#task-notes-input').value.trim();
        
        const priority = $('.priority-opt.active').dataset.priority;
        const category = $('.category-opt.active').dataset.category;

        if (!title) return;

        if (id) {
          this.updateTask(id, { title, date, priority, category, time, estimatedMinutes, notes });
        } else {
          this.addTask({ title, date, priority, category, time, estimatedMinutes, notes });
        }
        
        this.closeEditModal();
      });

      // UI Toggles for Priority/Category
      $$('.priority-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          $$('.priority-opt').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          opt.querySelector('input').checked = true;
        });
      });
      $$('.category-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          $$('.category-opt').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          opt.querySelector('input').checked = true;
        });
      });

      // Quick Add
      const qaInput = $('#quick-add-input');
      const qaSubmit = $('#quick-add-submit');
      const handleQA = () => {
        const title = qaInput.value.trim();
        if (title) {
          this.addTask({ title, date: CURRENT_DATE });
          qaInput.value = '';
        }
      };
      qaSubmit.addEventListener('click', handleQA);
      qaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleQA(); });

      // Modals close
      $('#modal-close').addEventListener('click', () => this.closeEditModal());
      $('#modal-cancel').addEventListener('click', () => this.closeEditModal());
      $('#modal-backdrop').addEventListener('click', () => this.closeEditModal());

      // Focus Mode
      $('#focus-exit').addEventListener('click', () => this.exitFocusView());
      $('#focus-toggle').addEventListener('click', () => this.toggleFocusTimer());
      $('#focus-finish').addEventListener('click', () => this.finishFocusSession());
      $('#focus-complete').addEventListener('click', async () => {
        if (state.focus.taskId) {
           const t = state.tasks.find(t => t._id === state.focus.taskId || t.tempId === state.focus.taskId);
           if (t) await this.toggleTaskCompletion(t, true);
        }
        await this.endFocusSession('completed');
        await this.exitFocusView({ skipConfirm: true });
      });
      $('#focus-continue').addEventListener('click', () => {
        if (state.focus.timerId) this.toggleFocusTimer(); // pause
        this.setFocusDuration(state.focus.duration); // reset time
        showToast("Timer reset for another session");
      });
      $('#focus-later').addEventListener('click', async () => {
         // Change status to 'planned'
         if (state.focus.taskId) await this.updateTask(state.focus.taskId, { status: 'planned' });
         await this.exitFocusView({ skipConfirm: true });
      });
      
      $$('.duration-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
          if (state.focus.timerId) return; // Disallow change while running
          $$('.duration-opt').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          this.setFocusDuration(parseInt(opt.dataset.duration));
        });
      });

      // Reflection Flow
      $('#start-reflection').addEventListener('click', () => this.startReflection());
      $$('[data-reflection-next]').forEach(btn => {
        btn.addEventListener('click', (e) => {
           const nextStep = e.target.dataset.reflectionNext;
           $$('.reflection-card__step').forEach(s => s.classList.remove('active'));
           $(`.reflection-card__step[data-step="${nextStep}"]`).classList.add('active');
        });
      });
      $('#reflection-save').addEventListener('click', () => this.saveReflection());

      // Settings Flow
      $('#settings-btn').addEventListener('click', () => {
         this.populateSettings();
         $('#settings-modal').classList.add('active');
         $('#settings-backdrop').classList.add('active');
      });
      $('#settings-close').addEventListener('click', () => {
         $('#settings-modal').classList.remove('active');
         $('#settings-backdrop').classList.remove('active');
      });
      $('#settings-backdrop').addEventListener('click', () => {
         $('#settings-modal').classList.remove('active');
         $('#settings-backdrop').classList.remove('active');
      });

      $('#sync-form').addEventListener('submit', (event) => {
        event.preventDefault();
        this.submitSyncAccount();
      });
      $$('[data-account-mode]').forEach((button) => {
        button.addEventListener('click', () => this.setAccountMode(button.dataset.accountMode));
      });
      $('#sync-skip').addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY_ONBOARDED, '1');
        this.closeSyncPrompt();
        this.startApp();
      });
      $('#sync-close').addEventListener('click', () => this.closeSyncPrompt());
      $('#sync-backdrop').addEventListener('click', () => this.closeSyncPrompt());

      $('#btn-open-sync').addEventListener('click', () => {
        if (isSynced()) {
          showToast(`On your other device, sign in as @${USERNAME} with your private sync code.`);
        } else {
          this.showSyncPrompt('register');
        }
      });
      $('#btn-disconnect').addEventListener('click', () => this.disconnectDevice());

      $('#setting-push').addEventListener('change', async (e) => {
         if (e.target.checked) {
           await SettingsLogic.subscribeToPush();
         }
      });

      $('#setting-email-toggle').addEventListener('change', (event) => {
        $('#setting-email-group').hidden = !event.target.checked;
        if (event.target.checked) $('#setting-email-input').focus();
      });

      $('#btn-save-notifications').addEventListener('click', () => this.saveNotificationSettings());

      $('#btn-test-notification').addEventListener('click', async () => {
         if (!isSynced()) return showToast('Set up sync before testing reminders.');
         const res = await Api.request('POST', '/notifications/test');
         if (res.success) showToast('Test notification sent!', 'success');
         else showToast(res.message || 'No notification could be sent yet.');
      });

      $('#btn-export-data').addEventListener('click', () => {
         if (!isSynced()) return showToast('Set up sync before exporting account data.');
         window.open(`${API_BASE}/privacy/export/${USERNAME}`, '_blank');
      });

      $('#btn-delete-account').addEventListener('click', async () => {
         if (!confirm("Are you sure? This will delete all your tasks, plans, and momentum. This cannot be undone.")) return;
         if (isSynced()) {
            const res = await Api.request('DELETE', `/privacy/delete/${USERNAME}`);
            if (!res.success) return showToast('Failed to delete account.');
         }
         clearSession();
         state.tasks = [];
         state.momentum = { daysCaredFor: 0, events: [] };
         localStorage.removeItem(STORAGE_KEY_OFFLINE);
         localStorage.removeItem(STORAGE_KEY_ONBOARDED);
         window.location.reload();
      });

      document.addEventListener('keydown', (event) => {
        // Close modals on Escape
        if (event.key === 'Escape') {
          if ($('#focus-overlay').classList.contains('active')) this.exitFocusView();
          else if ($('#task-modal').classList.contains('active')) this.closeEditModal();
          else if ($('#settings-modal').classList.contains('active')) {
            $('#settings-modal').classList.remove('active');
            $('#settings-backdrop').classList.remove('active');
          } else if ($('#sync-modal').classList.contains('active')) this.closeSyncPrompt();
          return;
        }

        // Don't trigger shortcuts when typing in an input/textarea
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        // Don't trigger if any modal is open
        if ($('.modal.active') || $('#focus-overlay.active') || $('#welcome:not(.hidden)')) return;

        if (event.key === 'n' || event.key === 'N') {
          event.preventDefault();
          this.openEditModal();
        } else if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          const searchInput = $('#search-input');
          if (searchInput) searchInput.focus();
          else $('#quick-add-input')?.focus();
        } else if (event.key === 'f' || event.key === 'F') {
          event.preventDefault();
          const todayTasks = state.tasks.filter(t => (t.date === CURRENT_DATE || (!t.date && t.day === getTodayDayKey())) && !t.completed);
          if (todayTasks.length > 0) this.startFocus(todayTasks[0]);
        }
      });


    }
  };

  /* ========== 7. SETTINGS & PUSH LOGIC ========== */
  const SettingsLogic = {
    subscribeToPush: async function() {
      if (!isSynced()) {
        showToast('Set up sync before enabling browser notifications.');
        $('#setting-push').checked = false;
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications are not supported by your browser.');
        $('#setting-push').checked = false;
        return;
      }

      try {
        const config = await Api.request('GET', '/notifications/config');
        const vapidPublicKey = config.data?.vapidPublicKey;
        if (!config.success || !vapidPublicKey) {
          showToast('Browser notifications are not configured on the server yet.');
          $('#setting-push').checked = false;
          return;
        }
        const registration = await navigator.serviceWorker.register('/sw.js');
        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription = existingSubscription || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });

        if (isSynced()) {
          const result = await Api.request('POST', '/notifications/subscribe', { subscription });
          if (!result.success) throw new Error(result.message || 'Unable to save the push subscription.');
          state.user = {
            ...state.user,
            notifications: { ...state.user?.notifications, browserPush: true }
          };
          persistSession(state.user, AUTH_TOKEN);
          showToast('Push notifications enabled!', 'success');
        }
      } catch (err) {
        console.error('Failed to subscribe:', err);
        showToast('Failed to enable push notifications.');
        $('#setting-push').checked = false;
      }
    },
    urlBase64ToUint8Array: function(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
  };

  /* ========== 7. INITIALIZATION ========== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Logic.init());
  } else {
    Logic.init();
  }
})();
