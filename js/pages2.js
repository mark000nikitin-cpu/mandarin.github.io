/* Сова — экраны книги, саги, профиля и лиги. */
(function () {
  "use strict";

  const D = window.SOVA_DATA;
  const S = window.SovaStore;
  const U = window.SovaUI;
  const esc = U.esc;
  const icon = U.icon;
  const fmt = U.fmt;
  const bar = U.bar;
  const cover = U.cover;

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    if (total < 60) return total + " мин";
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return hours + " ч" + (rest ? " " + rest + " мин" : "");
  }

  function pluralBooks(n) { return U.booksWord(n); }

  /* ---------- страница саги ---------- */

  function sagaPage(sagaId) {
    const saga = S.getSaga(sagaId);
    if (!saga) return null;
    const stats = S.getSagaStats(saga);
    const reward = saga.reward || { xp: 100, feathers: 20 };
    const books = stats.books;

    return '<div class="page page--saga">' +
      '<a class="backlink" href="#/sagas">' + icon("back") + " Все саги</a>" +
      '<section class="saga-hero" style="--s1:' + esc(saga.colors[0]) + ";--s2:" + esc(saga.colors[1]) + '">' +
      '<span class="saga-hero__deco"></span>' +
      '<div class="saga-hero__top"><span class="saga-hero__emoji">' + esc(saga.emoji) + "</span>" +
      '<span class="saga-hero__meta">' + stats.booksCount + " " + pluralBooks(stats.booksCount) + " · " + stats.chaptersTotal + " " + U.chaptersWord(stats.chaptersTotal) + "</span></div>" +
      '<span class="saga-hero__label">Книжная серия</span>' +
      "<h1>" + esc(saga.title) + "</h1>" +
      '<p class="saga-hero__author">' + esc(saga.author) + "</p>" +
      '<p class="saga-hero__tagline">' + esc(saga.tagline || "") + "</p>" +
      '<div class="saga-hero__progress">' +
      '<div class="saga-hero__progress-label"><span>Прогресс саги</span><strong>' + stats.percent + "%</strong></div>" +
      bar(stats.percent) +
      '<div class="saga-hero__progress-meta"><span>' + stats.finishedBooks + " из " + stats.booksCount + " книг собрано</span><span>" + stats.chaptersDone + "/" + stats.chaptersTotal + " глав</span></div>" +
      "</div></section>" +

      '<p class="saga-description">' + esc(saga.description || "") + "</p>" +

      '<div class="section-head"><div><span class="eyebrow">Порядок чтения</span><h2>Книги саги</h2></div>' +
      '<span class="chip">' + stats.finishedBooks + "/" + stats.booksCount + "</span></div>" +
      '<div class="saga-books">' + books.map(function (book, index) {
        const p = S.getProgress(book.id);
        const percent = S.bookPercent(book);
        const finished = !!(p && p.finished);
        const started = !!p;
        return '<a class="saga-book ' + (finished ? "is-finished" : started ? "is-reading" : "") + '" href="#/book/' + book.id + '">' +
          '<span class="saga-book__line" aria-hidden="true"></span>' +
          '<span class="saga-book__order">' + (finished ? icon("check") : index + 1) + "</span>" +
          cover(book, "xs") +
          '<span class="saga-book__info">' +
          '<span class="saga-book__status">' + (finished ? "Прочитана" : started ? percent + "% прочитано" : "Ещё не начата") + "</span>" +
          '<strong class="saga-book__title">' + esc(book.title) + "</strong>" +
          '<span class="saga-book__author">' + esc(book.author) + "</span>" +
          '<span class="saga-book__bar">' + bar(percent, "bar--slim") + "</span>" +
          "</span>" +
          '<span class="saga-book__arrow">' + icon("arrow-right") + "</span></a>";
      }).join("") + "</div>" +

      '<section class="reward-card ' + (stats.complete ? "is-ready" : "") + " " + (stats.claimed ? "is-claimed" : "") + '">' +
      '<span class="reward-card__chest">' + (stats.claimed ? "🏆" : stats.complete ? "🎁" : "🔒") + "</span>" +
      '<span class="reward-card__body"><span class="eyebrow">Сундук саги</span>' +
      "<strong>" + (stats.claimed ? "Награда получена" : "Собери все книги серии") + "</strong>" +
      "<span>+" + reward.xp + " XP и +" + reward.feathers + " перьев</span>" +
      bar(stats.percent, "bar--gold") +
      "</span>" +
      (stats.claimed
        ? '<span class="reward-card__done">' + icon("check") + " Получено</span>"
        : stats.complete
          ? '<button class="btn btn--gold" type="button" data-action="claim-saga" data-id="' + saga.id + '">Открыть</button>'
          : '<span class="reward-card__locked">' + stats.finishedBooks + "/" + stats.booksCount + " книг</span>") +
      "</section>" +

      '<div class="tip-card tip-card--soft">' + U.owlSVG("owl--tiny") +
      "<div><strong>Совет Уха</strong><p>Читай книги саги по порядку — так сюжет раскрывается ровнее. Но если очень хочется заглянуть вперёд, Сова не запрещает.</p></div></div>" +
      "</div>";
  }

  /* ---------- страница книги ---------- */

  function bookPage(bookId) {
    const book = S.getBook(bookId);
    if (!book) return null;
    const saga = S.getSaga(book.sagaId);
    const progress = S.getProgress(book.id);
    const percent = S.bookPercent(book);
    const chaptersCount = book.chapters.length;
    const doneCount = progress ? progress.finishedChapters.filter(Boolean).length : 0;
    const finished = !!(progress && progress.finished);
    const idx = U.nextChapterIndex(book);
    const minutes = U.bookMinutes(book);
    const cta = finished ? "Перечитать с начала" : progress ? "Продолжить · глава " + (idx + 1) : "Начать читать";
    const startIndex = finished ? 0 : idx;
    const books = saga ? S.booksOfSaga(saga.id) : [];
    const nextBook = finished && saga ? books.find(function (b) { return b.order > book.order; }) : null;
    const sagaStats = saga ? S.getSagaStats(saga) : null;

    const sagaBanner = saga
      ? '<a class="saga-banner" href="#/saga/' + saga.id + '" style="--s1:' + esc(saga.colors[0]) + ";--s2:" + esc(saga.colors[1]) + '">' +
        '<span class="saga-banner__emoji">' + esc(saga.emoji) + "</span>" +
        '<span class="saga-banner__body"><span class="eyebrow">Сага «' + esc(saga.title) + '» · книга ' + book.order + " из " + sagaStats.booksCount + "</span>" +
        "<strong>" + sagaStats.finishedBooks + " из " + sagaStats.booksCount + " книг собрано</strong>" +
        bar(sagaStats.percent, "bar--slim") + "</span>" +
        '<span class="saga-banner__arrow">' + icon("arrow-right") + "</span></a>"
      : "";

    const nextBookCard = nextBook
      ? '<a class="next-book" href="#/book/' + nextBook.id + '">' +
        '<span class="next-book__label">Следующая книга саги</span>' +
        '<span class="next-book__row">' + cover(nextBook, "xxs") +
        "<span><strong>" + esc(nextBook.title) + "</strong><small>" + esc(nextBook.author) + "</small></span>" +
        '<span class="next-book__go">' + icon("arrow-right") + "</span></span></a>"
      : finished && saga && sagaStats && sagaStats.complete && !sagaStats.claimed
        ? '<a class="next-book next-book--gold" href="#/saga/' + saga.id + '">' +
          '<span class="next-book__label">Сага собрана</span>' +
          '<span class="next-book__row"><span class="next-book__chest">🎁</span><span><strong>Сундук саги ждёт</strong><small>Забери награду за всю серию</small></span>' +
          '<span class="next-book__go">' + icon("arrow-right") + "</span></span></a>"
        : "";

    return '<div class="page page--book">' +
      '<a class="backlink" href="' + (saga ? "#/saga/" + saga.id : "#/library") + '">' +
      icon("back") + " " + (saga ? "К саге «" + esc(saga.title) + "»" : "В библиотеку") + "</a>" +

      '<section class="book-hero">' +
      '<div class="book-hero__cover">' + cover(book, "lg") + "</div>" +
      '<div class="book-hero__info">' +
      (saga
        ? '<a class="book-saga" href="#/saga/' + saga.id + '">' + esc(saga.emoji) + " " + esc(saga.title) + " · книга " + book.order + "</a>"
        : '<span class="book-saga">Отдельная история</span>') +
      "<h1>" + esc(book.title) + "</h1>" +
      '<p class="book-author">' + esc(book.author) + "</p>" +
      '<div class="tag-row">' + (book.tags || []).slice(0, 3).map(function (tag) {
        return '<span class="tag">' + esc(tag) + "</span>";
      }).join("") + "</div>" +
      '<div class="book-facts">' +
      '<span>' + icon("book-open") + " " + chaptersCount + " " + U.chaptersWord(chaptersCount) + "</span>" +
      '<span>' + icon("clock") + " ≈ " + minutes + " мин</span>" +
      (progress ? '<span>' + icon("star") + " " + percent + "%</span>" : "") +
      "</div>" +
      '<a class="btn btn--primary btn--big btn--full book-hero__cta" href="#/read/' + book.id + "/" + startIndex + '">' +
      icon(finished ? "refresh" : "play") + " " + cta + "</a>" +
      "</div></section>" +

      '<p class="book-description">' + esc(book.description) + "</p>" +

      (progress
        ? '<div class="book-progress-card card"><div class="book-progress-card__head">' +
          "<span><span class=\"eyebrow\">Твой прогресс</span><strong>" + percent + "%</strong></span>" +
          "<small>" + doneCount + " из " + chaptersCount + " глав</small></div>" +
          bar(percent) + "</div>"
        : "") +

      sagaBanner +

      '<section class="chapters-section">' +
      '<div class="section-head"><div><span class="eyebrow">Маршрут книги</span><h2>Глава за главой</h2></div>' +
      '<span class="chip">' + doneCount + "/" + chaptersCount + "</span></div>" +
      '<div class="chapter-path">' + book.chapters.map(function (chapter, index) {
        const done = !!(progress && progress.finishedChapters[index]);
        const current = !done && index === idx;
        const chapterMin = U.chapterMinutes(chapter);
        return '<a class="chapter-node ' + (done ? "is-done" : "") + " " + (current ? "is-current" : "") + '" href="#/read/' + book.id + "/" + index + '">' +
          '<span class="chapter-node__marker">' + (done ? icon("check") : current ? icon("play") : index + 1) + "</span>" +
          '<span class="chapter-node__card">' +
          '<span class="chapter-node__top"><strong>' + esc(chapter.title) + "</strong><small>" + chapterMin + " мин</small></span>" +
          '<span class="chapter-node__meta">' +
          (done ? "Пройдена" : current ? "Продолжить отсюда" : "Глава " + (index + 1)) +
          (chapter.quiz ? " · проверка" : "") + "</span></span>" +
          (done ? '<span class="chapter-node__star">' + icon("star") + "</span>" : "") +
          "</a>";
      }).join("") + "</div></section>" +

      nextBookCard +

      (book.custom
        ? '<button class="text-danger text-danger--center" type="button" data-action="delete-book" data-id="' + book.id + '">Удалить книгу из библиотеки</button>'
        : "") +
      "</div>";
  }

  /* ---------- профиль ---------- */

  function heatmapWeeks() {
    const weeks = 16;
    const today = S.todayKey();
    const weekStart = S.startOfWeekKey(today);
    const start = S.shiftKey(weekStart, -(weeks - 1) * 7);
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const key = S.shiftKey(start, i);
      const day = S.state.days[key];
      const minutes = day ? Math.floor((day.seconds || 0) / 60) : 0;
      let level = 0;
      if (minutes > 0) level = 1;
      if (minutes >= 10) level = 2;
      if (minutes >= 20) level = 3;
      if (minutes >= 35) level = 4;
      cells.push({
        key: key,
        minutes: minutes,
        level: key > today ? 0 : level,
        future: key > today,
        goal: !!(day && day.goalReached),
        label: U.shortDateFromKey(key) + ": " + minutes + " мин"
      });
    }
    return cells;
  }

  function themeSwatch(theme) {
    return '<i class="theme-swatch theme-swatch--' + theme + '"><span></span><span></span></i>';
  }

  function profile(options) {
    const opts = options || {};
    const level = S.levelInfo();
    const profileData = S.state.profile;
    const achievements = S.getAchievements().sort(function (a, b) {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      const pa = a.target ? a.value / a.target : 0;
      const pb = b.target ? b.value / b.target : 0;
      return pb - pa;
    });
    const unlockedCount = achievements.filter(function (a) { return a.unlocked; }).length;
    const initial = (profileData.name || "Ч").trim().charAt(0).toUpperCase();
    const totalMinutes = S.totalMinutes();
    const cells = heatmapWeeks();
    const active = S.activeDays();
    const themes = [
      { id: "light", label: "Светлая" },
      { id: "sepia", label: "Сепия" },
      { id: "night", label: "Ночь" }
    ];
    const goals = [5, 10, 15, 20, 30, 45];

    return '<div class="page page--profile">' +
      '<div class="page-head page-head--profile"><div><span class="eyebrow">Личный профиль</span><h1>Твой путь</h1></div>' +
      '<span class="profile-streak">' + icon("flame") + " " + S.state.streak.current + "</span></div>" +

      '<section class="profile-card card">' +
      '<div class="profile-avatar">' + esc(initial) + '<span class="profile-avatar__owl">🦉</span></div>' +
      '<div class="profile-main">' +
      '<div class="profile-name"><h2>' + esc(profileData.name) + '</h2>' +
      '<button class="icon-btn icon-btn--tiny" type="button" data-action="edit-name" aria-label="Изменить имя">' + icon("edit") + "</button></div>" +
      '<span class="profile-level">Уровень ' + level.level + " · " + esc(level.title) + "</span>" +
      '<div class="profile-xpbar">' + bar(level.percent, "bar--xp") + "</div>" +
      '<div class="profile-xpmeta"><span>' + fmt(level.current) + " / " + fmt(level.need) + " XP</span>" +
      "<span>" + fmt(Math.max(0, level.next - S.state.xp)) + " XP до уровня " + (level.level + 1) + "</span></div>" +
      "</div></section>" +

      '<div class="stats-grid">' +
      '<div class="stat-tile"><span class="stat-tile__icon">🔥</span><strong>' + S.state.streak.current + "</strong><small>" + U.daysWord(S.state.streak.current) + " подряд</small></div>" +
      '<div class="stat-tile"><span class="stat-tile__icon">⏳</span><strong>' + formatDuration(totalMinutes) + "</strong><small>за всё время</small></div>" +
      '<div class="stat-tile"><span class="stat-tile__icon">📚</span><strong>' + S.booksFinishedCount() + "</strong><small>" + U.booksDoneWord(S.booksFinishedCount()) + "</small></div>" +
      '<div class="stat-tile"><span class="stat-tile__icon">🪶</span><strong>' + fmt(S.state.feathers) + "</strong><small>перьев в запасе</small></div>" +
      "</div>" +
      '<p class="profile-extra">Лучшая серия: <b>' + S.state.streak.best + " " + U.daysWord(S.state.streak.best) + "</b> · Активных дней: <b>" + active + "</b> · Глав завершено: <b>" + S.chaptersFinishedCount() + "</b></p>" +

      '<a class="league-mini card" href="#/league">' +
      '<span class="league-mini__icon">' + icon("trophy") + "</span>" +
      '<span class="league-mini__body"><span class="eyebrow">' + esc(S.leagueData().tier) + "</span>" +
      "<strong>" + S.leagueData().rank + " место <small>из " + S.leagueData().total + "</small></strong>" +
      "<span>" + fmt(S.weeklyXp()) + " XP за неделю · топ-5 идут выше</span></span>" +
      '<span class="league-mini__arrow">' + icon("arrow-right") + "</span></a>" +

      '<section class="card activity-card">' +
      '<div class="card-head"><span class="card-title">' + icon("calendar") + " Активность</span>" +
      '<span class="card-note">' + active + " " + U.daysWord(active) + " с книгой</span></div>" +
      '<div class="heatmap-wrap"><div class="heatmap">' + cells.map(function (cell) {
        return '<i class="hm hm--' + cell.level + (cell.future ? " is-future" : "") + (cell.goal ? " is-goal" : "") + '" title="' + esc(cell.label) + '"></i>';
      }).join("") + "</div></div>" +
      '<div class="heatmap-legend"><span>меньше</span><i class="hm hm--0"></i><i class="hm hm--1"></i><i class="hm hm--2"></i><i class="hm hm--3"></i><i class="hm hm--4"></i><span>больше</span></div>' +
      "</section>" +

      '<section class="achievements-section">' +
      '<div class="section-head"><div><span class="eyebrow">Коллекция</span><h2>Достижения</h2></div>' +
      '<span class="chip">' + unlockedCount + " из " + achievements.length + "</span></div>" +
      '<div class="ach-grid">' + achievements.map(function (ach) {
        const percent = ach.target ? (ach.value / ach.target) * 100 : 0;
        return '<div class="ach ' + (ach.unlocked ? "is-unlocked" : "") + '">' +
          '<span class="ach__icon">' + ach.icon + "</span>" +
          '<span class="ach__body"><strong>' + ach.title + "</strong><span>" + ach.desc + "</span>" +
          (ach.unlocked
            ? '<span class="ach__meta">' + icon("check") + " Получено · +" + ach.reward + " 🪶</span>"
            : '<span class="ach__progress">' + bar(percent, "bar--slim") + "<small>" + ach.value + "/" + ach.target + "</small></span>") +
          "</span></div>";
      }).join("") + "</div></section>" +

      '<section class="settings card">' +
      '<div class="card-head"><span class="card-title">' + icon("settings") + " Настройки</span></div>" +
      '<div class="setting-block"><div class="setting-label"><strong>Цель на день</strong><span>Сколько минут читать, чтобы зажечь огонёк</span></div>' +
      '<div class="pill-select">' + goals.map(function (minutes) {
        return '<button class="pill-option ' + (S.state.profile.goalMinutes === minutes ? "is-active" : "") + '" type="button" data-action="set-goal" data-goal="' + minutes + '">' + minutes + "</button>";
      }).join("") + "</div></div>" +
      '<div class="setting-block"><div class="setting-label"><strong>Тема чтения</strong><span>Фон и цвет текста в читалке</span></div>' +
      '<div class="theme-select">' + themes.map(function (theme) {
        return '<button class="theme-option ' + (S.state.settings.theme === theme.id ? "is-active" : "") + '" type="button" data-action="set-reader-theme" data-theme="' + theme.id + '">' +
          themeSwatch(theme.id) + "<span>" + theme.label + "</span></button>";
      }).join("") + "</div></div>" +
      '<div class="setting-row"><div class="setting-label"><strong>Звуки</strong><span>Короткие сигналы за награды</span></div>' +
      '<button class="switch ' + (S.state.settings.sound ? "is-on" : "") + '" type="button" data-action="toggle-sound" role="switch" aria-checked="' + (S.state.settings.sound ? "true" : "false") + '" aria-label="Звуки"><span></span></button></div>' +
      '<div class="setting-row"><div class="setting-label"><strong>Установить приложение</strong><span>' + (opts.standalone ? "Сова уже на главном экране" : "Работает офлайн, как обычное приложение") + "</span></div>" +
      (opts.standalone
        ? '<span class="soft-tag">' + icon("check") + " Установлено</span>"
        : '<button class="btn btn--soft btn--small" type="button" data-action="install-app">' + icon("install") + " Установить</button>") +
      "</div>" +
      '<div class="setting-row"><div class="setting-label"><strong>Начать заново</strong><span>Удалить прогресс и книги с этого устройства</span></div>' +
      '<button class="text-danger" type="button" data-action="reset-data">Сбросить</button></div>' +
      '<p class="settings-version">Сова ' + D.app.version + " · " + D.app.tagline + "</p>" +
      "</section></div>";
  }

  /* ---------- лига ---------- */

  function leaguePage() {
    const data = S.leagueData();
    const me = data.all.find(function (p) { return p.me; });
    const top = data.all.slice(0, 10);
    const isTop = data.rank <= 10;
    const nearStart = Math.max(10, data.rank - 3);
    const near = !isTop ? data.all.slice(nearStart, Math.min(data.all.length, nearStart + 5)) : [];
    const target = data.rank > 5
      ? Math.max(0, data.all[4].xp + 1 - me.xp)
      : 0;
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7;
    const daysLeft = 6 - dayIndex;
    const resetLabel = daysLeft <= 0 ? "Сброс сегодня в полночь" : "Сброс через " + daysLeft + " " + U.daysWord(daysLeft);

    function row(person, index) {
      const promoted = index < 5;
      return '<div class="league-row ' + (person.me ? "is-me" : "") + " " + (promoted ? "is-promo" : "") + '">' +
        '<span class="league-row__rank">' + (index + 1) + (promoted ? icon("arrow-up") : "") + "</span>" +
        '<span class="league-avatar">' + person.avatar + "</span>" +
        '<span class="league-row__name">' + esc(person.name) + (person.me ? "<em>ты</em>" : "") + "</span>" +
        '<span class="league-row__xp">' + fmt(person.xp) + " XP</span></div>";
    }

    return '<div class="page page--league">' +
      '<a class="backlink" href="#/profile">' + icon("back") + " В профиль</a>" +
      '<section class="league-hero">' +
      '<span class="league-hero__deco"></span>' +
      '<span class="league-hero__trophy">' + icon("trophy") + "</span>" +
      '<span class="league-hero__label">' + esc(data.tier) + "</span>" +
      "<h1>" + data.rank + " место</h1>" +
      '<p>' + data.total + " " + U.peopleWord(data.total) + " · " + fmt(S.weeklyXp()) + " XP за неделю</p>" +
      '<div class="league-hero__goal">' + (data.rank <= 5
        ? "Ты в зоне повышения. Так держать! 🎉"
        : "До топ-5 — " + fmt(target) + " XP") + "</div>" +
      '<span class="league-hero__reset">' + resetLabel + "</span>" +
      "</section>" +

      '<div class="league-list card">' +
      '<div class="league-list__head"><span>#</span><span>Читатель</span><span>XP</span></div>' +
      top.map(function (person, index) { return row(person, index); }).join("") +
      (!isTop
        ? '<div class="league-divider">· · ·</div>' + near.map(function (person, i) {
          return row(person, nearStart + i);
        }).join("")
        : "") +
      "</div>" +
      '<div class="league-legend"><span><i class="legend-dot legend-dot--promo"></i> топ-5 переходят выше</span>' +
      "<span>" + U.fmt(data.total - data.rank) + " позади тебя</span></div>" +
      '<div class="tip-card tip-card--soft">' + U.owlSVG("owl--tiny") +
      "<div><strong>Как это работает</strong><p>XP за неделю складывается из чтения, глав, заданий и целей. Соперники здесь тренировочные: их XP придуман для демо, а твой — настоящий.</p></div></div>" +
      "</div>";
  }

  window.SovaPages = window.SovaPages || {};
  window.SovaPages.sagaPage = sagaPage;
  window.SovaPages.bookPage = bookPage;
  window.SovaPages.profile = profile;
  window.SovaPages.leaguePage = leaguePage;
})();
