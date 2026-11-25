const KEY = "word-duo-v1";

const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

function defaultProfile(name) {
  return {
    name,
    level: "A2",
    accent: "en-GB",
    xp: 0,
    streakDays: 0,
    lastPlayedOn: null,
    viHints: true,
  };
}

export function defaultStore() {
  return {
    profiles: [defaultProfile("You"), defaultProfile("Partner")],
    active: 0,
    progress: { 0: {}, 1: {} },
    shared: { streakDays: 0, lastBothOn: null },
  };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    const base = defaultStore();
    return {
      ...base,
      ...parsed,
      profiles: [0, 1].map((i) => ({ ...base.profiles[i], ...(parsed.profiles && parsed.profiles[i]) })),
      progress: {
        0: (parsed.progress && parsed.progress[0]) || {},
        1: (parsed.progress && parsed.progress[1]) || {},
      },
      shared: { ...base.shared, ...(parsed.shared || {}) },
      active: parsed.active === 1 ? 1 : 0,
    };
  } catch {
    return defaultStore();
  }
}

export function saveStore(store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function activeProfile(store) {
  return store.profiles[store.active];
}

export function getProgress(store, wordId) {
  const bag = store.progress[store.active] || {};
  return bag[wordId] || null;
}

function emptySkill() {
  return { right: 0, wrong: 0 };
}

export function recordResult(store, wordId, skill, right) {
  const today = todayISO();
  const bag = store.progress[store.active] || (store.progress[store.active] = {});
  const prev = bag[wordId] || {
    wordId,
    box: 0,
    dueOn: today,
    meaning: emptySkill(),
    spelling: emptySkill(),
    listening: emptySkill(),
    speaking: emptySkill(),
  };
  const next = {
    ...prev,
    meaning: { ...prev.meaning },
    spelling: { ...prev.spelling },
    listening: { ...prev.listening },
    speaking: { ...prev.speaking },
  };
  if (!next[skill]) next[skill] = emptySkill();
  if (right) next[skill].right += 1;
  else next[skill].wrong += 1;
  if (right) {
    next.box = Math.min(5, (next.box || 0) + 1);
    next.dueOn = addDays(today, INTERVALS[next.box] || 1);
  } else {
    next.box = 1;
    next.dueOn = addDays(today, 1);
  }
  bag[wordId] = next;
  return next;
}

export function dueWords(store, words) {
  const today = todayISO();
  const bag = store.progress[store.active] || {};
  return words.filter((w) => {
    const p = bag[w.id];
    return p && p.dueOn && p.dueOn <= today && p.box < 5;
  });
}

export function addXp(store, amount) {
  const profile = activeProfile(store);
  profile.xp += Math.max(0, Math.round(amount));
}

function isYesterday(iso, today) {
  return addDays(iso, 1) === today;
}

export function markSessionPlayed(store) {
  const today = todayISO();
  const profile = activeProfile(store);
  if (profile.lastPlayedOn === today) {
    updateShared(store, today);
    return;
  }
  if (profile.lastPlayedOn && isYesterday(profile.lastPlayedOn, today)) {
    profile.streakDays += 1;
  } else {
    profile.streakDays = 1;
  }
  profile.lastPlayedOn = today;
  updateShared(store, today);
}

function updateShared(store, today) {
  const [a, b] = store.profiles;
  if (a.lastPlayedOn === today && b.lastPlayedOn === today) {
    if (store.shared.lastBothOn === today) return;
    if (store.shared.lastBothOn && isYesterday(store.shared.lastBothOn, today)) {
      store.shared.streakDays += 1;
    } else {
      store.shared.streakDays = 1;
    }
    store.shared.lastBothOn = today;
  }
}

export function resetStore() {
  const fresh = defaultStore();
  saveStore(fresh);
  return fresh;
}
