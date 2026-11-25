import {
  loadStore,
  saveStore,
  activeProfile,
  recordResult,
  dueWords,
  addXp,
  markSessionPlayed,
  resetStore,
} from "./storage.js";
import {
  canRecognize,
  canSynthesize,
  speak,
  stopSpeaking,
  stopRecognition,
  recognize,
  heardMatches,
} from "./speech.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));
const E2E = new URLSearchParams(location.search).has("e2e");
const ROUNDS = E2E ? 3 : 10;
const DUO_ROUNDS = E2E ? 4 : 8;

const VI = {
  subtitle: "Cùng học từ và phát âm",
  level: "Chọn trình độ",
  snap: "Chọn nghĩa đúng",
  snapHint: "Bốn lựa chọn, một nghĩa đúng",
  say: "Nói từ này",
  sayHint: "Nghe, rồi nói lại",
  twins: "Bạn nghe thấy từ nào?",
  twinsHint: "Luyện nghe các cặp âm dễ nhầm",
  review: "Ôn từ đến hạn",
  reviewHint: "Các từ cần xem lại hôm nay",
  duo: "Chơi cùng nhau",
  duoHint: "Đưa điện thoại cho nhau",
  settings: "Cài đặt",
  hear: "Nghe",
  sayNow: "Nói",
  listening: "Đang nghe…",
  saidWell: "Mình nói ổn",
  needPractice: "Cần luyện thêm",
  playAgain: "Chơi lại",
  home: "Về trang chính",
  passPhone: "Đưa điện thoại cho người kia",
  ISaidIt: "Mình đã nói xong",
  noDue: "Hôm nay không có từ cần ôn",
  fallback:
    "Trình duyệt này không chấm phát âm tự động (thường gặp trên Firefox). Hãy nghe, nói to, rồi tự đánh giá.",
  heard: "Máy nghe được",
  tryAgain: "Thử lại",
  next: "Tiếp",
  streak: "Chuỗi ngày",
  shared: "Cả hai đã học",
};

const app = document.getElementById("app");
let words = [];
let pairs = [];
let store = loadStore();
let view = "home";
let game = null;
let speakBusy = false;

