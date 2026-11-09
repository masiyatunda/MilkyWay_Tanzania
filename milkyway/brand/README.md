# MilkyWay brand assets

All assets come from the official MilkyWay logo (blue and gold spiral galaxy, "MilkyWay — FREEDOM. TRUTH. LIGHT."), taken from the supplied design reference. The starry background was keyed out; the emblem, colours, wordmark and tagline are unchanged.

| File | Use |
| --- | --- |
| `milkyway-logo.png` | Master transparent logo (276×360, full quality). |
| `milkyway-logo-web.png` | Optimized transparent logo for in-app placements (sign-in screen). |
| `milkyway-watermark.png` | Transparent post watermark and Live stage brand mark (200 px wide, ~22 KB). |
| `milkyway-emblem.png` | Transparent spiral emblem without the wordmark. |
| `milkyway-emblem-96.png` | Toolbar emblem. |
| `favicon-16.png`, `favicon-32.png`, `../favicon.ico` | MilkyWay favicons. |
| `../icon-180.png` … `../icon-512.png`, `../icon-square-source.png` | App and PWA icons (logo on the galaxy plate, maskable-safe padding). |

The source in the reference sheet is only about 280 px wide, so the large icons are slightly upscaled. If a high-resolution master logo is available, regenerate these files from it at the same names and sizes.

## Watermark rules

- The watermark is a display overlay (`.mw-media-frame > .mw-watermark`) on feed image and video posts. Uploaded originals are never modified.
- Posts published on or after 2026-10-11 are branded automatically. Authors can add or remove the watermark on older media posts from the post's "•••" menu; opt-ins are stored in the Supabase table `mw_post_watermarks`.
- "Download with watermark" (author's post menu, images only) creates a separate branded JPEG copy in the browser. Exporting branded videos is not implemented.
- The watermark is not applied to DMs, documents, profile pictures, Stories or advertisements.
