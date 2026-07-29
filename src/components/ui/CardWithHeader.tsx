import { TrashIcon } from '@heroicons/react/24/outline';
import { JSX } from 'react';
import Button from '~/components/forms/Button';

export default function CardWithHeader({
  title,
  key = '',
  className = '',
  header = <></>,
  deleteCb = undefined,
  children,
}: {
  title: string;
  className?: string;
  deleteCb?: () => void;
  key?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      key={key}
      className={`${className} divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-lg border-2 border-gray-100`}
    >
      <div className="px-4 py-5 sm:px-6 flex flex-row justify-between">
        <div className="flex flex-row justify-between">
          <h2 className="font-bold text-lg">{title}</h2>
          {header}
        </div>
        {deleteCb && (
          <Button onClick={deleteCb} variant="light_danger" icon={TrashIcon} />
        )}
      </div>
      <div className="px-4 py-5 sm:p-6">{children}</div>
    </div>
  );
}
