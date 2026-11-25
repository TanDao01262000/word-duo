const LINES = [
  { vi: "Giỏi quá, em yêu!", en: "You're amazing, my love." },
  { vi: "Năm cái liền! Anh tự hào về em.", en: "Five in a row! I'm so proud of you." },
  { vi: "Ê, đỉnh thật đó!", en: "Hey, that was brilliant." },
  { vi: "Cứ thế này là em thông tiếng Anh hết à.", en: "Keep this up and you'll know all the English." },
  { vi: "Về đích rồi, thương quá!", en: "You finished the round — so proud of you." },
  { vi: "Một vòng nữa nhớ thương.", en: "Another round of love." },
  { vi: "Chồng khen vợ rồi đó nha.", en: "That's your husband cheering you on." },
  { vi: "Trái tim này thuộc về em.", en: "This heart is yours." },
];

const MILESTONES = [50, 100, 200, 350, 500, 800, 1200];

let hideTimer = 0;
let lastStreakSeen = 0;
let lastXpFloor = 0;

function pick(list, salt) {
  if (!list || !list.length) return null;
  return list[Math.abs(salt) % list.length];
}

export function shouldCelebrateLevelUp(prevXp, nextXp) {
  return MILESTONES.some((n) => prevXp < n && nextXp >= n);
}

export function celebrate({ us, reason, xp, streak }, host) {
  if (!us || !us.isUnlocked()) return;
  const manifest = us.manifest() || {};
  const photos = manifest.celebrate || [];
  const salt = Date.now() + (xp || 0) + (streak || 0);
  const photo = pick(photos, salt) || manifest.usBadge;
  const line = pick(
    reason === "streak"
      ? [LINES[1], LINES[2], LINES[0]]
      : reason === "level"
        ? [LINES[4], LINES[0], LINES[6]]
        : LINES,
    salt + 3
  );
  const existing = document.querySelector(".celebrate");
  if (existing) existing.remove();
  const layer = document.createElement("div");
  layer.className = "celebrate";
  layer.dataset.testid = "celebrate";
  layer.setAttribute("data-testid", "celebrate");
  const bits = Array.from({ length: 22 }, (_, i) => {
    const kind = i % 3 === 0 ? "heart" : "dot";
    const left = (i * 17 + (salt % 13)) % 100;
    const delay = (i % 8) * 0.08;
    return `<span class="confetti ${kind}" style="left:${left}%; animation-delay:${delay}s"></span>`;
  }).join("");
  layer.innerHTML = `
    ${bits}
    <div class="celebrate-card">
      ${us.photoTag(photo, { className: "celebrate-photo", alt: "", testid: "celebrate-photo" })}
      <p class="celebrate-vi">${line.vi}</p>
      <p class="celebrate-en">${line.en}</p>
    </div>
  `;
  layer.addEventListener("click", () => layer.remove());
  (host || document.getElementById("app") || document.body).appendChild(layer);
  us.hydrate(layer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => layer.remove(), 3200);
}

export function noteStreakReset() {
  lastStreakSeen = 0;
}

export function maybeCelebrateStreak(us, streak, host) {
  if (streak >= 5 && streak !== lastStreakSeen) {
    lastStreakSeen = streak;
    celebrate({ us, reason: "streak", streak }, host);
    return true;
  }
  if (streak < 5) lastStreakSeen = 0;
  return false;
}

export function markXpFloor(xp) {
  lastXpFloor = xp;
}

export function maybeCelebrateLevel(us, nextXp, host) {
  if (shouldCelebrateLevelUp(lastXpFloor, nextXp)) {
    lastXpFloor = nextXp;
    celebrate({ us, reason: "level", xp: nextXp }, host);
    return true;
  }
  lastXpFloor = nextXp;
  return false;
}
