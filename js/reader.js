/* Сова — иммерсивная читалка: прогресс, таймер, вопросы и награды. */
(function () {
  "use strict";

  const D = window.SOVA_DATA;
  const S = window.SovaStore;
  const U = window.SovaUI;
  const esc = U.esc;
  const icon = U.icon;

  const THEMES = {
    light: { label: "Светлая", bg: "#fbf8f1" },
    sepia: { label: "Сепия", bg: "#f3e6ce" },
    night: { label: "Ночь", bg: "#17201c" }
  };

  function mount(root, book, chapterIndex, options) {
    const opts = options || {};
    const chapter = book && book.chapters[chapterIndex];
    if (!chapter) return null;

    const progressBefore = S.getProgress(book.id);
    const alreadyDone = !!(progressBefore && progressBefore.finishedChapters[chapterIndex]);
    const startPct = progressBefore && progressBefore.chapter === chapterIndex && !alreadyDone
      ? U.clamp(progressBefore.pct || 0, 0, 100)
      : 0;
    const saga = S.getSaga(book.sagaId);
    const settings = S.state.settings;
    let lastPct = startPct;
    let lastSavedAt = 0;
    let ticking = false;
    let timerId = null;
    let speaking = false;
    let destroyed = false;

    S.openBook(book);
    if (!alreadyDone) S.savePosition(book, chapterIndex, startPct);

    const reader = {
      book: book,
      index: chapterIndex,
      chapterDone: alreadyDone,
      finishedBook: !!(progressBefore && progressBefore.finished),
      completed: false,
      quizAnswered: false,
      quizXp: 0,
      destroyed: false,
      back: back,
      openSettings: openSettings,
      toggleTTS: toggleTTS,
      stopTTS: stopTTS,
      finish: finish,
      setTheme: setTheme,
      setFont: setFont,
      answerQuiz: answerQuiz,
      skipQuiz: skipQuiz,
      completeChapter: completeChapter,
      saveNow: saveNow,
      destroy: destroy
    };

    document.title = chapter.title + " — " + book.title;

    root.innerHTML = renderReader();
    const readerRoot = root.querySelector(".reader");
    const scroller = root.querySelector("#readerScroller");
    const progressLine = root.querySelector("#readerProgressLine");
    const pctLabel = root.querySelector("#readerChapterPct");
    const dailyLabel = root.querySelector("#readerDaily");
    const finishButton = root.querySelector("#readerFinish");

    // восстановление позиции только после раскладки
    requestAnimationFrame(function () {
      if (destroyed || !scroller) return;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = (startPct / 100) * max;
      updateScrollState();
    });

    scroller.addEventListener("scroll", onScroll, { passive: true });
    timerId = window.setInterval(onTick, 15000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveNow);

    updateDailyHud();
    updateTTSButton();

    function renderReader() {
      const paragraphs = chapter.paragraphs.map(function (text, index) {
        return '<p class="' + (index === 0 ? "lead" : "") + '">' + esc(text) + "</p>";
      }).join("");
      const chapterMinutes = U.chapterMinutes(chapter);
      const sagaLabel = saga ? esc(saga.emoji) + " " + esc(saga.title) + " · книга " + book.order : esc(book.author);
      const done = alreadyDone;
      return '<div class="reader" data-theme="' + esc(settings.theme) + '" style="--reader-size:' + settings.fontSize + "px;--reader-line:" + settings.lineHeight + '">' +
        '<header class="reader-top">' +
        '<button class="reader-icon" type="button" data-action="reader-back" aria-label="Назад">' + icon("back") + "</button>" +
        '<div class="reader-top__meta"><strong>' + esc(book.title) + "</strong><span>" + sagaLabel + " · глава " + (chapterIndex + 1) + " из " + book.chapters.length + "</span></div>" +
        '<div class="reader-top__tools">' +
        '<button class="reader-icon" type="button" data-action="reader-tts" id="readerTTS" aria-label="Читать вслух" aria-pressed="false">' + icon("tts") + "</button>" +
        '<button class="reader-icon reader-aa" type="button" data-action="reader-settings" aria-label="Настройки чтения">Aa</button>' +
        "</div></header>" +
        '<div class="reader-progress" aria-hidden="true"><span id="readerProgressLine"></span></div>' +
        '<div class="reader-scroll" id="readerScroller">' +
        '<article class="reader-page">' +
        '<p class="reader-kicker">' + (saga ? esc(saga.title) + " · " : "") + (saga ? "книга " + book.order : esc(book.author)) + "</p>" +
        "<h1>" + esc(chapter.title) + "</h1>" +
        '<p class="reader-byline">' + esc(book.author) + " · " + chapterMinutes + " мин чтения" + "</p>" +
        '<div class="reader-ornament" aria-hidden="true"><i></i><span>✦</span><i></i></div>' +
        '<div class="reader-text">' + paragraphs + "</div>" +
        '<div class="reader-end" id="readerEnd">' + endBlock(done) + "</div>" +
        '<div class="reader-colophon">' + esc(book.title) + " · " + esc(book.author) + "<br>Читай в своём ритме.</div>" +
        "</article></div>" +
        '<footer class="reader-bot">' +
        (chapterIndex > 0
          ? '<a class="reader-nav" href="#/read/' + book.id + "/" + (chapterIndex - 1) + '" aria-label="Предыдущая глава">' + icon("back") + "</a>"
          : '<button class="reader-nav" type="button" disabled aria-label="Это первая глава">' + icon("back") + "</button>") +
        '<div class="reader-bot__mid"><span id="readerChapterPct">' + Math.round(startPct) + "% главы</span>" +
        '<span id="readerDaily">Сегодня 0/15 мин</span></div>' +
        '<button class="reader-finish-btn" type="button" data-action="reader-finish" id="readerFinish">' +
        (done ? (chapterIndex < book.chapters.length - 1 ? "Далее" : "К книге") : "Завершить") + "</button>" +
        "</footer></div>";
    }

    function endBlock(done) {
      const hasNext = chapterIndex < book.chapters.length - 1;
      return '<div class="reader-end__orn" aria-hidden="true">⁂</div>' +
        "<h2>" + (done ? "Глава пройдена" : "Конец главы") + "</h2>" +
        "<p>" + (done ? "Можно перечитать или спокойно идти дальше." : "Проверь себя и получи награду за чтение.") + "</p>" +
        '<button class="btn btn--primary" type="button" data-action="reader-finish">' +
        (done ? (hasNext ? "Следующая глава" : "К книге") : "Завершить главу") + "</button>" +
        '<span class="reader-end__hint">' + (done ? "Глава уже в твоей коллекции" : "Это займёт несколько секунд") + "</span>";
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (!destroyed) updateScrollState();
      });
    }

    function updateScrollState() {
      if (!scroller) return;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const pct = max <= 0 ? 100 : U.clamp((scroller.scrollTop / max) * 100, 0, 100);
      lastPct = pct;
      if (progressLine) progressLine.style.width = Math.max(2, pct) + "%";
      if (pctLabel) pctLabel.textContent = Math.round(pct) + "% главы";
      const now = Date.now();
      if (!reader.chapterDone && !destroyed && now - lastSavedAt > 1000) {
        lastSavedAt = now;
        S.savePosition(book, chapterIndex, pct);
      }
      if (pct > 92) {
        const finish = root.querySelector("#readerFinish");
        if (finish) finish.classList.add("is-ready");
      }
    }

    function saveNow() {
      if (destroyed || reader.chapterDone) return;
      S.savePosition(book, chapterIndex, lastPct);
    }

    function onVisibility() {
      if (document.hidden) {
        saveNow();
        stopTTS();
      }
    }

    function onTick() {
      if (destroyed || document.hidden || U.isSheetOpen()) return;
      const result = S.addReadingSeconds(15);
      updateDailyHud();
      if (result && result.xp > 0) showXp(result.xp);
      U.flushEvents();
    }

    function updateDailyHud() {
      const goal = S.getGoalInfo();
      const label = document.getElementById("readerDaily");
      if (label) {
        label.textContent = "Сегодня " + goal.minutes + "/" + goal.goalMinutes + " мин" + (goal.reached ? " 🔥" : "");
        label.classList.toggle("is-done", goal.reached);
      }
      const endHint = document.querySelector(".reader-end__hint");
      if (endHint && !reader.chapterDone) {
        endHint.textContent = "Это займёт несколько секунд";
      }
    }

    function showXp(amount) {
      const pop = document.createElement("span");
      pop.className = "reader-xp-pop";
      pop.textContent = "+" + amount + " XP";
      readerRoot.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 1100);
    }

    function finish() {
      if (reader.chapterDone) {
        goAfterChapter();
        return;
      }
      if (reader.quizAnswered) {
        completeChapter();
        return;
      }
      if (chapter.quiz) {
        openQuiz();
      } else {
        completeChapter();
      }
    }

    function goAfterChapter() {
      saveNow();
      if (reader.finishedBook) {
        location.hash = "#/book/" + book.id;
        return;
      }
      const progress = S.getProgress(book.id);
      if (progress && !progress.finishedChapters[progress.chapter]) {
        location.hash = "#/read/" + book.id + "/" + progress.chapter;
        return;
      }
      if (chapterIndex < book.chapters.length - 1) {
        location.hash = "#/read/" + book.id + "/" + (chapterIndex + 1);
      } else {
        location.hash = "#/book/" + book.id;
      }
    }

    /* ---------- вопрос по главе ---------- */

    function openQuiz() {
      stopTTS();
      U.openSheet({
        title: "Проверь себя",
        eyebrow: "Вопрос по главе",
        className: "quiz-sheet",
        theme: S.state.settings.theme,
        html: '<div class="quiz-intro"><span class="quiz-badge">' + esc(chapter.title) + '</span><span class="quiz-reward">+10 XP</span></div>' +
          '<h3 class="quiz-question">' + esc(chapter.quiz.q) + "</h3>" +
          '<div class="quiz-options">' + chapter.quiz.options.map(function (option, index) {
            return '<button class="quiz-option" type="button" data-quiz-option="' + index + '">' +
              '<span class="quiz-letter">' + "ABC"[index] + "</span><span>" + esc(option) + "</span></button>";
          }).join("") + "</div>" +
          '<div class="quiz-result" id="quizResult" hidden></div>' +
          '<button class="btn btn--primary btn--full" type="button" data-quiz-continue disabled id="quizContinue">Завершить главу</button>' +
          '<button class="quiz-skip" type="button" data-quiz-skip>Пропустить вопрос</button>' +
          '<p class="quiz-hint">За ответ дают +10 XP. Если ошиблись — глава всё равно засчитается.</p>'
      });
      reader.quizAnswered = false;
    }

    function answerQuiz(optionIndex) {
      if (destroyed || !chapter.quiz || reader.quizAnswered) return;
      const quiz = chapter.quiz;
      const correct = optionIndex === quiz.answer;
      reader.quizAnswered = true;
      const result = S.recordQuiz(correct);
      reader.quizXp = result.xp || 0;

      const buttons = document.querySelectorAll(".quiz-option");
      buttons.forEach(function (button, index) {
        button.disabled = true;
        if (index === quiz.answer) button.classList.add("is-correct");
        if (index === optionIndex && !correct) button.classList.add("is-wrong");
        if (index !== quiz.answer && index !== optionIndex) button.classList.add("is-muted");
      });

      const resultBox = document.getElementById("quizResult");
      if (resultBox) {
        resultBox.hidden = false;
        resultBox.className = "quiz-result " + (correct ? "is-correct" : "is-wrong");
        resultBox.innerHTML = "<strong>" + (correct ? "Точно так! +10 XP" : "Почти получилось") + "</strong>" +
          (correct ? "" : "<span>Правильный ответ: <b>" + esc(quiz.options[quiz.answer]) + "</b></span>") +
          "<p>" + esc(quiz.explain || "") + "</p>";
      }
      const continueButton = document.getElementById("quizContinue");
      if (continueButton) {
        continueButton.disabled = false;
        continueButton.textContent = "Завершить главу";
        try { continueButton.focus({ preventScroll: true }); } catch (err) { /* пусто */ }
      }
      U.playSound(correct ? "correct" : "wrong");
      U.flushEvents();
    }

    function skipQuiz() {
      if (reader.quizAnswered) return;
      reader.quizXp = 0;
      reader.quizAnswered = true;
      completeChapter();
    }

    /* ---------- завершение главы ---------- */

    function completeChapter() {
      if (destroyed) return;
      if (reader.completed) return;
      const result = S.finishChapter(book, chapterIndex);
      if (result.already) {
        reader.chapterDone = true;
        U.closeSheet();
        return;
      }
      reader.completed = true;
      reader.chapterDone = true;
      reader.finishedBook = !!result.bookFinished;
      reader.nextIndex = result.nextChapter;
      U.closeSheet(true);
      const end = root.querySelector("#readerEnd");
      if (end) end.innerHTML = endBlock(true);
      const finishButton = root.querySelector("#readerFinish");
      if (finishButton) finishButton.textContent = result.bookFinished ? "К книге" : "Далее";
      U.playSound(result.bookFinished ? "level" : "success");
      U.confetti(result.bookFinished ? 58 : 28);
      openCompletionSheet(result);
      U.flushEvents();
      updateDailyHud();
    }

    function openCompletionSheet(result) {
      const goal = S.getGoalInfo();
      const saga = S.getSaga(book.sagaId);
      const sagaStats = saga ? S.getSagaStats(saga) : null;
      const books = saga ? S.booksOfSaga(saga.id) : [];
      const nextBook = result.bookFinished && saga
        ? books.find(function (b) {
          const p = S.getProgress(b.id);
          return b.order > book.order && !(p && p.finished);
        })
        : null;
      const quizXp = reader.quizXp;
      let primary = "";

      if (result.bookFinished) {
        if (nextBook) {
          primary = '<a class="btn btn--primary btn--full" href="#/book/' + nextBook.id + '">Следующая книга саги ' + icon("arrow-right") + "</a>";
        } else if (sagaStats && sagaStats.complete && !sagaStats.claimed) {
          primary = '<a class="btn btn--gold btn--full" href="#/saga/' + saga.id + '">' + icon("gift") + " Забрать сундук саги</a>";
        } else {
          primary = '<a class="btn btn--primary btn--full" href="#/book/' + book.id + '">К книге ' + icon("arrow-right") + "</a>";
        }
      } else {
        primary = '<a class="btn btn--primary btn--full" href="#/read/' + book.id + "/" + result.nextChapter + '">Следующая глава ' + icon("arrow-right") + "</a>";
      }

      const rewards = '<span class="reward-chip">' + icon("bolt") + " +25 XP</span>" +
        '<span class="reward-chip">🪶 +4</span>' +
        (quizXp ? '<span class="reward-chip reward-chip--quiz">💡 +' + quizXp + " XP за вопрос</span>" : "") +
        (result.bookFinished ? '<span class="reward-chip reward-chip--gold">' + icon("bolt") + " +100 XP за книгу</span>" +
          '<span class="reward-chip reward-chip--gold">🪶 +25 за книгу</span>' : "");

      U.openSheet({
        title: result.bookFinished ? "Книга дочитана!" : "Глава пройдена!",
        eyebrow: result.bookFinished ? "Большой шаг" : "Так держать",
        className: "completion-sheet",
        theme: S.state.settings.theme,
        html: '<div class="completion-hero">' + U.owlSVG("owl--completion") + "</div>" +
          '<p class="completion-lead">' + (result.bookFinished
            ? "Ты дошёл до последней страницы «" + esc(book.title) + "». Это уже не просто чтение — это коллекция."
            : "Одна глава позади. История стала ближе, а огонёк — ярче.") + "</p>" +
          '<div class="reward-chips">' + rewards + "</div>" +
          (result.bookFinished && saga
            ? '<div class="completion-saga"><span>' + (sagaStats && sagaStats.complete ? "Сага собрана!" : "Прогресс саги") + "</span>" +
              "<strong>" + esc(saga.title) + "</strong>" +
              '<span class="completion-saga__meta">' + (sagaStats ? sagaStats.finishedBooks + " из " + sagaStats.booksCount + " книг" : "") + "</span></div>"
            : "") +
          '<p class="completion-goal">' + (goal.reached
            ? "🔥 Цель дня выполнена — огонёк горит."
            : "До цели дня: " + goal.leftMinutes + " " + U.minutesWord(goal.leftMinutes) + ".") + "</p>" +
          '<div class="completion-actions">' + primary +
          '<a class="btn btn--ghost btn--full" href="#/book/' + book.id + '">К книге</a>' +
          (saga ? '<a class="btn btn--ghost btn--full" href="#/saga/' + saga.id + '">Открыть сагу</a>' : "") +
          "</div>" +
          '<button class="sheet-inline-close" type="button" data-action="close-sheet">Остаться в главе</button>'
      });
      reader.quizXp = 0;
    }

    /* ---------- настройки чтения ---------- */

    function openSettings() {
      stopTTS();
      const current = S.state.settings;
      const themes = Object.keys(THEMES).map(function (id) {
        return '<button class="theme-card ' + (current.theme === id ? "is-active" : "") + '" type="button" data-action="reader-theme" data-theme="' + id + '">' +
          '<span class="theme-card__preview theme-preview--' + id + '"><i></i><i></i><i></i></span>' +
          "<span>" + THEMES[id].label + "</span></button>";
      }).join("");
      U.openSheet({
        title: "Настройки чтения",
        eyebrow: "Сделай уютно",
        className: "settings-sheet",
        theme: current.theme,
        html: '<div class="sheet-section"><span class="sheet-label">Тема</span>' +
          '<div class="theme-grid">' + themes + "</div></div>" +
          '<div class="sheet-section"><span class="sheet-label">Размер текста</span>' +
          '<div class="font-row"><button class="font-btn" type="button" data-action="reader-font" data-delta="-1" aria-label="Уменьшить шрифт">A−</button>' +
          '<span class="font-sample" id="fontSample" style="font-size:' + current.fontSize + 'px">Аа</span>' +
          '<button class="font-btn" type="button" data-action="reader-font" data-delta="1" aria-label="Увеличить шрифт">A+</button></div>' +
          '<span class="font-value" id="fontSizeValue">' + current.fontSize + " px</span></div>" +
          '<div class="sheet-section"><span class="sheet-label">Слушать</span>' +
          '<button class="btn btn--soft btn--full" type="button" data-action="reader-tts" data-tts-label>Прочитать главу вслух</button>' +
          '<p class="sheet-hint">Синтез речи работает на устройстве. Если голос не звучит, проверь настройки браузера.</p></div>' +
          '<button class="btn btn--primary btn--full" type="button" data-action="close-sheet">Готово</button>'
      });
      updateFontButtons();
    }

    function setTheme(theme) {
      if (!THEMES[theme]) return;
      S.updateSettings({ theme: theme });
      if (readerRoot) readerRoot.dataset.theme = theme;
      const sheet = document.querySelector(".sheet");
      if (sheet) sheet.dataset.theme = theme;
      document.querySelectorAll(".theme-card").forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.theme === theme);
      });
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", THEMES[theme].bg);
    }

    function setFont(delta) {
      const next = U.clamp(S.state.settings.fontSize + delta, 16, 30);
      if (next === S.state.settings.fontSize) return;
      S.updateSettings({ fontSize: next });
      if (readerRoot) readerRoot.style.setProperty("--reader-size", next + "px");
      const sample = document.getElementById("fontSample");
      if (sample) sample.style.fontSize = next + "px";
      const value = document.getElementById("fontSizeValue");
      if (value) value.textContent = next + " px";
      updateFontButtons();
    }

    function updateFontButtons() {
      const size = S.state.settings.fontSize;
      document.querySelectorAll('[data-action="reader-font"]').forEach(function (button) {
        const delta = Number(button.dataset.delta);
        button.disabled = (delta < 0 && size <= 16) || (delta > 0 && size >= 30);
      });
    }

    /* ---------- чтение вслух ---------- */

    function updateTTSButton() {
      const button = document.getElementById("readerTTS");
      if (button) {
        button.classList.toggle("is-active", speaking);
        button.setAttribute("aria-pressed", speaking ? "true" : "false");
      }
      document.querySelectorAll("[data-tts-label]").forEach(function (label) {
        label.textContent = speaking ? "Остановить чтение" : "Прочитать главу вслух";
      });
    }

    function toggleTTS() {
      if (speaking) {
        stopTTS();
        return;
      }
      if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
        U.toast("Этот браузер не умеет читать вслух.", { icon: "🔇", title: "Нет синтеза речи" });
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chapter.title + ". " + chapter.paragraphs.join(" "));
      utterance.lang = "ru-RU";
      utterance.rate = U.clamp(S.state.settings.ttsRate || 0.95, 0.7, 1.3);
      utterance.pitch = 1;
      utterance.onend = function () {
        speaking = false;
        updateTTSButton();
      };
      utterance.onerror = function () {
        speaking = false;
        updateTTSButton();
      };
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        speaking = true;
        updateTTSButton();
        U.toast("Читаю главу вслух. Нажми ещё раз, чтобы остановить.", { icon: "🔊" });
      } catch (err) {
        speaking = false;
        updateTTSButton();
      }
    }

    function stopTTS() {
      if (!speaking) return;
      speaking = false;
      try { window.speechSynthesis.cancel(); } catch (err) { /* пусто */ }
      updateTTSButton();
    }

    function back() {
      saveNow();
      if (typeof opts.onBack === "function") opts.onBack();
    }

    function destroy() {
      if (destroyed) return;
      saveNow();
      destroyed = true;
      reader.destroyed = true;
      if (timerId) window.clearInterval(timerId);
      stopTTS();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveNow);
      if (scroller) scroller.removeEventListener("scroll", onScroll);
    }

    return reader;
  }

  window.SovaReader = { mount: mount };
})();
