# Crimson

A music library for recordings, sheet music, game music, podcast and video music, compositions, and other work.

## Site files

- **index.html** — library page
- **about.html** — about page
- **styles.css** — layout and styling
- **app.js** — search, collection filters, sorting, and piece details
- **music.json** — catalog entries

## Publish with GitHub Pages

1. Open the repository's **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose the **main** branch and the **/(root)** folder, then save.

## Adding a piece

Upload the real audio or document files into the repository, then add an entry to **music.json**. Use one of these category IDs:

- `sheet-music`
- `game-music`
- `podcast-video`
- `compositions`
- `other`

Example entry:

```json
[
  {
    "id": "piece-id",
    "title": "Piece title",
    "category": "compositions",
    "project": "Project name",
    "description": "Optional description",
    "date": "2026-11-19",
    "genres": ["Orchestral", "Adventure"],
    "audio": "music/audio/piece.mp3",
    "score": "music/scores/piece.pdf",
    "parts": [
      {
        "instrument": "French horn",
        "file": "music/parts/piece-horn.pdf"
      }
    ],
    "files": [
      {
        "label": "MIDI",
        "file": "music/downloads/piece.mid"
      }
    ]
  }
]
```

Only include fields and files that actually exist. The audio, score, parts, and extra files are optional. For several pieces, put each entry in the same JSON array and separate entries with commas.

The site is plain HTML, CSS, and JavaScript. It does not need a build step or third-party libraries.
