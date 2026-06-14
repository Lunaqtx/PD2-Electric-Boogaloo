# Project Destiny 2: Electric Boogaloo

A shared availability calendar for Destiny 2 fireteams. Each guardian marks the
times they're free; cells light up gold as more people pile in, fully ignite at
6 — your raid-ready signal. Also lets you schedule specific raids by name and
track who's in.

Set against an animated star-field with subtle nebula glows. All times in
**Eastern Time (ET)**.

**Sign in with Google** to create a guardian — your profile then follows you
across every device you sign in on. Anyone with the link can view the calendar
without an account; only marking availability and scheduling raids requires
signing in.

Self-hosted on GitHub Pages with Firebase Realtime Database as the backend.
Free tier on both is more than enough for a fireteam.

---

## What you're setting up

Three things, in order:

1. **Firebase project** — the backend that stores guardians, availability, and
   raids, and syncs changes between everyone in real time. About 5 minutes.
2. **GitHub repo with Pages enabled** — hosts the static files. About 2 minutes.
3. **Paste Firebase config into the code** — one line of glue. About 30 seconds.

You only do this once. After that, your fireteam just opens the link.

---

## Part 1 — Firebase setup

### 1.1 Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Add project**. Give it any name (e.g. `pd2eb`). You can skip Google
   Analytics — say no when prompted, it isn't needed for this.
3. Wait for the project to provision (~30 seconds).

### 1.2 Enable authentication providers

The app uses two sign-in methods: **Anonymous** so the calendar loads
without anyone having to sign in, and **Google** for creating a guardian
profile that follows you across devices.

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**.
3. On the **Sign-in method** tab, you'll add two providers:
   - **Anonymous**: click it in the list, toggle **Enable** on, **Save**.
   - **Google**: click it in the list, toggle **Enable** on. Set the
     **Project support email** (your own Gmail works), then **Save**.

### 1.3 Authorize your GitHub Pages domain

Google sign-in only works from domains Firebase explicitly trusts.
`localhost` and your Firebase project's `firebaseapp.com` domain are
allowed by default — you need to add your GitHub Pages domain too.

1. Still in **Authentication**, click the **Settings** tab.
2. Scroll to **Authorized domains**.
3. Click **Add domain** and enter your GitHub Pages host, e.g.
   `yourusername.github.io` (no `https://`, no path — just the host).
4. Save.

> If you skip this step, the Google popup will close with an error like
> "auth/unauthorized-domain" and the app will tell you.

### 1.4 Create the Realtime Database

This is where the shared data lives.

1. In the left sidebar, click **Build → Realtime Database**.
2. Click **Create Database**.
3. Pick a region (closest to your fireteam — `us-east1` is fine for ET).
4. When asked about security rules, choose **Start in locked mode**. We'll
   replace these in the next step anyway.
5. Once the database exists, click the **Rules** tab.
6. Replace the contents with the contents of `database.rules.json` from this
   repo:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
   This means: anyone signed in (including anonymously) can read and write.
   For a fireteam of friends, this is fine. If you want stricter rules
   (e.g. only let users edit their own availability), see the **Security
   notes** section at the bottom.
7. Click **Publish**.

### 1.5 Get your config snippet

1. In the left sidebar, click the **gear icon** (top-left, next to "Project
   Overview") → **Project settings**.
2. Scroll down to **Your apps**. Click the **`</>`** (web) icon to register a
   web app.
3. Give it any nickname (e.g. `web`). Do **not** check "Set up Firebase
   Hosting" — we're using GitHub Pages.
4. Click **Register app**.
5. Firebase shows you a config object that looks like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project",
     storageBucket: "your-project.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123"
   };
   ```
6. **Copy the whole object.** You'll paste it into `app.js` shortly.

   > **Important:** if you don't see a `databaseURL` line in the config, that
   > means Firebase didn't link the Realtime Database to this web app. Go back
   > to **Realtime Database**, copy the URL shown at the top of the **Data**
   > tab (looks like `https://your-project-default-rtdb.firebaseio.com`), and
   > add it to the config manually.

---

## Part 2 — GitHub Pages setup

### 2.1 Create the repo

