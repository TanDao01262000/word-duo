function hasWindow() {
  return typeof window !== "undefined";
}

export function isIOS() {
  if (!hasWindow()) return false;
  const ua = navigator.userAgent || "";
  const iPhoneLike = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iPhoneLike || iPadOs;
}

export function isCriOS() {
  return hasWindow() && /CriOS/i.test(navigator.userAgent || "");
}

export function canSynthesize() {
  return hasWindow() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
}

export function recognitionCtor() {
  if (!hasWindow()) return null;
  return window.webkitSpeechRecognition || window.SpeechRecognition || null;
}

export function canRecognize() {
  return Boolean(recognitionCtor());
}

export function ttsLang(preferred) {
  // iOS (including Chrome, which uses WebKit) is reliable with a language
  // tag and no voice object. American English is the voice iOS plays most
  // consistently; British tags are often silent if a matching voice is missing.
  if (isIOS()) return "en-US";
  return preferred === "en-US" ? "en-US" : "en-GB";
}

export function recognitionFallbackCopy() {
  if (isCriOS()) {
    return {
      vi: "Chrome trên iPhone chưa hỗ trợ mic, hãy mở bằng Safari",
      en: "Mic isn't supported in Chrome on iPhone, open in Safari",
    };
  }
  return {
    vi: "Trình duyệt này không chấm phát âm tự động (thường gặp trên Firefox). Hãy nghe, nói to, rồi tự đánh giá.",
    en: "This browser cannot score pronunciation automatically (common on Firefox). Listen, say the word, then mark yourself.",
  };
}

export function speak(text, { lang, rate = 0.92 } = {}) {
  if (!canSynthesize() || !text) return Promise.resolve();
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(String(text));
  utter.lang = ttsLang(lang);
  utter.rate = rate;
  // Do not assign utter.voice. On iOS WebKit (Safari and CriOS) that is a
  // common cause of silence, especially when the voice list is still empty.

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utter.onend = done;
    utter.onerror = done;
    try {
      // Must run in the same turn as the tap. cancel + speak + resume is the
      // pattern that gets iOS out of a stuck paused state.
      synth.cancel();
      synth.speak(utter);
      if (typeof synth.resume === "function") synth.resume();
    } catch {
      done();
    }
  });
}

export function stopSpeaking() {
  try {
    if (canSynthesize()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

let activeRec = null;

export function stopRecognition() {
  if (!activeRec) return;
  try {
    activeRec.onend = null;
    activeRec.onerror = null;
    activeRec.onresult = null;
    activeRec.abort();
  } catch {
    /* ignore */
  }
  activeRec = null;
}

function isFatalRecognitionError(code) {
  return [
    "unsupported",
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "network",
    "language-not-supported",
  ].includes(code);
}

export function recognize({ lang = "en-GB", timeoutMs = 8000 } = {}) {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return Promise.reject(Object.assign(new Error("unsupported"), { code: "unsupported" }));
  }
  stopRecognition();
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    activeRec = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let settled = false;
    const timer = setTimeout(() => finish(null, Object.assign(new Error("timeout"), { code: "timeout" })), timeoutMs);

    function finish(value, error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (activeRec === rec) activeRec = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      if (error) reject(error);
      else resolve(value);
    }

    rec.onresult = (event) => {
      const result = event.results && event.results[0];
      if (!result) return;
      const alts = [];
      for (let i = 0; i < result.length; i += 1) {
        alts.push((result[i].transcript || "").trim());
      }
      finish({ transcript: alts[0] || "", alternatives: alts, confidence: result[0].confidence ?? null });
    };
    rec.onerror = (event) => {
      const code = event.error || "error";
      finish(null, Object.assign(new Error(code), { code }));
    };
    rec.onend = () => {
      if (!settled) finish(null, Object.assign(new Error("no-speech"), { code: "no-speech" }));
    };
    try {
      rec.start();
    } catch (err) {
      finish(null, Object.assign(err, { code: err.name || "error" }));
    }
  });
}

export { isFatalRecognitionError };

const SPELLING = {
  neighbour: ["neighbor"],
  minimise: ["minimize"],
  scrutinise: ["scrutinize"],
};

export function normalizeHeard(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function heardMatches(heard, lemma) {
  const h = normalizeHeard(heard);
  const t = normalizeHeard(lemma);
  if (!h || !t) return false;
  if (h === t) return true;
  const extras = SPELLING[t] || [];
  if (extras.includes(h)) return true;
  const tokens = h.split(" ");
  if (tokens.includes(t) || extras.some((x) => tokens.includes(x))) return true;
  const stripped = t.replace(/-/g, " ");
  if (h === stripped || h.replace(/-/g, " ") === stripped) return true;
  return false;
}
