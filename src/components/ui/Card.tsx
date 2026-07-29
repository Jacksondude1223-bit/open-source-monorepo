import { JSX } from "react";

/* eslint-disable @next/next/no-img-element */
export default function Card({
  className = '',
  key = '',
  children,
  imgHeader = ''
}: {
  className?: string;
  key?: string;
  children: React.ReactNode;
  imgHeader?: string;
}): JSX.Element {
  return imgHeader ? (
    <div
      key={key}
      className={`w-full rounded-lg transition dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 bg-white shadow-lg border-2 border-gray-100 ${className}`}
    >
      <img src={imgHeader} alt="img header" />
      <div className="px-4 py-4">
        {children}
      </div>
    </div>
  ) : (
    <div
      key={key}
      className={`w-full rounded-lg transition dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 bg-white shadow-lg border-2 border-gray-100 px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
}
