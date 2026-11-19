# Crimson

Crimson is a music library for original recordings, sheet music, game music, podcast and video music, compositions, and related files.

## Site

- `index.html` — music library, search and collection filters
- `about.html` — about Crimson
- `app.js` and `styles.css` — catalog behavior and design
- `music.json` — public music catalog
- `admin.html` — private admin entry point
- `worker/` — server-side admin API

## First composition

**Storm Frontier** is an original French horn in F piece by Talon. Its score is written in D minor, 4/4, at quarter note = 112. The preview on the site is synthesized from the same note sequence stored in `music.json`.

Files:
- `music/covers/storm-frontier-cover.svg` — original cover artwork
- `music/audio/storm-frontier-horn.mp3` — playable French-horn render
- `music/scores/storm-frontier-horn.pdf`
- `music/musicxml/storm-frontier-horn.musicxml`
- `music/midi/storm-frontier-horn.mid`

## Publish with GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/(root)`, then save.

## Admin uploads

GitHub Pages is static and cannot safely verify a password or commit uploaded files. The private admin backend is a Cloudflare Worker in `worker/`. Read [worker/README.md](worker/README.md) to deploy it. Keep all secrets in the Worker environment; do not put them in this repository. Choose a new admin password for the Worker rather than reusing one already shared in a chat.

After deployment, set `window.CRIMSON_ADMIN_API` in `admin-config.js` to the Worker URL. The footer's small **a** opens the admin page. After sign-in, uploads are committed to the repository and added to `music.json`.

The site itself uses plain HTML, CSS and JavaScript and has no build step.
