/* Сова — экраны приложения: приветствие, главная, библиотека, саги. */
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

  function stringHash(text) {
    let h = 0;
    const value = String(text);
    for (let i = 0; i < value.length; i++) {
      h = ((h << 5) - h + value.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function topbar() {
    const streak = S.state.streak.current || 0;
    return '<header class="topbar">' +
      '<a class="brand" href="#/home" aria-label="Сова — на главную">' +
      '<span class="brand__mark">' + U.markSVG() + "</span>" +
      '<span class="brand__name">Сова</span>' +
      "</a>" +
      '<div class="topbar__stats">' +
      '<button class="pill pill--flame" type="button" data-action="open-shop" aria-label="Огонёк: ' + streak + '. Заморозки и магазин">' +
      icon("flame") + "<b>" + streak + "</b></button>" +
      '<a class="pill pill--xp" href="#/profile" aria-label="Опыт: ' + S.state.xp + '">' +
      icon("bolt") + "<b>" + fmt(S.state.xp) + "</b></a>" +
      "</div></header>";
  }

  function bottomnav(active) {
    const items = [
      { id: "home", href: "#/home", icon: "home", label: "Главная" },
      { id: "library", href: "#/library", icon: "books", label: "Библиотека" },
      { id: "sagas", href: "#/sagas", icon: "sagas", label: "Саги" },
      { id: "profile", href: "#/profile", icon: "user", label: "Профиль" }
    ];
    return '<nav class="bottomnav" aria-label="Разделы приложения"><div class="bottomnav__inner">' +
      items.map(function (item) {
        return '<a class="navitem ' + (active === item.id ? "is-active" : "") + '" href="' + item.href + '">' +
          icon(item.icon) + "<span>" + item.label + "</span></a>";
      }).join("") +
      "</div></nav>";
  }

  function shell(content, active) {
    return '<div class="shell">' + topbar() +
      '<main class="main" id="main">' + content + "</main>" +
      "</div>" + bottomnav(active);
  }

  /* ---------- онбординг ---------- */

  function onboarding(model) {
    const step = model.step || 0;
    const goal = model.goal || 15;
    const name = model.name || "";
    const stepsDots = '<span class="onboard-dots">' + [0, 1, 2].map(function (i) {
      return '<i class="' + (i === step ? "is-active" : i < step ? "is-done" : "") + '"></i>';
    }).join("") + "</span>";

    let inner = "";
    if (step === 0) {
      inner = '<div class="onboard__art">' +
        '<span class="orbit orbit--1"></span><span class="orbit orbit--2"></span><span class="orbit orbit--3"></span>' +
        '<span class="art-badge art-badge--flame">🔥 серия</span>' +
        '<span class="art-badge art-badge--xp">' + icon("bolt") + " +XP</span>" +
        '<span class="art-badge art-badge--book">📖 глава</span>' +
        U.owlSVG("owl--onboard") +
        "</div>" +
        '<div class="onboard__copy">' +
        '<p class="eyebrow">Читалка с сагами и характером</p>' +
        "<h1>Читай. Расти.<br>Возвращайся.</h1>" +
        '<p class="onboard__lead">Собирай книжные серии, зажигай огонёк и получай награды за каждую главу. Без зубрёжки и давления.</p>' +
        '<div class="feature-list">' +
        '<div class="feature"><span class="feature__icon">📚</span><span><strong>Саги</strong><small>Читай серии целиком и открывай сундуки</small></span></div>' +
        '<div class="feature"><span class="feature__icon">🔥</span><span><strong>Огонёк</strong><small>Маленькая цель каждый день — большая привычка</small></span></div>' +
        '<div class="feature"><span class="feature__icon">🏆</span><span><strong>Награды</strong><small>XP, задания, достижения и читательская лига</small></span></div>' +
        "</div>" +
        '<button class="btn btn--primary btn--big btn--full" type="button" data-action="onboard-next">Начать путь ' + icon("arrow-right") + "</button>" +
        '<button class="onboard__demo" type="button" data-action="onboard-demo">Сначала посмотреть демо-профиль</button>' +
        '<p class="onboard__note">' + icon("install") + " Работает офлайн и устанавливается на Android</p>" +
        "</div>";
    } else if (step === 1) {
      const options = [
        { value: 10, title: "10 минут", sub: "Лёгкий старт", note: "Одна глава" },
        { value: 15, title: "15 минут", sub: "Золотая середина", note: "1–2 главы", best: true },
        { value: 25, title: "25 минут", sub: "Книжный марафон", note: "Глубокое погружение" }
      ];
      inner = '<button class="onboard-back" type="button" data-action="onboard-back">' + icon("back") + " Назад</button>" +
        '<div class="onboard__step">' +
        '<div class="onboard__mini-art">' + U.owlSVG("owl--small") + "</div>" +
        '<p class="eyebrow">Шаг 2 из 3</p>' +
        "<h1>Сколько читать каждый день?</h1>" +
        '<p class="onboard__lead">Цель зажигает огонёк. Выбери то, что реально успеть даже в шумный день. Потом можно изменить.</p>' +
        '<div class="goal-options">' + options.map(function (option) {
          return '<button class="goal-option ' + (Number(goal) === option.value ? "is-active" : "") + '" type="button" data-action="onboard-goal" data-goal="' + option.value + '">' +
            '<span class="goal-option__circle">' + (option.best ? "🦉" : option.value) + "</span>" +
            '<span class="goal-option__body"><strong>' + option.title + "</strong><small>" + option.sub + " · " + option.note + "</small></span>" +
            (option.best ? '<span class="goal-option__best">советуем</span>' : '<span class="goal-option__radio"></span>') +
            "</button>";
        }).join("") + "</div>" +
        '<button class="btn btn--primary btn--big btn--full" type="button" data-action="onboard-next">Дальше ' + icon("arrow-right") + "</button>" +
        '<p class="onboard__note">' + icon("target") + " Сова подстроит задания под твою цель</p>" +
        "</div>";
    } else {
      inner = '<button class="onboard-back" type="button" data-action="onboard-back">' + icon("back") + " Назад</button>" +
        '<div class="onboard__step">' +
        '<div class="onboard__mini-art">' + U.owlSVG("owl--small") + "</div>" +
        '<p class="eyebrow">Шаг 3 из 3</p>' +
        "<h1>Как тебя называть?</h1>" +
        '<p class="onboard__lead">Сова будет обращаться к тебе по имени и вести личную статистику чтения.</p>' +
        '<form class="onboard-form" data-form="onboarding">' +
        '<label class="field"><span>Твоё имя или ник</span>' +
        '<input class="input" name="name" maxlength="30" placeholder="Например, Марк" autocomplete="nickname" value="' + esc(name) + '">' +
        "</label>" +
        '<button class="btn btn--primary btn--big btn--full" type="submit">Войти в библиотеку ' + icon("arrow-right") + "</button>" +
        "</form>" +
        '<button class="onboard__skip" type="button" data-action="onboard-skip">Пропустить — я просто читатель</button>' +
        '<p class="onboard__note">' + icon("lock") + " Всё хранится только на этом устройстве</p>" +
        "</div>";
    }

    return '<div class="onboard">' +
      '<span class="onboard__blob onboard__blob--1"></span>' +
      '<span class="onboard__blob onboard__blob--2"></span>' +
      '<header class="onboard__head"><span class="onboard__brand">' + U.markSVG() + "<span>Сова</span></span>" +
      (step > 0 ? stepsDots : '<span class="onboard__tag">читалка с сагами</span>') + "</header>" +
      '<div class="onboard__main">' + inner + "</div>" +
      '<footer class="onboard__foot"><span>' + D.app.tagline + "</span>" +
      (step > 0 ? stepsDots : "<span>1.0</span>") +
      "</footer></div>";
  }

  /* ---------- главная ---------- */

  function questRow(quest) {
    const percent = quest.target ? (quest.current / quest.target) * 100 : 0;
    return '<div class="quest ' + (quest.claimed ? "is-claimed" : quest.done ? "is-done" : "") + '">' +
      '<span class="quest__icon">' + (quest.claimed ? icon("check") : quest.icon) + "</span>" +
      '<span class="quest__main">' +
      '<span class="quest__top"><strong>' + esc(quest.title) + "</strong><small>" + quest.current + "/" + quest.target + "</small></span>" +
      "<span>" + esc(quest.label) + "</span>" +
      bar(percent, "bar--quest bar--slim") +
      "</span>" +
      '<span class="quest__side">' +
      (quest.claimed
        ? '<span class="quest__claimed">' + icon("check") + " +" + quest.xp + "</span>"
        : quest.done
          ? '<button class="btn btn--tiny" type="button" data-action="claim-quest" data-id="' + quest.id + '">Забрать</button>'
          : '<span class="quest__reward">+' + quest.xp + " XP</span><small>+" + quest.feathers + " 🪶</small>") +
      "</span></div>";
  }

  function home() {
    const profile = S.state.profile;
    const level = S.levelInfo();
    const goal = S.getGoalInfo();
    const week = S.getWeek();
    const quests = S.getQuests();
    const league = S.leagueData();
    const today = S.getDay();
    const quote = D.quotes[stringHash(S.todayKey()) % D.quotes.length];
    const allBooks = S.allBooks();
    const allRead = allBooks.length > 0 && allBooks.every(function (book) {
      const p = S.getProgress(book.id);
      return !!(p && p.finished);
    });
    let continueBook = S.getContinueBook();
    let firstUnread = allBooks.find(function (book) {
      const p = S.getProgress(book.id);
      return !p || !p.finished;
    }) || allBooks[0];
    let continueHref = "";
    let continueChapter = null;
    let continuePercent = 0;
    if (continueBook) {
      const idx = U.nextChapterIndex(continueBook);
      continueHref = "#/read/" + continueBook.id + "/" + idx;
      continueChapter = continueBook.chapters[idx];
      continuePercent = S.bookPercent(continueBook);
    } else if (firstUnread) {
      continueHref = "#/book/" + firstUnread.id;
    }

    const questsClaimed = quests.filter(function (q) { return q.claimed; }).length;
    const sagas = S.allSagas().slice().sort(function (a, b) {
      const sa = S.getSagaStats(a);
      const sb = S.getSagaStats(b);
      function rank(stats) { return stats.complete ? 3 : stats.percent > 0 ? 0 : 1; }
      return rank(sa) - rank(sb);
    });

    const continueSection = allRead
      ? '<div class="all-done-card card"><span class="all-done-card__icon">🎉</span>' +
        "<div><strong>Все книги на полке прочитаны!</strong><span>Самое время добавить свою историю.</span></div>" +
        '<button class="btn btn--soft btn--small" type="button" data-action="add-book">Добавить книгу</button></div>'
      : continueBook
        ? '<a class="continue-card card" href="' + continueHref + '">' +
          cover(continueBook, "xs") +
          '<span class="continue-card__info">' +
          '<span class="continue-card__kicker">' +
          (function () {
            const saga = S.getSaga(continueBook.sagaId);
            return saga ? saga.emoji + " " + esc(saga.title) + " · книга " + continueBook.order : "Отдельная история";
          })() + "</span>" +
          '<strong class="continue-card__title">' + esc(continueBook.title) + "</strong>" +
          '<span class="continue-card__chapter">' + esc(continueChapter ? continueChapter.title : "Продолжить") + "</span>" +
          '<span class="continue-card__bar">' + bar(continuePercent) + "<small>" + continuePercent + "%</small></span>" +
          "</span>" +
          '<span class="continue-card__go">' + icon("play") + "</span>" +
          "</a>"
        : firstUnread
          ? '<a class="continue-card card" href="' + continueHref + '">' + cover(firstUnread, "xs") +
            '<span class="continue-card__info"><span class="continue-card__kicker">Начни первую сагу</span>' +
            '<strong class="continue-card__title">' + esc(firstUnread.title) + "</strong>" +
            '<span class="continue-card__chapter">' + esc(firstUnread.author) + " · " + firstUnread.chapters.length + " " + U.chaptersWord(firstUnread.chapters.length) + "</span>" +
            "</span>" +
            '<span class="continue-card__go">' + icon("play") + "</span></a>"
          : '<div class="empty card">Пока пусто. Добавь свою первую книгу.</div>';

    return '<div class="page page--home">' +
      '<section class="hero">' +
      '<span class="hero__glow"></span><span class="hero__ring"></span>' +
      '<div class="hero__content">' +
      '<p class="hero__date">' + esc(U.longDate()) + "</p>" +
      "<h1>" + esc(U.greeting()) + ",<br>" + esc(profile.name) + "!</h1>" +
      '<p class="hero__quote">«' + esc(quote) + "»</p>" +
      '<div class="hero__level">' +
      '<span class="hero__level-badge">' + level.level + "</span>" +
      '<span class="hero__level-body"><span class="hero__level-title">' + esc(level.title) + "</span>" +
      '<span class="hero__level-bar">' + bar(level.percent) + "</span></span>" +
      "</div>" +
      "</div>" +
      '<div class="hero__art">' + U.owlSVG("owl--hero") + "</div>" +
      "</section>" +

      '<div class="home-duo">' +
      '<section class="card streak-card">' +
      '<div class="card-head"><span class="card-title">' + icon("flame") + " Огонёк</span>" +
      '<button class="freeze-chip" type="button" data-action="open-shop" aria-label="Заморозки: ' + S.state.freezes + '">❄️ ' + S.state.freezes + "</button></div>" +
      '<div class="streak-big"><strong>' + S.state.streak.current + "</strong><span>" + U.daysWord(S.state.streak.current) + " подряд</span></div>" +
      '<div class="week">' + week.map(function (day) {
        return '<span class="weekday ' + (day.reached ? "is-done" : "") + " " + (day.isToday ? "is-today" : "") + " " + (day.isFuture ? "is-future" : "") + '">' +
          '<i class="weekday__dot">' + (day.reached ? icon("check") : day.isToday ? "•" : "") + "</i>" +
          "<small>" + day.label + "</small></span>";
      }).join("") + "</div>" +
      '<p class="card-hint">' + (goal.reached
        ? "Сегодняшняя цель выполнена — огонёк в безопасности."
        : "Ещё " + goal.leftMinutes + " мин — и огонёк загорится.") + "</p>" +
      "</section>" +

      '<section class="card goal-card">' +
      '<div class="card-head"><span class="card-title">' + icon("target") + " Цель дня</span>" +
      '<button class="mini-link" type="button" data-action="open-goal-sheet">Изменить</button></div>' +
      '<div class="goal-row">' + U.ring(goal.percent, 82, 7) +
      '<span class="goal-copy"><span class="goal-value">' + goal.minutes + '<small>/' + goal.goalMinutes + " мин</small></span>" +
      '<span class="goal-status">' + (goal.reached ? "Готово!" : "Ещё " + goal.leftMinutes + " мин") + "</span>" +
      '<span class="goal-reward">' + icon("bolt") + " +" + today.xp + " XP сегодня</span>" +
      "</span></div>" +
      '<p class="card-hint">+15 XP и +2 пера за закрытую цель</p>' +
      "</section>" +
      "</div>" +

      '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">Твоя история</span><h2>Продолжить чтение</h2></div>' +
      '<a class="link-more" href="#/library">Все книги ' + icon("arrow-right") + "</a></div>" +
      continueSection +
      "</section>" +

      '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">Ежедневно</span><h2>Задания на сегодня</h2></div>' +
      '<span class="chip">' + questsClaimed + " из 3</span></div>" +
      '<div class="quests card">' + quests.map(questRow).join("") +
      (quests.every(function (q) { return q.claimed; })
        ? S.state.quests.bonus
          ? '<div class="quest-bonus is-claimed">' + icon("gift") + " Бонус дня уже в кармане: +10 XP и +3 пера</div>"
          : '<button class="quest-bonus" type="button" data-action="quest-bonus">' + icon("gift") + " Все задания готовы — забери +10 XP</button>"
        : "") +
      "</div></section>" +

      '<a class="league-mini card" href="#/league">' +
      '<span class="league-mini__icon">' + icon("trophy") + "</span>" +
      '<span class="league-mini__body"><span class="eyebrow">' + esc(league.tier) + "</span>" +
      "<strong>" + league.rank + " место <small>из " + league.total + "</small></strong>" +
      "<span>" + fmt(S.weeklyXp()) + " XP за неделю · топ-5 идут выше</span></span>" +
      '<span class="league-mini__faces">' + league.all.slice(0, 3).map(function (person) {
        return '<i title="' + esc(person.name) + '">' + person.avatar + "</i>";
      }).join("") + "</span>" +
      '<span class="league-mini__arrow">' + icon("arrow-right") + "</span></a>" +

      '<section class="section">' +
      '<div class="section-head"><div><span class="eyebrow">Коллекция</span><h2>Твои саги</h2></div>' +
      '<a class="link-more" href="#/sagas">Все саги ' + icon("arrow-right") + "</a></div>" +
      '<div class="saga-strip">' + sagas.map(function (saga) {
        const stats = S.getSagaStats(saga);
        return '<a class="saga-chip" href="#/saga/' + saga.id + '">' +
          '<span class="saga-chip__emoji" style="--c1:' + esc(saga.colors[0]) + ";--c2:" + esc(saga.colors[1]) + '">' + esc(saga.emoji) + "</span>" +
          '<span class="saga-chip__body"><strong>' + esc(saga.title) + "</strong>" +
          "<span>" + stats.finishedBooks + "/" + stats.booksCount + " книг · " + stats.percent + "%</span>" +
          bar(stats.percent, "bar--slim") + "</span></a>";
      }).join("") + "</div></section>" +
      "</div>";
  }

  /* ---------- библиотека ---------- */

  function sortBooksForLibrary(books) {
    return books.slice().sort(function (a, b) {
      const pa = S.getProgress(a.id);
      const pb = S.getProgress(b.id);
      function score(p) { return p ? (p.finished ? 2 : 0) : 1; }
      if (score(pa) !== score(pb)) return score(pa) - score(pb);
      if (pa && pb && !pa.finished && !pb.finished) {
        return (pb.lastReadAt || 0) - (pa.lastReadAt || 0);
      }
      return 0;
    });
  }

  function bookCard(book) {
    const saga = S.getSaga(book.sagaId);
    const status = U.statusOf(book);
    const percent = S.bookPercent(book);
    const search = (book.title + " " + book.author + " " + (saga ? saga.title : "")).toLowerCase();
    const badge = status === "done"
      ? '<span class="book-card__badge is-done">' + icon("check") + "</span>"
      : status === "reading"
        ? '<span class="book-card__badge">' + percent + "%</span>"
        : "";
    const foot = status === "done"
      ? '<span class="book-card__done-label">' + icon("check") + " Прочитана</span>"
      : '<span class="book-card__foot">' + bar(percent) +
        "<span>" + (status === "reading" ? percent + "%" : book.chapters.length + " " + U.chaptersWord(book.chapters.length)) + "</span></span>";
    return '<a class="book-card" href="#/book/' + book.id + '" data-search="' + esc(search) + '" data-status="' + status + '" data-custom="' + (book.custom ? "1" : "0") + '">' +
      '<span class="book-card__cover">' + cover(book, "md") + badge + "</span>" +
      '<span class="book-card__body">' +
      '<span class="book-card__saga">' + (saga ? esc(saga.emoji) + " " + esc(saga.title) : "Отдельная книга") + "</span>" +
      '<strong class="book-card__title">' + esc(book.title) + "</strong>" +
      '<span class="book-card__author">' + esc(book.author) + "</span>" +
      foot + "</span></a>";
  }

  function library(model) {
    const books = sortBooksForLibrary(S.allBooks());
    const sagas = S.allSagas();
    const filter = model.filter || "all";
    const search = model.search || "";
    const reading = books.filter(function (book) { return U.statusOf(book) === "reading"; }).length;
    const done = books.filter(function (book) { return U.statusOf(book) === "done"; }).length;
    const custom = books.filter(function (book) { return book.custom; }).length;
    const filters = [
      { id: "all", label: "Все", count: books.length },
      { id: "reading", label: "Читаю", count: reading },
      { id: "done", label: "Завершено", count: done },
      { id: "custom", label: "Мои", count: custom }
    ];

    return '<div class="page page--library">' +
      '<div class="page-head"><div><span class="eyebrow">Библиотека</span><h1>Все истории</h1>' +
      "<p>" + books.length + " " + U.booksWord(books.length) + " в " + sagas.length + " " + U.plural(sagas.length, "саге", "сагах", "сагах") + "</p></div>" +
      '<button class="btn btn--primary" type="button" data-action="add-book">' + icon("plus") + " Своя книга</button></div>" +
      '<div class="search-bar">' + icon("search") +
      '<input id="librarySearch" type="search" placeholder="Найти книгу, автора или сагу" value="' + esc(search) + '" autocomplete="off"></div>' +
      '<div class="filter-row">' + filters.map(function (item) {
        return '<button class="filter-chip ' + (filter === item.id ? "is-active" : "") + '" type="button" data-action="library-filter" data-filter="' + item.id + '">' +
          item.label + ' <i>' + item.count + "</i></button>";
      }).join("") + "</div>" +
      '<p class="library-count" id="libraryCount"></p>' +
      '<div class="book-grid" id="bookGrid">' + books.map(bookCard).join("") +
      '<button class="book-card book-card--add" type="button" data-action="add-book">' +
      '<span class="book-card__add-icon">' + icon("plus") + "</span>" +
      "<strong>Добавить книгу</strong>" +
      "<small>Вставь текст .txt или .md</small></button>" +
      "</div>" +
      '<div class="empty-state" id="libraryEmpty" hidden>' + U.owlSVG("owl--tiny") +
      '<h3 id="libraryEmptyTitle">Ничего не нашлось</h3><p id="libraryEmptyText">Попробуй другое название или добавь свою книгу.</p>' +
      '<button class="btn btn--soft" type="button" data-action="add-book">Добавить книгу</button></div>' +
      "</div>";
  }

  /* ---------- саги ---------- */

  function sagaCard(saga) {
    const stats = S.getSagaStats(saga);
    return '<a class="saga-card" href="#/saga/' + saga.id + '" style="--s1:' + esc(saga.colors[0]) + ";--s2:" + esc(saga.colors[1]) + '">' +
      '<span class="saga-card__deco"></span>' +
      '<span class="saga-card__head"><span class="saga-card__emoji">' + esc(saga.emoji) + "</span>" +
      '<span class="saga-card__count">' + stats.booksCount + " " + U.booksWord(stats.booksCount) + "</span></span>" +
      '<span class="saga-card__body">' +
      '<span class="saga-card__label">Книжная серия</span>' +
      '<strong class="saga-card__title">' + esc(saga.title) + "</strong>" +
      '<span class="saga-card__author">' + esc(saga.author) + "</span>" +
      '<span class="saga-card__tagline">' + esc(saga.tagline || saga.description) + "</span>" +
      '<span class="saga-card__covers">' + stats.books.slice(0, 3).map(function (book) {
        return '<i style="--b1:' + esc(book.colors[0]) + ";--b2:" + esc(book.colors[1]) + '" title="' + esc(book.title) + '">' + esc(book.emoji) + "</i>";
      }).join("") +
      '<span class="saga-card__made">' + stats.finishedBooks + " из " + stats.booksCount + " собрано</span></span>" +
      '<span class="saga-card__progress">' + bar(stats.percent) + "</span>" +
      "</span>" +
      (stats.complete ? '<span class="saga-card__badge">' + icon("check") + " Собрана</span>" : "") +
      "</a>";
  }

  function sagas() {
    const list = S.allSagas().slice().sort(function (a, b) {
      const sa = S.getSagaStats(a);
      const sb = S.getSagaStats(b);
      function rank(stats) { return stats.complete ? 3 : stats.percent > 0 ? 0 : 1; }
      return rank(sa) - rank(sb);
    });
    const complete = list.filter(function (saga) { return S.getSagaStats(saga).complete; }).length;
    return '<div class="page page--sagas">' +
      '<div class="page-head"><div><span class="eyebrow">Коллекция</span><h1>Саги</h1>' +
      "<p>" + list.length + " " + U.plural(list.length, "серия", "серии", "серий") + " · " + complete + " собрано</p></div>" +
      '<button class="btn btn--soft" type="button" data-action="add-book">' + icon("plus") + " Своя сага</button></div>" +
      '<div class="sagas-grid">' + list.map(sagaCard).join("") + "</div>" +
      '<div class="tip-card">' + U.owlSVG("owl--tiny") +
      "<div><strong>Что такое сага?</strong><p>Это книжная серия. Дочитывай книги по порядку, следи за прогрессом и открывай сундук, когда собрана вся серия.</p></div></div>" +
      "</div>";
  }

  window.SovaPages = {
    shell: shell,
    onboarding: onboarding,
    home: home,
    library: library,
    sagas: sagas,
    questRow: questRow
  };
})();
