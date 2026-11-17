/* Сова — визуальные помощники, листы, тосты, звуки и конфетти. */
(function () {
  "use strict";

  const D = window.SOVA_DATA;
  const S = window.SovaStore;
  const OVERLAY = document.getElementById("overlay-root");
  const TOAST = document.getElementById("toast-root");

  const hooks = { onSheetOpen: null, onSheetClose: null };
  let currentSheet = null;
  let lastFocused = null;
  let audioContext = null;
  let numberFormat = null;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function fmt(n) {
    if (!numberFormat) numberFormat = new Intl.NumberFormat("ru-RU");
    return numberFormat.format(Number(n) || 0);
  }

  function clampDisplay(n) {
    return Math.max(0, Math.round(Number(n) || 0));
  }

  function plural(n, one, few, many) {
    const abs = Math.abs(Math.round(Number(n) || 0));
    const n10 = abs % 10;
    const n100 = abs % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  function daysWord(n) { return plural(n, "день", "дня", "дней"); }
  function minutesWord(n) { return plural(n, "минута", "минуты", "минут"); }
  function booksWord(n) { return plural(n, "книга", "книги", "книг"); }
  function booksDoneWord(n) { return plural(n, "книга завершена", "книги завершены", "книг завершено"); }
  function chaptersWord(n) { return plural(n, "глава", "главы", "глав"); }
  function feathersWord(n) { return plural(n, "перо", "пера", "перьев"); }
  function peopleWord(n) { return plural(n, "читатель", "читателя", "читателей"); }

  function capitalize(text) {
    const value = String(text || "");
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function greeting(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 5 && hour < 12) return "Доброе утро";
    if (hour >= 12 && hour < 18) return "Добрый день";
    if (hour >= 18 && hour < 23) return "Добрый вечер";
    return "Доброй ночи";
  }

  function longDate(date) {
    const d = date || new Date();
    try {
      return capitalize(new Intl.DateTimeFormat("ru-RU", {
        weekday: "long", day: "numeric", month: "long"
      }).format(d));
    } catch (err) {
      return "";
    }
  }

  function shortDateFromKey(key) {
    if (!key) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(S.parseDateKey(key));
    } catch (err) {
      return key;
    }
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function markSVG() {
    return '<svg class="brandsvg" viewBox="0 0 48 48" aria-hidden="true">' +
      '<rect width="48" height="48" rx="15" fill="#205c45"/>' +
      '<path d="M12 17c-2-5-1-8 2-11 2 4 5 7 8 8z" fill="#f7e7c2"/>' +
      '<path d="M36 17c2-5 1-8-2-11-2 4-5 7-8 8z" fill="#f7e7c2"/>' +
      '<ellipse cx="24" cy="26" rx="15" ry="16" fill="#f7e7c2"/>' +
      '<circle cx="18.5" cy="24" r="5.4" fill="#fffdf4"/>' +
      '<circle cx="29.5" cy="24" r="5.4" fill="#fffdf4"/>' +
      '<circle cx="19.4" cy="24.4" r="2.4" fill="#22352d"/>' +
      '<circle cx="28.6" cy="24.4" r="2.4" fill="#22352d"/>' +
      '<path d="M24 30l-3-4h6z" fill="#eda338"/>' +
      '<path d="M16 35c5 3 11 3 16 0" stroke="#2c7455" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  function owlSVG(extraClass) {
    return '<svg class="owl ' + (extraClass || "") + '" viewBox="0 0 240 250" aria-hidden="true">' +
      '<ellipse cx="120" cy="238" rx="68" ry="9" fill="rgba(20,40,32,.16)"/>' +
      '<path d="M65 91c-12-27-6-47 10-61 12 18 26 32 43 40z" fill="#2c7455"/>' +
      '<path d="M175 91c12-27 6-47-10-61-12 18-26 32-43 40z" fill="#2c7455"/>' +
      '<ellipse cx="43" cy="151" rx="20" ry="50" fill="#2c7455" transform="rotate(20 43 151)"/>' +
      '<ellipse cx="197" cy="151" rx="20" ry="50" fill="#2c7455" transform="rotate(-20 197 151)"/>' +
      '<ellipse cx="120" cy="142" rx="76" ry="84" fill="#f7e7c2"/>' +
      '<ellipse cx="120" cy="157" rx="59" ry="64" fill="#f1d9a9"/>' +
      '<circle cx="89" cy="119" r="34" fill="#fffdf4"/>' +
      '<circle cx="151" cy="119" r="34" fill="#fffdf4"/>' +
      '<circle cx="96" cy="122" r="14" fill="#22352d"/>' +
      '<circle cx="144" cy="122" r="14" fill="#22352d"/>' +
      '<circle cx="91" cy="116" r="4.5" fill="#ffffff"/>' +
      '<circle cx="139" cy="116" r="4.5" fill="#ffffff"/>' +
      '<circle cx="89" cy="119" r="42" fill="none" stroke="#c78a2d" stroke-width="2.2"/>' +
      '<circle cx="151" cy="119" r="42" fill="none" stroke="#c78a2d" stroke-width="2.2"/>' +
      '<path d="M130 112c5-7 12-7 17 0" stroke="#c78a2d" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M120 138l-11-14h22z" fill="#eda338"/>' +
      '<ellipse cx="78" cy="158" rx="14" ry="8" fill="#eaa58d" opacity=".55"/>' +
      '<ellipse cx="162" cy="158" rx="14" ry="8" fill="#eaa58d" opacity=".55"/>' +
      '<g>' +
      '<path d="M64 191c19-8 38-7 55 2v37c-17-8-36-9-55-2z" fill="#fdf3d9" stroke="#d8bd87" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M176 191c-19-8-38-7-55 2v37c17-8 36-9 55-2z" fill="#fff8e7" stroke="#d8bd87" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M120 193v37" stroke="#c7a469" stroke-width="3"/>' +
      '<path d="M76 199c13-4 25-3 36 1M76 207c13-4 25-3 36 1" stroke="#e2cda3" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M128 200c11-4 23-5 36-1M128 208c11-4 23-5 36-1" stroke="#e2cda3" stroke-width="2" stroke-linecap="round"/>' +
      '</g>' +
      '<path d="M203 95l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f4c65e"/>' +
      '<path d="M41 111l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f4c65e" opacity=".8"/>' +
      '<circle cx="212" cy="137" r="3" fill="#f4c65e" opacity=".7"/>' +
      '</svg>';
  }

  function cover(book, size, extraClass) {
    const saga = S.getSaga(book.sagaId);
    const kicker = saga ? "Книга " + book.order : "Отдельная история";
    return '<div class="cover cover--' + (size || "md") + " " + (extraClass || "") + '" style="--c1:' +
      esc(book.colors[0]) + ";--c2:" + esc(book.colors[1]) + '" aria-hidden="true">' +
      '<span class="cover__glow"></span>' +
      '<span class="cover__top">' +
      '<span class="cover__badge">' + esc(book.emoji) + "</span>" +
      '<span class="cover__kicker">' + esc(kicker) + "</span>" +
      "</span>" +
      '<span class="cover__bottom">' +
      '<span class="cover__title">' + esc(book.title) + "</span>" +
      '<span class="cover__author">' + esc(book.author) + "</span>" +
      "</span></div>";
  }

  function bar(percent, extraClass) {
    const value = Math.round(clamp(percent, 0, 100));
    return '<span class="bar ' + (extraClass || "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value + '">' +
      '<span class="bar__fill" style="width:' + value + '%"></span></span>';
  }

  function ring(percent, size, stroke, label) {
    const value = clamp(percent, 0, 100);
    const s = size || 64;
    const sw = stroke || 6;
    const radius = (s - sw) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const center = s / 2;
    return '<span class="ring" style="width:' + s + "px;height:" + s + 'px">' +
      '<svg viewBox="0 0 ' + s + " " + s + '" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<circle cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="none" stroke="var(--ring-track, rgba(32,92,69,.12))" stroke-width="' + sw + '"/>' +
      '<circle class="ring__value" cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="none" stroke="var(--ring-color, var(--primary))" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 ' + center + " " + center + ')"/>' +
      "</svg>" +
      '<span class="ring__label">' + (label == null ? Math.round(value) + "%" : esc(label)) + "</span>" +
      "</span>";
  }

  function wordsIn(text) {
    return String(text || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function chapterMinutes(chapter) {
    const places = chapter && chapter.paragraphs ? chapter.paragraphs.length : 0;
    const words = chapter && chapter.paragraphs ? wordsIn(chapter.paragraphs.join(" ")) : places * 50;
    return Math.max(1, Math.round(words / 150));
  }

  function bookMinutes(book) {
    return book.chapters.reduce(function (sum, chapter) {
      return sum + chapterMinutes(chapter);
    }, 0);
  }

  function statusOf(book) {
    const progress = S.getProgress(book.id);
    if (progress && progress.finished) return "done";
    if (progress) return "reading";
    return "new";
  }

  function nextChapterIndex(book) {
    const progress = S.getProgress(book.id);
    if (!progress) return 0;
    if (progress.finished) return 0;
    return clamp(progress.chapter, 0, book.chapters.length - 1);
  }

  /* ---------- звук ---------- */

  function soundOn() {
    return !!(S.state && S.state.settings && S.state.settings.sound);
  }

  function ensureAudio() {
    if (audioContext) return audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioContext = new Ctx();
    } catch (err) {
      audioContext = null;
    }
    return audioContext;
  }

  function note(ctx, frequency, start, duration, volume, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playSound(kind) {
    if (!soundOn() || document.hidden) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime + 0.02;
      if (kind === "correct" || kind === "success") {
        note(ctx, 523.25, now, 0.16, 0.035, "sine");
        note(ctx, 783.99, now + 0.09, 0.2, 0.03, "sine");
      } else if (kind === "wrong") {
        note(ctx, 246.94, now, 0.16, 0.03, "triangle");
        note(ctx, 196, now + 0.12, 0.2, 0.025, "triangle");
      } else if (kind === "level") {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
          note(ctx, freq, now + i * 0.08, 0.22, 0.032, "sine");
        });
      } else if (kind === "coin") {
        note(ctx, 987.77, now, 0.1, 0.025, "triangle");
        note(ctx, 1318.51, now + 0.08, 0.16, 0.022, "triangle");
      } else {
        note(ctx, 440, now, 0.08, 0.018, "sine");
      }
    } catch (err) { /* звук не критичен */ }
  }

  /* ---------- конфетти ---------- */

  function confetti(count) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f2b13c", "#2f7d5c", "#e87754", "#f7e7c2", "#7fc8b0", "#f4d06f"];
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");
    const total = count || 28;
    for (let i = 0; i < total; i++) {
      const piece = document.createElement("i");
      const size = 6 + Math.random() * 7;
      piece.style.left = (Math.random() * 100) + "%";
      piece.style.width = size + "px";
      piece.style.height = (size * (Math.random() > 0.4 ? 1.6 : 0.7)) + "px";
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
      piece.style.setProperty("--turn", (Math.random() * 620 - 310) + "deg");
      piece.style.setProperty("--delay", (Math.random() * 260) + "ms");
      piece.style.setProperty("--fall", (1900 + Math.random() * 1200) + "ms");
      if (i % 4 === 0) piece.style.borderRadius = "50%";
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(function () {
      layer.classList.add("is-gone");
      setTimeout(function () { layer.remove(); }, 500);
    }, 2900);
  }

  /* ---------- тосты ---------- */

  function toast(message, options) {
    const opts = options || {};
    if (!TOAST) return;
    const element = document.createElement("div");
    element.className = "toast toast--" + (opts.tone || "default");
    element.innerHTML = '<span class="toast__icon">' + (opts.icon || "✨") + "</span>" +
      '<span class="toast__body">' +
      (opts.title ? '<strong>' + esc(opts.title) + "</strong>" : "") +
      "<span>" + esc(message) + "</span></span>";
    TOAST.appendChild(element);
    while (TOAST.children.length > 3) TOAST.removeChild(TOAST.firstElementChild);
    requestAnimationFrame(function () { element.classList.add("is-in"); });
    setTimeout(function () {
      element.classList.remove("is-in");
      element.classList.add("is-out");
      setTimeout(function () { element.remove(); }, 320);
    }, opts.duration || 3400);
    if (navigator.vibrate && opts.vibrate) {
      try { navigator.vibrate(18); } catch (err) { /* пусто */ }
    }
  }

  /* ---------- нижние листы ---------- */

  function closeSheet(immediate) {
    if (!currentSheet) return;
    const node = currentSheet;
    currentSheet = null;
    document.body.classList.remove("sheet-open");
    node.classList.remove("is-open");
    if (hooks.onSheetClose) { try { hooks.onSheetClose(); } catch (err) { /* пусто */ } }
    if (immediate) {
      node.remove();
    } else {
      setTimeout(function () { node.remove(); }, 240);
    }
    if (lastFocused && typeof lastFocused.focus === "function") {
      try { lastFocused.focus({ preventScroll: true }); } catch (err) { /* пусто */ }
    }
    lastFocused = null;
  }

  function openSheet(options) {
    const opts = options || {};
    closeSheet(true);
    if (hooks.onSheetOpen) { try { hooks.onSheetOpen(); } catch (err) { /* пусто */ } }
    lastFocused = document.activeElement;
    const dismissible = opts.dismissible !== false;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML =
      (dismissible
        ? '<button class="overlay__backdrop" data-action="close-sheet" tabindex="-1" aria-label="Закрыть"></button>'
        : '<div class="overlay__backdrop"></div>') +
      '<section class="sheet ' + (opts.className || "") + '" role="dialog" aria-modal="true"' +
      (opts.theme ? ' data-theme="' + esc(opts.theme) + '"' : "") + ">" +
      '<div class="sheet__grab"></div>' +
      '<header class="sheet__head"><div>' +
      (opts.eyebrow ? '<span class="sheet__eyebrow">' + opts.eyebrow + "</span>" : "") +
      "<h2>" + (opts.title || "") + "</h2></div>" +
      (dismissible ? '<button class="icon-btn" data-action="close-sheet" aria-label="Закрыть">' + icon("close") + "</button>" : "") +
      "</header>" +
      '<div class="sheet__body">' + (opts.html || "") + "</div>" +
      (opts.footer ? '<footer class="sheet__foot">' + opts.footer + "</footer>" : "") +
      "</section>";
    OVERLAY.appendChild(overlay);
    document.body.classList.add("sheet-open");
    currentSheet = overlay;
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });
    setTimeout(function () {
      const target = overlay.querySelector(".sheet__body button:not([disabled]), .sheet__body a, .sheet__body input, .sheet__head button");
      if (target && typeof target.focus === "function") {
        try { target.focus({ preventScroll: true }); } catch (err) { /* пусто */ }
      }
    }, 120);
  }

  function isSheetOpen() {
    return !!currentSheet;
  }

  /* ---------- события мотивации ---------- */

  function flushEvents() {
    const events = S.drainEvents();
    events.forEach(function (event, index) {
      if (event.type === "goal") {
        toast("Цель дня выполнена. Огонёк в безопасности!", {
          icon: "🔥", title: "Огонёк: " + event.streak + " " + daysWord(event.streak), tone: "flame", vibrate: true
        });
        confetti(22);
        playSound("success");
      } else if (event.type === "milestone") {
        toast("Ты в ударе. Не останавливайся!", {
          icon: "🏆", title: event.days + " " + daysWord(event.days) + " подряд!", tone: "gold", vibrate: true
        });
        confetti(48);
        playSound("level");
      } else if (event.type === "levelup") {
        toast("Теперь ты — " + event.title, {
          icon: "⭐", title: "Уровень " + event.level + "!", tone: "gold", vibrate: true
        });
        confetti(34);
        playSound("level");
      } else if (event.type === "achievement") {
        toast("Награда: +" + event.reward + " " + feathersWord(event.reward), {
          icon: event.icon, title: "Достижение: " + event.title, tone: "green", vibrate: true
        });
        playSound("coin");
      } else if (event.type === "freezeUsed") {
        toast("Осталось заморозок: " + S.state.freezes, {
          icon: "❄️", title: "Заморозка спасла огонёк"
        });
      } else if (event.type === "streakLost") {
        toast("Одна глава сегодня — и начнётся новая серия.", {
          icon: "🌱", title: "Огонёк погас"
        });
      } else if (event.type === "sagaReward") {
        toast("+" + event.xp + " XP · +" + event.feathers + " перьев", {
          icon: "🎁", title: "Сага «" + event.saga + "» собрана!", tone: "gold", vibrate: true
        });
        confetti(42);
        playSound("level");
      } else if (event.type === "storageError") {
        toast("Браузер не дал сохранить прогресс. Освободи место в хранилище.", {
          icon: "⚠️", title: "Не удалось сохранить", tone: "warn", duration: 5000
        });
      }
      // bookFinished показывает отдельный праздничный лист — здесь его не дублируем
    });
    return events;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isSheetOpen()) {
      event.preventDefault();
      closeSheet();
    }
  });

  window.SovaUI = {
    hooks: hooks,
    esc: esc,
    fmt: fmt,
    clamp: clamp,
    clampDisplay: clampDisplay,
    plural: plural,
    daysWord: daysWord,
    minutesWord: minutesWord,
    booksWord: booksWord,
    booksDoneWord: booksDoneWord,
    chaptersWord: chaptersWord,
    feathersWord: feathersWord,
    peopleWord: peopleWord,
    capitalize: capitalize,
    greeting: greeting,
    longDate: longDate,
    shortDateFromKey: shortDateFromKey,
    icon: icon,
    markSVG: markSVG,
    owlSVG: owlSVG,
    cover: cover,
    bar: bar,
    ring: ring,
    wordsIn: wordsIn,
    chapterMinutes: chapterMinutes,
    bookMinutes: bookMinutes,
    statusOf: statusOf,
    nextChapterIndex: nextChapterIndex,
    playSound: playSound,
    confetti: confetti,
    toast: toast,
    openSheet: openSheet,
    closeSheet: closeSheet,
    isSheetOpen: isSheetOpen,
    flushEvents: flushEvents
  };
})();
