# Crimson Client

Crimson is a browser-based client setup for **Eaglercraft 1.12.2**. It has a patcher, an in-game mod panel, five bundled quality-of-life features, a server list, and an original resource pack builder.

The game itself is not included. Use a standalone EaglercraftX 1.12.2 JavaScript HTML file that you are entitled to use.

## Set up the client

1. Open the [Crimson Client site](https://captainbensword.github.io/Crimson/).
2. Go to **Play → Open Crimson Patcher**.
3. Select the clean standalone Eaglercraft 1.12.2 HTML file.
4. Download the patched HTML.
5. Return to **Play**, import the patched HTML, and select **Launch Client**.

Crimson keeps the patched file in this browser's IndexedDB. It does not upload your game file to a server.

## In-game controls

Press **Right Shift** to open or close the mod panel. Each listed module has an ON/OFF control; modules with extra settings also have a Config button.

| Module | What it does | Default |
| --- | --- | --- |
| Crimson Interface | Crimson styling for the mod panel | On |
| Crimson HUD | FPS, frame time, keystrokes, and left/right CPS | On |
| Crimson Crosshair | Adjustable center reticle | On |
| Toggle Sprint | Toggle sprint with Ctrl + Shift + G | Off |
| Crimson Screenshot | Save a screenshot with F8 | On |

Use **Arrange HUD** in the panel to move supported HUD widgets.

## Mod uploads

Custom uploads are for **local singleplayer worlds only**. The panel accepts EaglerLite API JavaScript mods (.js) and EaglerLite JSON bundles (.json), up to 2 MB per file. Saved custom mods are held back outside singleplayer, and enabled custom mods are suspended when leaving the local world.

This client is not Forge or Fabric and does not load Java .jar files, .class files, or arbitrary mods for other Minecraft versions. Mods must be written for the EaglerLite API used by this 1.12.2 JavaScript build. Imported scripts run in the game page, so only import code from sources you trust.

## Servers

The patcher adds these addresses to the game's Multiplayer list and preserves server entries already present in the original file.

- Talon — wss://talon.mybothosting.com/
- Archyverse — wss://mc.archyverse.org/
- GenericSMP — wss://genericsmp.eagler.host/
- ArchMC — wss://arch.mc/ (kept from the source client)

The [Servers page](https://captainbensword.github.io/Crimson/#servers) also displays the addresses for copying. These are saved addresses, not live server status checks.

## Resource pack

Open **Appearance → Build Resource Pack** to create Crimson-Resource-Pack-1.12.zip. It includes original 16×16 textures for stone, cobblestone, dirt, grass, oak planks, obsidian, and netherrack, plus a 1.12-compatible pack.mcmeta.

Import the ZIP through the game's Resource Packs screen.

## Project files

- index.html, styles.css, app.js — launcher, local client storage, server directory, and resource pack builder
- patcher.html — EaglerLite API patcher with Crimson modules and server defaults
- mods/crimson-mod-pack.json — separate EaglerLite mod bundle
- licenses/EaglerLite-API-APACHE-2.0.txt — EaglerLite API license
- THIRD_PARTY_NOTICES.md — third-party attribution

## Worlds and storage

Worlds and game settings are stored by the game in browser storage. Export worlds as EPK files from inside the game if you need a backup. Removing the saved HTML from Crimson does not delete the game's own world storage.