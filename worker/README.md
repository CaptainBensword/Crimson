# Crimson Admin Worker

This is the private backend for the small admin link in the Crimson footer. GitHub Pages cannot safely verify a password or write files to a repository on its own, so the browser sends sign-in requests to this Worker. The Worker checks the password and keeps the GitHub token server-side.

## What it does

- Verifies the admin password on the server
- Issues an expiring, signed session token
- Reads the current `music.json` catalog
- Uploads audio, PDF, MIDI and MusicXML files into the repository
- Adds the new entry to `music.json`, which triggers the normal GitHub Pages deployment

Files are limited to 8 MB each. Allowed file formats are MP3/WAV/OGG/M4A, PDF, MID/MIDI and MusicXML/XML.

## Deploy

1. Create a Cloudflare account and install Wrangler on a computer with Node.js.
2. From this folder, run `npx wrangler login`.
3. Create a fine-grained GitHub token for **only** `CaptainBensword/Crimson`, with **Contents: Read and write** permission. Do not put the token in this repository or in `admin-config.js`.
4. Set the three Worker secrets:
   - `npx wrangler secret put ADMIN_PASSWORD`
   - `npx wrangler secret put SESSION_SECRET`
   - `npx wrangler secret put GITHUB_TOKEN`
5. For `ADMIN_PASSWORD`, choose a new password that has not been posted in a chat or committed to a file. For `SESSION_SECRET`, use a long random value. Paste the GitHub token only into the Wrangler secret prompt.
6. Deploy with `npx wrangler deploy`.
7. Copy the deployed Worker URL, open the repository's `admin-config.js`, and set `window.CRIMSON_ADMIN_API` to that URL. Commit the change.
8. Visit Crimson, click the small **a** in the footer, and sign in with the password stored as the Worker secret.

The configured allowed browser origin is `https://captainbensword.github.io`. If the site is moved to a custom domain, change `ALLOWED_ORIGIN` in `wrangler.toml` to that exact origin and redeploy.

## Security notes

- Never add passwords, Worker secrets or GitHub tokens to the GitHub repository.
- The password provided in the chat should not be reused. Treat it as no longer private and choose a new one for the Worker.
- The GitHub token stays in the Worker environment and is never sent to the browser.
- Admin sessions expire after eight hours and are kept in the current browser tab's session storage.
