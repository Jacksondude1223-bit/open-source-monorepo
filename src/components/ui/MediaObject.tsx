/* eslint-disable jsx-a11y/alt-text */

import { JSX } from "react";

/* eslint-disable @next/next/no-img-element */
export default function MediaObject({
  src,
  title,
  description,
  children,
  smaller = false,
}: {
  src: string;
  smaller?: boolean;
  title: any;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-row gap-2 flex-wrap w-full">
      <img
        className={`rounded-full ${smaller ? 'h-12 w-12' : 'h-16 w-16'
          } border border-gray-300 bg-white text-gray-300 transition dark:bg-blue-800 dark:text-gray-100 self-center align-middle`}
        src={src}
      />
      <div className="flex flex-col w-min grow align-middle self-center">
        <h4
          className={`${smaller ? 'text-md' : 'text-lg'} font-bold text-left`}
        >
          {title}
        </h4>
        <p className={`mt-1 text-left ${smaller ? 'text-sm' : ''}`}>
          {description ? description : ''}
        </p>
      </div>
      {(children && children) || <></>}
    </div>
  );
}