function profile() {
  return activeProfile(store);
}
function persist() {
  saveStore(store);
}
function hint(key) {
  return profile().viHints && VI[key] ? `<span class="hint">${escapeHtml(VI[key])}</span>` : "";
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function lang() {
  return profile().accent || "en-GB";
}
function roundCount(duo = false) {
  return duo ? DUO_ROUNDS : ROUNDS;
}

function wordById(id) {
  return words.find((w) => w.id === id);
}
function wordByLemma(lemma) {
  return words.find((w) => w.lemma === lemma);
}

function poolForLevel(level) {
  const rank = LEVEL_RANK[level] ?? 1;
  const current = words.filter((w) => w.level === level);
  const personal = words.filter(
    (w) => w.source === "personal" && (LEVEL_RANK[w.level] ?? 0) <= rank
  );
  const stretch = words.filter((w) => (LEVEL_RANK[w.level] ?? 99) === rank + 1);
  return { current, personal, stretch };
}

function pickWords(count, level) {
  const { current, personal, stretch } = poolForLevel(level);
  const due = dueWords(store, current);
  const unseen = current.filter((w) => !store.progress[store.active]?.[w.id]);
  const seen = current.filter((w) => store.progress[store.active]?.[w.id]);
  const out = [];
  const used = new Set();
  function take(list, n) {
    for (const w of shuffle(list)) {
      if (out.length >= count) break;
      if (used.has(w.id)) continue;
      used.add(w.id);
      out.push(w);
    }
  }
  take(due, Math.min(3, count));
  take(unseen, Math.ceil(count * 0.5));
  take(personal, Math.min(2, count));
  take(stretch, 1);
  take(seen, count);
  take(current, count);
  take(words, count);
  return out.slice(0, count);
}

function pickPairs(count, level) {
  const rank = LEVEL_RANK[level] ?? 1;
  const same = pairs.filter((p) => p.level === level);
  const lower = pairs.filter((p) => (LEVEL_RANK[p.level] ?? 0) < rank);
  const any = pairs.slice();
  const out = [];
  const used = new Set();
  function take(list) {
    for (const p of shuffle(list)) {
      if (out.length >= count) break;
      if (used.has(p.id)) continue;
      used.add(p.id);
      out.push(p);
    }
  }
  take(same);
  take(lower);
  take(any);
  // If still short, recycle.
  let i = 0;
  while (out.length < count && pairs.length) {
    out.push(pairs[i % pairs.length]);
    i += 1;
  }
  return out.slice(0, count).map((p) => {
    const target = Math.random() < 0.5 ? "a" : "b";
    return { ...p, target, heard: false };
  });
}

function glossOptions(word) {
  const rank = LEVEL_RANK[word.level] ?? 1;
  const nearby = words.filter((w) => {
    const r = LEVEL_RANK[w.level] ?? 0;
    return w.id !== word.id && w.gloss !== word.gloss && Math.abs(r - rank) <= 1;
  });
  const picks = shuffle(nearby).slice(0, 3);
  while (picks.length < 3) {
    const extra = words[Math.floor(Math.random() * words.length)];
    if (extra && extra.id !== word.id && extra.gloss !== word.gloss && !picks.includes(extra)) {
      picks.push(extra);
    }
  }
  return shuffle([
    { text: word.gloss, correct: true },
    ...picks.slice(0, 3).map((w) => ({ text: w.gloss, correct: false })),
  ]);
}

function xpFor(correct, streak, firstTry = false) {
  if (!correct) return 0;
  return 10 + Math.min(streak, 5) * 2 + (firstTry ? 5 : 0);
}

function shell(inner, { back = true, title } = {}) {
  const p = profile();
  return `
    <header class="top">
      <a class="brand" href="#/" data-action="nav" data-to="home">
        <span class="logo" aria-hidden="true"></span>
        <div>
          <h1>Word Duo</h1>
          <p>${p.viHints ? escapeHtml(VI.subtitle) : "Vocab and pronunciation, for two"}</p>
        </div>
      </a>
      <div class="stats">
        <div class="pill" title="XP" data-testid="xp">XP ${p.xp}</div>
        <div class="pill" title="Streak" data-testid="streak">🔥 ${p.streakDays}</div>
      </div>
    </header>
    ${back ? `<button class="back" data-action="nav" data-to="home">← Home${hint("home")}</button>` : ""}
    ${title ? `<h2>${title}</h2>` : ""}
    ${inner}
  `;
}

function renderHome() {
  const p = profile();
  const due = dueWords(store, words);
  const shared = store.shared.streakDays
    ? `<p class="lede">${escapeHtml(VI.shared)}: <strong>${store.shared.streakDays}</strong>${p.viHints ? "" : " day streak together"}.</p>`
    : "";
  view = "home";
  app.innerHTML = shell(
    `
    <div class="card">
      <div class="progress-line">
        <span>Playing as</span>
      </div>
      <div class="row">
        ${store.profiles
          .map(
            (pr, i) =>
              `<button class="player-btn ${i === store.active ? "is-on" : ""}" data-action="switch-player" data-index="${i}" data-testid="player-${i}">${escapeHtml(pr.name)}</button>`
          )
          .join("")}
        <button class="btn ghost" data-action="nav" data-to="settings">${escapeHtml(VI.settings)}</button>
      </div>
      ${shared}
      <p class="lede" style="margin-top:12px">Level${hint("level")}</p>
      <div class="levels" data-testid="levels">
        ${LEVELS.map(
          (lv) =>
            `<button class="chip ${p.level === lv ? "is-on" : ""}" data-action="set-level" data-level="${lv}" data-testid="level-${lv}">${lv}</button>`
        ).join("")}
      </div>
    </div>
    <div class="play-grid">
      ${playCard("snap", "Meaning Snap", VI.snapHint, "Aa")}
      ${playCard("say", "Say It", VI.sayHint, "♪")}
      ${playCard("twins", "Twin Sounds", VI.twinsHint, "🔊")}
      ${playCard("review", "Review", `${due.length} due today`, "↻", due.length)}
      ${playCard("duo", "Duo", VI.duoHint, "2")}
    </div>
    <p class="footnote">A starter word bank, not an official exam list. British English by default.</p>
    `,
    { back: false }
  );
}

function playCard(to, title, detail, icon, badge) {
  const hintKey = to;
  return `
    <button class="play-card" data-action="nav" data-to="${to}" data-testid="nav-${to}">
      <span class="icon ${to}">${icon}</span>
      <div>
        <h3>${title}${hint(hintKey)}</h3>
        <p>${escapeHtml(detail)}${badge != null ? "" : ""}</p>
      </div>
      <span class="go">Play</span>
    </button>`;
}

function renderSettings() {
  const p = profile();
  view = "settings";
  app.innerHTML = shell(
    `
    <div class="card">
      <div class="field">
        <span>Your name</span>
        <input data-action="name" data-index="0" value="${escapeHtml(store.profiles[0].name)}" maxlength="24">
      </div>
      <div class="field">
        <span>Partner's name</span>
        <input data-action="name" data-index="1" value="${escapeHtml(store.profiles[1].name)}" maxlength="24">
      </div>
      <div class="field">
        <span>Accent for listening and speaking</span>
        <select data-action="accent">
          <option value="en-GB" ${p.accent === "en-GB" ? "selected" : ""}>British English</option>
          <option value="en-US" ${p.accent === "en-US" ? "selected" : ""}>American English</option>
        </select>
      </div>
      <label class="toggle">
        <span>Vietnamese hints</span>
        <input type="checkbox" data-action="vi" ${p.viHints ? "checked" : ""}>
      </label>
    </div>
    <p class="lede">Progress stays on this device in local storage. No account needed.</p>
    `,
    { title: "Settings" }
  );
}

function startSnap({ review = false, duo = false } = {}) {
  const level = profile().level;
  const items = review
    ? shuffle(dueWords(store, words)).slice(0, roundCount(duo))
    : pickWords(roundCount(duo), level);
  if (!items.length) {
    game = { type: "empty-review" };
    renderEmptyReview();
    return;
  }
  game = {
    type: duo ? "duo-snap" : "snap",
    review,
    items: items.map((word) => ({ word, options: glossOptions(word), picked: null, timedOut: false })),
    index: 0,
    correct: 0,
    streak: 0,
    xp: 0,
    turn: 0,
    scores: [0, 0],
    locked: false,
    startedAt: Date.now(),
    timeLeft: 15,
    timerId: null,
  };
  view = game.type;
  tickSnap();
  renderSnap();
}

function tickSnap() {
  clearSnapTimer();
  game.timeLeft = 15;
  game.timerId = setInterval(() => {
    if (!game || (game.type !== "snap" && game.type !== "duo-snap")) return clearSnapTimer();
    game.timeLeft -= 1;
    const el = document.querySelector("[data-testid=timer]");
    if (el) el.textContent = `${Math.max(0, game.timeLeft)}s`;
    if (game.timeLeft <= 0) answerSnap(-1, true);
  }, 1000);
}
function clearSnapTimer() {
  if (game && game.timerId) {
    clearInterval(game.timerId);
    game.timerId = null;
  }
}

function renderSnap() {
  if (game.index >= game.items.length) return renderResults();
  const round = game.items[game.index];
  const duo = game.type === "duo-snap";
  const player = store.profiles[game.turn];
  const bar = Math.round((game.index / game.items.length) * 100);
  app.innerHTML = shell(
    `
    <div class="progress-line">
      <span>${duo ? escapeHtml(player.name) + " · " : ""}Round ${game.index + 1} / ${game.items.length}</span>
      <span class="timer" data-testid="timer">${game.timeLeft}s</span>
    </div>
    <div class="bar"><span style="width:${bar}%"></span></div>
    ${duo ? `<div class="banner info">${escapeHtml(VI.passPhone)} — ${escapeHtml(player.name)}</div>` : ""}
    <div class="card">
      <p class="meta">${escapeHtml(round.word.level)} · ${escapeHtml(round.word.pos)}</p>
      <h2 class="word" data-testid="prompt">${escapeHtml(round.word.lemma)}</h2>
      <p class="lede" style="text-align:center">${hint("snap") || "Pick the meaning"}</p>
      <div class="options">
        ${round.options
          .map(
            (opt, i) => `
          <button class="option ${optClass(round, i)}" data-action="snap-answer" data-index="${i}"
            data-testid="option-${i}" ${E2E && opt.correct ? 'data-correct="1"' : ""}
            ${round.picked != null || game.locked ? "disabled" : ""}>${escapeHtml(opt.text)}</button>`
          )
          .join("")}
      </div>
    </div>
    `,
    { title: game.review ? "Review · Meaning Snap" : "Meaning Snap" }
  );
}
function optClass(round, i) {
  if (round.picked == null && !round.timedOut) return "";
  if (round.options[i].correct) return "is-right";
  if (round.picked === i) return "is-wrong";
  return "";
}

function answerSnap(optionIndex, timedOut = false) {
  if (!game || game.locked) return;
  const round = game.items[game.index];
  if (round.picked != null) return;
  clearSnapTimer();
  const correct = !timedOut && optionIndex >= 0 && round.options[optionIndex].correct;
  round.picked = optionIndex;
  round.timedOut = timedOut;
  game.locked = true;
  if (correct) {
    game.correct += 1;
    game.streak += 1;
    if (game.type === "duo-snap") game.scores[game.turn] += 1;
  } else {
    game.streak = 0;
  }
  const gained = xpFor(correct, game.streak);
  game.xp += gained;
  addXp(store, gained);
  recordResult(store, round.word.id, "meaning", correct);
  persist();
  renderSnap();
  setTimeout(() => {
    if (!game) return;
    game.index += 1;
    game.locked = false;
    if (game.type === "duo-snap") game.turn = game.turn === 0 ? 1 : 0;
    if (game.index >= game.items.length) renderResults();
    else {
      tickSnap();
      renderSnap();
    }
  }, 850);
}

function startSay({ review = false } = {}) {
  const level = profile().level;
  const items = review
    ? shuffle(dueWords(store, words)).slice(0, roundCount())
    : pickWords(roundCount(), level);
  if (!items.length) {
    game = { type: "empty-review" };
    renderEmptyReview();
    return;
  }
  game = {
    type: "say",
    review,
    items: items.map((word) => ({ word, attempts: 0, result: null, heard: "", firstTry: false })),
    index: 0,
    correct: 0,
    streak: 0,
    xp: 0,
    listening: false,
    support: canRecognize(),
    synth: canSynthesize(),
  };
  view = "say";
  renderSay();
}

function renderSay() {
  if (game.index >= game.items.length) return renderResults();
  const round = game.items[game.index];
  const word = round.word;
  const bar = Math.round((game.index / game.items.length) * 100);
  const fallback = !game.support;
  const status = round.result
    ? round.result === "right"
      ? `<div class="banner ok">${profile().viHints ? "Đúng rồi!" : "Nice!"} ${round.heard ? ` ${escapeHtml(VI.heard)}: “${escapeHtml(round.heard)}”` : ""}</div>`
      : `<div class="banner bad">${profile().viHints ? "Gần đúng, thử lại nhé." : "Not quite."} ${round.heard ? `${escapeHtml(VI.heard)}: “${escapeHtml(round.heard)}”` : ""}</div>`
    : "";
  app.innerHTML = shell(
    `
    <div class="progress-line">
      <span>Round ${game.index + 1} / ${game.items.length}</span>
      <span>${"★".repeat(Math.max(0, 3 - round.attempts))}${"☆".repeat(round.attempts)}</span>
    </div>
    <div class="bar"><span style="width:${bar}%"></span></div>
    ${fallback ? `<div class="banner warn" data-testid="speech-fallback">${escapeHtml(VI.fallback)}</div>` : ""}
    <div class="card">
      <p class="meta">${escapeHtml(word.level)} · ${escapeHtml(word.pos)}</p>
      <h2 class="word" data-testid="prompt">${escapeHtml(word.lemma)}</h2>
      <p class="ipa" data-testid="ipa">${escapeHtml(word.ipa || " ")}</p>
      <p class="lede" style="text-align:center">${escapeHtml(word.gloss)}</p>
      <div class="row">
        <button class="btn peach" data-action="hear" data-testid="hear" ${game.synth ? "" : "disabled"}>${escapeHtml(VI.hear)}</button>
        ${
          fallback
            ? ""
            : `<button class="btn primary" data-action="listen" data-testid="listen" ${game.listening ? "disabled" : ""}>${game.listening ? escapeHtml(VI.listening) : escapeHtml(VI.sayNow)}</button>`
        }
      </div>
      ${
        fallback
          ? `<div class="row" style="margin-top:10px">
              <button class="btn mint" data-action="self-right" data-testid="self-right">${escapeHtml(VI.saidWell)}</button>
              <button class="btn" data-action="self-wrong" data-testid="self-wrong">${escapeHtml(VI.needPractice)}</button>
            </div>`
          : ""
      }
      ${status}
      ${
        round.result
          ? `<button class="btn primary wide" data-action="say-next" data-testid="next">${escapeHtml(VI.next)}</button>`
          : round.attempts >= 3 && !fallback
            ? `<button class="btn primary wide" data-action="say-next" data-testid="next">${escapeHtml(VI.next)}</button>`
            : ""
      }
    </div>
    `,
    { title: game.review ? "Review · Say It" : "Say It" }
  );
}

async function hearWord(text) {
  if (speakBusy) return;
  speakBusy = true;
  try {
    await speak(text, { lang: lang() });
  } finally {
    speakBusy = false;
  }
}

async function listenSay() {
  if (!game || game.type !== "say" || game.listening) return;
  const round = game.items[game.index];
  if (round.result === "right" || round.attempts >= 3) return;
  game.listening = true;
  renderSay();
  try {
    const result = await recognize({ lang: lang() });
    const ok = heardMatches(result.transcript, round.word.lemma);
    round.attempts += 1;
    round.heard = result.transcript;
    if (ok) {
      round.result = "right";
      round.firstTry = round.attempts === 1;
      finishSayRound(round, true);
    } else if (round.attempts >= 3) {
      round.result = "wrong";
      finishSayRound(round, false);
    }
  } catch (err) {
    const code = err && err.code;
    if (code === "unsupported" || code === "not-allowed" || code === "service-not-allowed") {
      game.support = false;
    }
    round.heard = "";
  } finally {
    game.listening = false;
    if (game && game.type === "say") renderSay();
  }
}

function selfGrade(ok) {
  if (!game || game.type !== "say") return;
  const round = game.items[game.index];
  if (round.result) return;
  round.attempts = Math.max(1, round.attempts);
  round.result = ok ? "right" : "wrong";
  round.firstTry = ok && round.attempts === 1;
  finishSayRound(round, ok);
  renderSay();
}

function finishSayRound(round, ok) {
  if (ok) {
    game.correct += 1;
    game.streak += 1;
  } else game.streak = 0;
  const gained = xpFor(ok, game.streak, Boolean(round.firstTry));
  game.xp += gained;
  addXp(store, gained);
  recordResult(store, round.word.id, "speaking", ok);
  persist();
}

function nextSay() {
  if (!game || game.type !== "say") return;
  const round = game.items[game.index];
  if (!round.result && round.attempts < 3 && game.support) return;
  if (!round.result) {
    round.result = "wrong";
    finishSayRound(round, false);
  }
  game.index += 1;
  if (game.index >= game.items.length) renderResults();
  else renderSay();
}

function startTwins({ review = false, duo = false } = {}) {
  const level = profile().level;
  const items = pickPairs(roundCount(duo), level);
  game = {
    type: duo ? "duo-twins" : "twins",
    review,
    items,
    index: 0,
    correct: 0,
    streak: 0,
    xp: 0,
    turn: 0,
    scores: [0, 0],
    locked: false,
    phase: duo ? "say" : "listen",
    synth: canSynthesize(),
  };
  view = game.type;
  renderTwins();
}

function currentTwin() {
  return game.items[game.index];
}

function renderTwins() {
  if (game.index >= game.items.length) return renderResults();
  const pair = currentTwin();
  const target = pair[pair.target];
  const other = pair[pair.target === "a" ? "b" : "a"];
  const duo = game.type === "duo-twins";
  const speaker = store.profiles[game.turn];
  const listener = store.profiles[game.turn === 0 ? 1 : 0];
  const bar = Math.round((game.index / game.items.length) * 100);
  const order = shuffle([
    { side: pair.target, item: target },
    { side: pair.target === "a" ? "b" : "a", item: other },
  ]);
  game.buttonOrder = order;

  if (duo && game.phase === "say") {
    app.innerHTML = shell(
      `
      <div class="progress-line"><span>Round ${game.index + 1} / ${game.items.length}</span><span>${escapeHtml(pair.pitfall)}</span></div>
      <div class="bar"><span style="width:${bar}%"></span></div>
      <div class="banner info">${escapeHtml(VI.passPhone)} — ${escapeHtml(speaker.name)} speaks, ${escapeHtml(listener.name)} listens</div>
      <div class="card secret-word">
        <p class="meta">Say this word clearly</p>
        <h2 class="word" data-testid="secret">${escapeHtml(target.lemma)}</h2>
        <p class="ipa">${escapeHtml(target.ipa || "")}</p>
        <div class="row">
          <button class="btn peach" data-action="hear-target" data-testid="hear">${escapeHtml(VI.hear)}</button>
          <button class="btn primary" data-action="twins-passed" data-testid="passed">${escapeHtml(VI.ISaidIt)}</button>
        </div>
      </div>
      `,
      { title: "Duo · Twin Sounds" }
    );
    return;
  }

  const sentence = pair.target === "a" ? pair.sentenceA : pair.sentenceB;
  const showSentence = (LEVEL_RANK[profile().level] ?? 0) >= 2 && !duo;
  app.innerHTML = shell(
    `
    <div class="progress-line">
      <span>${duo ? escapeHtml(listener.name) + " · " : ""}Round ${game.index + 1} / ${game.items.length}</span>
      <span>${escapeHtml(pair.pitfall)}</span>
    </div>
    <div class="bar"><span style="width:${bar}%"></span></div>
    ${duo ? `<div class="banner info">${escapeHtml(listener.name)}, ${escapeHtml(VI.twins)}</div>` : ""}
    <div class="card" style="text-align:center">
      <p class="lede">${hint("twins") || "Which word did you hear?"}</p>
      <button class="listen ${pair.heard ? "" : ""}" data-action="hear-target" data-testid="hear" ${game.synth ? "" : "disabled"}>
        ${escapeHtml(VI.hear)}
      </button>
      ${showSentence && pair.heard ? `<p class="lede">In a sentence: “${escapeHtml(sentence)}”</p>` : ""}
      <div class="row" style="margin-top:8px">
        ${order
          .map(
            (opt, i) => `
          <button class="option ${twinsClass(pair, opt.side)}" data-action="twins-answer" data-side="${opt.side}"
            data-testid="option-${i}" ${E2E && opt.side === pair.target ? 'data-correct="1"' : ""}
            ${game.locked ? "disabled" : ""}>${escapeHtml(opt.item.lemma)}</button>`
          )
          .join("")}
      </div>
    </div>
    `,
    { title: duo ? "Duo · Twin Sounds" : game.review ? "Review · Twin Sounds" : "Twin Sounds" }
  );
}

function twinsClass(pair, side) {
  if (!game.locked && pair.picked == null) return "";
  if (side === pair.target) return "is-right";
  if (pair.picked === side) return "is-wrong";
  return "";
}

async function hearTarget(playSentence = false) {
  if (!game) return;
  const pair = currentTwin();
  const target = pair[pair.target];
  const sentence = pair.target === "a" ? pair.sentenceA : pair.sentenceB;
  pair.heard = true;
  const text = playSentence ? sentence : target.lemma;
  await hearWord(text);
  if (game && (game.type === "twins" || game.type === "duo-twins") && game.phase !== "say") {
    renderTwins();
  }
}

function twinsPassed() {
  if (!game || game.phase !== "say") return;
  game.phase = "listen";
  currentTwin().heard = true;
  renderTwins();
}

function answerTwins(side) {
  if (!game || game.locked) return;
  const pair = currentTwin();
  if (pair.picked) return;
  game.locked = true;
  pair.picked = side;
  const ok = side === pair.target;
  if (ok) {
    game.correct += 1;
    game.streak += 1;
    if (game.type === "duo-twins") game.scores[game.turn] += 1;
  } else game.streak = 0;
  const gained = xpFor(ok, game.streak);
  game.xp += gained;
  addXp(store, gained);
  const linked = wordByLemma(pair.a.lemma) || wordByLemma(pair.b.lemma);
  if (linked) recordResult(store, linked.id, "listening", ok);
  persist();
  renderTwins();
  setTimeout(() => {
    if (!game) return;
    game.index += 1;
    game.locked = false;
    game.phase = game.type === "duo-twins" ? "say" : "listen";
    if (game.type === "duo-twins") game.turn = game.turn === 0 ? 1 : 0;
    if (game.index >= game.items.length) renderResults();
    else renderTwins();
  }, 900);
}

function startReview() {
  const due = dueWords(store, words);
  if (!due.length) {
    game = { type: "empty-review" };
    renderEmptyReview();
    return;
  }
  // Alternate meaning and speaking for due cards; use twins when a pair exists.
  const items = shuffle(due).slice(0, roundCount());
  const withPairs = items.filter((w) => w.pairs && w.pairs.length);
  if (withPairs.length >= 2 && Math.random() < 0.34) startTwins({ review: true });
  else if (Math.random() < 0.5) startSnap({ review: true });
  else startSay({ review: true });
}

function renderEmptyReview() {
  view = "review";
  app.innerHTML = shell(
    `
    <div class="card">
      <p data-testid="no-due">${escapeHtml(VI.noDue)}. Play a game to learn a few new words first.</p>
      <div class="row">
        <button class="btn primary" data-action="nav" data-to="snap">Meaning Snap</button>
        <button class="btn" data-action="nav" data-to="say">Say It</button>
      </div>
    </div>
    `,
    { title: "Review" }
  );
}

function renderDuo() {
  view = "duo";
  game = null;
  app.innerHTML = shell(
    `
    <div class="card">
      <p class="lede">${hint("duo") || "Pass the phone. Scores are friendly."}</p>
      <div class="duo-names">
        <div class="pill" style="text-align:center">${escapeHtml(store.profiles[0].name)}</div>
        <div class="pill" style="text-align:center">${escapeHtml(store.profiles[1].name)}</div>
      </div>
      <div class="stack" style="margin-top:14px">
        <button class="btn primary wide" data-action="duo-snap" data-testid="duo-snap">Meaning Snap · take turns</button>
        <button class="btn mint wide" data-action="duo-twins" data-testid="duo-twins">Twin Sounds · I say, you hear</button>
      </div>
    </div>
    `,
    { title: "Duo" }
  );
}

function renderResults() {
  clearSnapTimer();
  stopRecognition();
  stopSpeaking();
  markSessionPlayed(store);
  persist();
  const total = game.items.length;
  const duo = game.type === "duo-snap" || game.type === "duo-twins";
  const p0 = store.profiles[0].name;
  const p1 = store.profiles[1].name;
  view = "results";
  const replayTo = game.type.startsWith("duo")
    ? game.type
    : game.review
      ? "review"
      : game.type;
  app.innerHTML = shell(
    `
    <div class="card score" data-testid="results">
      <p class="lede">Nice work</p>
      <p class="big">${game.correct}/${total}</p>
      <p>+${game.xp} XP · streak ${profile().streakDays} day${profile().streakDays === 1 ? "" : "s"}</p>
      ${
        duo
          ? `<p style="margin-top:10px"><strong>${escapeHtml(p0)}</strong> ${game.scores[0]} · <strong>${escapeHtml(p1)}</strong> ${game.scores[1]}</p>`
          : ""
      }
      <div class="row" style="margin-top:16px">
        <button class="btn primary" data-action="replay" data-to="${replayTo}" data-testid="replay">${escapeHtml(VI.playAgain)}</button>
        <button class="btn" data-action="nav" data-to="home">${escapeHtml(VI.home)}</button>
      </div>
    </div>
    `,
    { title: "Round over" }
  );
  game = null;
}

function renderError(message) {
  app.innerHTML = shell(
    `<div class="card"><p>${escapeHtml(message)}</p>
     <button class="btn primary" data-action="nav" data-to="home">Home</button></div>`
  );
}

function syncHash(to) {
  const route = to.replace(/^#\/?/, "");
  const hash = !route || route === "home" ? "#/" : `#/${route}`;
  const next = `${location.pathname}${location.search}${hash}`;
  if (`${location.pathname}${location.search}${location.hash || "#/"}` !== next) {
    history.replaceState(null, "", next);
  }
}

function go(to) {
  stopRecognition();
  stopSpeaking();
  clearSnapTimer();
  const route = to.replace(/^#\/?/, "");
  syncHash(route);
  if (route === "" || route === "home") return renderHome();
  if (route === "settings") return renderSettings();
  if (route === "snap") return startSnap();
  if (route === "say") return startSay();
  if (route === "twins") return startTwins();
  if (route === "review") return startReview();
  if (route === "duo") return renderDuo();
  if (route === "duo-snap") return startSnap({ duo: true });
  if (route === "duo-twins") return startTwins({ duo: true });
  renderHome();
}

app.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn || btn.tagName === "INPUT" || btn.tagName === "SELECT") return;
  const action = btn.dataset.action;
  if (action === "nav") go(btn.dataset.to);
  else if (action === "set-level") {
    profile().level = btn.dataset.level;
    persist();
    renderHome();
  } else if (action === "switch-player") {
    store.active = Number(btn.dataset.index) ? 1 : 0;
    persist();
    renderHome();
  } else if (action === "snap-answer") answerSnap(Number(btn.dataset.index));
  else if (action === "hear") {
    const word = game && game.items && game.items[game.index] && game.items[game.index].word;
    if (word) hearWord(word.lemma);
  } else if (action === "listen") listenSay();
  else if (action === "self-right") selfGrade(true);
  else if (action === "self-wrong") selfGrade(false);
  else if (action === "say-next") nextSay();
  else if (action === "hear-target") hearTarget(false);
  else if (action === "twins-passed") twinsPassed();
  else if (action === "twins-answer") answerTwins(btn.dataset.side);
  else if (action === "duo-snap") startSnap({ duo: true });
  else if (action === "duo-twins") startTwins({ duo: true });
  else if (action === "replay") go(btn.dataset.to);
});

