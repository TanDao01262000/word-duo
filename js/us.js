const KEY_STORAGE = "wordDuo.usKey";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64ToBytes(value) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

async function deriveKey(passcode, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", encoder.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );
}

async function importRawKey(raw) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["decrypt"]);
}

async function decryptBytes(key, packed) {
  const iv = packed.slice(0, 12);
  const data = packed.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new Uint8Array(plain);
}

export function createUsVault({ version }) {
  const state = {
    manifest: null,
    key: null,
    words: [],
    urls: new Map(),
    ready: false,
  };

  function isUnlocked() {
    return Boolean(state.key) && state.ready;
  }

  function revokeAll() {
    state.urls.forEach((url) => URL.revokeObjectURL(url));
    state.urls.clear();
  }

  async function checkCanary(key, manifest) {
    const packed = b64ToBytes(manifest.canary);
    const plain = await decryptBytes(key, packed);
    return decoder.decode(plain) === "word-duo-us-ok";
  }

  async function loadPack(key, manifest) {
    revokeAll();
    const wordsBuf = await fetch(`data/us/${manifest.words}?v=${version}`).then((r) => {
      if (!r.ok) throw new Error("Could not load the Us word list");
      return r.arrayBuffer();
    });
    const wordsJson = decoder.decode(await decryptBytes(key, new Uint8Array(wordsBuf)));
    const parsed = JSON.parse(wordsJson);
    const urls = new Map();
    await Promise.all(
      (manifest.photos || []).map(async (photo) => {
        const buf = await fetch(`data/us/${photo.file}?v=${version}`).then((r) => {
          if (!r.ok) throw new Error("Could not load a photo");
          return r.arrayBuffer();
        });
        const bytes = await decryptBytes(key, new Uint8Array(buf));
        const blob = new Blob([bytes], { type: photo.mime || "image/webp" });
        urls.set(photo.id, URL.createObjectURL(blob));
      })
    );
    state.key = key;
    state.manifest = manifest;
    state.words = parsed.words || [];
    state.urls = urls;
    state.ready = true;
  }

  async function loadManifest() {
    if (state.manifest) return state.manifest;
    const manifest = await fetch(`data/us/manifest.json?v=${version}`).then((r) => {
      if (!r.ok) throw new Error("Could not load Us photos");
      return r.json();
    });
    state.manifest = manifest;
    return manifest;
  }

  async function tryRestore() {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (!saved) return false;
    try {
      const manifest = await loadManifest();
      const key = await importRawKey(b64ToBytes(saved));
      if (!(await checkCanary(key, manifest))) {
        localStorage.removeItem(KEY_STORAGE);
        return false;
      }
      await loadPack(key, manifest);
      return true;
    } catch {
      localStorage.removeItem(KEY_STORAGE);
      lock();
      return false;
    }
  }

  async function unlock(passcode) {
    const manifest = await loadManifest();
    const salt = b64ToBytes(manifest.salt);
    const key = await deriveKey(passcode, salt, manifest.iterations);
    if (!(await checkCanary(key, manifest))) return false;
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    localStorage.setItem(KEY_STORAGE, bytesToB64(raw));
    await loadPack(key, manifest);
    return true;
  }

  function lock() {
    revokeAll();
    state.key = null;
    state.words = [];
    state.ready = false;
    localStorage.removeItem(KEY_STORAGE);
  }

  function photoUrl(id) {
    return (id && state.urls.get(id)) || "";
  }

  function hydrate(root) {
    if (!root || !isUnlocked()) return;
    root.querySelectorAll("[data-photo]").forEach((img) => {
      const url = photoUrl(img.getAttribute("data-photo"));
      if (url) img.src = url;
    });
  }

  function photoTag(id, { className = "us-photo", alt = "", testid } = {}) {
    if (!isUnlocked() || !id) return "";
    const testdata = testid ? ` data-testid="${testid}"` : "";
    return `<img class="${className}" data-photo="${id}" alt="${alt}"${testdata}>`;
  }

  return {
    isUnlocked,
    tryRestore,
    unlock,
    lock,
    loadManifest,
    photoUrl,
    photoTag,
    hydrate,
    words: () => state.words,
    manifest: () => state.manifest,
  };
}
