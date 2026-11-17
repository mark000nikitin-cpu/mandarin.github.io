/* Сова — вход в приложение, маршруты, обработка действий и установка PWA. */
(function () {
  "use strict";

  const D = window.SOVA_DATA;
  const S = window.SovaStore;
  const U = window.SovaUI;
  const P = window.SovaPages;
  const R = window.SovaReader;
  const SH = window.SovaSheets;

  const APP = document.getElementById("app");
  const DEFAULT_TITLE = "Сова — Читай. Расти. Возвращайся.";
  const APP_THEME_COLOR = "#205c45";
  const READER_THEMES = { light: "#fbf8f1", sepia: "#f3e6ce", night: "#17201c" };

  const model = {
    route: null,
    reader: null,
    onboarding: { step: 0, goal: 15, name: "" },
    library: { filter: "all", search: "" },
    needsRefresh: false,
    seededDemo: false
  };

  /* ---------- адреса ---------- */

  function parseHash() {
    const raw = String(location.hash || "").replace(/^#/, "");
    if (!raw || raw === "/") return { name: "home" };
    const parts = raw.split("?")[0].split("/").filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    });
    const first = parts[0];
    if (first === "home" || first === "library" || first === "sagas" || first === "profile" || first === "league") {
      return { name: first };
    }
    if (first === "saga" && parts[1]) return { name: "saga", id: parts[1] };
    if (first === "book" && parts[1]) return { name: "book", id: parts[1] };
    if (first === "read" && parts[1]) {
      const chapter = parts[2] === undefined ? null : Number(parts[2]);
      return {
        name: "read",
        id: parts[1],
        chapter: Number.isFinite(chapter) ? chapter : null
      };
    }
    return { name: "home", unknown: true };
  }

  function normalizeHash(hash) {
    let value = String(hash || "").trim();
    if (!value) return "#/home";
    if (value.charAt(0) !== "#") value = "#" + (value.charAt(0) === "/" ? "" : "/") + value;
    return value;
  }

  function go(hash) {
    const target = normalizeHash(hash);
    if (location.hash === target) {
      render();
      return;
    }
    location.hash = target;
  }

  function refresh() {
    if (model.reader && model.route && model.route.name === "read") return;
    render(true);
  }

  function markNeedsRefresh() {
    model.needsRefresh = true;
  }

  /* ---------- оформление ---------- */

  function setThemeColor(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  }

  function readerThemeColor() {
    const theme = S.state && S.state.settings ? S.state.settings.theme : "sepia";
    return READER_THEMES[theme] || READER_THEMES.sepia;
  }

  function setTitle(text) {
    document.title = text || DEFAULT_TITLE;
  }

  function notFoundPage(title, text) {
    return P.shell(
      '<div class="page"><div class="empty-state empty-state--page">' +
      U.owlSVG("owl--tiny") +
      "<h3>" + U.esc(title) + "</h3><p>" + U.esc(text) + "</p>" +
      '<a class="btn btn--primary" href="#/library">В библиотеку</a>' +
      "</div></div>",
      "library"
    );
  }

  /* ---------- отрисовка ---------- */

  function render(keepScroll) {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const route = parseHash();

    if (model.reader) {
      try { model.reader.destroy(); } catch (err) { /* пусто */ }
      model.reader = null;
    }
    if (U.isSheetOpen()) U.closeSheet(true);
    model.needsRefresh = false;
    model.route = route;

    document.body.classList.toggle("is-reader", route.name === "read");
    document.body.classList.toggle("is-onboarding", !S.state.profile.onboarded);
    document.body.classList.toggle("is-standalone", SH.isStandalone());
    document.body.dataset.route = route.name;

    if (!keepScroll) {
      window.scrollTo(0, 0);
    }

    if (!S.state.profile.onboarded) {
      setTitle("Сова — начнём");
      setThemeColor(APP_THEME_COLOR);
      APP.innerHTML = P.onboarding(model.onboarding);
      if (keepScroll) window.scrollTo(0, 0);
      return;
    }

    if (route.name === "read") {
      renderReader(route);
      return;
    }

    let content = "";
    let active = "home";
    let title = DEFAULT_TITLE;

    if (route.name === "home") {
      content = P.home();
      active = "home";
      title = DEFAULT_TITLE;
    } else if (route.name === "library") {
      content = P.library(model.library);
      active = "library";
      title = "Библиотека — Сова";
    } else if (route.name === "sagas") {
      content = P.sagas();
      active = "sagas";
      title = "Саги — Сова";
    } else if (route.name === "saga") {
      const saga = S.getSaga(route.id);
      if (saga) {
        content = P.sagaPage(route.id);
        title = saga.title + " — Сова";
      } else {
        content = notFoundPage("Сага не найдена", "Возможно, она осталась на другой полке. Открой список саг и выбери историю заново.");
        title = "Сага не найдена — Сова";
      }
      active = "sagas";
    } else if (route.name === "book") {
      const book = S.getBook(route.id);
      if (book) {
        content = P.bookPage(route.id);
        title = book.title + " — Сова";
      } else {
        content = notFoundPage("Книга не найдена", "Похоже, эту историю убрали с полки. В библиотеке ждут другие книги.");
        title = "Книга не найдена — Сова";
      }
      active = "library";
    } else if (route.name === "profile") {
      content = P.profile({ standalone: SH.isStandalone() });
      active = "profile";
      title = "Профиль — Сова";
    } else if (route.name === "league") {
      content = P.leaguePage();
      active = "profile";
      title = "Лига — Сова";
    }

    if (route.unknown) {
      content = P.home();
      active = "home";
      title = DEFAULT_TITLE;
    }

    if (!content) {
      content = P.home();
      active = "home";
      title = DEFAULT_TITLE;
    }

    setTitle(title);
    setThemeColor(APP_THEME_COLOR);
    APP.innerHTML = P.shell(content, active);

    if (route.name === "library") applyLibraryFilter();

    if (keepScroll) {
      window.scrollTo(0, scrollY);
    }

    U.flushEvents();
  }

  function renderReader(route) {
    const book = S.getBook(route.id);
    if (!book) {
      document.body.classList.remove("is-reader");
      setTitle("Книга не найдена — Сова");
      setThemeColor(APP_THEME_COLOR);
      APP.innerHTML = notFoundPage("Книга не найдена", "История, которую ты ищешь, больше не лежит на полке.");
      return;
    }
    let index = route.chapter;
    if (index === null || !Number.isInteger(index) || index < 0 || index >= book.chapters.length) {
      index = U.nextChapterIndex(book);
    }
    setThemeColor(readerThemeColor());
    APP.innerHTML = "";
    model.reader = R.mount(APP, book, index, {
      onBack: function () {
        go("#/book/" + book.id);
      }
    });
    if (!model.reader) {
      go("#/book/" + book.id);
    }
    U.flushEvents();
  }

  function renderOnboarding() {
    if (model.reader) {
      try { model.reader.destroy(); } catch (err) { /* пусто */ }
      model.reader = null;
    }
    document.body.classList.add("is-onboarding");
    document.body.classList.remove("is-reader");
    document.body.dataset.route = "onboarding";
    setTitle("Сова — начнём");
    setThemeColor(APP_THEME_COLOR);
    APP.innerHTML = P.onboarding(model.onboarding);
    window.scrollTo(0, 0);
  }

  /* ---------- библиотека: поиск и фильтры ---------- */

  function applyLibraryFilter() {
    const grid = document.getElementById("bookGrid");
    if (!grid) return;
    const empty = document.getElementById("libraryEmpty");
    const count = document.getElementById("libraryCount");
    const filter = model.library.filter || "all";
    const query = String(model.library.search || "").trim().toLowerCase();
    const cards = Array.prototype.slice.call(grid.querySelectorAll(".book-card:not(.book-card--add)"));
    let visible = 0;

    cards.forEach(function (card) {
      const status = card.getAttribute("data-status");
      const custom = card.getAttribute("data-custom") === "1";
      const haystack = (card.getAttribute("data-search") || "").toLowerCase();
      const fitsFilter = filter === "all" || (filter === "custom" ? custom : status === filter);
      const fitsSearch = !query || haystack.indexOf(query) >= 0;
      const show = fitsFilter && fitsSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const addCard = grid.querySelector(".book-card--add");
    if (addCard) addCard.hidden = !!query || (filter !== "all" && filter !== "custom") || visible === 0;

    document.querySelectorAll(".filter-chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-filter") === filter);
    });

    if (empty) {
      const customEmpty = filter === "custom" && !query && visible === 0;
      empty.hidden = visible > 0;
      const emptyTitle = document.getElementById("libraryEmptyTitle");
      const emptyText = document.getElementById("libraryEmptyText");
      if (emptyTitle) emptyTitle.textContent = customEmpty ? "Твоя полка пока пуста" : "Ничего не нашлось";
      if (emptyText) {
        emptyText.textContent = customEmpty
          ? "Добавь свою книгу — она останется в браузере и будет доступна офлайн."
          : "Попробуй другое название или добавь свою книгу.";
      }
    }
    if (count) {
      if (query) {
        count.textContent = visible
          ? "Найдено: " + visible + " " + U.booksWord(visible)
          : "По запросу «" + model.library.search.trim() + "» ничего не нашлось";
      } else if (filter === "custom") {
        count.textContent = visible
          ? "Твоих книг: " + visible + " " + U.booksWord(visible)
          : "Твоих книг: 0";
      } else {
        count.textContent = "Показано: " + visible + " " + U.booksWord(visible);
      }
    }
  }

  function setLibraryFilter(filter) {
    model.library.filter = filter || "all";
    applyLibraryFilter();
  }

  function onLibrarySearch(event) {
    const input = event.target;
    if (!input || input.id !== "librarySearch") return;
    model.library.search = String(input.value || "");
    applyLibraryFilter();
  }

  /* ---------- онбординг ---------- */

  function completeOnboarding(name) {
    const clean = String(name || "").trim();
    S.state.profile.onboarded = true;
    S.setName(clean || "Читатель");
    S.setGoal(model.onboarding.goal || 15);
    S.save();
    model.onboarding.step = 0;
    U.closeSheet(true);
    U.toast(
      clean
        ? "Сова уже заварила чай. Начнём с одной главы."
        : "Ты вошёл как Читатель. Имя можно изменить в профиле.",
      { icon: "🦉", title: "Добро пожаловать, " + (clean || "Читатель") + "!" }
    );
    go("#/home");
  }

  function handleOnboardingSubmit(form) {
    const field = form.elements.name;
    completeOnboarding(field ? field.value : "");
    return true;
  }

  function onboardDemo() {
    S.seedDemo();
    model.onboarding = { step: 0, goal: 15, name: "" };
    go("#/home");
    U.toast("340 XP, огонёк на 4 дня и несколько глав уже прочитаны. Осмотрись!", {
      icon: "🦉", title: "Демо-профиль включён", tone: "green"
    });
  }

  /* ---------- действия ---------- */

  function toastFail(message) {
    U.toast(message, { icon: "⚠️", tone: "warn" });
  }

  function handleReaderAction(action, element) {
    const reader = model.reader;
    if (!reader) return false;
    if (action === "reader-back") {
      reader.back();
      return true;
    }
    if (action === "reader-settings") {
      reader.openSettings();
      return true;
    }
    if (action === "reader-tts") {
      reader.toggleTTS();
      return true;
    }
    if (action === "reader-finish") {
      reader.finish();
      return true;
    }
    if (action === "reader-theme") {
      reader.setTheme(element.getAttribute("data-theme"));
      return true;
    }
    if (action === "reader-font") {
      reader.setFont(Number(element.getAttribute("data-delta")) || 0);
      return true;
    }
    return false;
  }

  function handleAction(action, element, event) {
    if (!action) return;

    if (action.indexOf("reader-") === 0 && model.reader) {
      if (handleReaderAction(action, element)) {
        event.preventDefault();
        return;
      }
    }

    if (action === "close-sheet") {
      U.closeSheet();
      if (model.needsRefresh && !model.reader) {
        model.needsRefresh = false;
        refresh();
      }
      return;
    }

    if (action === "onboard-next") {
      if (model.onboarding.step < 2) {
        model.onboarding.step += 1;
        renderOnboarding();
      }
      return;
    }

    if (action === "onboard-back") {
      model.onboarding.step = Math.max(0, model.onboarding.step - 1);
      renderOnboarding();
      return;
    }

    if (action === "onboard-goal") {
      const goal = Number(element.getAttribute("data-goal"));
      if ([5, 10, 15, 20, 25, 30, 45].indexOf(goal) >= 0) model.onboarding.goal = goal;
      renderOnboarding();
      return;
    }

    if (action === "onboard-skip") {
      completeOnboarding("");
      return;
    }

    if (action === "onboard-demo") {
      onboardDemo();
      return;
    }

    if (action === "open-shop") {
      SH.openShop();
      return;
    }

    if (action === "open-goal-sheet") {
      SH.openGoalPicker();
      return;
    }

    if (action === "add-book") {
      SH.openAddBook();
      return;
    }

    if (action === "edit-name") {
      SH.openName();
      return;
    }

    if (action === "install-app") {
      SH.promptInstall();
      return;
    }

    if (action === "reset-data") {
      SH.openReset();
      return;
    }

    if (action === "delete-book") {
      SH.openDelete(element.getAttribute("data-id"));
      return;
    }

    if (action === "library-filter") {
      setLibraryFilter(element.getAttribute("data-filter"));
      return;
    }

    if (action === "buy-freeze") {
      const result = S.buyFreeze();
      if (result.ok) {
        U.playSound("coin");
        U.toast("Теперь у тебя " + result.freezes + " " + U.plural(result.freezes, "заморозка", "заморозки", "заморозок") + ".", {
          icon: "❄️", title: "Заморозка куплена", tone: "green"
        });
        SH.openShop();
      } else if (result.error === "max") {
        toastFail("Больше трёх заморозок хранить нельзя.");
      } else {
        toastFail("Не хватает перьев. Дочитай главу или выполни задание.");
      }
      return;
    }

    if (action === "claim-quest") {
      const result = S.claimQuest(element.getAttribute("data-id"));
      if (result.ok) {
        U.playSound("coin");
        U.confetti(18);
        U.toast("+" + result.xp + " XP и +" + result.feathers + " перьев.", {
          icon: "🎯", title: "Задание: " + result.title, tone: "green"
        });
        refresh();
        U.flushEvents();
      } else {
        toastFail("Задание ещё не выполнено.");
      }
      return;
    }

    if (action === "quest-bonus") {
      const result = S.claimQuestBonus();
      if (result.ok) {
        U.playSound("level");
        U.confetti(26);
        U.toast("+" + result.xp + " XP и +" + result.feathers + " пера за все задания дня.", {
          icon: "🎁", title: "Бонус дня", tone: "gold"
        });
        refresh();
        U.flushEvents();
      } else {
        toastFail("Сначала забери награды за все три задания.");
      }
      return;
    }

    if (action === "claim-saga") {
      const result = S.claimSagaReward(element.getAttribute("data-id"));
      if (result.ok) {
        refresh();
        U.flushEvents();
      } else if (result.error === "claimed") {
        toastFail("Сундук этой саги уже открыт.");
      } else {
        toastFail("Сначала собери все книги саги.");
      }
      return;
    }

    if (action === "set-goal") {
      const goal = Number(element.getAttribute("data-goal"));
      if (S.setGoal(goal)) {
        if (U.isSheetOpen()) U.closeSheet(true);
        refresh();
        U.toast("Теперь цель — " + goal + " " + U.minutesWord(goal) + " в день.", {
          icon: "🎯", title: "Цель обновлена"
        });
        U.flushEvents();
      }
      return;
    }

    if (action === "set-reader-theme") {
      const theme = element.getAttribute("data-theme");
      if (["light", "sepia", "night"].indexOf(theme) >= 0) {
        S.updateSettings({ theme: theme });
        refresh();
        U.playSound("click");
      }
      return;
    }

    if (action === "toggle-sound") {
      const enabled = !S.state.settings.sound;
      S.updateSettings({ sound: enabled });
      refresh();
      if (enabled) U.playSound("coin");
      U.toast(enabled ? "Звуки наград включены." : "Звуки выключены. Читать можно в тишине.", {
        icon: enabled ? "🔔" : "🔕", title: "Звуки"
      });
      return;
    }

    if (action === "confirm-reset") {
      S.reset();
      model.onboarding = { step: 0, goal: 15, name: "" };
      model.library = { filter: "all", search: "" };
      U.closeSheet(true);
      go("#/home");
      U.toast("Прогресс, настройки и свои книги удалены с этого устройства.", {
        icon: "🌱", title: "Чистый лист"
      });
      return;
    }

    if (action === "confirm-delete-book") {
      const id = element.getAttribute("data-id");
      const current = model.route;
      const deleted = S.deleteCustomBook(id);
      if (!deleted) {
        toastFail("Не получилось удалить книгу. Возможно, она уже исчезла.");
        return;
      }
      U.closeSheet(true);
      U.toast("Книга убрана с полки. Остальные истории на месте.", { icon: "📕", title: "Книга удалена" });
      if (current && current.name === "book" && current.id === id) {
        go("#/library");
      } else if (current && current.name === "read" && current.id === id) {
        go("#/library");
      } else {
        refresh();
      }
      return;
    }
  }

  /* ---------- делегирование ---------- */

  function onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const quizOption = target.closest("[data-quiz-option]");
    if (quizOption) {
      event.preventDefault();
      if (model.reader) model.reader.answerQuiz(Number(quizOption.getAttribute("data-quiz-option")));
      return;
    }

    const quizContinue = target.closest("[data-quiz-continue]");
    if (quizContinue) {
      event.preventDefault();
      if (model.reader) model.reader.completeChapter();
      return;
    }

    const quizSkip = target.closest("[data-quiz-skip]");
    if (quizSkip) {
      event.preventDefault();
      if (model.reader) model.reader.skipQuiz();
      return;
    }

    const actionElement = target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.getAttribute("data-action");
    handleAction(action, actionElement, event);
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const kind = form.getAttribute("data-form");
    if (!kind) return;
    event.preventDefault();
    if (kind === "onboarding") {
      handleOnboardingSubmit(form);
      return;
    }
    SH.handleForm(kind, form);
  }

  function onChange(event) {
    const target = event.target;
    if (target && target.id === "bookFile") SH.handleFileChange(target);
  }

  function bindEvents() {
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onLibrarySearch);
    window.addEventListener("hashchange", function () { render(); });

    U.hooks.onSheetOpen = function () {
      if (model.reader) model.reader.stopTTS();
    };
    U.hooks.onSheetClose = function () {
      // Ничего не перерисовываем: закрытие листа не должно ломать позицию в книге.
    };
  }

  /* ---------- запуск и PWA ---------- */

  function stripSeedParam() {
    try {
      const params = new URLSearchParams(location.search);
      if (!params.has("seed")) return;
      params.delete("seed");
      const search = params.toString();
      const next = location.pathname + (search ? "?" + search : "") + location.hash;
      history.replaceState(null, "", next);
    } catch (err) { /* file:// и старые браузеры могут не разрешить */ }
  }

  function maybeSeedDemo() {
    let seed = "";
    try {
      seed = new URLSearchParams(location.search).get("seed") || "";
    } catch (err) { seed = ""; }
    if (seed === "demo") {
      S.seedDemo();
      model.seededDemo = true;
      stripSeedParam();
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {
        /* без HTTPS или localhost регистрация недоступна — приложение продолжит работать */
      });
    });
  }

  function init() {
    S.init();
    maybeSeedDemo();
    bindEvents();
    render();
    if (model.seededDemo) {
      U.toast("Это демонстрация: огонёк, XP и несколько прочитанных глав. Сбросить можно в профиле.", {
        icon: "🦉", title: "Демо-профиль", tone: "green", duration: 5000
      });
    }
    registerServiceWorker();
  }

  window.SovaApp = {
    go: go,
    refresh: refresh,
    render: render,
    markNeedsRefresh: markNeedsRefresh,
    getRoute: function () { return model.route; },
    model: model
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
