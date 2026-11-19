# Crimson Admin Worker

This is the private backend for the small admin link in the Crimson footer. GitHub Pages cannot safely verify a password or write files to a repository on its own, so the browser sends sign-in requests to this Worker. The Worker checks the password and keeps the GitHub token server-side.

## What it does

- Verifies the admin password on the server
- Issues an expiring, signed session token
- Reads the current `music.json` catalog
- Uploads audio, PDF, MIDI and MusicXML files into the repository
- Adds the new entry to `music.json`, which triggers the normal GitHub Pages deployment

Files are limited to 8 MB each. Allowed file formats are MP3/WAV/OGG/M4A, PDF, MID/MIDI and MusicXML/XML.

## Browser-only setup (no command line required)

1. Open the Cloudflare dashboard and go to **Workers & Pages**.
2. Create a new Worker named `crimson-admin-api`.
3. In the Worker editor, replace the starter code with the contents of [src/index.js](src/index.js), then deploy it.
4. Open the Worker **Settings → Variables and Secrets**.
5. Add these plain-text variables:
   - `REPO_OWNER` = `CaptainBensword`
   - `REPO_NAME` = `Crimson`
   - `REPO_BRANCH` = `main`
   - `ALLOWED_ORIGIN` = `https://captainbensword.github.io`
6. Add these as **secrets**, not plain-text variables:
   - `ADMIN_PASSWORD` — choose a new password that has not been posted in a chat or committed to a file
   - `SESSION_SECRET` — use a long, random value
   - `GITHUB_TOKEN` — a fine-grained GitHub token for only `CaptainBensword/Crimson`, with **Contents: Read and write** permission
7. Save the settings and redeploy the Worker.
8. Copy the Worker URL ending in `.workers.dev`.
9. Open `admin-config.js` in the GitHub editor and set `window.CRIMSON_ADMIN_API` to that Worker URL. Commit the change.
10. Visit Crimson, click the small **a** in the footer, and sign in with the new password stored as the Worker secret.

The configured allowed browser origin is `https://captainbensword.github.io`. If the site is moved to a custom domain, change `ALLOWED_ORIGIN` to that exact origin and redeploy.

## Command-line alternative

With Node.js installed, run `npx wrangler login` and `npx wrangler deploy` from this folder. Set the same values in `wrangler.toml` and add the three secrets with `npx wrangler secret put ADMIN_PASSWORD`, `npx wrangler secret put SESSION_SECRET`, and `npx wrangler secret put GITHUB_TOKEN`.

## Security notes

- Never add passwords, Worker secrets or GitHub tokens to the GitHub repository.
- The password provided in the chat should not be reused. Treat it as no longer private and choose a new one for the Worker.
- The GitHub token stays in the Worker environment and is never sent to the browser.
- Admin sessions expire after eight hours and are kept in the current browser tab's session storage.
