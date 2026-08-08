/**
 * The deployment's logo assets.
 *
 * These used to be `https://cdn.readmin.app/...` URLs written out in a couple of
 * dozen places, so rebranding a self-hosted instance meant editing every one —
 * and any that were missed kept serving ReAdmin's artwork from ReAdmin's CDN.
 *
 * To use your own: drop the files in `public/brand/` and point the matching
 * `NEXT_PUBLIC_BRAND_*` variable at them, e.g.
 *
 *   NEXT_PUBLIC_BRAND_WORDMARK_DARK=/brand/wordmark-dark.png
 *
 * A path starting with `/` is served by the panel itself, so no CDN is involved.
 * Read at build time like every other `NEXT_PUBLIC_*` value, so changing one
 * needs a rebuild — `sudo ./install.sh` does that for you.
 *
 * Unset, they fall back to ReAdmin's own assets, which keeps the hosted site and
 * any existing deployment looking exactly as it did.
 */

const READMIN_CDN = 'https://cdn.readmin.app/readmin-public';

/** Full lockup — logo plus name. "dark" / "light" name the *background*. */
export const BRAND_WORDMARK_DARK =
  process.env.NEXT_PUBLIC_BRAND_WORDMARK_DARK || `${READMIN_CDN}/RA-White.png`;
export const BRAND_WORDMARK_LIGHT =
  process.env.NEXT_PUBLIC_BRAND_WORDMARK_LIGHT || `${READMIN_CDN}/RA-Black.png`;

/** Square mark on its own, for tight spaces and favicons. */
export const BRAND_MARK_DARK =
  process.env.NEXT_PUBLIC_BRAND_MARK_DARK || `${READMIN_CDN}/RA-White-RA.png`;
export const BRAND_MARK_LIGHT =
  process.env.NEXT_PUBLIC_BRAND_MARK_LIGHT || `${READMIN_CDN}/ra-black-ra.png`;

/**
 * Browser icons. Falling back to the square mark rather than a second set of
 * ReAdmin URLs means one variable rebrands the tab icon too.
 */
export const BRAND_FAVICON_32 =
  process.env.NEXT_PUBLIC_BRAND_FAVICON_32 || `${READMIN_CDN}/favicon-32x32.png`;
export const BRAND_FAVICON_16 =
  process.env.NEXT_PUBLIC_BRAND_FAVICON_16 || `${READMIN_CDN}/favicon-16x16.png`;
export const BRAND_APPLE_TOUCH_ICON =
  process.env.NEXT_PUBLIC_BRAND_APPLE_TOUCH_ICON || `${READMIN_CDN}/apple-touch-icon.png`;

/** The product name, used in page titles and headings. */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'ReAdmin';
