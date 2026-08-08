# Brand assets

Drop your own logo files here and point the matching `NEXT_PUBLIC_BRAND_*`
variable at them in `.env`. Anything in `public/` is served by the panel at the
same path, so a file saved as `public/brand/wordmark-dark.png` is reachable at
`/brand/wordmark-dark.png`.

```dotenv
NEXT_PUBLIC_BRAND_NAME=CypherX Admin
NEXT_PUBLIC_BRAND_WORDMARK_DARK=/brand/wordmark-dark.png
NEXT_PUBLIC_BRAND_WORDMARK_LIGHT=/brand/wordmark-light.png
NEXT_PUBLIC_BRAND_MARK_DARK=/brand/mark-dark.png
NEXT_PUBLIC_BRAND_MARK_LIGHT=/brand/mark-light.png
NEXT_PUBLIC_BRAND_FAVICON_32=/brand/favicon-32x32.png
NEXT_PUBLIC_BRAND_FAVICON_16=/brand/favicon-16x16.png
NEXT_PUBLIC_BRAND_APPLE_TOUCH_ICON=/brand/apple-touch-icon.png
```

| Variable | What it is | Where it shows |
| --- | --- | --- |
| `WORDMARK_DARK` | Full lockup for **dark** backgrounds | Sidebars, nav, most of the panel |
| `WORDMARK_LIGHT` | Full lockup for **light** backgrounds | Landing page, 404, public postings |
| `MARK_DARK` | Square mark for dark backgrounds | Login, auth callbacks, compact headers |
| `MARK_LIGHT` | Square mark for light backgrounds | Workspace creation |
| `FAVICON_*`, `APPLE_TOUCH_ICON` | Browser tab and home-screen icons | `_document.tsx` |

"dark" and "light" name the **background** the asset sits on, so a white logo is
the *dark* variant.

Two files that are not env driven, because they are static and read before any
JavaScript runs — edit them directly if you rebrand:

- `public/site.webmanifest` — name and Android icons
- `public/browserconfig.xml` — the Windows tile

Unset variables fall back to ReAdmin's own artwork on its CDN, which keeps an
existing deployment looking exactly as it did.

These are read at **build** time, so a change needs a rebuild — `sudo
./install.sh` does that. Everything in this directory except this README is
gitignored, so your artwork will not be committed.
