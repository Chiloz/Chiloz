# josaphatchilokoto.space

Static site on Firebase Hosting + Firestore. No build step.

## Deploy
```
firebase login
firebase deploy            # hosting + firestore rules
```

## One-time setup in the Firebase console
1. Authentication → Sign-in method: keep **Email/Password** on (optionally add **Google**). Add `josaphatchilokoto.space` under Authorized domains.
2. Authentication → Settings → User actions: turn **off** "Enable create (sign-up)".
3. Open `/admin`, sign in, press "Send verification email", open the link, then "I've verified".
   (Firestore rules only accept writes from the *verified* owner email.)

## Structure
- `public/` the website (HTML, `css/site.css`, `js/`, `assets/`)
- `firestore.rules` security rules (admin-only writes, validated public contact form)
- `firebase.json` hosting config: clean URLs, CSP + security headers, caching

## Editing projects
Built-in projects live in `public/projects.html`. Copy a `<article class="card card-hover proj ...">` block.
Statuses: `live`, `delivered`, `building` (unfinished). Extra ones can be added from `/admin`.
