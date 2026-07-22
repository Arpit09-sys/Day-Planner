/* ============================================================
   Day Planner v3.0 — Calm Habit-Building Redesign
   Vanilla JavaScript
   ============================================================ */

(function () {
  'use strict';

  /* ========== 1. STATE & CONSTANTS ========== */
  const API_BASE = window.location.origin + '/api';
  const STORAGE_KEY_USER = 'dayplanner_username';
  const STORAGE_KEY_THEME = 'dayplanner_theme';
  const STORAGE_KEY_OFFLINE = 'dayplanner_offline_tasks';

  let USERNAME = localStorage.getItem(STORAGE_KEY_USER) || '';
  let CURRENT_DATE = new Date().toISOString().split('T')[0];

  let state = {
    tasks: [],
    momentum: { daysCaredFor: 0, events: [] },
    plan: null,
    focus: {
      active: false,
      taskId: null,
      duration: 25,
      remaining: 25 * 60,
      timerId: null,
      sessionId: null
    }
  };

  /* ========== 2. UTILITIES ========== */
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function getTodayStr() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  }

  function formatTime(minutes) {
    const m = Math.floor(minutes / 60);
    const s = minutes % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function getTodayDayKey() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  function showToast(message, type = 'info') {
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

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--removing');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        meta.setAttribute('content', theme === 'dark' ? '#1a1d2e' : '#4338CA');
      }
    }
  };

  /* ========== 4. API SERVICE ========== */
  const Api = {
    request: async function(method, endpoint, data = null) {
      if (!USERNAME && method !== 'GET') {
        this.saveOffline(method, endpoint, data);
        return { success: true, data: data || {} }; 
      }
      
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (data) options.body = JSON.stringify(data);

      try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
      } catch (err) {
        console.warn('Network request failed, saving offline.', err);
        if (method !== 'GET') this.saveOffline(method, endpoint, data);
        return { success: false, error: err };
      }
    },
    saveOffline: function(method, endpoint, data) {
      let offline = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
      offline.push({ method, endpoint, data, timestamp: Date.now() });
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(offline));
    },
    syncOffline: async function() {
      if (!USERNAME) return;
      let offline = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
      if (offline.length === 0) return;

      for (let req of offline) {
        if (req.data) req.data.username = USERNAME; 
        try {
          await fetch(`${API_BASE}${req.endpoint}`, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.data)
          });
        } catch (e) { console.error('Sync failed', e); }
      }
      localStorage.removeItem(STORAGE_KEY_OFFLINE);
    }
  };

  /* ========== 5. RENDERER ========== */
  const Renderer = {
    init: function() {
      this.updateDateTime();
      setInterval(() => this.updateDateTime(), 60000);
      this.renderTasks();
      this.renderNowCard();
      this.renderWeekGrid();
      this.renderMomentum();
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
        $('#greeting-text').textContent = `${greeting}${USERNAME ? ', ' + USERNAME : '.'}`;
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

      const todayTasks = state.tasks.filter(t => t.date === CURRENT_DATE && !t.completed);
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

        const dateStr = d.toISOString().split('T')[0];
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
          // Visual mock: color some dots active
          if (i < Math.min(state.momentum.daysCaredFor, totalDots)) {
            dot.classList.add('momentum__dot--active');
          }
          dotsContainer.appendChild(dot);
        }
        // If today has activity, color last active dot green
        if (state.momentum.events.some(e => e.date === CURRENT_DATE)) {
           const active = dotsContainer.querySelectorAll('.momentum__dot--active');
           if (active.length > 0) {
             active[active.length-1].classList.remove('momentum__dot--active');
             active[active.length-1].classList.add('momentum__dot--today');
           }
        }
      }
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
      
      if (!USERNAME) {
        this.showOnboarding();
      } else {
        await Api.syncOffline();
        await this.loadData();
        this.startApp();
      }
      
      this.setupEventListeners();
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
             p1.value = 'Deep work session (90m)'; p2.value = 'Review PRs'; p3.value = 'Reply to urgent emails';
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
         ].filter(t => t);
         
         if (tasks.length > 0) {
           for (let title of tasks) {
             await this.addTask({ title, date: CURRENT_DATE, priority: 'high' });
           }
           this.recordMomentum('plan_created');
         }
         
         this.finishOnboarding();
      });

      $('#welcome-skip').addEventListener('click', () => {
         this.finishOnboarding();
      });
    },

    finishOnboarding: function() {
      $('#welcome').classList.add('hidden');
      this.showSyncPrompt();
    },

    showSyncPrompt: function() {
       const syncModal = $('#sync-modal');
       const backdrop = $('#sync-backdrop');
       syncModal.classList.add('active');
       backdrop.classList.add('active');

       $('#sync-form').addEventListener('submit', async (e) => {
         e.preventDefault();
         const name = $('#sync-username').value.trim();
         if(name) {
           USERNAME = name;
           localStorage.setItem(STORAGE_KEY_USER, USERNAME);
           await Api.request('POST', '/user', { username: USERNAME, displayName: USERNAME });
           await Api.syncOffline();
         }
         this.closeSyncPrompt();
         this.startApp();
       }, { once: true });

       $('#sync-skip').addEventListener('click', () => {
         USERNAME = 'User'; // Local only placeholder
         this.closeSyncPrompt();
         this.startApp();
       }, { once: true });
       
       $('#sync-close').addEventListener('click', () => {
         USERNAME = 'User';
         this.closeSyncPrompt();
         this.startApp();
       }, { once: true });
    },

    closeSyncPrompt: function() {
       $('#sync-modal').classList.remove('active');
       $('#sync-backdrop').classList.remove('active');
    },

    startApp: function() {
      $('#app').classList.add('active');
      Renderer.init();
    },

    loadData: async function() {
      if(!USERNAME) return;
      
      const [tasksRes, momentumRes] = await Promise.all([
        Api.request('GET', `/tasks/${USERNAME}`),
        Api.request('GET', `/momentum/${USERNAME}?days=30`)
      ]);

      if (tasksRes.success && tasksRes.data) {
        state.tasks = tasksRes.data;
      }
      
      if (momentumRes.success && momentumRes.data) {
        state.momentum = momentumRes.data;
      }
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

      if (USERNAME && USERNAME !== 'User') {
        newTask.username = USERNAME;
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

       if (USERNAME && USERNAME !== 'User' && state.tasks[idx]._id) {
         await Api.request('PUT', `/tasks/${state.tasks[idx]._id}`, updates);
       } else {
         Api.saveOffline('PUT', `/tasks/${id}`, updates);
       }
    },

    deleteTask: async function(task) {
      if (!confirm(`Delete task "${task.title}"?`)) return;
      
      state.tasks = state.tasks.filter(t => t._id !== task._id && t.tempId !== task.tempId);
      Renderer.renderTasks();
      Renderer.renderWeekGrid();
      Renderer.renderNowCard();
      
      if (USERNAME && USERNAME !== 'User' && task._id) {
        await Api.request('DELETE', `/tasks/${task._id}`);
      }
      showToast('Task deleted');
    },

    toggleTaskCompletion: async function(task, isCompleted) {
       await this.updateTask(task._id || task.tempId, { completed: isCompleted });
       if (isCompleted) {
         this.recordMomentum('task_completed');
         showToast('Task completed! 🎉', 'success');
       } else {
         showToast('Task uncompleted');
       }
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
       if (!USERNAME || USERNAME === 'User') return;
       
       // Optimistic local update
       if (!state.momentum.events.some(e => e.date === CURRENT_DATE && e.actionType === actionType)) {
          state.momentum.events.unshift({ date: CURRENT_DATE, actionType, createdAt: new Date().toISOString() });
          // Recalculate days cared for
          const uniqueDays = new Set(state.momentum.events.map(e => e.date));
          state.momentum.daysCaredFor = uniqueDays.size;
          Renderer.renderMomentum();
       }

       const res = await Api.request('POST', '/momentum', {
         username: USERNAME,
         date: CURRENT_DATE,
         actionType
       });
       
       if (res.success && res.duplicate !== true) {
         // Optionally refresh data from server here, but optimistic is fine
       }
    },

    /* ========== FOCUS MODE ========== */
    startFocus: async function(task) {
      if (!task) return;
      
      state.focus.active = true;
      state.focus.taskId = task._id || task.tempId;
      state.focus.duration = task.estimatedMinutes || 25;
      
      // Update UI picker
      $$('.duration-opt').forEach(el => el.classList.remove('active'));
      let dOpt = $(`.duration-opt[data-duration="${state.focus.duration}"]`);
      if(!dOpt) dOpt = $(`.duration-opt[data-duration="25"]`);
      if(dOpt) dOpt.classList.add('active');

      state.focus.duration = parseInt(dOpt.dataset.duration);
      state.focus.remaining = state.focus.duration * 60;
      
      $('#focus-task-name').textContent = task.title;
      $('#focus-timer').textContent = formatTime(state.focus.remaining);
      
      $('#focus-overlay').classList.add('active');
      
      // Set task status to in_progress
      await this.updateTask(state.focus.taskId, { status: 'in_progress' });
      
      // Create session on backend
      if (USERNAME && USERNAME !== 'User' && task._id) {
         const res = await Api.request('POST', '/focus', {
           username: USERNAME,
           taskId: task._id,
           plannedDuration: state.focus.duration
         });
         if (res.success && res.data) {
           state.focus.sessionId = res.data._id;
         }
      }
    },
    
    toggleFocusTimer: function() {
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
            this.endFocusSession('completed');
            this.toggleFocusTimer(); // Pause
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
       if (state.focus.timerId) {
         clearInterval(state.focus.timerId);
         state.focus.timerId = null;
       }
       
       $('#focus-toggle').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
       
       const completedMins = state.focus.duration - Math.ceil(state.focus.remaining / 60);
       
       if (state.focus.sessionId && USERNAME && USERNAME !== 'User') {
         await Api.request('PUT', `/focus/${state.focus.sessionId}`, {
           endTime: new Date(),
           completedDuration: completedMins,
           status: status
         });
       }

       if (status === 'completed' && completedMins > 0) {
         this.recordMomentum('focus_completed');
         if ('vibrate' in navigator) navigator.vibrate(200);
         showToast(`Focus session completed! (${completedMins}m)`, 'success');
       }
    },

    exitFocusView: function() {
       if (state.focus.timerId) {
         if (!confirm("End current focus session?")) return;
         this.endFocusSession('abandoned');
       }
       $('#focus-overlay').classList.remove('active');
       
       // Reset task status to planned if not completed
       const task = state.tasks.find(t => t._id === state.focus.taskId || t.tempId === state.focus.taskId);
       if (task && !task.completed) {
         this.updateTask(task._id || task.tempId, { status: 'planned' });
       }
       
       state.focus.active = false;
       state.focus.taskId = null;
       state.focus.sessionId = null;
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

      if (USERNAME && USERNAME !== 'User') {
        await Api.request('POST', '/plans', {
          username: USERNAME,
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
      $('#focus-finish').addEventListener('click', () => {
        this.endFocusSession('completed');
        showToast("Session finished.");
      });
      $('#focus-complete').addEventListener('click', () => {
        if (state.focus.taskId) {
           const t = state.tasks.find(t => t._id === state.focus.taskId || t.tempId === state.focus.taskId);
           if (t) this.toggleTaskCompletion(t, true);
        }
        this.exitFocusView();
      });
      $('#focus-continue').addEventListener('click', () => {
        if (state.focus.timerId) this.toggleFocusTimer(); // pause
        this.setFocusDuration(state.focus.duration); // reset time
        showToast("Timer reset for another session");
      });
      $('#focus-later').addEventListener('click', () => {
         // Change status to 'planned'
         if (state.focus.taskId) this.updateTask(state.focus.taskId, { status: 'planned' });
         this.exitFocusView();
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

      $('#setting-push').addEventListener('change', async (e) => {
         if (e.target.checked) {
           await SettingsLogic.subscribeToPush();
         }
      });

      $('#btn-test-notification').addEventListener('click', async () => {
         if (!USERNAME || USERNAME === 'User') return showToast('Please sync your name first.');
         const res = await Api.request('POST', '/notifications/test', { username: USERNAME });
         if (res.success) showToast('Test notifications sent!');
         else showToast('Failed to send notifications.');
      });

      $('#btn-export-data').addEventListener('click', () => {
         if (!USERNAME || USERNAME === 'User') return showToast('No data to export locally.');
         window.open(`${API_BASE}/privacy/export/${USERNAME}`, '_blank');
      });

      $('#btn-delete-account').addEventListener('click', async () => {
         if (!confirm("Are you sure? This will delete all your tasks, plans, and momentum. This cannot be undone.")) return;
         if (USERNAME && USERNAME !== 'User') {
            const res = await Api.request('DELETE', `/privacy/delete/${USERNAME}`);
            if (!res.success) return showToast('Failed to delete account.');
         }
         localStorage.clear();
         window.location.reload();
      });


    }
  };

  /* ========== 7. SETTINGS & PUSH LOGIC ========== */
  const SettingsLogic = {
    subscribeToPush: async function() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications are not supported by your browser.');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array('BOLLqdZOEA2laemrjZ3AOMqUs_a42ieia30NO5m6ymAvSKc1F8xtAhgezFPbVCLpd9xA3oikkSyS-9lrcVaSL14')
        });

        if (USERNAME && USERNAME !== 'User') {
          await Api.request('POST', '/notifications/subscribe', {
            username: USERNAME,
            subscription
          });
          showToast('Push notifications enabled!', 'success');
        } else {
          showToast('Please sync your name first to enable push.');
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

  /* ========== 8. INITIALIZE ========== */
  document.addEventListener('DOMContentLoaded', () => Logic.init());

})();
