import {
  loadStore,
  saveStore,
  activeProfile,
  recordResult,
  dueWords,
  addXp,
  markSessionPlayed,
  resetStore,
} from "./storage.js?v=20261125-3";
import {
  canRecognize,
  canSynthesize,
  speak,
  stopSpeaking,
  stopRecognition,
  recognize,
  heardMatches,
} from "./speech.js?v=20261125-3";
import { PITFALL_TIPS, sayTipsFor, twinsTipFor } from "./tips.js?v=20261125-3";
import { createUsVault } from "./us.js?v=20261125-3";
import { celebrate, maybeCelebrateStreak, maybeCelebrateLevel, markXpFloor, noteStreakReset } from "./celebrate.js?v=20261125-3";

const VERSION = "20261125-3";
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));
const E2E = new URLSearchParams(location.search).has("e2e");
const us = createUsVault({ version: VERSION });
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
  us: "Chúng mình",
  usHint: "Từ về cuộc sống của hai mình",
  usLocked: "Nhập mã để mở ảnh và chủ đề Chúng mình",
  usUnlock: "Mở khóa",
  usLock: "Khóa Chúng mình",
  passcode: "Mã mở khóa",
  passBad: "Mã này chưa đúng. Thử lại nhé.",
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
function afterPaint() {
  us.hydrate(app);
}
function hintMode() {
  const mode = profile().hintMode;
  return mode === "off" || mode === "always" ? mode : "demand";
}
function uiVi() {
  return hintMode() !== "off";
}
function hint(key) {
  return uiVi() && VI[key] ? `<span class="hint">${escapeHtml(VI[key])}</span>` : "";
}
function hintOpen(round) {
  return hintMode() === "always" || Boolean(round && round.hintOn);
}
function wordBlock(lemma, ipa, { testid = "prompt", ipaTestid = "ipa", tag = "h2" } = {}) {
  return `<div class="word-block">
    <${tag} class="word" data-testid="${testid}">${escapeHtml(lemma)}</${tag}>
    <p class="ipa" data-testid="${ipaTestid}">${escapeHtml(ipa || "")}</p>
  </div>`;
}
function viMeaningHtml(word) {
  if (!word || !word.vi) return "";
  const note = word.viNote ? `<p class="vi-note">${escapeHtml(word.viNote)}</p>` : "";
  return `<div class="vi-hint" data-testid="vi-hint"><p class="vi-meaning">${escapeHtml(word.vi)}</p>${note}</div>`;
}
function hintButton(alreadyOn) {
  if (hintMode() !== "demand" || alreadyOn) return "";
  return `<button class="btn ghost hint-btn" data-action="use-hint" data-testid="hint-btn">Gợi ý 🇻🇳</button>`;
}
function meaningHintPanel(word, round, { afterAnswer = false } = {}) {
  if (hintMode() === "off") return "";
  const show = afterAnswer || hintOpen(round);
  return `${hintButton(show)}${show ? viMeaningHtml(word) : ""}`;
}
function sayHintPanel(word, round) {
  if (hintMode() === "off") return "";
  const show = hintOpen(round) || Boolean(round && round.result);
  if (!show) return hintButton(false);
  const tips = sayTipsFor(word).map((line) => `<p class="vi-note">${escapeHtml(line)}</p>`).join("");
  return `${viMeaningHtml(word)}<div class="vi-hint" data-testid="vi-tip"><p class="tip-title">Phát âm</p>${tips}</div>`;
}
function twinsHintPanel(pair, round, { afterAnswer = false } = {}) {
  if (hintMode() === "off") return "";
  const show = afterAnswer || hintOpen(round);
  if (!show) return hintButton(false);
  const tip = twinsTipFor(pair);
  const meanings = afterAnswer
    ? `<p class="vi-meaning">${escapeHtml(pair.a.lemma)} — ${escapeHtml(pair.a.vi || "")}</p>
       <p class="vi-meaning" style="margin-top:6px">${escapeHtml(pair.b.lemma)} — ${escapeHtml(pair.b.vi || "")}</p>`
    : "";
  return `<div class="vi-hint" data-testid="vi-tip"><p class="tip-title">${escapeHtml(tip.title)}</p><p class="vi-note">${escapeHtml(tip.body)}</p>${meanings}</div>`;
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
  return words.find((w) => w.id === id) || (us.isUnlocked() ? us.words().find((w) => w.id === id) : null);
}

