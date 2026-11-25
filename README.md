# Word Duo

A small, static English vocabulary game for two people. Practise meaning, listening, and pronunciation from A1 to C2, including sounds that often trip up Vietnamese speakers.

Live site: https://tandao01262000.github.io/word-duo/

## Play

- **Meaning Snap** — pick the right meaning before the timer runs out.
- **Say It** — hear the word, then say it. Chrome, Edge, and Safari can score your attempt with the Web Speech API. Other browsers, or a blocked microphone, get a kind self-check instead.
- **Twin Sounds** — hear one word from a close pair (`think` / `sink`, `book` / `booked`, `flight` / `flights`) and tap which you heard.
- **Review** — a Leitner box schedule brings due words back (1, 3, 7, 14, then 30 days). A miss returns the card to box 1.
- **Duo** — pass the phone. Meaning Snap is take turns. Twin Sounds is “I say, you hear.”

Progress, XP, and daily streaks stay in `localStorage` on this device. You can keep two player profiles on the same phone.

A private **Chúng mình** topic unlocks with a passcode. Personal photos are stored on the site only as AES-GCM encrypted files; nothing is shown until the passcode is entered on that device. The rest of the games work as usual without it.

Each word shows American IPA under the spelling. Vietnamese meanings and pronunciation tips can be Off, On demand (tap Gợi ý 🇻🇳; this is the default), or Always show, in Settings. Text-to-speech defaults to British English, with an American toggle.

## Word bank

This is an original starter list (about 50 words per level, plus a personal tourism, booking, family, and hometown bank). It is **not** the Oxford 3000/5000 or the English Vocabulary Profile, which we cannot redistribute here. Levels are assigned reasonably, not from an official exam syllabus.

Each entry includes American IPA (with stress marks) and a Vietnamese meaning written for this project.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://127.0.0.1:4173/

WORD_DUO_PASSCODE is required only when encrypting or when Playwright tests the unlocked Us topic. Never commit it.

```bash
npm install
npx playwright install chromium
npm test
```

## Browser notes

- **Speaking scores** need the Web Speech API’s speech recognition, HTTPS (or localhost), and a microphone permission. This works in current Chrome and Edge on desktop and Android, and in Safari on recent iOS and macOS, though Safari can be stricter about permissions.
- **Firefox** (and some in-app browsers) usually cannot score pronunciation. You can still hear the word and mark the attempt yourself.
- The score is “did the recognizer transcribe the target word?”, not a phoneme-by-phoneme accent score.

## Licence

The game code is yours to use. The word glosses and example sentences were written for this project. Dictionary IPA comes from the Free Dictionary API / Wiktionary and is used under their terms.