1. Go to <https://github.com> and sign in (or sign up — it's free).
2. Click **New repository** (top-right, green button or `+` menu).
3. Name it whatever you want — `fireteam-calendar`, `pd2eb`, etc.
4. Set it to **Public**. (GitHub Pages on private repos requires a paid plan.)
5. Check **Add a README file** so the repo isn't empty.
6. Click **Create repository**.

### 2.2 Upload the files

The easy way:

1. On your new repo's page, click **Add file → Upload files**.
2. Drag in `index.html`, `style.css`, `app.js`, `database.rules.json`, and
   `README.md` (this file) from the `fireteam-calendar/` folder.
3. Scroll down, click **Commit changes**.

Or if you use git locally: clone the repo, copy the files in, commit, push.

### 2.3 Paste your Firebase config

1. In your repo, click `app.js` to open it.
2. Click the pencil icon (top-right of the file view) to edit.
3. Find the block near the top that says **PASTE YOUR FIREBASE CONFIG HERE** —
   roughly lines 25 to 45.
4. Replace the `firebaseConfig` object's values with the ones from your
   Firebase project (from step 1.5). It should end up looking like:
   ```js
   const firebaseConfig = {
     apiKey:            "AIzaSy...",
     authDomain:        "your-project.firebaseapp.com",
     databaseURL:       "https://your-project-default-rtdb.firebaseio.com",
     projectId:         "your-project",
     storageBucket:     "your-project.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId:             "1:1234567890:web:abcdef123",
   };
   ```
   No placeholder strings starting with `REPLACE_` should remain.
5. Scroll down, click **Commit changes**.

   > Yes, this commits the Firebase config publicly. That's fine — Firebase
   > web config is **not a secret**. The security is enforced by the database
   > rules you set in step 1.4, not by hiding the config. Google's
   > [official docs say so explicitly][1].

### 2.4 Enable GitHub Pages

1. In your repo, click **Settings** (top tab).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **`main`**, folder: **`/ (root)`**
4. Click **Save**.
5. Wait about a minute. Refresh the page. You'll see:
   > Your site is live at `https://yourusername.github.io/your-repo-name/`

That URL is your private fireteam calendar. Share it with your friends.

---

## Part 3 — Test it

1. Open the URL. You should see the calendar with no guardians yet, and a
   **Sign in with Google** button in the top-right.
2. Click **Sign in with Google**, pick a Google account, allow the popup.
3. The CTA banner should now offer **Set up guardian** — click it, give your
   guardian a name and pick a class.
4. Click some time slots — they should fill with gold tint and show a "1".
5. To test cross-device: sign in on a different browser/device with the
   **same Google account** — your guardian and availability should be
   identical, no setup needed.
6. To test multi-user: sign in on another browser with a **different Google
   account** and create a second guardian. Both should show up in the same
   calendar in real-time.

If that works, you're done. Send the link to your fireteam.

---

## Customization

Common tweaks (all in `app.js`):

- **Different hours**: change the `HOURS` constant. Currently `[8, 9, 10, …, 20]`
  shows 8 AM – 8 PM. For late-night raids you might want
  `[20, 21, 22, 23, 0, 1, 2]`.
- **Different fireteam size**: change `FIRETEAM_SIZE` (currently 6). Set to 3
  for dungeons, 12 for whatever you're cooking up.
- **Add or reorder raid names**: edit the `RAIDS` array. The list currently
  runs Leviathan through Salvation's Edge in release order. If you want a
  free-text option for one-offs like Trials or GM nightfalls, add
  `"Other"` to the array — the modal has a built-in handler that turns into
  a custom name field whenever that option is selected.
- **Starfield density**: change the count in `generateStars(280, 1200, 800)`.
  Higher = denser sky, lower = sparser. 280 is calibrated for typical desktop
  viewports.
- **Twinkle speed / range**: edit the `.ft-stars .tw-*` rules in `style.css`.
  Each rule defines `--dur` (cycle time), `--max` and `--min` (opacity range),
  and `--delay` (phase offset).
- **Nebula colors / intensity**: the four `radial-gradient(...)` layers in
  `body::before` in `style.css`. Bump the alpha values up for stronger glows,
  down for subtler.