app.addEventListener("change", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
  const action = el.dataset.action;
  if (action === "name") {
    const i = Number(el.dataset.index) ? 1 : 0;
    store.profiles[i].name = el.value.trim() || store.profiles[i].name;
    persist();
  } else if (action === "accent") {
    profile().accent = el.value === "en-US" ? "en-US" : "en-GB";
    persist();
  } else if (action === "vi") {
    profile().viHints = el.checked;
    persist();
    renderSettings();
  }
});

window.addEventListener("hashchange", () => {
  const to = location.hash.replace(/^#\/?/, "") || "home";
  if (["home", "settings", "snap", "say", "twins", "review", "duo"].includes(to)) go(to);
});

async function init() {
  try {
    const [w, p] = await Promise.all([
      fetch("data/words.json").then((r) => {
        if (!r.ok) throw new Error("Could not load words");
        return r.json();
      }),
      fetch("data/pairs.json").then((r) => {
        if (!r.ok) throw new Error("Could not load pairs");
        return r.json();
      }),
    ]);
    words = w;
    pairs = p;
    if (E2E) window.__WORD_DUO__ = { words, pairs, store, resetStore };
    const to = location.hash.replace(/^#\/?/, "") || "home";
    go(to);
  } catch (err) {
    renderError(err.message || "Could not start Word Duo.");
  }
}

init();
