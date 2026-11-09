# josaphatchilokoto.space

Static site on Firebase Hosting + Firestore. No build step.

## Deploy
```
firebase login
firebase deploy            # hosting + firestore rules
```

## One-time setup in the Firebase console
1. Authentication → Sign-in method: turn on **Email/Password** (Google is optional).
2. Authentication → Users → **Add user**: email `josaphatkychiloz@gmail.com` + your chosen password (it is never stored in the site code).
3. Authentication → Settings → User actions: turn **off** "Enable create (sign-up)" so nobody else can register.
4. Authentication → Settings → Authorized domains: add `josaphatchilokoto.space`.
5. `firebase deploy` (publishes the site **and** the new `firestore.rules`).
6. Open the site, press and hold the footer name "Josaphat" for ~3 s (it turns like a key) → admin. Sign in, press "Send verification email", open the link, then "I've verified".
7. On the first admin visit your 9 built-in projects are copied into the database automatically, so every one is editable.
8. Security → Change password: replace your starter password with a longer one.

## Structure
- `public/` the website (HTML, `css/site.css`, `js/`, `assets/`)
- `public/js/projects-data.js` the built-in projects (fallback + first-visit import)
- `tools/build-static.mjs` regenerates the fallback cards: `node tools/build-static.mjs`
- `firestore.rules` security rules (owner-only writes, validated public contact form)
- `firebase.json` hosting config: clean URLs, CSP + security headers, caching

## Editing projects
Admin → Projects: Edit, change the preview picture, re-order with the arrows, delete or add new ones.
Statuses: `live`, `delivered`, `building` (unfinished).

## Search appearance (favicon + Google Images)
- Favicons: `public/favicon.ico` + `public/assets/icons/jkc-favicon-{48,96,144,192}.png`, linked with `?v=3` in every page head. Bump `?v=` if you ever change them again.
- Photos of Josaphat: `public/assets/images/josaphat-chilokoto.webp` and `josaphat-chilokoto-2.webp` (name, description and author are embedded in the files). They are described in each page's JSON-LD and in `public/sitemap.xml` (image entries). Old file names 301-redirect in `firebase.json`.
- After `firebase deploy`: Google Search Console → URL inspection → `https://josaphatchilokoto.space/` → Request indexing (also `/about`), and re-submit `sitemap.xml`. Google refreshes favicons and images on its own schedule (days to a few weeks).

## Hero depth
`initNet()` in `public/js/site.js` runs the network in 3D. Tuning knobs at the top of the function: `F` (perspective), `ZR` (depth of the cloud), `LINK` (line reach), `YAW` / `PITCH` (how far the scene tilts with the mouse). The hero card, code window and orbits shift via `--cx/--cy` in `css/site.css`.
