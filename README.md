# Crimson Client

Crimson is a browser-based Eaglercraft 1.12.2 client by Talon. The site opens the actual game in-place; it is not a separate launcher window.

## First launch

1. Open the Crimson Client site.
2. Choose your standalone Eaglercraft 1.12.2 HTML file (the clean file you are entitled to use).
3. Crimson injects its EaglerLite API, server list, and bundled client-side modules, then saves the resulting HTML in this browser's IndexedDB.
4. From then on, opening the site starts the game directly. The game file is kept in this browser and is not uploaded to Crimson's website.

The first import is required because the game engine is user-supplied and is not stored in this repository. Each browser/device needs its own initial import.

## Playing

The embedded game is the Eaglercraft 1.12.2 client itself. Use its normal Minecraft main menu for singleplayer, multiplayer, controls, options, and resource packs. The Crimson patch adds these multiplayer entries:

- Talon — wss://talon.mybothosting.com/
- Archyverse — wss://mc.archyverse.org/
- GenericSMP — wss://genericsmp.eagler.host/
- ArchMC — wss://arch.mc/

These are saved addresses, not live status checks. A server may be offline or require another version.

## Crimson controls

Click the small Crimson tab in the top-left corner to open the client controls. Right Shift opens the in-game mod panel directly.

| Module | What it does | Default |
| --- | --- | --- |
| Crimson Interface | Crimson styling for the mod panel | On |
| Crimson HUD | FPS, frame time, keystrokes, and left/right CPS | On |
| Crimson Crosshair | Adjustable center reticle | On |
| Toggle Sprint | Toggle sprint with Ctrl + Shift + G | Off |
| Crimson Screenshot | Save a screenshot with F8 | On |

Use Arrange HUD in the mod panel to move supported HUD widgets.

Custom mod uploads are for local singleplayer worlds only. The panel accepts EaglerLite API JavaScript mods (.js) and JSON bundles (.json), up to 2 MB per file. This is not Forge or Fabric and does not load Java .jar files or arbitrary mods from other Minecraft versions. Only import scripts from sources you trust.

## Textures

Open the Crimson tab and choose Crimson textures to build an original 16x resource pack with new block and sword textures. Import the resulting Crimson-Resource-Pack-1.12.zip in Minecraft's Options → Resource Packs menu.

## Technical notes

- index.html, styles.css, app.js — direct in-page game surface, first-run import, local storage, and texture pack builder
- patcher.html — EaglerLite API patch engine and bundled Crimson modules
- mods/crimson-mod-pack.json — separate EaglerLite mod bundle
- licenses/EaglerLite-API-APACHE-2.0.txt — EaglerLite API license
- THIRD_PARTY_NOTICES.md — third-party attribution

Worlds and game settings are stored by the game in browser storage. Export worlds from inside the game if you need a backup. Removing the saved client file does not delete worlds.