- **Color palette**: edit the CSS variables at the top of `style.css`
  (`--gold`, `--titan`, `--hunter`, `--warlock`, etc.).

After editing, commit and push — GitHub Pages auto-redeploys within a minute.
Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) to bypass browser caching.

---

## Pushing updates without making everyone hard-refresh

Browsers cache `style.css` and `app.js` aggressively. GitHub Pages tells
browsers they're good for 10 minutes, so even after you push a change, your
fireteam may still see the old version for up to that long — and longer if
their browser is holding on tighter.

To force everyone to fetch a fresh copy the next time they load the page,
**bump the asset version in `index.html`**:

```html
<link rel="stylesheet" href="./style.css?v=2" />
...
<script type="module" src="./app.js?v=2"></script>
```

Increment the `?v=N` number whenever you push CSS or JS changes that need to
propagate immediately. Browsers cache by full URL, so `style.css?v=3` is a
different resource from `style.css?v=2` — they have no choice but to refetch.

You only need to do this when the change is something visible/breaking. For
small tweaks, GitHub Pages' default cache will expire on its own within ~10
minutes and everyone will pick up the new version next time they open the page.

If you forget to bump and someone reports stale UI, they can always hard-refresh
(Ctrl+Shift+R / Cmd+Shift+R) as a one-off fix.

---

## Troubleshooting

**"Firebase config required" screen**
You didn't paste your config into `app.js`, or some values still start with
`REPLACE_`. Re-check step 2.3.

**"Could not connect" screen**
Three common causes:
1. Anonymous auth isn't enabled in Firebase (step 1.2).
2. Your `databaseURL` is missing or wrong in the config.
3. The database rules are too restrictive — make sure they match
   `database.rules.json`.

**App loads but slots don't save**
Open browser DevTools → Console. If you see `PERMISSION_DENIED`, your
database rules are blocking writes. Re-check step 1.4.

**Friends see "Could not connect"**
They need to have anonymous auth allowed (which is automatic once you've
enabled it in step 1.2). If still broken, ask them to share the console error.

**Google sign-in popup closes immediately or shows "unauthorized-domain"**
Your GitHub Pages domain isn't in Firebase's authorized domain list.
Go to **Firebase Console → Authentication → Settings → Authorized domains**
and add `yourusername.github.io` (the host only, no path). See step 1.3.

**Friend signs in with Google but ends up with a blank guardian**
That's normal — they're signed in, but they haven't set up their guardian's
name and class yet. They should see a **Set up guardian** button in the
top-right or in the welcome banner.

**Past raids cluttering the list**
Click the trash icon on any raid card to delete it. Past raids appear at the
bottom, dimmed.

---

## Security notes

The default rules let any signed-in user read/write everything. Anonymous auth
means anyone with your GitHub Pages URL can sign in and access the data. For a
fireteam of friends sharing a private link, this is the right tradeoff —
simple, no account hassle.

If you want tighter control:
- **Restrict writes to your own data only**: replace the rules with something
  like
  ```json
  {
    "rules": {
      "guardians":    { ".read": "auth != null", ".write": "auth != null" },
      "availability": {
        "$gid": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "raids": {
        ".read": "auth != null",
        ".write": "auth != null",
        "$rid": {
          "attendees": {
            "$uid": {
              ".write": "auth != null"
            }
          }
        }
      }
    }
  }
  ```
  Note: because we use anonymous auth (uid changes per session/device), you
  can't easily tie ownership to a Firebase uid. The simple rules above are
  honestly fine for a small trusted group.
- **Stop indexing**: the HTML has `<meta name="robots" content="noindex">`
  already, so search engines won't list it. Your link is "private" in the
  sense of "obscure" but not authentication-gated. Don't post it publicly.

---

## File layout

```
fireteam-calendar/
├── index.html             ← HTML shell
├── style.css              ← all the styles
├── app.js                 ← all the logic, with the FIREBASE CONFIG block
├── database.rules.json    ← paste contents into Firebase Console → Rules
└── README.md              ← you are here
```

---

[1]: https://firebase.google.com/docs/projects/api-keys