function allPlayableWords() {
  return us.isUnlocked() ? words.concat(us.words()) : words;
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
  const bank = word.id && String(word.id).startsWith("us-") && us.isUnlocked()
    ? words.concat(us.words())
    : words;
  const rank = LEVEL_RANK[word.level] ?? 1;
  const nearby = bank.filter((w) => {
    const r = LEVEL_RANK[w.level] ?? 0;
    return w.id !== word.id && w.gloss !== word.gloss && Math.abs(r - rank) <= 1;
  });
  const picks = shuffle(nearby).slice(0, 3);
  while (picks.length < 3) {
    const extra = bank[Math.floor(Math.random() * bank.length)];
    if (extra && extra.id !== word.id && extra.gloss !== word.gloss && !picks.includes(extra)) {
      picks.push(extra);
    }
  }
  return shuffle([
    { text: word.gloss, correct: true },
    ...picks.slice(0, 3).map((w) => ({ text: w.gloss, correct: false })),
  ]);
}

function xpFor(correct, streak, firstTry = false, usedHint = false) {
  if (!correct) return 0;
  const streakBonus = usedHint ? 0 : Math.min(streak, 5) * 2;
  const tryBonus = firstTry && !usedHint ? 5 : 0;
  return 10 + streakBonus + tryBonus;
}

