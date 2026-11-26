const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const shotDir = path.join(__dirname, "..", "test-screenshots");
fs.mkdirSync(shotDir, { recursive: true });

async function shot(page, name) {
  const file = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function mockSpeech(page, { recognize = true } = {}) {
  return page.addInitScript(({ recognize }) => {
    window.speechSynthesis = {
      speak(u) {
        this._last = u;
        this.speaking = true;
        this.paused = false;
        setTimeout(() => {
          this.speaking = false;
          if (typeof u.onend === "function") u.onend();
        }, 20);
      },
      cancel() { this.speaking = false; },
      resume() { this.paused = false; this._resumed = true; },
      pause() { this.paused = true; },
      getVoices() {
        return [];
      },
      addEventListener() {},
      speaking: false,
      paused: false,
    };
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };
    if (recognize) {
      class FakeRec {
        start() {
          const word = (document.querySelector("[data-testid=prompt]") || {}).textContent || "";
          const alt = { transcript: word.trim(), confidence: 1 };
          const res = [alt];
          setTimeout(() => {
            if (typeof this.onresult === "function") this.onresult({ results: [res] });
          }, 40);
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRec;
      window.webkitSpeechRecognition = FakeRec;
    } else {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    }
  }, { recognize });
}

async function open(page, extra = "") {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(`/?e2e=1${extra}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Word Duo" })).toBeVisible();
  return errors;
}


const CRIOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.148 Mobile/15E148 Safari/604.1";

async function withCriOS(browser, run) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: CRIOS_UA,
  });
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

test.describe("Word Duo MVP", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("home, level picker, and Meaning Snap end to end", async ({ page }) => {
    const errors = await open(page);
    await mockSpeech(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("nav-snap")).toBeVisible();
    await page.getByTestId("level-A1").click();
    await expect(page.getByTestId("level-A1")).toHaveClass(/is-on/);
    await expect(page.getByTestId("nav-us")).toBeVisible();
    await expect(page.getByTestId("us-hero")).toHaveCount(0);
    await expect(page.locator("[data-testid=us-photo], [data-testid=us-hero-photo], [data-testid=celebrate-photo]")).toHaveCount(0);
    await shot(page, "01-home-mobile");
    await page.getByTestId("nav-snap").click();
    await expect(page.getByTestId("prompt")).toBeVisible();
    await expect(page.getByTestId("ipa")).toHaveText(/^\/.+\/$/);
    await expect(page.getByTestId("hint-btn")).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("next")).toBeVisible();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("results")).toContainText("3/3");
    await expect(page.getByTestId("xp")).toContainText("XP");
    await shot(page, "02-snap-results");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Twin Sounds end to end", async ({ page }) => {
    const errors = await open(page);
    await mockSpeech(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("nav-twins").click();
    await expect(page.getByTestId("hear")).toBeVisible();
    await expect(page.getByTestId("ipa-0")).toHaveText(/^\/.+\/$/);
    await expect(page.getByTestId("ipa-1")).toHaveText(/^\/.+\/$/);
    await page.getByTestId("hear").click();
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("next")).toBeVisible();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("results")).toContainText("3/3");
    await shot(page, "03-twins-results");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Say It with speech recognition mock", async ({ page }) => {
    await mockSpeech(page, { recognize: true });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    await expect(page.getByTestId("prompt")).toBeVisible();
    await expect(page.getByTestId("ipa")).toHaveText(/^\/.+\/$/);
    await shot(page, "04-say-it");
    for (let i = 0; i < 3; i += 1) {
      await page.getByTestId("hear").click();
      await page.getByTestId("listen").click();
      await expect(page.getByTestId("next")).toBeVisible();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("results")).toContainText("3/3");
    await shot(page, "05-say-results");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Say It fallback when recognition is missing", async ({ page }) => {
    await mockSpeech(page, { recognize: false });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    await expect(page.getByTestId("speech-fallback")).toBeVisible();
    await expect(page.getByTestId("speech-fallback")).toContainText("cannot score pronunciation automatically");
    await shot(page, "06-say-fallback");
    for (let i = 0; i < 3; i += 1) {
      await page.getByTestId("self-right").click();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Review empty state and Duo take-turns snap", async ({ page }) => {
    await mockSpeech(page);
    const errors = await open(page);
    await page.getByTestId("nav-review").click();
    await expect(page.getByTestId("no-due")).toBeVisible();
    await shot(page, "07-review-empty");
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByTestId("nav-duo").click();
    await expect(page.getByTestId("duo-twins")).toBeVisible();
    await page.getByTestId("duo-snap").click();
    for (let i = 0; i < 4; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("next")).toBeVisible();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await shot(page, "08-duo-results");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Vietnamese hint button and always-show toggle", async ({ page }) => {
    await mockSpeech(page);
    const errors = await open(page);
    await page.getByTestId("nav-snap").click();
    await expect(page.getByTestId("hint-btn")).toBeVisible();
    await expect(page.getByTestId("ipa")).toBeVisible();
    await page.getByTestId("hint-btn").click();
    await expect(page.getByTestId("vi-hint")).toBeVisible();
    await expect(page.getByTestId("vi-hint")).not.toHaveText("");
    await shot(page, "10-snap-hint-mobile");
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: "Cài đặt" }).click();
    await expect(page.getByTestId("hint-demand")).toHaveClass(/is-on/);
    await page.getByTestId("hint-always").click();
    await expect(page.getByTestId("hint-always")).toHaveClass(/is-on/);
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByTestId("nav-snap").click();
    await expect(page.getByTestId("vi-hint")).toBeVisible();
    await expect(page.getByTestId("hint-btn")).toHaveCount(0);
    await shot(page, "11-snap-always-mobile");
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: "Settings" }).or(page.getByRole("button", { name: "Cài đặt" })).click();
    await page.getByTestId("hint-off").click();
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByTestId("nav-snap").click();
    await expect(page.getByTestId("ipa")).toBeVisible();
    await expect(page.getByTestId("hint-btn")).toHaveCount(0);
    await expect(page.getByTestId("vi-hint")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Say It pronunciation tip on demand", async ({ page }) => {
    await mockSpeech(page, { recognize: false });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    await expect(page.getByTestId("ipa")).toHaveText(/^\/.+\/$/);
    await page.getByTestId("hint-btn").click();
    await expect(page.getByTestId("vi-tip")).toBeVisible();
    await shot(page, "12-say-hint-mobile");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Us topic stays locked without the passcode", async ({ page }) => {
    const errors = await open(page);
    await page.getByTestId("nav-us").click();
    await expect(page.getByTestId("us-unlock")).toBeVisible();
    await expect(page.getByTestId("us-passcode")).toHaveAttribute("type", "password");
    await page.getByTestId("us-passcode").fill("not-the-passcode");
    await page.getByTestId("us-unlock-btn").click();
    await expect(page.getByTestId("us-unlock-error")).toBeVisible();
    await expect(page.getByTestId("us-hero")).toHaveCount(0);
    await expect(page.locator("[data-testid=us-photo]")).toHaveCount(0);
    await shot(page, "13-us-locked-mobile");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Us topic unlocks, shows photos, and celebrates a finished round", async ({ page }) => {
    const passcode = process.env.WORD_DUO_PASSCODE;
    test.skip(!passcode, "WORD_DUO_PASSCODE is not set");
    const errors = await open(page);
    await page.getByTestId("nav-us").click();
    await page.getByTestId("us-passcode").fill(passcode);
    await page.getByTestId("us-unlock-btn").click();
    await expect(page.getByTestId("us-hero-photo")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("nav-us").click();
    await expect(page.getByTestId("us-photo")).toBeVisible();
    await expect(page.getByTestId("ipa")).toHaveText(/^\/.+\/$/);
    await expect(page.getByTestId("prompt")).toBeVisible();
    await shot(page, "14-us-snap-mobile");
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("next")).toBeVisible();
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("celebrate")).toBeVisible();
    await expect(page.getByTestId("celebrate-photo")).toBeVisible();
    await page.screenshot({ path: require("path").join(shotDir, "15-us-celebrate-mobile.png") });
    await page.getByTestId("celebrate").click();
    await page.getByRole("button", { name: "Home" }).click();
    await expect(page.getByTestId("us-hero")).toBeVisible();
    await expect(page.getByTestId("us-hero-photo")).toBeVisible();
    await expect(page.getByTestId("level-A1").locator("img.chip-photo")).toBeVisible();
    await shot(page, "16-us-home-mobile");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("Say It on Chrome iPhone shows a Safari mic message when recognition is missing", async ({ browser }) => {
  await withCriOS(browser, async (page) => {
    await mockSpeech(page, { recognize: false });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    const banner = page.getByTestId("speech-fallback");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Chrome trên iPhone chưa hỗ trợ mic, hãy mở bằng Safari");
    await expect(banner).toContainText("Mic isn't supported in Chrome on iPhone, open in Safari");
    await expect(page.getByTestId("hear")).toBeEnabled();
    await page.getByTestId("hear").click();
    await expect(page.getByTestId("listen")).toHaveCount(0);
    await expect(page.getByTestId("self-right")).toBeVisible();
    await shot(page, "18-say-crios-fallback-mobile");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("Say It on Chrome iPhone uses the mic when webkitSpeechRecognition exists", async ({ browser }) => {
  await withCriOS(browser, async (page) => {
    await mockSpeech(page, { recognize: true });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    await expect(page.getByTestId("speech-fallback")).toHaveCount(0);
    await expect(page.getByTestId("listen")).toBeVisible();
    await page.getByTestId("hear").click();
    await page.getByTestId("listen").click();
    await expect(page.getByTestId("next")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("Say It on Chrome iPhone falls back if recognition errors", async ({ browser }) => {
  await withCriOS(browser, async (page) => {
    await mockSpeech(page, { recognize: true });
    await page.addInitScript(() => {
      class BoomRec {
        start() {
          setTimeout(() => {
            if (typeof this.onerror === "function") this.onerror({ error: "service-not-allowed" });
          }, 10);
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = BoomRec;
      window.webkitSpeechRecognition = BoomRec;
    });
    const errors = await open(page);
    await page.getByTestId("nav-say").click();
    await page.getByTestId("listen").click();
    const banner = page.getByTestId("speech-fallback");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Chrome trên iPhone chưa hỗ trợ mic, hãy mở bằng Safari");
    await expect(page.getByTestId("self-right")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("desktop home has no console errors", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockSpeech(page);
  const errors = await open(page);
  await expect(page.getByTestId("nav-us")).toBeVisible();
  await expect(page.getByTestId("us-hero")).toHaveCount(0);
  await shot(page, "09-home-desktop");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("desktop Us home after unlock", async ({ page }) => {
  const passcode = process.env.WORD_DUO_PASSCODE;
  test.skip(!passcode, "WORD_DUO_PASSCODE is not set");
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await open(page);
  await page.getByTestId("nav-us").click();
  await page.getByTestId("us-passcode").fill(passcode);
  await page.getByTestId("us-unlock-btn").click();
  await expect(page.getByTestId("us-hero-photo")).toBeVisible({ timeout: 20_000 });
  await shot(page, "17-us-home-desktop");
  expect(errors, errors.join("\n")).toEqual([]);
});
