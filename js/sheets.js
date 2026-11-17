/* Сова — формы, магазин, установка и вспомогательные листы. */
(function () {
  "use strict";

  const S = window.SovaStore;
  const U = window.SovaUI;
  const icon = U.icon;
  const esc = U.esc;

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    U.toast("Сова теперь на главном экране. Открывай в один тап.", {
      icon: "📲", title: "Приложение установлено", tone: "green"
    });
  });

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function markNeedsRefresh() {
    if (window.SovaApp && typeof window.SovaApp.markNeedsRefresh === "function") {
      window.SovaApp.markNeedsRefresh();
    }
  }

  function showError(form, message) {
    const box = form.querySelector(".form-error");
    if (!box) {
      U.toast(message, { icon: "⚠️", tone: "warn" });
      return;
    }
    box.hidden = false;
    box.textContent = message;
  }

  function clearError(form) {
    const box = form.querySelector(".form-error");
    if (box) {
      box.hidden = true;
      box.textContent = "";
    }
  }

  function valueOf(form, name) {
    const field = form.elements[name];
    return field ? String(field.value || "").trim() : "";
  }

  /* ---------- магазин ---------- */

  function openShop() {
    const feathers = S.state.feathers;
    const freezes = S.state.freezes;
    const cost = S.FREEZE_COST;
    const maxed = freezes >= S.MAX_FREEZES;
    const enough = feathers >= cost;
    const button = maxed
      ? '<span class="shop-max">' + icon("check") + " Максимум 3</span>"
      : '<button class="btn btn--primary btn--small" type="button" data-action="buy-freeze"' + (enough ? "" : " disabled") + ">" +
        "Купить за " + cost + " " + icon("feather") + "</button>";

    U.openSheet({
      title: "Перья и заморозки",
      eyebrow: "Магазин",
      className: "shop-sheet",
      html: '<div class="shop-balance"><span class="shop-balance__icon">🪶</span>' +
        '<span><strong>' + U.fmt(feathers) + "</strong><small>" + U.feathersWord(feathers) + " в запасе</small></span>" +
        '<span class="shop-balance__freeze">❄️ ' + freezes + "/" + S.MAX_FREEZES + "</span></div>" +
        '<div class="shop-feature"><span class="shop-feature__icon">❄️</span>' +
        '<span class="shop-feature__body"><strong>Заморозка огонька</strong>' +
        "<span>Если пропустишь день, заморозка сохранит серию. Сработает сама — включать ничего не нужно.</span>" +
        '<span class="shop-feature__meta">Сейчас: ' + freezes + " из " + S.MAX_FREEZES + "</span></span>" +
        "</div>" +
        '<div class="shop-action">' + button + "</div>" +
        (enough || maxed ? "" : '<p class="shop-lack">Не хватает ' + (cost - feathers) + " " + U.feathersWord(cost - feathers) + ". Выполни задания или дочитай главу.</p>") +
        '<div class="shop-earn"><strong>Где взять перья?</strong><ul>' +
        "<li>📖 за каждую завершённую главу — 4</li>" +
        "<li>📚 за дочитанную книгу — 25</li>" +
        "<li>🎯 за ежедневные задания</li>" +
        "<li>🏆 за достижения и сундуки саг</li>" +
        "</ul></div>" +
        '<p class="sheet-hint">Перья нельзя купить за деньги. Это только читательская валюта.</p>'
    });
  }

  /* ---------- цель ---------- */

  function openGoalPicker() {
    const goals = [
      { value: 5, label: "5 мин", hint: "один разворот" },
      { value: 10, label: "10 мин", hint: "лёгкий старт" },
      { value: 15, label: "15 мин", hint: "золотая середина" },
      { value: 20, label: "20 мин", hint: "уверенный темп" },
      { value: 30, label: "30 мин", hint: "книжный вечер" },
      { value: 45, label: "45 мин", hint: "марафон" }
    ];
    const current = S.state.profile.goalMinutes;
    U.openSheet({
      title: "Цель на день",
      eyebrow: "Огонёк",
      className: "goal-sheet",
      html: '<p class="sheet-intro">Цель — это не дедлайн. Это маленькое обещание себе, после которого загорается огонёк и начисляются награды.</p>' +
        '<div class="goal-picker">' + goals.map(function (goal) {
          return '<button class="goal-chip ' + (current === goal.value ? "is-active" : "") + '" type="button" data-action="set-goal" data-goal="' + goal.value + '">' +
            "<strong>" + goal.label + "</strong><small>" + goal.hint + "</small>" +
            (current === goal.value ? '<span class="goal-chip__check">' + icon("check") + "</span>" : "") +
            "</button>";
        }).join("") + "</div>" +
        '<div class="goal-note"><span>🔥</span><p>Выполненная цель даёт <b>+15 XP</b>, <b>+2 пера</b> и сохраняет серию дней.</p></div>'
    });
  }

  /* ---------- имя ---------- */

  function openName() {
    U.openSheet({
      title: "Как тебя называть?",
      eyebrow: "Профиль",
      className: "name-sheet",
      html: '<form class="form" data-form="save-name">' +
        '<label class="field"><span>Имя или ник</span>' +
        '<input class="input" name="name" maxlength="30" required value="' + esc(S.state.profile.name) + '" placeholder="Читатель">' +
        "</label>" +
        '<p class="form-hint">Имя видно только на этом устройстве. Сова будет здороваться именно так.</p>' +
        '<div class="form-error" hidden></div>' +
        '<button class="btn btn--primary btn--full" type="submit">Сохранить</button>' +
        "</form>"
    });
  }

  function saveName(form) {
    clearError(form);
    const name = valueOf(form, "name");
    if (!name) {
      showError(form, "Напиши хотя бы одну букву — так будет уютнее.");
      return false;
    }
    S.setName(name);
    U.closeSheet(true);
    if (window.SovaApp) window.SovaApp.refresh();
    U.toast("Теперь Сова зовёт тебя " + name + ".", { icon: "🦉", title: "Имя обновлено" });
    return true;
  }

  /* ---------- разбор текста на главы ---------- */

  function isHeading(line) {
    const text = line.trim();
    if (!text) return false;
    if (/^#{1,6}\s+\S/.test(text)) return true;
    if (/^(глава|часть)\s+([0-9]+|[ivxlcdm]+|[а-яё]+)([.:\s)—-].*)?$/i.test(text)) return true;
    if (/^(пролог|эпилог|вступление|послесловие)$/i.test(text)) return true;
    return false;
  }

  function cleanHeading(line) {
    return line.trim().replace(/^#{1,6}\s+/, "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function toParagraphs(lines) {
    const blocks = [];
    let buffer = [];
    lines.forEach(function (line) {
      if (!line.trim()) {
        if (buffer.length) {
          blocks.push(buffer.join(" ").trim());
          buffer = [];
        }
      } else {
        buffer.push(line.trim());
      }
    });
    if (buffer.length) blocks.push(buffer.join(" ").trim());
    return blocks.filter(Boolean);
  }

  function parseChapters(raw) {
    const text = String(raw || "").replace(/\r\n?/g, "\n").trim();
    if (!text) return [];
    const lines = text.split("\n");
    const chapters = [];
    let title = null;
    let currentLines = [];
    let sawHeading = false;

    function flush() {
      const paragraphs = toParagraphs(currentLines);
      currentLines = [];
      if (!paragraphs.length) {
        title = null;
        return;
      }
      const fallback = chapters.length === 0
        ? (sawHeading ? "Начало" : "Глава 1")
        : "Глава " + (chapters.length + 1);
      chapters.push({
        title: (title || fallback).slice(0, 120),
        paragraphs: paragraphs
      });
      title = null;
    }

    lines.forEach(function (line) {
      if (isHeading(line)) {
        if (!sawHeading) sawHeading = true;
        flush();
        title = cleanHeading(line);
      } else {
        currentLines.push(line);
      }
    });
    flush();
    return chapters.slice(0, 200);
  }

  /* ---------- добавление книги ---------- */

  function openAddBook() {
    const suggestions = S.state.customSagas.map(function (saga) {
      return '<option value="' + esc(saga.title) + '"></option>';
    }).join("");
    U.openSheet({
      title: "Добавить книгу",
      eyebrow: "Своя полка",
      className: "form-sheet add-book-sheet",
      dismissible: true,
      html: '<form class="form" data-form="add-book" novalidate>' +
        '<p class="sheet-intro">Вставь текст книги или загрузи файл. Всё останется в этом браузере и будет доступно офлайн.</p>' +
        '<label class="field"><span>Название книги *</span>' +
        '<input class="input" name="title" maxlength="120" required placeholder="Например, «Хранитель маяка»"></label>' +
        '<div class="form-grid">' +
        '<label class="field"><span>Автор</span><input class="input" name="author" maxlength="80" placeholder="Неизвестный автор"></label>' +
        '<label class="field"><span>Сага или серия</span><input class="input" name="saga" maxlength="80" list="mySagas" placeholder="Можно оставить пустым"></label>' +
        "</div>" +
        '<datalist id="mySagas">' + suggestions + "</datalist>" +
        '<label class="field"><span>Короткое описание</span><textarea class="input" name="description" rows="2" maxlength="400" placeholder="О чём эта история?"></textarea></label>' +
        '<label class="field"><span>Текст книги *</span>' +
        '<textarea class="input textarea--book" name="text" id="bookText" rows="9" required placeholder="Вставь текст...&#10;&#10;## Название главы&#10;Первый абзац главы..."></textarea></label>' +
        '<div class="file-upload"><label class="file-upload__btn">' + icon("install") + ' Загрузить .txt или .md' +
        '<input type="file" id="bookFile" accept=".txt,.md,text/plain,text/markdown" hidden></label>' +
        '<span class="file-upload__name" id="bookFileName">Файл ещё не выбран</span></div>' +
        '<p class="form-hint">Новая глава — строка вида <code>## Название главы</code>. Можно использовать и «Глава 1». Без разметки весь текст станет одной главой.</p>' +
        '<div class="form-error" id="bookError" hidden></div>' +
        '<button class="btn btn--primary btn--full" type="submit">Добавить в библиотеку</button>' +
        "</form>"
    });
  }

  function addBook(form) {
    clearError(form);
    const title = valueOf(form, "title");
    const author = valueOf(form, "author") || "Неизвестный автор";
    const sagaTitle = valueOf(form, "saga");
    const description = valueOf(form, "description");
    const text = String(form.elements.text ? form.elements.text.value : "");
    if (!title) {
      showError(form, "У книги должно быть название.");
      if (form.elements.title) form.elements.title.focus();
      return false;
    }
    if (!text.trim()) {
      showError(form, "Вставь текст книги или загрузи файл.");
      if (form.elements.text) form.elements.text.focus();
      return false;
    }
    if (text.length > 350000) {
      showError(form, "Текст слишком большой для локального хранилища. Оставь до 350 000 символов.");
      return false;
    }
    const chapters = parseChapters(text);
    if (!chapters.length) {
      showError(form, "Не получилось найти текст. Проверь содержимое.");
      return false;
    }
    const result = S.addCustomBook({
      title: title,
      author: author,
      sagaTitle: sagaTitle,
      description: description,
      chapters: chapters
    });
    if (!result.ok) {
      showError(form, "Не удалось добавить книгу. Попробуй уменьшить размер текста.");
      return false;
    }
    U.closeSheet(true);
    U.playSound("success");
    if (window.SovaApp) {
      window.SovaApp.go("#/book/" + result.id);
    } else {
      location.hash = "#/book/" + result.id;
    }
    window.setTimeout(function () {
      U.flushEvents();
      U.toast(
        chapters.length === 1
          ? "Книга добавлена. Для глав добавь строки вида «## Название»."
          : "Книга добавлена: " + chapters.length + " " + U.chaptersWord(chapters.length) + ".",
        { icon: "📚", title: "Полка пополнилась" }
      );
    }, 60);
    return true;
  }

  function handleFileChange(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const form = input.closest("form");
    if (!form) return;
    const nameLabel = document.getElementById("bookFileName");
    if (file.size > 2 * 1024 * 1024) {
      showError(form, "Файл больше 2 МБ. Лучше добавить текст частями или уменьшить файл.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || "");
      const textarea = form.elements.text;
      if (textarea) textarea.value = text;
      const titleField = form.elements.title;
      if (titleField && !titleField.value.trim()) {
        titleField.value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      }
      if (nameLabel) nameLabel.textContent = file.name;
      clearError(form);
      U.toast("Файл загружен. Проверь название и главы.", { icon: "📄" });
    };
    reader.onerror = function () {
      showError(form, "Не удалось прочитать файл. Попробуй ещё раз.");
    };
    reader.readAsText(file, "utf-8");
  }

  /* ---------- подтверждения ---------- */

  function openReset() {
    U.openSheet({
      title: "Начать с чистого листа?",
      eyebrow: "Осторожно",
      className: "confirm-sheet",
      html: '<div class="confirm-icon">🧹</div>' +
        '<p class="confirm-text">Удалятся весь прогресс, XP, достижения, настройки и добавленные книги. Это действие нельзя отменить.</p>' +
        '<div class="confirm-actions">' +
        '<button class="btn btn--danger btn--full" type="button" data-action="confirm-reset">Сбросить всё</button>' +
        '<button class="btn btn--ghost btn--full" type="button" data-action="close-sheet">Оставить как есть</button>' +
        "</div>"
    });
  }

  function openDelete(bookId) {
    const book = S.getBook(bookId);
    if (!book || !book.custom) return;
    U.openSheet({
      title: "Удалить книгу?",
      eyebrow: "Своя полка",
      className: "confirm-sheet",
      html: '<div class="confirm-icon">📕</div>' +
        '<p class="confirm-text">«' + esc(book.title) + '» исчезнет из библиотеки вместе с прогрессом чтения. Остальные книги не пострадают.</p>' +
        '<div class="confirm-actions">' +
        '<button class="btn btn--danger btn--full" type="button" data-action="confirm-delete-book" data-id="' + esc(bookId) + '">Удалить книгу</button>' +
        '<button class="btn btn--ghost btn--full" type="button" data-action="close-sheet">Отмена</button>' +
        "</div>"
    });
  }

  /* ---------- установка на телефон ---------- */

  function openInstallHelp() {
    const isFile = location.protocol === "file:";
    U.openSheet({
      title: "Установить Сову",
      eyebrow: "На телефон",
      className: "install-sheet",
      html: (isFile
        ? '<div class="install-note">' + icon("info") + "<p>Сейчас приложение открыто как файл. Чтобы установить его на Android, открой папку через локальный сервер или размести на любом хостинге с HTTPS. Инструкция в README.</p></div>"
        : "") +
        '<div class="install-step"><span class="install-step__num">Android</span><div><strong>Chrome</strong><p>Нажми на три точки в меню браузера и выбери «Установить приложение» или «Добавить на главный экран».</p></div></div>' +
        '<div class="install-step"><span class="install-step__num">iPhone</span><div><strong>Safari</strong><p>Нажми «Поделиться» и выбери «На экран „Домой“».</p></div></div>' +
        '<div class="install-step"><span class="install-step__num">ПК</span><div><strong>Chrome / Edge</strong><p>Нажми на иконку установки справа в адресной строке.</p></div></div>' +
        '<p class="sheet-hint">После установки Сова открывается без браузера и работает офлайн.</p>' +
        '<button class="btn btn--primary btn--full" type="button" data-action="close-sheet">Понятно</button>'
    });
  }

  async function promptInstall() {
    if (isStandalone()) {
      U.toast("Сова уже открыта как приложение.", { icon: "✅", title: "Всё установлено" });
      return;
    }
    if (!deferredPrompt) {
      openInstallHelp();
      return;
    }
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        U.toast("Отлично! Ищи сову на главном экране.", { icon: "📲", title: "Устанавливаем" });
      }
      deferredPrompt = null;
    } catch (err) {
      openInstallHelp();
    }
  }

  /* ---------- формы ---------- */

  function handleForm(kind, form) {
    if (kind === "add-book") return addBook(form);
    if (kind === "save-name") return saveName(form);
    return false;
  }

  window.SovaSheets = {
    openShop: openShop,
    openGoalPicker: openGoalPicker,
    openName: openName,
    openAddBook: openAddBook,
    openReset: openReset,
    openDelete: openDelete,
    openInstallHelp: openInstallHelp,
    promptInstall: promptInstall,
    handleForm: handleForm,
    handleFileChange: handleFileChange,
    parseChapters: parseChapters,
    isStandalone: isStandalone
  };
})();
