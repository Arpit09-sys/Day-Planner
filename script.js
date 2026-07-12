/* ============================================================
   Day Planner — Vanilla JavaScript Application
   Modules: StorageManager, TaskManager, UIRenderer,
            DailyReset, StatsEngine, App
   ============================================================ */

(function () {
  'use strict';

  /* ========== CONSTANTS ========== */
  const STORAGE_KEY = 'dayplanner_data';
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const DAY_LABELS = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  };
  const DAY_FULL = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
  };

  const MOTIVATIONAL_QUOTES = [
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"It always seems impossible until it\'s done." — Nelson Mandela',
    '"The only way to do great work is to love what you do." — Steve Jobs',
    '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
    '"Success is the sum of small efforts repeated day in and day out." — Robert Collier',
    '"Productivity is never an accident. It is the result of commitment." — Paul J. Meyer',
    '"Focus on being productive instead of busy." — Tim Ferriss',
    '"Your future is created by what you do today, not tomorrow." — Robert Kiyosaki',
    '"Action is the foundational key to all success." — Pablo Picasso',
    '"Start where you are. Use what you have. Do what you can." — Arthur Ashe',
    '"The best time to plant a tree was 20 years ago. The second best time is now."',
    '"Small daily improvements over time lead to stunning results." — Robin Sharma'
  ];

  /* ========== SVG ICON TEMPLATES ========== */
  const Icons = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>'
  };

  /* ========== UTILITY HELPERS ========== */

  /** Generate a unique ID */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /** Get today's date string (YYYY-MM-DD) */
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  /** Get the JS day index (0=Sun) mapped to our week (0=Mon) */
  function getTodayDayKey() {
    const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
    const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return map[jsDay];
  }

  /** Get the dates for the current week (Mon-Sun) */
  function getCurrentWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const dates = {};
    DAYS.forEach(function (day, i) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates[day] = d;
    });
    return dates;
  }

  /** Format a Date to readable string */
  function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  /** Format a Date to short */
  function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** Format time from 24h input to 12h display */
  function formatTime12h(timeStr) {
    if (!timeStr) return '';
    var parts = timeStr.split(':');
    var hours = parseInt(parts[0], 10);
    var minutes = parts[1];
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return hours + ':' + minutes + ' ' + ampm;
  }

  /** Convert time string to minutes for sorting */
  function timeToMinutes(timeStr) {
    if (!timeStr) return 9999;
    var parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  /* ========== STORAGE MANAGER ========== */
  var StorageManager = {
    /** Load data from localStorage */
    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to load data:', e);
      }
      return null;
    },

    /** Save data to localStorage */
    save: function (data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save data:', e);
      }
    },

    /** Get default empty data structure */
    getDefault: function () {
      var weekData = {};
      DAYS.forEach(function (day) {
        weekData[day] = [];
      });
      return {
        weekData: weekData,
        lastResetDate: todayStr(),
        stats: {
          streak: 0,
          completionHistory: {}
        }
      };
    }
  };

  /* ========== TASK MANAGER ========== */
  var TaskManager = {
    data: null,

    /** Initialize — load or create data */
    init: function () {
      this.data = StorageManager.load() || StorageManager.getDefault();
      // Ensure all days exist
      DAYS.forEach(function (day) {
        if (!this.data.weekData[day]) this.data.weekData[day] = [];
      }.bind(this));
      if (!this.data.stats) {
        this.data.stats = { streak: 0, completionHistory: {} };
      }
      this.save();
    },

    save: function () {
      StorageManager.save(this.data);
    },

    /** Add a new task to a day */
    addTask: function (day, taskData) {
      var task = {
        id: generateId(),
        title: taskData.title,
        time: taskData.time || '',
        priority: taskData.priority || 'medium',
        notes: taskData.notes || '',
        completed: false,
        order: this.data.weekData[day].length
      };
      this.data.weekData[day].push(task);
      this.sortByTime(day);
      this.save();
      return task;
    },

    /** Edit an existing task */
    editTask: function (day, taskId, updates) {
      var tasks = this.data.weekData[day];
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
          Object.keys(updates).forEach(function (key) {
            tasks[i][key] = updates[key];
          });
          break;
        }
      }
      this.sortByTime(day);
      this.save();
    },

    /** Delete a task */
    deleteTask: function (day, taskId) {
      this.data.weekData[day] = this.data.weekData[day].filter(function (t) {
        return t.id !== taskId;
      });
      this.save();
    },

    /** Toggle task completion */
    toggleComplete: function (day, taskId) {
      var tasks = this.data.weekData[day];
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
          tasks[i].completed = !tasks[i].completed;
          break;
        }
      }
      this.save();
    },

    /** Reorder a task (direction: 'up' or 'down') */
    reorderTask: function (day, taskId, direction) {
      var tasks = this.data.weekData[day];
      var idx = -1;
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) { idx = i; break; }
      }
      if (idx === -1) return;

      var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= tasks.length) return;

      // Swap
      var temp = tasks[idx];
      tasks[idx] = tasks[swapIdx];
      tasks[swapIdx] = temp;

      // Update order
      tasks.forEach(function (t, i) { t.order = i; });
      this.save();
    },

    /** Sort tasks by time */
    sortByTime: function (day) {
      this.data.weekData[day].sort(function (a, b) {
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      });
      this.data.weekData[day].forEach(function (t, i) { t.order = i; });
    },

    /** Get tasks for a day (already sorted) */
    getTasks: function (day) {
      return this.data.weekData[day] || [];
    },

    /** Get a specific task */
    getTask: function (day, taskId) {
      var tasks = this.data.weekData[day] || [];
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) return tasks[i];
      }
      return null;
    }
  };

  /* ========== DAILY RESET ========== */
  var DailyReset = {
    /** Check and perform daily reset if needed */
    check: function () {
      var today = todayStr();
      if (TaskManager.data.lastResetDate !== today) {
        // Snapshot yesterday's data for stats before resetting
        this.snapshotStats();

        // Reset all completion statuses
        DAYS.forEach(function (day) {
          var tasks = TaskManager.data.weekData[day];
          tasks.forEach(function (task) {
            task.completed = false;
          });
        });

        TaskManager.data.lastResetDate = today;
        TaskManager.save();
      }
    },

    /** Save a snapshot of completion stats for the previous day */
    snapshotStats: function () {
      var prevDate = TaskManager.data.lastResetDate;
      if (!prevDate) return;

      var totalCompleted = 0;
      var totalTasks = 0;

      DAYS.forEach(function (day) {
        var tasks = TaskManager.data.weekData[day];
        tasks.forEach(function (task) {
          totalTasks++;
          if (task.completed) totalCompleted++;
        });
      });

      if (!TaskManager.data.stats.completionHistory) {
        TaskManager.data.stats.completionHistory = {};
      }

      TaskManager.data.stats.completionHistory[prevDate] = {
        completed: totalCompleted,
        total: totalTasks
      };

      // Calculate streak
      this.updateStreak();
    },

    /** Update the consecutive day streak */
    updateStreak: function () {
      var history = TaskManager.data.stats.completionHistory;
      var streak = 0;
      var d = new Date();
      d.setDate(d.getDate() - 1); // Start from yesterday

      while (true) {
        var dateStr = d.toISOString().split('T')[0];
        var entry = history[dateStr];
        if (entry && entry.completed > 0) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      TaskManager.data.stats.streak = streak;
    }
  };

  /* ========== STATS ENGINE ========== */
  var StatsEngine = {
    /** Get stats for today */
    getStats: function () {
      var todayKey = getTodayDayKey();
      var todayTasks = TaskManager.getTasks(todayKey);
      var completedToday = 0;
      var pendingToday = 0;

      todayTasks.forEach(function (t) {
        if (t.completed) completedToday++;
        else pendingToday++;
      });

      // Weekly totals
      var weekCompleted = 0;
      var weekTotal = 0;
      DAYS.forEach(function (day) {
        var tasks = TaskManager.getTasks(day);
        tasks.forEach(function (t) {
          weekTotal++;
          if (t.completed) weekCompleted++;
        });
      });

      var weeklyPct = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

      // Most productive day (by completed count this week)
      var maxCompleted = 0;
      var mostProductiveDay = '—';
      DAYS.forEach(function (day) {
        var count = 0;
        TaskManager.getTasks(day).forEach(function (t) {
          if (t.completed) count++;
        });
        if (count > maxCompleted) {
          maxCompleted = count;
          mostProductiveDay = DAY_FULL[day];
        }
      });

      return {
        completedToday: completedToday,
        pendingToday: pendingToday,
        weeklyPct: weeklyPct,
        streak: TaskManager.data.stats.streak || 0,
        mostProductiveDay: maxCompleted > 0 ? mostProductiveDay : '—'
      };
    }
  };

  /* ========== UI RENDERER ========== */
  var UIRenderer = {
    weekDates: null,

    init: function () {
      this.weekDates = getCurrentWeekDates();
      this.renderNav();
      this.renderHeroQuote();
      this.renderWeekRange();
      this.renderAllDayCards();
      this.renderStats();
      this.startClock();
      this.setupNavScroll();
    },

    /** Live clock in navigation */
    startClock: function () {
      var timeEl = document.getElementById('nav-time-text');
      var dateEl = document.getElementById('nav-date-text');

      function update() {
        var now = new Date();
        timeEl.textContent = now.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });
        dateEl.textContent = formatDate(now);
      }

      update();
      setInterval(update, 1000);
    },

    /** Nav date display */
    renderNav: function () {
      // Date is set via startClock
    },

    /** Sticky nav shadow on scroll */
    setupNavScroll: function () {
      var nav = document.getElementById('nav');
      window.addEventListener('scroll', function () {
        if (window.scrollY > 10) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
      }, { passive: true });
    },

    /** Rotate motivational quotes */
    renderHeroQuote: function () {
      var quoteEl = document.getElementById('hero-quote-text');
      var idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
      quoteEl.textContent = MOTIVATIONAL_QUOTES[idx];
    },

    /** Show the week date range */
    renderWeekRange: function () {
      var el = document.getElementById('week-range');
      var monDate = this.weekDates.monday;
      var sunDate = this.weekDates.sunday;
      el.textContent = formatDateShort(monDate) + ' — ' + formatDateShort(sunDate);
    },

    /** Render all 7 day cards */
    renderAllDayCards: function () {
      var grid = document.getElementById('planner-grid');
      grid.innerHTML = '';
      var todayKey = getTodayDayKey();

      DAYS.forEach(function (day) {
        var card = this.createDayCard(day, day === todayKey);
        grid.appendChild(card);
      }.bind(this));
    },

    /** Create a single day card DOM element */
    createDayCard: function (day, isToday) {
      var tasks = TaskManager.getTasks(day);
      var completedCount = tasks.filter(function (t) { return t.completed; }).length;
      var totalCount = tasks.length;
      var pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      var card = document.createElement('div');
      card.className = 'day-card' + (isToday ? ' day-card--today' : '');
      card.id = 'day-card-' + day;

      // Header
      var dateStr = this.weekDates[day] ? formatDateShort(this.weekDates[day]) : '';

      card.innerHTML =
        '<div class="day-card__header">' +
          '<span class="day-card__day">' + DAY_LABELS[day] + (isToday ? ' · Today' : '') + '</span>' +
          '<span class="day-card__date">' + dateStr + '</span>' +
        '</div>' +
        '<div class="day-card__progress">' +
          '<div class="progress-bar">' +
            '<div class="progress-bar__fill" style="width: ' + pct + '%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="day-card__counter">' +
          '<span class="day-card__counter-text">' + completedCount + ' / ' + totalCount + ' tasks</span>' +
          '<span class="day-card__counter-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="task-list" id="task-list-' + day + '"></div>' +
        '<button class="day-card__add-btn" data-day="' + day + '" aria-label="Add task to ' + DAY_FULL[day] + '">' +
          Icons.plus +
          'Add Task' +
        '</button>';

      // Render tasks into the task list
      var taskListEl = card.querySelector('.task-list');
      if (tasks.length === 0) {
        taskListEl.innerHTML =
          '<div class="task-list__empty">' +
            Icons.empty +
            '<span>No tasks yet</span>' +
          '</div>';
      } else {
        tasks.forEach(function (task) {
          taskListEl.appendChild(this.createTaskItem(day, task));
        }.bind(this));
      }

      return card;
    },

    /** Create a single task item DOM element */
    createTaskItem: function (day, task) {
      var item = document.createElement('div');
      item.className = 'task-item' + (task.completed ? ' task-item--completed' : '');
      item.id = 'task-' + task.id;
      item.dataset.taskId = task.id;
      item.dataset.day = day;

      var timeDisplay = task.time ? formatTime12h(task.time) : '';
      var notesIndicator = task.notes ? '<span class="task-item__notes-indicator" title="' + this.escapeHtml(task.notes) + '">📝</span>' : '';

      // We use a text-based notes indicator to avoid emoji. Let's use an SVG-based approach instead.
      var notesHtml = task.notes ?
        '<span class="task-item__notes-indicator" title="' + this.escapeHtml(task.notes) + '" style="display:inline-flex;width:11px;height:11px;color:var(--text-tertiary)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>' +
        '</span>' : '';

      item.innerHTML =
        '<label class="task-item__checkbox">' +
          '<input type="checkbox"' + (task.completed ? ' checked' : '') + ' data-action="toggle" data-day="' + day + '" data-task-id="' + task.id + '" aria-label="Mark ' + this.escapeHtml(task.title) + ' as ' + (task.completed ? 'incomplete' : 'complete') + '">' +
          '<div class="task-item__checkbox-visual">' + Icons.check + '</div>' +
        '</label>' +
        '<div class="task-item__content">' +
          '<div class="task-item__top-row">' +
            '<div class="task-item__priority task-item__priority--' + task.priority + '" title="' + task.priority + ' priority"></div>' +
            '<span class="task-item__title">' + this.escapeHtml(task.title) + '</span>' +
          '</div>' +
          '<div class="task-item__meta">' +
            (timeDisplay ? '<span class="task-item__time">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
              timeDisplay +
            '</span>' : '') +
            notesHtml +
          '</div>' +
        '</div>' +
        '<div class="task-item__actions">' +
          '<button class="task-action-btn" data-action="move-up" data-day="' + day + '" data-task-id="' + task.id + '" aria-label="Move task up" title="Move up">' + Icons.arrowUp + '</button>' +
          '<button class="task-action-btn" data-action="move-down" data-day="' + day + '" data-task-id="' + task.id + '" aria-label="Move task down" title="Move down">' + Icons.arrowDown + '</button>' +
          '<button class="task-action-btn" data-action="edit" data-day="' + day + '" data-task-id="' + task.id + '" aria-label="Edit task" title="Edit">' + Icons.edit + '</button>' +
          '<button class="task-action-btn task-action-btn--delete" data-action="delete" data-day="' + day + '" data-task-id="' + task.id + '" aria-label="Delete task" title="Delete">' + Icons.trash + '</button>' +
        '</div>';

      return item;
    },

    /** Re-render a single day card in place */
    refreshDayCard: function (day) {
      var oldCard = document.getElementById('day-card-' + day);
      if (!oldCard) return;
      var isToday = day === getTodayDayKey();
      var newCard = this.createDayCard(day, isToday);
      oldCard.replaceWith(newCard);
    },

    /** Render statistics dashboard */
    renderStats: function () {
      var stats = StatsEngine.getStats();
      document.getElementById('stat-completed-val').textContent = stats.completedToday;
      document.getElementById('stat-pending-val').textContent = stats.pendingToday;
      document.getElementById('stat-weekly-val').textContent = stats.weeklyPct + '%';
      document.getElementById('stat-streak-val').textContent = stats.streak + (stats.streak === 1 ? ' day' : ' days');
      document.getElementById('stat-productive-val').textContent = stats.mostProductiveDay;
    },

    /** Escape HTML for XSS safety */
    escapeHtml: function (str) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }
  };

  /* ========== MODAL CONTROLLER ========== */
  var ModalController = {
    backdrop: null,
    modal: null,
    form: null,
    currentDay: null,
    currentTaskId: null,
    isEditing: false,
    previousFocus: null,

    init: function () {
      this.backdrop = document.getElementById('modal-backdrop');
      this.modal = document.getElementById('task-modal');
      this.form = document.getElementById('task-form');

      // Close handlers
      document.getElementById('modal-close').addEventListener('click', this.close.bind(this));
      document.getElementById('modal-cancel').addEventListener('click', this.close.bind(this));
      this.backdrop.addEventListener('click', this.close.bind(this));

      // Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && this.modal.classList.contains('active')) {
          this.close();
        }
      }.bind(this));

      // Form submit
      this.form.addEventListener('submit', function (e) {
        e.preventDefault();
        this.handleSave();
      }.bind(this));

      // Priority selector
      this.setupPrioritySelector();
    },

    setupPrioritySelector: function () {
      var options = document.querySelectorAll('.priority-option');
      options.forEach(function (option) {
        option.addEventListener('click', function () {
          options.forEach(function (o) { o.classList.remove('selected'); });
          option.classList.add('selected');
          option.querySelector('input').checked = true;
        });
      });
    },

    /** Open modal for adding a task */
    openAdd: function (day) {
      this.isEditing = false;
      this.currentDay = day;
      this.currentTaskId = null;

      document.getElementById('modal-title').textContent = 'Add Task';
      document.getElementById('modal-day-label').textContent = DAY_FULL[day];
      document.getElementById('task-day').value = day;
      document.getElementById('task-id').value = '';
      document.getElementById('task-title').value = '';
      document.getElementById('task-time').value = '09:00';
      document.getElementById('task-notes').value = '';
      document.getElementById('modal-save').innerHTML =
        Icons.check.replace('<svg', '<svg width="16" height="16"') + ' Save Task';

      // Reset priority to medium
      this.setPriority('medium');

      this.show();
      // Focus the title field
      setTimeout(function () {
        document.getElementById('task-title').focus();
      }, 200);
    },

    /** Open modal for editing a task */
    openEdit: function (day, taskId) {
      var task = TaskManager.getTask(day, taskId);
      if (!task) return;

      this.isEditing = true;
      this.currentDay = day;
      this.currentTaskId = taskId;

      document.getElementById('modal-title').textContent = 'Edit Task';
      document.getElementById('modal-day-label').textContent = DAY_FULL[day];
      document.getElementById('task-day').value = day;
      document.getElementById('task-id').value = taskId;
      document.getElementById('task-title').value = task.title;
      document.getElementById('task-time').value = task.time;
      document.getElementById('task-notes').value = task.notes || '';
      document.getElementById('modal-save').innerHTML =
        Icons.check.replace('<svg', '<svg width="16" height="16"') + ' Update Task';

      this.setPriority(task.priority);

      this.show();
      setTimeout(function () {
        document.getElementById('task-title').focus();
      }, 200);
    },

    /** Set the selected priority */
    setPriority: function (value) {
      var options = document.querySelectorAll('.priority-option');
      options.forEach(function (o) {
        o.classList.remove('selected');
        if (o.dataset.priority === value) {
          o.classList.add('selected');
          o.querySelector('input').checked = true;
        }
      });
    },

    /** Show the modal */
    show: function () {
      this.previousFocus = document.activeElement;
      this.backdrop.classList.add('active');
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    },

    /** Close the modal */
    close: function () {
      this.backdrop.classList.remove('active');
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
      if (this.previousFocus) this.previousFocus.focus();
    },

    /** Handle save / update */
    handleSave: function () {
      var title = document.getElementById('task-title').value.trim();
      if (!title) return;

      var time = document.getElementById('task-time').value;
      var notes = document.getElementById('task-notes').value.trim();

      // Get selected priority
      var priorityEl = document.querySelector('.priority-option.selected');
      var priority = priorityEl ? priorityEl.dataset.priority : 'medium';

      if (this.isEditing && this.currentTaskId) {
        TaskManager.editTask(this.currentDay, this.currentTaskId, {
          title: title,
          time: time,
          priority: priority,
          notes: notes
        });
      } else {
        TaskManager.addTask(this.currentDay, {
          title: title,
          time: time,
          priority: priority,
          notes: notes
        });
      }

      UIRenderer.refreshDayCard(this.currentDay);
      UIRenderer.renderStats();
      this.close();
    }
  };

  /* ========== EVENT DELEGATION ========== */
  function setupEventDelegation() {
    // Planner grid — handles all task actions via delegation
    var plannerGrid = document.getElementById('planner-grid');

    // Handle checkbox toggle via 'change' event (avoids double-toggle)
    plannerGrid.addEventListener('change', function (e) {
      if (e.target.matches('[data-action="toggle"]')) {
        var day = e.target.dataset.day;
        var taskId = e.target.dataset.taskId;
        TaskManager.toggleComplete(day, taskId);
        UIRenderer.refreshDayCard(day);
        UIRenderer.renderStats();
      }
    });

    // Handle click-based actions (edit, delete, reorder, add)
    plannerGrid.addEventListener('click', function (e) {
      // Skip checkbox clicks — handled by 'change' above
      if (e.target.matches('[data-action="toggle"]') || e.target.closest('.task-item__checkbox')) {
        return;
      }

      var target = e.target.closest('[data-action]');
      if (!target) {
        // Check if it's an add button
        var addBtn = e.target.closest('.day-card__add-btn');
        if (addBtn) {
          ModalController.openAdd(addBtn.dataset.day);
        }
        return;
      }

      var action = target.dataset.action;
      var day = target.dataset.day;
      var taskId = target.dataset.taskId;

      switch (action) {
        case 'edit':
          ModalController.openEdit(day, taskId);
          break;

        case 'delete':
          var taskItem = document.getElementById('task-' + taskId);
          if (taskItem) {
            taskItem.classList.add('task-item--removing');
            setTimeout(function () {
              TaskManager.deleteTask(day, taskId);
              UIRenderer.refreshDayCard(day);
              UIRenderer.renderStats();
            }, 250);
          }
          break;

        case 'move-up':
          TaskManager.reorderTask(day, taskId, 'up');
          UIRenderer.refreshDayCard(day);
          break;

        case 'move-down':
          TaskManager.reorderTask(day, taskId, 'down');
          UIRenderer.refreshDayCard(day);
          break;
      }
    });
  }

  /* ========== APP INITIALIZATION ========== */
  function initApp() {
    // 1. Initialize data
    TaskManager.init();

    // 2. Check for daily reset
    DailyReset.check();

    // 3. Initialize modal
    ModalController.init();

    // 4. Render UI
    UIRenderer.init();

    // 5. Set up event delegation
    setupEventDelegation();

    // 6. Periodic quote rotation (every 30 seconds)
    setInterval(function () {
      UIRenderer.renderHeroQuote();
    }, 30000);
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