function shell(inner, { back = true, title } = {}) {
  const p = profile();
  return `
    <header class="top">
      <a class="brand" href="#/" data-action="nav" data-to="home">
        <span class="logo${us.isUnlocked() ? " has-photo" : ""}" aria-hidden="true">${us.photoTag((us.manifest() || {}).homePortrait || (us.manifest() || {}).usBadge, { className: "logo-photo", alt: "" })}</span>
        <div>
          <h1>Word Duo</h1>
          <p>${uiVi() ? escapeHtml(VI.subtitle) : "Vocab and pronunciation, for two"}</p>
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


function usHomeHero() {
  if (!us.isUnlocked()) return "";
  const mid = us.manifest() || {};
  return `
    <div class="card us-hero" data-testid="us-hero">
      ${us.photoTag(mid.homeHero || mid.usBadge, { className: "us-hero-photo", alt: "", testid: "us-hero-photo" })}
      <div class="us-hero-copy">
        <h3>${escapeHtml(VI.us)}</h3>
        <p>${escapeHtml(VI.usHint)}</p>
      </div>
    </div>`;
}

function usPlayCard() {
  if (us.isUnlocked()) {
    const mid = us.manifest() || {};
    const icon = us.photoTag(mid.usBadge, { className: "us-badge-photo", alt: "" }) || `<span class="icon snap">♥</span>`;
    return `
    <button class="play-card" data-action="nav" data-to="us" data-testid="nav-us">
      ${icon}
      <div>
        <h3>${escapeHtml(VI.us)}</h3>
        <p>${escapeHtml(VI.usHint)}</p>
      </div>
      <span class="go">Play</span>
    </button>`;
  }
  return `
    <button class="play-card is-locked" data-action="nav" data-to="us-unlock" data-testid="nav-us">
      <span class="icon snap">♥</span>
      <div>
        <h3>${escapeHtml(VI.us)}</h3>
        <p>${escapeHtml(VI.usLocked)}</p>
      </div>
      <span class="go">Unlock</span>
    </button>`;
}

function renderUnlock(error) {
  view = "us-unlock";
  app.innerHTML = shell(
    `
    <div class="card" data-testid="us-unlock">
      <h3>${escapeHtml(VI.us)}</h3>
      <p class="lede">${escapeHtml(VI.usLocked)}</p>
      <form class="unlock-form" data-action="us-unlock-form">
        <label>
          <span>${escapeHtml(VI.passcode)}</span>
          <input type="password" name="passcode" autocomplete="off" data-testid="us-passcode" required>
        </label>
        ${error ? `<p class="unlock-error" data-testid="us-unlock-error">${escapeHtml(VI.passBad)}</p>` : ""}
        <button class="btn primary wide" type="submit" data-testid="us-unlock-btn">${escapeHtml(VI.usUnlock)}</button>
      </form>
    </div>
    `,
    { title: VI.us }
  );
}

async function submitUnlock(form) {
  const input = form.querySelector("[name=passcode]");
  const value = input ? input.value : "";
  if (input) input.value = "";
  try {
    const ok = await us.unlock(value);
    if (!ok) return renderUnlock(true);
    markXpFloor(profile().xp);
    renderHome();
    us.hydrate(app);
  } catch {
    renderUnlock(true);
  }
}

function lockUs() {
  us.lock();
  if (view === "settings") renderSettings();
  else renderHome();
}

function renderHome() {
  const p = profile();
  const due = dueWords(store, allPlayableWords());
  const shared = store.shared.streakDays
    ? `<p class="lede">${escapeHtml(VI.shared)}: <strong>${store.shared.streakDays}</strong>${uiVi() ? "" : " day streak together"}.</p>`
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
        ${LEVELS.map((lv) => {
          const badge = us.isUnlocked() ? us.photoTag((us.manifest() || {}).levelBadges?.[lv], { className: "chip-photo", alt: "" }) : "";
          return `<button class="chip ${p.level === lv ? "is-on" : ""}${badge ? " has-photo" : ""}" data-action="set-level" data-level="${lv}" data-testid="level-${lv}">${badge}${lv}</button>`;
        }).join("")}
      </div>
    </div>
    ${usHomeHero()}
    <div class="play-grid">
      ${usPlayCard()}
      ${playCard("snap", "Meaning Snap", VI.snapHint, "Aa")}
      ${playCard("say", "Say It", VI.sayHint, "♪")}
      ${playCard("twins", "Twin Sounds", VI.twinsHint, "🔊")}
      ${playCard("review", "Review", `${due.length} due today`, "↻", due.length)}
      ${playCard("duo", "Duo", VI.duoHint, "2")}
    </div>
    <p class="footnote">A starter word bank, not an official exam list. IPA is American English. <span class="version">Bản ${VERSION}</span></p>
    `,
    { back: false }
  );
  us.hydrate(app);
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
      <p class="lede" style="margin-top:8px">Vietnamese hints${hint("settings")}</p>
      <div class="levels" data-testid="hint-mode">
        ${["off", "demand", "always"].map((mode) => {
          const labels = { off: "Off", demand: "On demand", always: "Always show" };
          const viLabels = { off: "Tắt", demand: "Khi bấm gợi ý", always: "Hiện sẵn" };
          return `<button class="chip ${p.hintMode === mode ? "is-on" : ""}" data-action="hint-mode" data-mode="${mode}" data-testid="hint-${mode}">${labels[mode]}${uiVi() ? `<span class="hint">${viLabels[mode]}</span>` : ""}</button>`;
        }).join("")}
      </div>
      <p class="lede">On demand is the default: tap Gợi ý 🇻🇳 when you want a meaning or a pronunciation tip. IPA stays visible under every word, in American English.</p>
      ${
        us.isUnlocked()
          ? `<button class="btn" style="margin-top:14px" data-action="us-lock" data-testid="us-lock">${escapeHtml(VI.usLock)}</button>`
          : `<p class="lede" style="margin-top:14px">${escapeHtml(VI.usLocked)}</p>
             <button class="btn" data-action="nav" data-to="us-unlock" data-testid="nav-us-settings">${escapeHtml(VI.usUnlock)}</button>`
      }
    </div>
    <p class="lede">Progress stays on this device in local storage. No account needed.</p>
    `,
    { title: "Settings" }
  );
  us.hydrate(app);
}

function pickUsWords(count) {
  return shuffle(us.words()).slice(0, count);
}

function startSnap({ review = false, duo = false, topic } = {}) {
  const level = profile().level;
  const items = review
    ? shuffle(dueWords(store, allPlayableWords())).slice(0, roundCount(duo))
    : topic === "us"
      ? pickUsWords(roundCount(duo))
      : pickWords(roundCount(duo), level);
  if (!items.length) {
    game = { type: "empty-review" };
    renderEmptyReview();
    return;
  }
  game = {
    type: duo ? "duo-snap" : "snap",
    topic,
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
      ${us.isUnlocked() && round.word.photo ? us.photoTag(round.word.photo, { className: "snap-photo", alt: "", testid: "us-photo" }) : ""}
      <p class="meta">${escapeHtml(round.word.level)} · ${escapeHtml(round.word.pos)}${game.topic === "us" ? " · " + escapeHtml(VI.us) : ""}</p>
      ${wordBlock(round.word.lemma, round.word.ipa)}
      <p class="lede" style="text-align:center">${hint("snap") || "Pick the meaning"}</p>
      ${meaningHintPanel(round.word, round, { afterAnswer: round.picked != null || round.timedOut })}
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
      ${
        round.picked != null || round.timedOut
          ? `<button class="btn primary wide" data-action="snap-next" data-testid="next" style="margin-top:12px">${escapeHtml(VI.next)}</button>`
          : ""
      }
    </div>
    `,
    { title: game.review ? "Review · Meaning Snap" : game.topic === "us" ? "Chúng mình · Meaning Snap" : "Meaning Snap" }
  );
  us.hydrate(app);
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
  const prevXp = profile().xp;
  const gained = xpFor(correct, game.streak, false, Boolean(round.hintOn));
  game.xp += gained;
  addXp(store, gained);
  recordResult(store, round.word.id, "meaning", correct);
  persist();
  renderSnap();
  if (correct) {
    maybeCelebrateStreak(us, game.streak, document.getElementById("app"));
    maybeCelebrateLevel(us, profile().xp, document.getElementById("app"));
  } else {
    noteStreakReset();
  }
  void prevXp;
}

