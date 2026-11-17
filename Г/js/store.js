/* Сова — состояние, прогресс, серии, XP и вся мотивационная механика. */
(function () {
  "use strict";

  const D = window.SOVA_DATA;
  const LS_KEY = "sova.state.v1";
  const VERSION = 1;
  const FREEZE_COST = 50;
  const MAX_FREEZES = 3;
  const XP_PER_READING_STEP = 1;
  const READING_STEP_SECONDS = 20; // 3 XP за минуту чтения
  const GOAL_XP = 15;
  const CHAPTER_XP = 25;
  const BOOK_XP = 100;
  const QUIZ_XP = 10;

  let state = null;
  let events = [];
  let checkingAchievements = false;

  /* ---------- даты ---------- */

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function parseDateKey(key) {
    const parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function shiftKey(key, delta) {
    const d = parseDateKey(key);
    d.setDate(d.getDate() + delta);
    return dateKey(d);
  }

  function daysBetween(a, b) {
    return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86400000);
  }

  function startOfWeekKey(key) {
    const d = parseDateKey(key || todayKey());
    const day = (d.getDay() + 6) % 7; // понедельник = 0
    d.setDate(d.getDate() - day);
    return dateKey(d);
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* ---------- состояние ---------- */

  function defaultState() {
    return {
      version: VERSION,
      profile: {
        name: "Читатель",
        goalMinutes: 10,
        onboarded: false,
        createdAt: Date.now()
      },
      xp: 0,
      feathers: 10,
      freezes: 0,
      streak: { current: 0, best: 0, lastGoalDate: null },
      days: {},
      progress: {},
      quests: { date: todayKey(), claimed: {}, bonus: false },
      achievements: {},
      stats: {
        questsClaimed: 0,
        feathersEarned: 10,
        booksAdded: 0,
        nightRead: false
      },
      sagaClaims: {},
      customSagas: [],
      customBooks: [],
      settings: {
        theme: "sepia",
        fontSize: 19,
        lineHeight: 1.8,
        sound: true,
        ttsRate: 0.95
      }
    };
  }

  function mergeDefaults(base, loaded) {
    if (Array.isArray(base)) {
      return Array.isArray(loaded) ? loaded : base;
    }
    if (base && typeof base === "object") {
      const out = {};
      const srcLoaded = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? loaded : {};
      Object.keys(base).forEach(function (key) {
        out[key] = mergeDefaults(base[key], srcLoaded[key]);
      });
      Object.keys(srcLoaded).forEach(function (key) {
        if (!(key in out)) out[key] = srcLoaded[key];
      });
      return out;
    }
    return loaded === undefined || loaded === null ? base : loaded;
  }

  function prepareLoadedState(loaded) {
    const s = mergeDefaults(defaultState(), loaded || {});
    s.version = VERSION;
    if (!s.profile) s.profile = defaultState().profile;
    if (!s.streak) s.streak = defaultState().streak;
    if (!s.quests) s.quests = { date: todayKey(), claimed: {}, bonus: false };
    if (!s.achievements) s.achievements = {};
    if (!s.sagaClaims) s.sagaClaims = {};
    if (!Array.isArray(s.customBooks)) s.customBooks = [];
    if (!Array.isArray(s.customSagas)) s.customSagas = [];
    if (!s.settings) s.settings = defaultState().settings;
    if (!s.days) s.days = {};
    if (!s.progress) s.progress = {};
    if (!s.stats) s.stats = defaultState().stats;
    if (typeof s.stats.questsClaimed !== "number") s.stats.questsClaimed = 0;
    if (typeof s.stats.feathersEarned !== "number") s.stats.feathersEarned = 0;
    if (typeof s.stats.booksAdded !== "number") s.stats.booksAdded = 0;
    if (typeof s.stats.nightRead !== "boolean") s.stats.nightRead = false;

    s.profile.goalMinutes = [5, 10, 15, 20, 25, 30, 45].indexOf(Number(s.profile.goalMinutes)) >= 0
      ? Number(s.profile.goalMinutes)
      : 10;

    // подтягиваем массивы глав к актуальной библиотеке
    allBooksFrom(s).forEach(function (book) {
      const p = s.progress[book.id];
      if (!p) return;
      const arr = Array.isArray(p.finishedChapters) ? p.finishedChapters : [];
      p.finishedChapters = book.chapters.map(function (_, i) {
        return !!arr[i];
      });
      p.chapter = clamp(Number(p.chapter) || 0, 0, Math.max(0, book.chapters.length - 1));
      p.pct = clamp(Number(p.pct) || 0, 0, 100);
      if (book.chapters.every(function (_, i) { return p.finishedChapters[i]; })) {
        p.finished = true;
      }
    });

    Object.keys(s.days).forEach(function (key) {
      const d = s.days[key] || {};
      d.seconds = Math.max(0, Number(d.seconds) || 0);
      d.xp = Math.max(0, Number(d.xp) || 0);
      d.readXp = Math.max(0, Number(d.readXp) || 0);
      d.chapters = Math.max(0, Number(d.chapters) || 0);
      d.quizzes = Math.max(0, Number(d.quizzes) || 0);
      d.booksStarted = Math.max(0, Number(d.booksStarted) || 0);
      d.goalReached = !!d.goalReached;
      if (!(Number(d.goalMinutes) > 0)) {
        d.goalMinutes = d.goalReached
          ? clamp(Math.floor(d.seconds / 60), 5, 45)
          : s.profile.goalMinutes;
      }
      s.days[key] = d;
    });

    return s;
  }

  function init() {
    let loaded = null;
    try {
      loaded = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    } catch (err) {
      loaded = null;
    }
    state = prepareLoadedState(loaded);
    if (state.profile.onboarded) {
      reconcileStreak();
      checkGoal();
    }
    ensureQuestDate();
    save();
    return state;
  }

  function save() {
    if (!state) return false;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      events.push({ type: "storageError" });
      return false;
    }
  }

  function allBooksFrom(s) {
    return D.books.concat(s.customBooks || []);
  }

  function allSagasFrom(s) {
    return D.sagas.concat(s.customSagas || []);
  }

  function allBooks() { return allBooksFrom(state); }
  function allSagas() { return allSagasFrom(state); }
  function getBook(id) { return allBooks().find(function (b) { return b.id === id; }) || null; }
  function getSaga(id) { return allSagas().find(function (s) { return s.id === id; }) || null; }
  function booksOfSaga(sagaId) {
    return allBooks().filter(function (b) { return b.sagaId === sagaId; }).sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
  }

  /* ---------- ежедневные данные ---------- */

  function getDay(key) {
    const k = key || todayKey();
    if (!state.days[k]) {
      state.days[k] = {
        seconds: 0,
        xp: 0,
        readXp: 0,
        chapters: 0,
        quizzes: 0,
        booksStarted: 0,
        goalReached: false,
        goalMinutes: state.profile.goalMinutes
      };
    }
    return state.days[k];
  }

  function dayGoal(day) {
    return Number(day && day.goalMinutes) || state.profile.goalMinutes;
  }

  function ensureQuestDate() {
    const t = todayKey();
    if (!state.quests || state.quests.date !== t) {
      state.quests = { date: t, claimed: {}, bonus: false };
    }
    if (!state.quests.claimed) state.quests.claimed = {};
  }

  function getGoalInfo() {
    const d = getDay();
    const goalMinutes = dayGoal(d);
    const goalSec = goalMinutes * 60;
    const seconds = d.seconds || 0;
    const reached = !!d.goalReached || seconds >= goalSec;
    return {
      goalMinutes: goalMinutes,
      minutes: Math.floor(seconds / 60),
      seconds: seconds,
      percent: Math.min(100, Math.round((seconds / goalSec) * 100)),
      leftMinutes: Math.max(0, Math.ceil((goalSec - seconds) / 60)),
      reached: reached
    };
  }

  function getWeek() {
    const start = startOfWeekKey(todayKey());
    const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const t = todayKey();
    return labels.map(function (label, i) {
      const key = shiftKey(start, i);
      const d = state.days[key];
      const goalSec = dayGoal(d) * 60;
      return {
        key: key,
        label: label,
        reached: !!(d && (d.goalReached || d.seconds >= goalSec)),
        minutes: d ? Math.floor((d.seconds || 0) / 60) : 0,
        isToday: key === t,
        isFuture: key > t
      };
    });
  }

  /* ---------- уровни и статистика ---------- */

  function levelInfo(xpValue) {
    const xp = typeof xpValue === "number" ? xpValue : state.xp;
    const titles = [
      "Новичок с фонариком",
      "Читатель-исследователь",
      "Друг библиотеки",
      "Хранитель историй",
      "Книжный лис",
      "Магистр страниц",
      "Легенда полки",
      "Сова-архивариус"
    ];
    let level = 1;
    let start = 0;
    let need = 120;
    while (xp >= start + need && level < 99) {
      start += need;
      level += 1;
      need = 120 + (level - 1) * 80;
    }
    return {
      level: level,
      title: titles[Math.min(level - 1, titles.length - 1)],
      start: start,
      next: start + need,
      current: xp - start,
      need: need,
      percent: Math.round(((xp - start) / need) * 100)
    };
  }

  function totalReadingSeconds() {
    return Object.keys(state.days).reduce(function (sum, key) {
      return sum + (state.days[key].seconds || 0);
    }, 0);
  }

  function totalMinutes() {
    return Math.floor(totalReadingSeconds() / 60);
  }

  function activeDays() {
    return Object.keys(state.days).filter(function (key) {
      return (state.days[key].seconds || 0) > 0;
    }).length;
  }

  function booksFinishedCount() {
    return allBooks().filter(function (book) {
      const p = state.progress[book.id];
      return !!(p && p.finished);
    }).length;
  }

  function chaptersFinishedCount() {
    return allBooks().reduce(function (sum, book) {
      const p = state.progress[book.id];
      if (!p) return sum;
      return sum + p.finishedChapters.filter(Boolean).length;
    }, 0);
  }

  function sagasCompleteCount() {
    return allSagas().filter(function (saga) {
      const books = booksOfSaga(saga.id);
      return books.length > 0 && books.every(function (book) {
        const p = state.progress[book.id];
        return !!(p && p.finished);
      });
    }).length;
  }

  function weeklyXp() {
    const start = startOfWeekKey(todayKey());
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = state.days[shiftKey(start, i)];
      if (d) sum += d.xp || 0;
    }
    return sum;
  }

  /* ---------- XP, перья, события ---------- */

  function addXp(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    if (!n) return;
    const before = levelInfo(state.xp).level;
    state.xp += n;
    const day = getDay();
    day.xp = (day.xp || 0) + n;
    const afterInfo = levelInfo(state.xp);
    if (afterInfo.level > before) {
      events.push({
        type: "levelup",
        level: afterInfo.level,
        title: afterInfo.title
      });
    }
  }

  function addFeathers(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    if (!n) return;
    state.feathers += n;
    state.stats.feathersEarned = (state.stats.feathersEarned || 0) + n;
  }

  function drainEvents() {
    const out = events.slice();
    events = [];
    return out;
  }

  /* ---------- серия дней (огонёк) ---------- */

  function checkGoal() {
    if (!state.profile.onboarded) return;
    const day = getDay();
    const t = todayKey();
    const goalMinutes = dayGoal(day);
    const goalSec = goalMinutes * 60;
    if ((day.seconds || 0) < goalSec) return;
    if (day.goalReached && state.streak.lastGoalDate === t) return;
    if (!day.goalMinutes) day.goalMinutes = goalMinutes;
    day.goalReached = true;
    if (state.streak.lastGoalDate === t) return;

    const wasYesterday = state.streak.lastGoalDate === shiftKey(t, -1);
    const current = wasYesterday ? state.streak.current + 1 : 1;
    state.streak.current = current;
    state.streak.best = Math.max(state.streak.best || 0, current);
    state.streak.lastGoalDate = t;

    addXp(GOAL_XP);
    addFeathers(2);
    events.push({ type: "goal", streak: current });

    const milestoneDays = [3, 7, 14, 30, 50, 100, 365];
    if (milestoneDays.indexOf(current) >= 0) {
      addFeathers(10);
      events.push({ type: "milestone", days: current });
    }
    save();
  }

  function reconcileStreak() {
    if (!state.profile.onboarded) return;
    const t = todayKey();
    const last = state.streak.lastGoalDate;
    if (!last) {
      if (state.streak.current !== 0) state.streak.current = 0;
      return;
    }
    if (last === t) return;
    const gap = daysBetween(last, t);
    if (gap <= 1) return; // последняя цель была вчера — серия ещё жива
    const missing = gap - 1;
    if (missing <= (state.freezes || 0)) {
      state.freezes -= missing;
      state.streak.lastGoalDate = shiftKey(t, -1);
      events.push({ type: "freezeUsed", count: missing });
    } else {
      if (state.streak.current > 0) {
        events.push({ type: "streakLost", before: state.streak.current });
      }
      state.streak.current = 0;
      state.streak.lastGoalDate = null;
    }
    save();
  }

  /* ---------- прогресс книг ---------- */

  function ensureProgress(book) {
    if (!state.progress[book.id]) {
      state.progress[book.id] = {
        finishedChapters: book.chapters.map(function () { return false; }),
        chapter: 0,
        pct: 0,
        startedAt: Date.now(),
        lastReadAt: Date.now(),
        finished: false,
        finishedAt: null
      };
    }
    const p = state.progress[book.id];
    if (!Array.isArray(p.finishedChapters)) p.finishedChapters = [];
    while (p.finishedChapters.length < book.chapters.length) p.finishedChapters.push(false);
    p.chapter = clamp(Number(p.chapter) || 0, 0, Math.max(0, book.chapters.length - 1));
    p.pct = clamp(Number(p.pct) || 0, 0, 100);
    return p;
  }

  function openBook(book) {
    const isNew = !state.progress[book.id];
    const p = ensureProgress(book);
    if (isNew) {
      getDay().booksStarted = (getDay().booksStarted || 0) + 1;
    }
    p.lastReadAt = Date.now();
    save();
    return p;
  }

  function savePosition(book, chapterIndex, pct) {
    const p = ensureProgress(book);
    p.chapter = clamp(Number(chapterIndex) || 0, 0, book.chapters.length - 1);
    if (!p.finishedChapters[p.chapter]) {
      p.pct = clamp(Number(pct) || 0, 0, 100);
    }
    p.lastReadAt = Date.now();
    save();
    return p;
  }

  function bookPercent(book) {
    const p = state.progress[book.id];
    if (!p || !book.chapters.length) return 0;
    if (p.finished) return 100;
    const done = p.finishedChapters.filter(Boolean).length;
    const extra = p.finishedChapters[p.chapter] ? 0 : clamp(p.pct || 0, 0, 100) / 100;
    return Math.min(100, Math.round(((done + extra) / book.chapters.length) * 100));
  }

  function finishChapter(book, chapterIndex) {
    const p = ensureProgress(book);
    if (p.finishedChapters[chapterIndex]) {
      p.lastReadAt = Date.now();
      save();
      return { already: true };
    }

    p.finishedChapters[chapterIndex] = true;
    const day = getDay();
    day.chapters = (day.chapters || 0) + 1;
    addXp(CHAPTER_XP);
    addFeathers(4);

    const unreadAfter = [];
    const unreadAny = [];
    book.chapters.forEach(function (_, i) {
      if (!p.finishedChapters[i]) {
        unreadAny.push(i);
        if (i > chapterIndex) unreadAfter.push(i);
      }
    });
    const next = unreadAfter.length ? unreadAfter[0] : (unreadAny.length ? unreadAny[0] : chapterIndex);
    p.chapter = next;
    p.pct = 0;
    p.lastReadAt = Date.now();

    let bookFinished = false;
    const allDone = book.chapters.every(function (_, i) { return p.finishedChapters[i]; });
    if (allDone && !p.finished) {
      p.finished = true;
      p.finishedAt = Date.now();
      bookFinished = true;
      addXp(BOOK_XP);
      addFeathers(25);
      events.push({ type: "bookFinished", bookId: book.id, title: book.title });
    }

    checkGoal();
    save();
    checkAchievements();

    return {
      already: false,
      bookFinished: bookFinished,
      xp: CHAPTER_XP + (bookFinished ? BOOK_XP : 0),
      feathers: 4 + (bookFinished ? 25 : 0),
      nextChapter: next,
      allDone: allDone
    };
  }

  function recordQuiz(correct) {
    const day = getDay();
    if (correct) {
      addXp(QUIZ_XP);
      addFeathers(2);
      day.quizzes = (day.quizzes || 0) + 1;
    }
    save();
    checkAchievements();
    return { xp: correct ? QUIZ_XP : 0 };
  }

  function addReadingSeconds(seconds) {
    const s = clamp(Number(seconds) || 0, 0, 300);
    if (!s) return { xp: 0 };
    const day = getDay();
    day.seconds = (day.seconds || 0) + s;

    const hour = new Date().getHours();
    if (hour >= 23 || hour < 4) state.stats.nightRead = true;

    const expected = Math.floor(day.seconds / READING_STEP_SECONDS) * XP_PER_READING_STEP;
    const diff = Math.max(0, expected - (day.readXp || 0));
    if (diff > 0) {
      day.readXp = (day.readXp || 0) + diff;
      addXp(diff);
    }

    checkGoal();
    save();
    checkAchievements();
    return { xp: diff, goal: getGoalInfo() };
  }

  function getContinueBook() {
    let best = null;
    let bestTime = 0;
    allBooks().forEach(function (book) {
      const p = state.progress[book.id];
      if (!p || p.finished) return;
      if ((p.lastReadAt || 0) > bestTime) {
        bestTime = p.lastReadAt || 0;
        best = book;
      }
    });
    return best;
  }

  function getSagaStats(saga) {
    const books = booksOfSaga(saga.id);
    let chaptersDone = 0;
    let chaptersTotal = 0;
    let finishedBooks = 0;
    books.forEach(function (book) {
      chaptersTotal += book.chapters.length;
      const p = state.progress[book.id];
      if (p) {
        chaptersDone += p.finishedChapters.filter(Boolean).length;
        if (p.finished) finishedBooks += 1;
      }
    });
    const percent = books.length
      ? Math.round(books.reduce(function (sum, book) { return sum + bookPercent(book); }, 0) / books.length)
      : 0;
    return {
      books: books,
      booksCount: books.length,
      finishedBooks: finishedBooks,
      chaptersDone: chaptersDone,
      chaptersTotal: chaptersTotal,
      percent: percent,
      complete: books.length > 0 && finishedBooks === books.length,
      claimed: !!state.sagaClaims[saga.id]
    };
  }

  function claimSagaReward(sagaId) {
    const saga = getSaga(sagaId);
    if (!saga) return { ok: false };
    const stats = getSagaStats(saga);
    if (!stats.complete) return { ok: false, error: "notComplete" };
    if (state.sagaClaims[sagaId]) return { ok: false, error: "claimed" };
    state.sagaClaims[sagaId] = todayKey();
    const reward = saga.reward || { xp: 100, feathers: 20 };
    addXp(reward.xp || 100);
    addFeathers(reward.feathers || 20);
    events.push({ type: "sagaReward", saga: saga.title, xp: reward.xp, feathers: reward.feathers });
    save();
    checkAchievements();
    return { ok: true, xp: reward.xp || 0, feathers: reward.feathers || 0 };
  }

  /* ---------- ежедневные задания ---------- */

  const questTemplates = [
    {
      id: "minutes",
      icon: "⏱️",
      title: "Тихий час",
      metric: "minutes",
      xp: 20,
      feathers: 5,
      label: function (target) { return "Прочитай " + target + " минут"; }
    },
    {
      id: "chapter",
      icon: "📖",
      title: "Закрытая глава",
      metric: "chapters",
      xp: 25,
      feathers: 5,
      label: function (target) { return "Заверши " + target + " главу"; }
    },
    {
      id: "quiz",
      icon: "💡",
      title: "Верный ответ",
      metric: "quizzes",
      xp: 15,
      feathers: 5,
      label: function (target) { return "Ответь верно на вопрос главы" + (target > 1 ? " " + target + " раза" : ""); }
    },
    {
      id: "xp",
      icon: "⚡",
      title: "Разгон",
      metric: "xp",
      xp: 20,
      feathers: 5,
      label: function (target) { return "Заработай " + target + " XP за день"; }
    },
    {
      id: "start",
      icon: "🌱",
      title: "Новая история",
      metric: "booksStarted",
      xp: 20,
      feathers: 5,
      label: function () { return "Начни читать новую книгу"; }
    }
  ];

  function questMetric(metric, day) {
    if (metric === "minutes") return Math.floor((day.seconds || 0) / 60);
    if (metric === "chapters") return day.chapters || 0;
    if (metric === "quizzes") return day.quizzes || 0;
    if (metric === "xp") return day.xp || 0;
    if (metric === "booksStarted") return day.booksStarted || 0;
    return 0;
  }

  function getQuests() {
    ensureQuestDate();
    const date = state.quests.date;
    const day = getDay();
    const goal = dayGoal(day);
    const rng = mulberry32(hashString("quests:" + date));
    const minuteTarget = clamp(Math.round(goal * 0.75), 5, 30);
    const extraPool = questTemplates.filter(function (q) {
      return q.id !== "minutes" && q.id !== "chapter";
    });
    const extra = extraPool[Math.floor(rng() * extraPool.length)];
    let extraTarget = 1;
    if (extra.id === "xp") extraTarget = goal >= 20 ? 60 : 40;
    if (extra.id === "quizzes") extraTarget = 1;

    const chosen = [
      Object.assign({}, questTemplates[0], { target: minuteTarget }),
      Object.assign({}, questTemplates[1], { target: 1 }),
      Object.assign({}, extra, { target: extraTarget })
    ];

    return chosen.map(function (q) {
      const current = questMetric(q.metric, day);
      return {
        id: q.id,
        icon: q.icon,
        title: q.title,
        label: q.label(q.target),
        target: q.target,
        current: Math.min(current, q.target),
        rawCurrent: current,
        done: current >= q.target,
        claimed: !!state.quests.claimed[q.id],
        xp: q.xp,
        feathers: q.feathers
      };
    });
  }

  function questsAllClaimed() {
    return getQuests().every(function (q) { return q.claimed; });
  }

  function claimQuest(id) {
    const quests = getQuests();
    const q = quests.find(function (item) { return item.id === id; });
    if (!q || !q.done || q.claimed) return { ok: false };
    state.quests.claimed[id] = true;
    state.stats.questsClaimed = (state.stats.questsClaimed || 0) + 1;
    addXp(q.xp);
    addFeathers(q.feathers);
    save();
    checkAchievements();
    return { ok: true, xp: q.xp, feathers: q.feathers, title: q.title };
  }

  function claimQuestBonus() {
    ensureQuestDate();
    const quests = getQuests();
    if (!quests.every(function (q) { return q.claimed; }) || state.quests.bonus) {
      return { ok: false };
    }
    state.quests.bonus = true;
    addXp(10);
    addFeathers(3);
    save();
    return { ok: true, xp: 10, feathers: 3 };
  }

  /* ---------- достижения ---------- */

  function achievementList() {
    return [
      {
        id: "first_chapter", icon: "📖", title: "Первая глава", desc: "Заверши первую главу",
        reward: 10, target: 1, value: function () { return chaptersFinishedCount(); }
      },
      {
        id: "first_book", icon: "🏅", title: "Дочитал до конца", desc: "Заверши первую книгу",
        reward: 15, target: 1, value: function () { return booksFinishedCount(); }
      },
      {
        id: "first_saga", icon: "🏆", title: "Покоритель саги", desc: "Собери все книги одной саги",
        reward: 20, target: 1, value: function () { return sagasCompleteCount(); }
      },
      {
        id: "ten_chapters", icon: "🐛", title: "Книжный червь", desc: "Заверши 10 глав",
        reward: 15, target: 10, value: function () { return chaptersFinishedCount(); }
      },
      {
        id: "three_books", icon: "📚", title: "Малая полка", desc: "Заверши 3 книги",
        reward: 20, target: 3, value: function () { return booksFinishedCount(); }
      },
      {
        id: "streak3", icon: "🔥", title: "Искра", desc: "Читай 3 дня подряд",
        reward: 10, target: 3, value: function () { return state.streak.best || 0; }
      },
      {
        id: "streak7", icon: "🕯️", title: "Семь вечеров", desc: "Читай 7 дней подряд",
        reward: 20, target: 7, value: function () { return state.streak.best || 0; }
      },
      {
        id: "level3", icon: "🌿", title: "Друг библиотеки", desc: "Достигни 3 уровня",
        reward: 10, target: 3, value: function () { return levelInfo().level; }
      },
      {
        id: "level5", icon: "🦊", title: "Книжный лис", desc: "Достигни 5 уровня",
        reward: 20, target: 5, value: function () { return levelInfo().level; }
      },
      {
        id: "minutes100", icon: "⏳", title: "Сто минут", desc: "Прочитай в сумме 100 минут",
        reward: 15, target: 100, value: function () { return totalMinutes(); }
      },
      {
        id: "minutes600", icon: "🌙", title: "Десять часов", desc: "Прочитай в сумме 10 часов",
        reward: 30, target: 600, value: function () { return totalMinutes(); }
      },
      {
        id: "quests10", icon: "🎯", title: "Три из трёх", desc: "Выполни 10 ежедневных заданий",
        reward: 15, target: 10, value: function () { return state.stats.questsClaimed || 0; }
      },
      {
        id: "own_book", icon: "✍️", title: "Свой автор", desc: "Добавь в библиотеку свою книгу",
        reward: 15, target: 1, value: function () { return state.stats.booksAdded || 0; }
      },
      {
        id: "night_owl", icon: "🦉", title: "Полночный читатель", desc: "Почитай после 23:00",
        reward: 10, target: 1, value: function () { return state.stats.nightRead ? 1 : 0; }
      },
      {
        id: "feathers100", icon: "🪶", title: "Коллекционер", desc: "Заработай 100 перьев",
        reward: 15, target: 100, value: function () { return state.stats.feathersEarned || 0; }
      },
      {
        id: "all_sagas", icon: "🌟", title: "Все истории", desc: "Заверши все саги библиотеки",
        reward: 40, target: function () { return Math.max(1, allSagas().length); }, value: function () { return sagasCompleteCount(); }
      }
    ];
  }

  function getAchievements() {
    return achievementList().map(function (a) {
      const target = typeof a.target === "function" ? a.target() : a.target;
      const value = a.value();
      return {
        id: a.id,
        icon: a.icon,
        title: a.title,
        desc: a.desc,
        reward: a.reward,
        target: target,
        value: Math.min(value, target),
        unlocked: !!state.achievements[a.id],
        unlockedAt: state.achievements[a.id] || null
      };
    });
  }

  function checkAchievements() {
    if (checkingAchievements || !state) return [];
    checkingAchievements = true;
    const unlocked = [];
    try {
      achievementList().forEach(function (a) {
        if (state.achievements[a.id]) return;
        const target = typeof a.target === "function" ? a.target() : a.target;
        if (a.value() >= target) {
          state.achievements[a.id] = todayKey();
          addFeathers(a.reward);
          unlocked.push(a);
          events.push({
            type: "achievement",
            id: a.id,
            title: a.title,
            icon: a.icon,
            reward: a.reward
          });
        }
      });
    } finally {
      checkingAchievements = false;
    }
    if (unlocked.length) save();
    return unlocked;
  }

  /* ---------- лига ---------- */

  function leagueData() {
    const level = levelInfo().level;
    const tiers = [
      { min: 0, name: "Бронзовая лига" },
      { min: 3, name: "Серебряная лига" },
      { min: 5, name: "Золотая лига" },
      { min: 8, name: "Изумрудная лига" }
    ];
    let tier = tiers[0].name;
    tiers.forEach(function (t) { if (level >= t.min) tier = t.name; });

    const weekStart = startOfWeekKey(todayKey());
    const rng = mulberry32(hashString("league:" + weekStart));
    const names = D.leagueNames.slice();
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = names[i];
      names[i] = names[j];
      names[j] = tmp;
    }
    const avatars = D.leagueAvatars;
    const bots = names.slice(0, 29).map(function (name, i) {
      return {
        id: "bot-" + i,
        name: name,
        avatar: avatars[Math.floor(rng() * avatars.length)],
        xp: Math.floor(10 + rng() * 240),
        me: false
      };
    });
    const me = {
      id: "me",
      name: state.profile.name || "Ты",
      avatar: "🦉",
      xp: weeklyXp(),
      me: true
    };
    const all = bots.concat([me]).sort(function (a, b) {
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.me ? -1 : 1;
    });
    const rank = all.findIndex(function (p) { return p.me; }) + 1;
    return {
      tier: tier,
      weekStart: weekStart,
      all: all,
      rank: rank,
      total: all.length,
      promotionZone: 5
    };
  }

  /* ---------- магазин ---------- */

  function buyFreeze() {
    if (state.freezes >= MAX_FREEZES) return { ok: false, error: "max" };
    if (state.feathers < FREEZE_COST) return { ok: false, error: "feathers" };
    state.feathers -= FREEZE_COST;
    state.freezes += 1;
    save();
    return { ok: true, freezes: state.freezes };
  }

  /* ---------- своя библиотека ---------- */

  function addCustomBook(payload) {
    const title = String(payload.title || "").trim() || "Без названия";
    const author = String(payload.author || "").trim() || "Неизвестный автор";
    const chapters = (payload.chapters || []).filter(function (c) {
      return c && c.paragraphs && c.paragraphs.length;
    }).map(function (c) {
      return {
        title: String(c.title || "Глава").trim(),
        paragraphs: c.paragraphs.map(function (p) { return String(p).trim(); }).filter(Boolean)
      };
    });
    if (!chapters.length) return { ok: false, error: "no chapters" };

    const palette = D.palettes[hashString(title) % D.palettes.length];
    const emoji = D.customEmojis[hashString(author + title) % D.customEmojis.length];
    const id = "custom-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 9999).toString(36);

    let sagaId = null;
    const sagaTitle = String(payload.sagaTitle || "").trim();
    if (sagaTitle) {
      const existing = state.customSagas.find(function (s) {
        return s.title.toLowerCase() === sagaTitle.toLowerCase();
      });
      if (existing) {
        sagaId = existing.id;
      } else {
        sagaId = "saga-custom-" + Date.now().toString(36);
        state.customSagas.push({
          id: sagaId,
          title: sagaTitle,
          author: author,
          emoji: "📚",
          colors: palette,
          tagline: "Твоя личная серия.",
          description: "Серия книг, добавленных тобой. Собирай свои истории в саги.",
          reward: { xp: 80, feathers: 15 },
          custom: true
        });
      }
    }

    const order = sagaId ? booksOfSaga(sagaId).length + 1 : 1;
    const book = {
      id: id,
      sagaId: sagaId,
      order: order,
      title: title,
      author: author,
      emoji: emoji,
      colors: palette,
      tags: ["моя библиотека"],
      description: String(payload.description || "Книга из твоей личной библиотеки.").trim(),
      custom: true,
      chapters: chapters.map(function (c) {
        return {
          title: c.title,
          paragraphs: c.paragraphs
        };
      })
    };
    state.customBooks.push(book);
    state.stats.booksAdded = (state.stats.booksAdded || 0) + 1;
    save();
    checkAchievements();
    return { ok: true, id: book.id, book: book };
  }

  function deleteCustomBook(bookId) {
    const book = state.customBooks.find(function (b) { return b.id === bookId; });
    if (!book) return false;
    state.customBooks = state.customBooks.filter(function (b) { return b.id !== bookId; });
    delete state.progress[bookId];
    const sagaId = book.sagaId;
    if (sagaId) {
      const remaining = state.customBooks.filter(function (b) { return b.sagaId === sagaId; });
      if (!remaining.length) {
        state.customSagas = state.customSagas.filter(function (s) { return s.id !== sagaId; });
        delete state.sagaClaims[sagaId];
      } else {
        remaining.sort(function (a, b) { return a.order - b.order; }).forEach(function (b, i) {
          b.order = i + 1;
        });
      }
    }
    save();
    return true;
  }

  /* ---------- настройки ---------- */

  function updateSettings(patch) {
    state.settings = Object.assign({}, state.settings, patch || {});
    save();
    return state.settings;
  }

  function setGoal(minutes) {
    const value = Number(minutes);
    if ([5, 10, 15, 20, 25, 30, 45].indexOf(value) < 0) return false;
    state.profile.goalMinutes = value;
    const day = getDay();
    if (!day.goalReached) day.goalMinutes = value;
    checkGoal();
    save();
    return true;
  }

  function setName(name) {
    const clean = String(name || "").trim().slice(0, 30);
    if (!clean) return false;
    state.profile.name = clean;
    save();
    return true;
  }

  function reset() {
    state = defaultState();
    events = [];
    try {
      localStorage.removeItem(LS_KEY);
    } catch (err) { /* пусто */ }
    save();
    return state;
  }

  /* ---------- демо-профиль ---------- */

  function seedDemo() {
    const t = todayKey();
    state = defaultState();
    state.profile = {
      name: "Марк",
      goalMinutes: 15,
      onboarded: true,
      createdAt: Date.now() - 86400000 * 32
    };
    state.xp = 340;
    state.feathers = 65;
    state.freezes = 1;
    state.streak = { current: 4, best: 6, lastGoalDate: shiftKey(t, -1) };

    const rng = mulberry32(hashString("sova-demo"));
    for (let i = 1; i <= 48; i++) {
      const key = shiftKey(t, -i);
      if (rng() < 0.38) continue;
      const minutes = 4 + Math.floor(rng() * 24);
      const seconds = minutes * 60 + Math.floor(rng() * 50);
      state.days[key] = {
        seconds: seconds,
        xp: minutes * 3 + Math.floor(rng() * 30),
        readXp: Math.floor(seconds / READING_STEP_SECONDS),
        chapters: rng() < 0.35 ? 1 : 0,
        quizzes: rng() < 0.25 ? 1 : 0,
        booksStarted: rng() < 0.08 ? 1 : 0,
        goalReached: minutes >= 15,
        goalMinutes: 15
      };
    }
    for (let i = 1; i <= 4; i++) {
      const key = shiftKey(t, -i);
      state.days[key] = {
        seconds: (15 + i) * 60 + 20,
        xp: 70 + i * 11,
        readXp: Math.floor(((15 + i) * 60 + 20) / READING_STEP_SECONDS),
        chapters: 1,
        quizzes: 1,
        booksStarted: i === 3 ? 1 : 0,
        goalReached: true,
        goalMinutes: 15
      };
    }
    state.days[t] = {
      seconds: 400,
      xp: 78,
      readXp: Math.floor(400 / READING_STEP_SECONDS),
      chapters: 0,
      quizzes: 1,
      booksStarted: 1,
      goalReached: false,
      goalMinutes: 15
    };

    const now = Date.now();
    state.progress["tishinka-dom"] = {
      finishedChapters: [true, true, true],
      chapter: 2,
      pct: 100,
      startedAt: now - 86400000 * 19,
      lastReadAt: now - 86400000 * 2,
      finished: true,
      finishedAt: now - 86400000 * 2
    };
    state.progress["tishinka-keeper"] = {
      finishedChapters: [true, false, false],
      chapter: 1,
      pct: 25,
      startedAt: now - 86400000 * 6,
      lastReadAt: now - 1000 * 60 * 70,
      finished: false,
      finishedAt: null
    };
    state.progress["sol-chasy"] = {
      finishedChapters: [true, false, false],
      chapter: 1,
      pct: 4,
      startedAt: now - 86400000 * 12,
      lastReadAt: now - 86400000 * 3,
      finished: false,
      finishedAt: null
    };
    state.stats = {
      questsClaimed: 6,
      feathersEarned: 92,
      booksAdded: 0,
      nightRead: false
    };
    state.quests = { date: t, claimed: {}, bonus: false };
    state.settings = { theme: "sepia", fontSize: 19, lineHeight: 1.8, sound: true, ttsRate: 0.95 };
    const quiet = events;
    events = [];
    checkAchievements();
    events = quiet;
    save();
    return state;
  }

  /* ---------- публичное API ---------- */

  const api = {
    FREEZE_COST: FREEZE_COST,
    MAX_FREEZES: MAX_FREEZES,
    init: init,
    save: save,
    drainEvents: drainEvents,
    dateKey: dateKey,
    todayKey: todayKey,
    parseDateKey: parseDateKey,
    shiftKey: shiftKey,
    daysBetween: daysBetween,
    startOfWeekKey: startOfWeekKey,
    allBooks: allBooks,
    allSagas: allSagas,
    getBook: getBook,
    getSaga: getSaga,
    booksOfSaga: booksOfSaga,
    getProgress: function (bookId) { return state.progress[bookId] || null; },
    ensureProgress: ensureProgress,
    openBook: openBook,
    savePosition: savePosition,
    bookPercent: bookPercent,
    finishChapter: finishChapter,
    recordQuiz: recordQuiz,
    addReadingSeconds: addReadingSeconds,
    getContinueBook: getContinueBook,
    getSagaStats: getSagaStats,
    claimSagaReward: claimSagaReward,
    getDay: getDay,
    getGoalInfo: getGoalInfo,
    getWeek: getWeek,
    getQuests: getQuests,
    questsAllClaimed: questsAllClaimed,
    claimQuest: claimQuest,
    claimQuestBonus: claimQuestBonus,
    checkGoal: checkGoal,
    reconcileStreak: reconcileStreak,
    checkAchievements: checkAchievements,
    getAchievements: getAchievements,
    levelInfo: levelInfo,
    totalMinutes: totalMinutes,
    totalReadingSeconds: totalReadingSeconds,
    activeDays: activeDays,
    booksFinishedCount: booksFinishedCount,
    chaptersFinishedCount: chaptersFinishedCount,
    sagasCompleteCount: sagasCompleteCount,
    weeklyXp: weeklyXp,
    leagueData: leagueData,
    buyFreeze: buyFreeze,
    addCustomBook: addCustomBook,
    deleteCustomBook: deleteCustomBook,
    updateSettings: updateSettings,
    setGoal: setGoal,
    setName: setName,
    reset: reset,
    seedDemo: seedDemo
  };

  Object.defineProperty(api, "state", {
    get: function () { return state; },
    enumerable: true
  });

  window.SovaStore = api;
})();
