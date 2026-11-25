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
        setTimeout(() => {
          if (typeof u.onend === "function") u.onend();
        }, 20);
      },
      cancel() {},
      getVoices() {
        return [{ lang: "en-GB", name: "Fake GB", voiceURI: "fake" }];
      },
      addEventListener() {},
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

test.describe("Word Duo MVP", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("home, level picker, and Meaning Snap end to end", async ({ page }) => {
    const errors = await open(page);
    await mockSpeech(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("nav-snap")).toBeVisible();
    await page.getByTestId("level-A1").click();
    await expect(page.getByTestId("level-A1")).toHaveClass(/is-on/);
    await shot(page, "01-home-mobile");
    await page.getByTestId("nav-snap").click();
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
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
    await page.getByTestId("hear").click();
    for (let i = 0; i < 3; i += 1) {
      const btn = page.locator("[data-correct='1']");
      await expect(btn).toBeEnabled();
      await btn.click();
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
    }
    await expect(page.getByTestId("results")).toBeVisible();
    await shot(page, "08-duo-results");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("desktop home has no console errors", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockSpeech(page);
  const errors = await open(page);
  await shot(page, "09-home-desktop");
  expect(errors, errors.join("\n")).toEqual([]);
});
