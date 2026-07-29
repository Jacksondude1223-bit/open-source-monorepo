import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import classNames from '~/utils/classNames';

export default function DepartmentBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: BrandColors | null;
  className?: string;
}) {
  const c = color || 'blue';
  return (
    <span
      className={classNames(
        `bg-${c}-100 text-${c}-700 dark:bg-${c}-900/30 dark:text-${c}-300`,
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium align-middle',
        className || '',
      )}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-${c}-500`} />
      {name}
    </span>
  );
}
