# mtcq — setup guide

Everything is plain HTML + JS modules. No build step, no npm for the site itself.

## What's in the box

| File | What it is |
|---|---|
| `index.html` | Landing page: "Free Use, Excellent Service", login & signup |
| `dashboard.html` | Creator dashboard: claim username, links, PNG images, wallpaper, stats, QR |
| `tree.html` | The public tree page visitors see (`mtcq.org/username`) |
| `admin.html` | Admin panel (only `r45t6er7@gmail.com` gets in) |
| `js/app.js` | Firebase config + shared helpers |
| `css/style.css` | The black & white design system |
| `firestore.rules` | Security rules — **deploy these, see step 4** |
| `firebase.json` | Hosting config with the `/username` rewrite |

## 1. What you already did (nothing to redo)

- Firebase project `mtcq-v4` created ✔
- Authentication → Email/Password enabled ✔
- Firestore created in test mode ✔
- Web app config keys — already pasted into `js/app.js` ✔

The code creates all collections itself (`users`, `usernames`, `trees`, `stats`, `config`)
the first time they're needed. You don't create anything by hand.

## 2. Run it locally

JS modules don't work from a `file://` double-click. Serve the folder:

```
cd mtcq
python -m http.server 8000        # or: npx serve .
```

Open http://localhost:8000 — locally, public trees use `tree.html?u=name`.
The pretty `/username` URLs come from Firebase Hosting (step 3).

## 3. Deploy to Firebase Hosting (gives you the /username URLs)

```
npm install -g firebase-tools
firebase login
cd mtcq
firebase init            # pick Hosting + Firestore, use EXISTING project mtcq-v4,
                         # public directory: .  — don't overwrite the provided files
firebase deploy
```

Your site goes live at `https://mtcq-v4.web.app`. To use **mtcq.org**:
Firebase Console → Hosting → Add custom domain → follow the DNS steps at your registrar.
Once the domain is connected, `mtcq.org/anyname` automatically serves that user's tree
(the rewrite in `firebase.json` does this).

## 4. IMPORTANT — replace test mode with the real rules

Test mode lets **anyone on the internet read and write your whole database**, and it
auto-expires after ~30 days anyway. It's fine for your first local test, but before
sharing the site, deploy the included rules. Two ways:

- `firebase deploy --only firestore:rules` (uses `firestore.rules`), **or**
- Firebase Console → Firestore → Rules → paste the contents of `firestore.rules` → Publish.

What the rules guarantee once deployed:

- Emails and account data in `users/` are private — readable only by that user and the admin.
- Trees are publicly readable (they're public pages) but editable only by their owner.
- Usernames can't be hijacked, duplicated, or claimed for someone else.
- Admin powers are tied to `r45t6er7@gmail.com` **by Firebase itself**, not just by page
  JavaScript — nobody can grant themselves admin by editing the site in DevTools.
- The stats collection only accepts numeric counters, nothing else.

One requirement that comes with this: the admin account's email must be **verified**
(the rules check `email_verified` so nobody can sign up elsewhere pretending to be that
address). Log in as the admin once, then in Firebase Console → Authentication you can
mark it verified, or trigger a verification email.

## 5. Admin account

Create the account normally on the site (sign up with `r45t6er7@gmail.com`). The
dashboard then shows an **Admin** button. The panel gives you:

- Emergency shutdown of the entire platform (every page shows a maintenance screen; only the admin can still browse)
- Max trees per account and max links per tree
- Every live tree with views/clicks, with one-click removal
- Every account, with one-click removal of all its data

Deleting a user's *login credential* (so they can't sign back in) is the one thing a
browser is not allowed to do to other users — do that in Console → Authentication →
select user → Delete, or from a server with the Admin SDK.

## 6. Notes on security & honest limitations

- The `apiKey` in `js/app.js` is **not a secret** — Firebase web keys are meant to be
  public; security comes entirely from the rules in step 4.
- Link/view stats are written by anonymous visitors by design, so a determined person
  could inflate their own numbers. Fine for a free product; if it ever matters, move
  counting into a Cloud Function.
- Per-account tree and link limits are enforced in the app UI and are honest-user
  limits; hard server-side enforcement of counts would need Cloud Functions.
- PNG images are auto-resized to small 128px thumbnails and stored inside Firestore,
  which keeps everything free-tier and avoids needing Firebase Storage.
