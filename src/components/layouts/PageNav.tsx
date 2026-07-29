import Link from 'next/link';
import { PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import classNames from '~/utils/classNames';
import Dropdown from '../forms/Dropdown';
import { useWorkspace } from '../contexts/workspace';

export default function PageNav({
  tabs,
  children,
}: PropsWithChildren<{
  tabs: { current: boolean; name: string; href: string; icon: any; canShow?: boolean; }[];
}>) {
  const router = useRouter();
  const workspace = useWorkspace();
  const renderingTabs = tabs.filter(tab => {
    if (tab.canShow == undefined) {
      return true;
    }
    return tab.canShow;
  });

  return (
    <div className="w-full">
      <div className="sm:hidden flex flex-row justify-between w-full">
        <Dropdown
          className="w-full"
          choices={renderingTabs.map(tab => ({ name: tab.name, id: tab.name, icon: tab.icon }))}
          defaultValue={renderingTabs.find(a => a.current)?.name || ''}
          onChange={(name) => { router.push(renderingTabs.find(a => a.name == name)?.href || '') }}
        />

        <div className="">{children}</div>
      </div>
      <div className="hidden sm:block">
        <div className="flex flex-row justify-between align-middle border-b transition dark:border-gray-800 border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {renderingTabs.map((tab) => (
              <Link
                key={tab.name}
                href={tab.href}
                className={classNames(
                  tab.current
                    ? `border-blue-500 text-${workspace?.brandColor || 'blue'}-600 dark:text-${workspace?.brandColor || 'blue'}-400 dark:border-${workspace?.brandColor || 'blue'}-400`
                    : 'border-transparent text-gray-500 hover:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
                  'transition group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                )}
                aria-current={tab.current ? 'page' : undefined}
              >
                <tab.icon
                  className={classNames(
                    tab.current
                      ? `text-${workspace?.brandColor || 'blue'}-500`
                      : 'text-gray-400 transition dark:text-gray-600 group-transition hover:text-gray-500',
                    '-ml-0.5 mr-2 h-5 w-5',
                  )}
                  aria-hidden="true"
                />
                <span>{tab.name}</span>
              </Link>
            ))}
          </nav>

          <div className="align-middle self-center">{children}</div>
        </div>
      </div>
    </div>
  );
}
