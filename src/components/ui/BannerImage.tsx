/* eslint-disable @next/next/no-img-element */
import { JSX, useState } from 'react';

/**
 * Workspace banner with a fixed, responsive height so there's no layout shift,
 * plus a shimmering placeholder that the image fades in over once it loads.
 * This avoids the "image slowly painting in" effect of a bare <img>.
 */
export default function BannerImage({ src }: { src?: string | null | false }): JSX.Element | null {
  const [loaded, setLoaded] = useState(false);

  if (!src) return null;

  return (
    <div className="relative h-40 w-full overflow-hidden border-b border-gray-200 dark:border-gray-800 sm:h-56 lg:h-72">
      <div
        className={`absolute inset-0 animate-pulse bg-gray-200 transition-opacity duration-500 dark:bg-gray-800 ${loaded ? 'opacity-0' : 'opacity-100'
          }`}
      />
      <img
        src={src}
        alt="Workspace Banner"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'
          }`}
      />
    </div>
  );
}