function nextSnap() {
  if (!game || (game.type !== "snap" && game.type !== "duo-snap") || !game.locked) return;
  game.index += 1;
  game.locked = false;
  if (game.type === "duo-snap") game.turn = game.turn === 0 ? 1 : 0;
  if (game.index >= game.items.length) renderResults();
  else {
    tickSnap();
    renderSnap();
  }
}

function startSay({ review = false } = {}) {
  const level = profile().level;
  const items = review
    ? shuffle(dueWords(store, allPlayableWords())).slice(0, roundCount())
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
      ? `<div class="banner ok">${uiVi() ? "Đúng rồi!" : "Nice!"} ${round.heard ? ` ${escapeHtml(VI.heard)}: “${escapeHtml(round.heard)}”` : ""}</div>`
      : `<div class="banner bad">${uiVi() ? "Gần đúng, thử lại nhé." : "Not quite."} ${round.heard ? `${escapeHtml(VI.heard)}: “${escapeHtml(round.heard)}”` : ""}</div>`
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
      ${wordBlock(word.lemma, word.ipa)}
      <p class="lede" style="text-align:center">${escapeHtml(word.gloss)}</p>
      ${sayHintPanel(word, round)}
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
  afterPaint();
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
  const gained = xpFor(ok, game.streak, Boolean(round.firstTry), Boolean(round.hintOn));
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
  if (!pair.buttonOrder) {
    pair.buttonOrder = shuffle([
      { side: pair.target, item: target },
      { side: pair.target === "a" ? "b" : "a", item: other },
    ]);
  }
  const order = pair.buttonOrder;

  if (duo && game.phase === "say") {
    app.innerHTML = shell(
      `
      <div class="progress-line"><span>Round ${game.index + 1} / ${game.items.length}</span><span>${escapeHtml(pair.pitfall)}</span></div>
      <div class="bar"><span style="width:${bar}%"></span></div>
      <div class="banner info">${escapeHtml(VI.passPhone)} — ${escapeHtml(speaker.name)} speaks, ${escapeHtml(listener.name)} listens</div>
      <div class="card secret-word">
        <p class="meta">Say this word clearly</p>
        ${wordBlock(target.lemma, target.ipa, { testid: "secret" })}
        ${sayHintPanel({ lemma: target.lemma, ipa: target.ipa, syllables: (wordByLemma(target.lemma) || {}).syllables, stressIndex: (wordByLemma(target.lemma) || {}).stressIndex, vi: target.vi, viNote: target.viNote }, currentTwin())}
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
      ${twinsHintPanel(pair, pair, { afterAnswer: Boolean(pair.picked) })}
      <div class="row" style="margin-top:8px">
        ${order
          .map(
            (opt, i) => `
          <button class="option ${twinsClass(pair, opt.side)}" data-action="twins-answer" data-side="${opt.side}"
            data-testid="option-${i}" ${E2E && opt.side === pair.target ? 'data-correct="1"' : ""}
            ${game.locked ? "disabled" : ""}><span class="opt-word">${escapeHtml(opt.item.lemma)}</span><span class="opt-ipa" data-testid="ipa-${i}">${escapeHtml(opt.item.ipa || "")}</span></button>`
          )
          .join("")}
      </div>
      ${
        pair.picked
          ? `<button class="btn primary wide" data-action="twins-next" data-testid="next" style="margin-top:12px">${escapeHtml(VI.next)}</button>`
          : ""
      }
    </div>
    `,
    { title: duo ? "Duo · Twin Sounds" : game.review ? "Review · Twin Sounds" : "Twin Sounds" }
  );
  afterPaint();
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
  const gained = xpFor(ok, game.streak, false, Boolean(pair.hintOn));
  game.xp += gained;
  addXp(store, gained);
  const linked = wordByLemma(pair.a.lemma) || wordByLemma(pair.b.lemma);
  if (linked) recordResult(store, linked.id, "listening", ok);
  persist();
  renderTwins();
}

function nextTwins() {
  if (!game || (game.type !== "twins" && game.type !== "duo-twins") || !game.locked) return;
  game.index += 1;
  game.locked = false;
  game.phase = game.type === "duo-twins" ? "say" : "listen";
  if (game.type === "duo-twins") game.turn = game.turn === 0 ? 1 : 0;
  if (game.index >= game.items.length) renderResults();
  else renderTwins();
}

function startReview() {
  const due = dueWords(store, allPlayableWords());
  if (!due.length) {
    game = { type: "empty-review" };
    renderEmptyReview();
    return;
  }
  game = { type: "review-list", items: due };
  view = "review";
  renderReviewList();
}

function renderReviewList() {
  const due = game.items || dueWords(store, allPlayableWords());
  app.innerHTML = shell(
    `
    <div class="card">
      <p class="lede">${due.length} word${due.length === 1 ? "" : "s"} due today</p>
      <div data-testid="review-list">
        ${due
          .map(
            (w) => `
          <div class="review-row">
            <div>
              <strong data-testid="review-word">${escapeHtml(w.lemma)}</strong>
              ${hintMode() !== "off" && w.vi ? `<div class="hint">${escapeHtml(w.vi)}</div>` : ""}
            </div>
            <p class="ipa" data-testid="review-ipa">${escapeHtml(w.ipa || "")}</p>
          </div>`
          )
          .join("")}
      </div>
      <button class="btn primary wide" data-action="review-start" data-testid="review-start" style="margin-top:14px">Start review</button>
    </div>
    `,
    { title: "Review" }
  );
  afterPaint();
}

function playReview() {
  const due = dueWords(store, allPlayableWords());
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
  afterPaint();
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
  afterPaint();
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
  us.hydrate(app);
  const finished = game;
  game = null;
  if (us.isUnlocked() && finished && finished.correct > 0) {
    celebrate({ us, reason: "finish", xp: finished.xp, streak: profile().streakDays }, document.getElementById("app"));
  }
}

function renderError(message) {
  app.innerHTML = shell(
    `<div class="card"><p>${escapeHtml(message)}</p>
     <button class="btn primary" data-action="nav" data-to="home">Home</button></div>`
  );
  afterPaint();
}

function syncHash(to) {
  const route = to.replace(/^#\/?/, "");
  const hash = !route || route === "home" ? "#/" : `#/${route}`;
  const next = `${location.pathname}${location.search}${hash}`;
  if (`${location.pathname}${location.search}${location.hash || "#/"}` !== next) {
    history.replaceState(null, "", next);
  }
}

function useHint() {
  if (!game || !game.items || game.items[game.index] == null) return;
  const round = game.items[game.index];
  if (round.hintOn) return;
  round.hintOn = true;
  if (game.type === "snap" || game.type === "duo-snap") renderSnap();
  else if (game.type === "say") renderSay();
  else if (game.type === "twins" || game.type === "duo-twins") renderTwins();
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
  if (route === "us") {
    if (!us.isUnlocked()) return renderUnlock();
    return startSnap({ topic: "us" });
  }
  if (route === "us-unlock") return us.isUnlocked() ? startSnap({ topic: "us" }) : renderUnlock();
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
  else if (action === "snap-next") nextSnap();
  else if (action === "twins-next") nextTwins();
  else if (action === "review-start") playReview();
  else if (action === "use-hint") useHint();
  else if (action === "hint-mode") {
    profile().hintMode = btn.dataset.mode === "off" || btn.dataset.mode === "always" ? btn.dataset.mode : "demand";
    persist();
    if (view === "settings") renderSettings();
    else if (view === "home") renderHome();
  }
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
  else if (action === "us-lock") lockUs();
});

app.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-action=us-unlock-form]");
  if (!form) return;
  event.preventDefault();
  submitUnlock(form);
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
  }
});

window.addEventListener("hashchange", () => {
  const to = location.hash.replace(/^#\/?/, "") || "home";
  if (["home", "settings", "snap", "us", "us-unlock", "say", "twins", "review", "duo"].includes(to)) go(to);
});

async function init() {
  try {
    const [w, p] = await Promise.all([
      fetch(`data/words.json?v=${VERSION}`).then((r) => {
        if (!r.ok) throw new Error("Could not load words");
        return r.json();
      }),
      fetch(`data/pairs.json?v=${VERSION}`).then((r) => {
        if (!r.ok) throw new Error("Could not load pairs");
        return r.json();
      }),
    ]);
    words = w;
    pairs = p;
    await us.tryRestore();
    markXpFloor(profile().xp);
    if (E2E) window.__WORD_DUO__ = { words, pairs, store, resetStore, usUnlocked: () => us.isUnlocked() };
    const to = location.hash.replace(/^#\/?/, "") || "home";
    go(to);
  } catch (err) {
    renderError(err.message || "Could not start Word Duo.");
  }
}

init();
