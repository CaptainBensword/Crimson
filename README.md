# Crimson Client

Crimson Client is a custom browser-side setup for **Eaglercraft 1.12.2** with a Crimson-themed patcher, a small in-game quality-of-life mod pack, and an original 16×16 resource pack builder

The game itself is not included in this repository. Bring a clean standalone EaglercraftX 1.12.2 JavaScript HTML file that you are entitled to use

## Use Crimson

1. Open the [Crimson Client site](https://captainbensword.github.io/Crimson/)
2. Choose **Play → Open Crimson Patcher**
3. Select your clean standalone 1.12.2 HTML file
4. Download the patched client or use the patcher's temporary launch option
5. Back on Crimson, import the patched HTML and use **Launch Client** to keep it saved in this browser

The patcher injects the EaglerLite Mod API and bundles Crimson's modules into the patched file. Open the in-game mod menu with **F6**

## Included modules

| Module | What it does | Default |
| --- | --- | --- |
| Crimson HUD | FPS, frame time, keystrokes, and left/right CPS overlays | On |
| Crimson Crosshair | Adjustable center reticle with color, size, gap, and thickness options | On |
| Toggle Sprint | Toggle sprint using Ctrl + Shift + G | Off |

The HUD can be repositioned from the in-game mod menu's **Arrange HUD** action

A separate [mod bundle](mods/crimson-mod-pack.json) is included for manual import or updating an already-patched client

## Resource pack

Open **Appearance → Build Resource Pack** to generate Crimson-Resource-Pack-1.12.zip

It includes original 16×16 textures for stone, cobblestone, dirt, grass, oak planks, obsidian, and netherrack, plus a 1.12-compatible pack.mcmeta

Import the ZIP from the game's Resource Packs screen

## Project files

- index.html, styles.css, app.js — Crimson Client interface, local client storage, and resource pack builder
- patcher.html — Crimson-themed EaglerLite patcher with the Crimson mod pack bundled into its boot config
- mods/crimson-mod-pack.json — standalone mod bundle
- licenses/EaglerLite-API-APACHE-2.0.txt — third-party license
- THIRD_PARTY_NOTICES.md — attribution and modification notes

## Local storage

The launcher saves the patched HTML in IndexedDB on this browser only; it is not uploaded to a server

The game keeps its own browser data for worlds and settings. Export important worlds as EPK files from inside the game as a separate backup

## Development

The site uses plain HTML, CSS, and JavaScript with no build step or remote libraries. It is published from the repository root through GitHub Pages
