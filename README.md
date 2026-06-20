# Rocket Work — Chrome New Tab Extension

Custom Chrome new-tab page: Apple Reminders-style task list + quick-access launcher, on an animated blurred-gradient backdrop. Auto light/dark theme that follows Chrome/system.

## Features

- **Tasks** — Active + Completed sections with count badges, round checkboxes, favorite stars, inline delete, double-click to rename, inline "+ New Task" row. Completed is collapsible.
- **Quick Access** — favicon tiles; add/edit/delete via right-click menu; drag to reorder; upload a custom logo (auto-downscaled to 96px).
- **Theme** — auto-follows system via `prefers-color-scheme` (no toggle).
- **Persistence** — `chrome.storage.local` with `localStorage` fallback.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. **Load unpacked** → select this folder
4. Open a new tab

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest, overrides new tab |
| `newtab.html` | Page markup |
| `styles.css` | Theme + layout |
| `newtab.js` | Tasks, quick access, storage |
| `icons/` | Extension icons (16/48/128) |
