export function canSynthesize() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
}

export function canRecognize() {
  return Boolean(
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

function pickVoice(lang) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const prefix = lang.toLowerCase();
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase() === prefix) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix.split("-")[0])) ||
    null
  );
}

export function speak(text, { lang = "en-GB", rate = 0.92 } = {}) {
  if (!canSynthesize() || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      // Some engines stay silent if voices have not loaded yet.
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener(
          "voiceschanged",
          () => {
            const late = pickVoice(lang);
            if (late) utter.voice = late;
          },
          { once: true }
        );
      }
    } catch {
      resolve();
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

export function recognize({ lang = "en-GB", timeoutMs = 8000 } = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
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
