import { JSX } from "react";
import { RandomIntFromMinMax } from "~/utils/Numbers";

export default function TextLoadingPlaceholder({
  header = true,
  rows,
}: {
  header?: boolean;
  rows: number;
}): JSX.Element {
  return (
    <div role="status" className="max-w-sm animate-pulse">
      {header && (
        <div className="h-2.5 bg-gray-200 rounded-full transition dark:bg-gray-700 w-48 mb-4"></div>
      )}
      {Array(rows)
        .fill(0)
        .map((i, row) => {
          const size = RandomIntFromMinMax(300, 400);
          return (
            <div
              key={row}
              className={`h-2 bg-gray-200 rounded-full transition dark:bg-gray-700 mb-2.5`}
              style={{ maxWidth: `${size}px` }}
            ></div>
          );
        })}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
