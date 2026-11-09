# MilkyWay CSS Architecture & Audit

## Scope
This review covers all 39 CSS files in `milkyway/`. The current application entry page previously loaded 36 stylesheet files individually. The three files not loaded by `milkyway/index.html` are not deleted; some are shared with other site pages, and `short-feed.css` has no stylesheet reference found in the supplied project.

## Safe changes made
- Created four ordered CSS bundles for the MilkyWay app entry page.
- Replaced the 36 individual stylesheet links in `milkyway/index.html` with four bundle links.
- Preserved the original stylesheet order and the positions of intervening JavaScript and inline styles. The four bundles are intentionally split at those boundaries so the CSS cascade remains in the same order.
- Added all four bundles to the MilkyWay service-worker precache and incremented its cache version to `milkyway-v115-css-bundles-v1`.
- Kept every original CSS source file unchanged for maintenance and rollback.
- No application JavaScript, HTML component markup, Supabase logic, LiveKit logic, or database code was changed.

## Bundle map

### `mw-bundle-core.css` (272,474 bytes)
Source order:
- `galaxy.css`
- `premium.css`
- `language-dropdown.css`
- `engage.css`
- `suggested.css`
- `gallery.css`
- `galaxy-live.css`
- `/milkyway/theme.css`
- `/milkyway/release.css`
- `account-hub.css`
- `android-app.css`
- `live-globe.css`
- `cosmos.css`
- `chat.css`
- `group-settings.css`
- `mw-dialog.css`
- `settings-ui.css`
- `account-header.css`
- `edge-layout.css`
- `studio.css`
- `performance.css`
- `calls.css`
- `themes.css`
- `post-tools.css`
- `gifts.css`
- `final-layout.css`
- `live-in-feed.css`
- `chat-settings.css`
- `compact-buttons.css`

### `mw-bundle-live.css` (38,751 bytes)
Source order:
- `live-room.css`
- `tiktok-live.css`

### `mw-bundle-overlays.css` (4,299 bytes)
Source order:
- `/milkyway/fullscreen-bottomsheet-v39.css`

### `mw-bundle-theme-final.css` (27,421 bytes)
Source order:
- `/milkyway/app-theme-system.css`
- `/milkyway/light-glass-lock.css`
- `phase-a.css`
- `mobile-galaxy.css`

## Inventory of all 39 source stylesheets

### Theme, appearance and visual foundation
- `app-theme-system.css`
- `galaxy.css`
- `galaxy-live.css`
- `light-glass-lock.css`
- `mobile-galaxy.css`
- `phase-a.css`
- `premium.css`
- `release.css`
- `theme.css`
- `themes.css`
- `cosmos.css`
- `performance.css`

### Application shell, layout and controls
- `account-header.css`
- `account-hub.css`
- `android-app.css`
- `compact-buttons.css`
- `edge-layout.css`
- `final-layout.css`
- `fullscreen-bottomsheet-v39.css`
- `mw-dialog.css`
- `settings-ui.css`
- `shared-shell.css`

### Live, broadcast and creator studio
- `live-globe.css`
- `live-in-feed.css`
- `live-room.css`
- `live-themes.css`
- `tiktok-live.css`
- `studio.css`

### Messaging and communication
- `calls.css`
- `chat.css`
- `chat-settings.css`
- `group-settings.css`

### Feed, media and engagement
- `engage.css`
- `gallery.css`
- `gifts.css`
- `post-tools.css`
- `short-feed.css`
- `suggested.css`

### Language and localization
- `language-dropdown.css`

## Review of the separately supplied `tiktok-live.css`
The supplied file is **not safe to replace the existing `milkyway/tiktok-live.css` with as-is**.

Reasons found by comparing it with the supplied app:
- It applies a global `:root`, `*`, `html` and `body` reset, including `overflow: hidden`; this can affect the entire MilkyWay application rather than only the Live surface.
- Most of its video selectors (`.tt-stage`, `.tt-video-area`, `.tt-host-window`, `.tt-guest-window`) are not present in the current Live DOM. The current app uses `#mwLivePage`, `#mwLiveStage`, `#mwLiveGrid` and `.lv-tile`.
- Some Audio Live class names overlap, but the supplied stylesheet omits the current grid's `--tt-cols` layout contract and would not be a drop-in replacement.
- The file uses a black/pink TikTok palette, while the existing app's Live theme is scoped to the MilkyWay Galaxy Glass palette.

Recommendation: retain the supplied CSS as a design reference and adapt only the compatible rules to the real Live DOM after a separate visual review. It was not silently inserted or used to overwrite working styles.

## Validation
- All 39 source CSS files were parsed with a CSS parser; no syntax parse errors were found.
- All four generated bundles were parsed; no syntax parse errors were found.
- The source CSS files remain present and unchanged.
- JavaScript syntax check: 83 checks passed.
- Existing test suite: 13 passed, 12 skipped, 1 failed. The failure is unrelated to CSS: the uploaded archive is missing `.github/workflows/android-apk.yml`, which an existing Android workflow test expects. No claim is made that the full suite passed.
- No real-device/browser visual test was possible in this environment. Test the deployed preview on Android and desktop before publishing to production.

## Maintenance rules
1. Edit the original source CSS files, not the generated `mw-bundle-*.css` files.
2. After editing a source CSS file, regenerate the bundles in the same source order shown above.
3. Do not delete an original stylesheet until all HTML pages, JavaScript-created styles, service-worker precache entries, and deployment routes have been checked.
4. Keep the bundle cache version and service-worker cache version aligned when changing bundle filenames or contents.
