/* eslint-disable @next/next/no-img-element */
import { Fragment, PropsWithChildren, useState } from 'react'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import {
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { HomeIcon, Bars3Icon, UsersIcon, BoltIcon, ClipboardDocumentIcon, DocumentTextIcon, BriefcaseIcon, MagnifyingGlassIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/20/solid';
import classNames from '~/utils/classNames';
import { useRouter } from 'next/router'
import { useUser } from '~/components/contexts/user'
import AppShellSkeleton from '~/components/ui/AppShellSkeleton'
import { CheckBadgeIcon, ServerStackIcon, ChartBarIcon } from '@heroicons/react/24/solid'
import { trpc } from '~/utils/trpc'
import Link from 'next/link'
import React from 'react'
import AuthedAlerts, { WorkspaceBanners } from '../page_components/alerts'
import posthog from 'posthog-js'
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'


export default function AuthedLayout({
  children,
  disableMl = false,
  overwriteImage,
  brandColor = 'blue',
  navigation = [
    { name: 'Workspaces', href: '/dashboard', icon: HomeIcon, current: true },
  ],
}: PropsWithChildren<{
  disableMl?: boolean;
  brandLogo?: string;
  brandColor?: BrandColors;
  overwriteImage?: false | string;
  navigation?: { name: string; href: string; icon: any; current: boolean; faIcon?: boolean; canShow?: boolean; premiumOnly?: boolean; }[];
}>) {


  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persisted desktop collapse state so the primary nav can shrink to an icon
  // rail. Initialized lazily from localStorage to avoid a flash of the expanded
  // sidebar before collapsing on mount.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('primarySidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('primarySidebarCollapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const { data: userWorkspaces } = trpc.workspaces.getUsersWorkspaces.useQuery(undefined, { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false });

  const workspaces = userWorkspaces ? userWorkspaces.map(workspace => {
    return {
      id: workspace.groupId,
      name: workspace?.groupName,
      href: `/workspaces/${workspace.groupId}`,
      inital: workspace?.groupName?.substring(0, 1),
      current: router.asPath.startsWith(`/workspaces/${workspace.groupId}`),
      thumbnail: workspace.group.thumbnail,
      isVerified: workspace.isVerified
    }
  }) : []

  const user = useUser();
  if ('loading' in user) {
    return <AppShellSkeleton />;
  }

  const path = router.asPath;


  if (user.loggedIn == false) {
    if (router.isReady && typeof window !== 'undefined') {
      router.push(`/login?state=${encodeURIComponent(path)}`);
    }
    return <></>;
  }

  if (user.user.dbUser?.isModerated !== false && user.user.dbUser?.isModerated?.is == true) {
    if (router.asPath.includes('/moderated') == false) {
      if (router.isReady && typeof window !== 'undefined') {
        router.push(`/moderated`);
      }
    }
    navigation = [];
  }
  if (user.user.dbUser.role == 'Founder' && (router.asPath.startsWith('/dashboard') || router.asPath.startsWith('/admin'))) {
    navigation = [
      {
        name: 'Dashboard',
        href: `/dashboard`,
        icon: HomeIcon,
      },
      { name: 'Form Submissions', href: '/dashboard/applications', icon: ClipboardDocumentIcon },
      { name: 'My Resume', href: '/dashboard/resume', icon: DocumentTextIcon },
      { name: 'Job Applications', href: '/dashboard/job-applications', icon: BriefcaseIcon },
      { name: 'Browse Postings', href: '/postings', icon: MagnifyingGlassIcon },
      {
        name: 'Users',
        href: `/admin`,
        icon: UsersIcon,
      },
      {
        name: 'Workspaces',
        href: `/admin/workspaces`,
        icon: ServerStackIcon,
      },
      {
        name: 'Founder Statistics',
        href: `/admin/game-stats`,
        icon: ChartBarIcon,
        current: path === '/admin/game-stats',
      },
      {
        name: 'Site Alerts',
        href: `/admin/alerts`,
        icon: BoltIcon,
      },
    ].map((p) => {
      return {
        ...p,
        current: path == p.href,
      }
    });
  }


  return (
    <>
      <div className={`first-letter:h-screen transition bg-white dark:bg-gray-900 dark:text-gray-100 ${user?.user?.dbUser?.darkMode ? 'dark' : ''}`}>
        <Transition show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-30 lg:hidden" onClose={setSidebarOpen}>
            <TransitionChild
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </TransitionChild>

            <div className="fixed inset-0 flex">
              <TransitionChild
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <TransitionChild
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </TransitionChild>
                  {/* Sidebar component, swap this element with another sidebar if you like */}
                  <div className={`flex grow flex-col gap-y-5 overflow-y-auto bg-${brandColor}-600 px-6 pb-2`}>
                    <div className="flex h-16 shrink-0 items-center">

                      <img
                        className={`w-auto ${!(overwriteImage == false || overwriteImage == undefined || !overwriteImage) ? 'rounded-lg h-14 mt-2 max-h-14 max-w-14' : 'h-8'}`}
                        src={(overwriteImage == false || overwriteImage == undefined || !overwriteImage)
                          ? `https://cdn.readmin.app/readmin-public/RA-White-RA.png`
                          : overwriteImage}
                        alt="ReAdmin"
                      />
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                              <React.Fragment key={item.name}>
                                {(item?.canShow || item?.canShow == null) && (
                                  <li key={item.name}>
                                    <Link
                                      href={item.href}
                                      className={classNames(
                                        item.current
                                          ? `bg-${brandColor}-700 text-white`
                                          : `text-${brandColor}-200 hover:text-white hover:bg-${brandColor}-700`,
                                        'group flex justify-between gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                      )}
                                    >
                                      <div className='flex flex-row gap-2 justify-center'>
                                        {item?.faIcon == true ? (
                                          <FontAwesomeIcon
                                            icon={item.icon}
                                            className={classNames(
                                              item.current ? 'text-white' : `text-${brandColor}-200 group-hover:text-white`,
                                              'h-full! w-6 shrink-0'
                                            )}
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <item.icon
                                            className={classNames(
                                              item.current ? 'text-white' : `text-${brandColor}-200 group-hover:text-white`,
                                              'h-6 w-6 shrink-0'
                                            )}
                                            aria-hidden="true"
                                          />
                                        )}
                                        <p className='self-center'>{item.name}</p>
                                      </div>
                                      {item?.premiumOnly && (
                                        <span className={classNames(
                                          item.current
                                            ? `bg-${brandColor}-700 text-white`
                                            : `bg-${brandColor}-700 text-${brandColor}-300`,
                                          'rounded p-0.5 px-1 text-sm font-medium'
                                        )}>
                                          Premium Only
                                        </span>
                                      )}
                                    </Link>
                                  </li>
                                )}
                              </React.Fragment>
                            ))}
                          </ul>
                        </li>
                        {user.user.dbUser.isModerated == false && (
                          <li>
                            <div className={`text-xs font-semibold leading-6 text-${brandColor}-200`}>{workspaces.length !== 0 && "Your workspaces"}</div>
                            <ul role="list" className="-mx-2 mt-2 space-y-1">
                              {workspaces.map((team) => (
                                <li key={team.name}>
                                  <Link
                                    href={team.href}
                                    onClick={() => {

                                      router.push(`/workspaces/${team.id}`);
                                      try {
                                        posthog.capture('view-workspace', { groupId: team.id })
                                        posthog.group('workspace', team.id, { name: team.name })
                                      } catch (e) {

                                      }
                                    }}
                                    className={classNames(
                                      team.current
                                        ? `bg-${brandColor}-700 text-white`
                                        : `text-${brandColor}-200 hover:text-white hover:bg-${brandColor}-700`,
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                    )}
                                  >
                                    <img src={team.thumbnail} alt="Group thumbnail" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-${brandColor}-400 bg-${brandColor}-500 text-[0.625rem] font-medium text-white`} />
                                    <span className="truncate">{team.name}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        )}
                      </ul>
                    </nav>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>


        {/* Static sidebar for desktop */}
        <div className={classNames(
          collapsed ? 'lg:w-20' : 'lg:w-72',
          'hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col transition-[width] duration-200 ease-in-out'
        )}>
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className={`relative flex grow flex-col gap-y-5 overflow-y-auto overflow-x-hidden bg-${brandColor}-600 ${collapsed ? 'px-3' : 'px-6'} transition-[padding] duration-200`}>
            <div className={classNames(collapsed ? 'justify-center' : 'justify-between', 'flex h-16 shrink-0 items-center')}>
              <Link href="/dashboard">
                <img
                  className={`w-auto ${!(overwriteImage == false || overwriteImage == undefined || !overwriteImage) ? `rounded-lg ${collapsed ? 'h-9' : 'h-14 mt-2'}` : 'h-8'}`}
                  src={(overwriteImage == false || overwriteImage == undefined || !overwriteImage)
                    ? `https://cdn.readmin.app/readmin-public/RA-White-RA.png`
                    : overwriteImage}
                  alt="ReAdmin"
                />
              </Link>
            </div>

            {/* Collapse / expand toggle */}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`absolute right-2 top-3 z-10 rounded-md p-1 text-${brandColor}-200 hover:bg-${brandColor}-700 hover:text-white transition ${collapsed ? 'hidden' : ''}`}
            >
              <ChevronDoubleLeftIcon className="h-4 w-4" aria-hidden="true" />
            </button>

            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {collapsed && (
                      <li>
                        <button
                          type="button"
                          onClick={toggleCollapsed}
                          title="Expand sidebar"
                          aria-label="Expand sidebar"
                          className={`group flex w-full items-center justify-center rounded-md p-2 text-${brandColor}-200 hover:bg-${brandColor}-700 hover:text-white transition`}
                        >
                          <ChevronDoubleRightIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    )}
                    {navigation.map((item) => (item?.canShow || item?.canShow == null) && (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          title={collapsed ? item.name : undefined}
                          aria-current={item.current ? 'page' : undefined}
                          className={classNames(
                            item.current
                              ? `bg-${brandColor}-700 text-white`
                              : `text-${brandColor}-200 hover:text-white hover:bg-${brandColor}-700`,
                            collapsed ? 'justify-center' : 'justify-between',
                            'group relative flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors'
                          )}
                        >
                          {item.current && (
                            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-white/90" aria-hidden="true" />
                          )}
                          <div className={classNames(collapsed ? 'justify-center' : '', 'flex flex-row gap-2')}>
                            {item?.faIcon == true ? (
                              <FontAwesomeIcon
                                icon={item.icon}
                                className={classNames(
                                  item.current ? 'text-white' : `text-${brandColor}-200 group-hover:text-white`,
                                  'h-full! w-6 shrink-0'
                                )}
                                aria-hidden="true"
                              />
                            ) : (
                              <item.icon
                                className={classNames(
                                  item.current ? 'text-white' : `text-${brandColor}-200 group-hover:text-white`,
                                  'h-6 w-6 shrink-0'
                                )}
                                aria-hidden="true"
                              />
                            )}
                            {!collapsed && <p className='self-center'>{item.name}</p>}
                          </div>
                          {!collapsed && item?.premiumOnly && (
                            <span className={classNames(
                              item.current
                                ? `bg-${brandColor}-700 text-white`
                                : `bg-${brandColor}-700 text-${brandColor}-300`,
                              'rounded p-0.5 px-1 text-sm font-medium'
                            )}>
                              Premium Only
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
                {user.user.dbUser.isModerated == false && (
                  <li>
                    {!collapsed && workspaces.length !== 0 && (
                      <div className={`px-2 text-xs font-semibold uppercase tracking-wider leading-6 text-${brandColor}-200`}>Your workspaces</div>
                    )}
                    {collapsed && workspaces.length !== 0 && (
                      <div className={`mx-2 mb-1 border-t border-${brandColor}-500`} aria-hidden="true" />
                    )}
                    <ul role="list" className="-mx-2 mt-2 space-y-1">
                      {workspaces.map((team) => (
                        <li key={team.name}>
                          <Link
                            href={team.href}
                            title={collapsed ? team.name : undefined}
                            aria-current={team.current ? 'page' : undefined}
                            onClick={() => {
                              router.push(`/workspaces/${team.id}`);
                              try {
                                posthog.capture('view-workspace', { groupId: team.id })
                                posthog.group('workspace', team.id, { name: team.name })
                              } catch (e) {

                              }
                            }}
                            className={classNames(
                              team.current
                                ? `bg-${brandColor}-700 text-white`
                                : `text-${brandColor}-200 hover:text-white hover:bg-${brandColor}-700`,
                              collapsed ? 'justify-center' : '',
                              'group relative flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors'
                            )}
                          >
                            {team.current && (
                              <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-white/90" aria-hidden="true" />
                            )}
                            <img src={team.thumbnail} alt="Group thumbnail" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-${brandColor}-400 bg-${brandColor}-500 text-[0.625rem] font-medium text-white`} />
                            {!collapsed && <span className="truncate flex flex-row gap-1">{team.isVerified && (<CheckBadgeIcon className="w-4 h-4 self-center" />)} {team.name}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                <li className={classNames(collapsed ? 'mx-0' : '-mx-6', 'mt-auto w-full')}>
                  <button
                    className={classNames(
                      collapsed ? 'justify-center gap-x-0 px-0 rounded-md' : 'gap-x-4 px-6',
                      `flex items-center w-full py-3 text-sm font-semibold leading-6 text-white hover:bg-${brandColor}-700 transition-colors`
                    )}
                    title={collapsed ? user.user.dbUser.name : undefined}
                    onClick={() => {
                      router.push('/dashboard/settings')
                    }}>
                    <img
                      className={`h-8 w-8 shrink-0 rounded-full bg-${brandColor}-700`}
                      src={user.user.dbUser.thumbnail}
                      alt=""
                    />
                    <span className="sr-only">Your profile</span>
                    {!collapsed && <span aria-hidden="true" className="truncate">{user.user.dbUser.name}</span>}
                  </button>
                </li>
              </ul>



              {/* {!disableMl && ( */}
              {!collapsed && (
                <footer className="mt-2">
                  <div className={`border-t border-${brandColor}-500 py-3 text-center text-sm transition text-gray-100 sm:text-left`}>
                    <p className="text-gray-300 text-xs text-center">
                      &copy; {new Date().getFullYear()} ReAdmin, LLC. All rights reserved.
                    </p>
                    <p className={`mt-1 text-xs text-${brandColor}-300 text-center`}>
                      {/* {constants.VERCEL_GIT_COMMIT_SHA ? `${constants.VERCEL_GIT_COMMIT_SHA} - ${constants.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE}` : `Development Build - ${user.user.roblox?.id}`} */}
                    </p>
                    <div className='flex flex-row flex-wrap gap-2 mt-2 text-center justify-center mb-2'>
                      <Link className={`text-xs font-medium text-gray-100 hover:text-${brandColor}-400 transition`} target="_blank" href="https://readmin.app/legal/terms">Terms of Service</Link>
                      <Link className={`text-xs font-medium text-gray-100 hover:text-${brandColor}-400 transition`} target="_blank" href="https://readmin.app/legal/privacy">Privacy Policy</Link>
                      <Link className={`text-xs font-medium text-gray-100 hover:text-${brandColor}-400 transition`} target="_blank" href="https://discord.gg/readmin-845829826626584606">Support Server</Link>
                      <Link className={`text-xs font-medium text-gray-100 hover:text-${brandColor}-400 transition`} target="_blank" href="https://docs.readmin.app/">Documentation</Link>
                      <Link className={`text-xs font-medium text-gray-100 hover:text-${brandColor}-400 transition`} target="_blank" href="https://www.roblox.com/groups/10792229/ReAdmin#!/about">Group</Link>
                    </div>
                  </div>
                </footer>
              )}
              {/* )} */}
            </nav>
          </div>
        </div>

        <div className={`sticky top-0 z-30 flex items-center gap-x-6 bg-${brandColor}-600 px-4 py-4 shadow-xs sm:px-6 lg:hidden`}>
          <button type="button" className={`-m-2.5 p-2.5 ${brandColor}-blue-200 lg:hidden`} onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-sm font-semibold leading-6 text-white"></div>
          <button onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}>
            <span className="sr-only">Signout</span>
            <img
              className={`h-8 w-8 rounded-full bg-${brandColor}-700`}
              src={user.user.dbUser.thumbnail}
              alt="Signout"
            />
          </button>
        </div>

        <main className={`${!disableMl ? 'py-10' : ''} ${collapsed ? 'lg:pl-20' : 'lg:pl-72'} h-full min-h-screen first-letter:h-screen transition-[padding] duration-200 bg-white dark:bg-gray-900 dark:text-gray-100`}>

          <div className={`${!disableMl ? 'px-4 sm:px-6 lg:px-8' : ''} h-full`}>
            {!disableMl && (
              <AuthedAlerts />
            )}
            {!disableMl && (
              <WorkspaceBanners />
            )}
            {children}
          </div>
        </main >


      </div >
    </>
  )
}
