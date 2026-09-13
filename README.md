# New Muslim Companion — React + Vite

A graduation-project web app that helps new Muslims learn prayer, recitation and daily
practice. Built with **React 18 + Vite**, with **ReactBits-style** animated components and
**Lottie** animations.

---

## 1. Run it on your computer

You need **Node.js 18+** installed (https://nodejs.org).

```bash
# in this folder:
npm install       # install dependencies (first time only)
npm run dev       # start the dev server — open the printed http://localhost:5173
```

To build a production version (a static site you can upload anywhere):

```bash
npm run build     # output goes to the /dist folder
npm run preview   # preview the built site locally
```

Deploy the **`dist/`** folder to Netlify, Vercel, GitHub Pages, or Cloudflare Pages
(drag-and-drop the folder, or connect the repo). Because camera/location features need
**https**, always test on the deployed link, not a local file.

---

## 2. Project structure

```
src/
  main.jsx                 app entry
  App.jsx                  screen router + theme/RTL
  index.css                design tokens (sky light + charcoal night themes)
  context/AppContext.jsx   global state (screen, language, profile, name, theme)
  lib/
    data.js                prayers, ayat, features, personas, ingredient rules, sources
    i18n.js                translations (en + full ar; de/fr/es fall back to en)
  components/
    Chrome.jsx             status bar + bottom tab bar
    Lottie.jsx             Lottie loader + Rashed avatar
    reactbits/             Aurora, ShinyText, SplitText  (ReactBits-style)
  screens/
    Splash.jsx             animated السلام عليكم welcome
    Onboarding.jsx         Language → Name → Profile → Location
    Home.jsx               prayer countdown + ayah + feature tiles
    Rashed.jsx             Q&A assistant (links to trusted sites)
    Features.jsx           Scanner, Alarm, Map (Leaflet), Salah (MediaPipe)
    Settings.jsx           theme + language
  assets/                  your Lottie .json animations
```

---

## 3. Using real ReactBits components

The components in `src/components/reactbits/` are original, dependency-free versions in the
ReactBits style, so the app works out of the box. To swap in the **official** ReactBits
components (https://reactbits.dev), use their CLI inside this project, e.g.:

```bash
npx jsrepo add https://reactbits.dev/default/Backgrounds/Aurora
npx jsrepo add https://reactbits.dev/default/TextAnimations/SplitText
npx jsrepo add https://reactbits.dev/default/TextAnimations/ShinyText
```

Then update the imports in `Splash.jsx` (and anywhere else) to point at the added files.
ReactBits is MIT-licensed and meant to be copied into your project — keep their license note.

---

## 4. Swapping animations

Your Lottie files live in `src/assets/` (`rashed.json`, `mosque.json`, `wakeup.json`,
`salam.json`). Replace any file with another **Lottie JSON** (from LottieFiles or IconScout —
use only ones you are licensed to use) and it updates automatically.

---

## 5. Notes for your defense

- **On-device processing:** the salah camera (MediaPipe) and scanner run in the browser —
  no video or audio is uploaded.
- **Honest halal scanner:** it flags haram/doubtful ingredients but never *certifies* a
  product — true halal status depends on sourcing and slaughter a scanner can't see.
- **Rashed is a librarian, not a mufti:** it links to trusted scholars' sites rather than
  issuing rulings itself.
- **Real data:** the scanner uses the Open Food Facts API; the map uses OpenStreetMap +
  Overpass for nearby mosques (© OpenStreetMap contributors, ODbL — keep attribution).

---

## 6. What's new in this version

- **Journey (gamification):** a Habitica-style hub on the "Journey" tab. Daily quests
  cover the 5 prayers, praying at the mosque, Qur'an reading & memorization, hadith,
  dhikr/tasbih, wudu, adhkar, sunnah, charity, fasting Mon/Thu — with **XP, levels,
  streaks**, and **separate quest sets for New Muslim / Adult / Child**. Progress is
  **saved on the device** (localStorage) — no login, works offline. Edit quests in
  `src/lib/journey.js`.
- **Offline Qur'an:** the mushaf reads from bundled text first (`src/lib/offlineQuran.js`
  — Al-Fatihah + short surahs) so it works with **no internet**; other surahs fall back
  to the online API. To go fully offline for all 114 surahs, expand that file.
- **Nicer mushaf:** page-like flowing layout, Uthmani typography (Amiri + Scheherazade),
  adjustable font size (A− / A+, remembered), Arabic ayah numbers, collapsible translation.
- **Japanese (日本語):** added as a 5th+ language (Noto Sans JP). UI strings currently
  fall back to English — translate the `base` block in `src/lib/i18n.js` and add a `ja`
  block to localise fully.
- **Font fixes:** proper font stacks for Latin, Arabic (Amiri/Scheherazade) and Japanese.

### Expanding the offline Qur'an
`src/lib/offlineQuran.js` holds `{ surahNumber: { name, ename, ayat: [{n, ar, tr}] } }`.
Add more surahs in the same shape (source Uthmani text + a public-domain translation such
as Saheeh International) and they become available offline automatically.
