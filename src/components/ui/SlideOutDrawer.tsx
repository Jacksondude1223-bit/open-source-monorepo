import { Fragment } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface SlideOutDrawerProps {
    open: boolean;
    setOpen: any;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    position?: 'right' | 'left';
}

export default function SlideOutDrawer({
    open,
    setOpen,
    title,
    children,
    size = 'lg',
    position = 'right'
}: SlideOutDrawerProps) {
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    const slideDirection = position === 'right'
        ? { from: 'translate-x-full', to: 'translate-x-0' }
        : { from: '-translate-x-full', to: 'translate-x-0' };

    const positionClasses = position === 'right'
        ? 'inset-y-0 right-0 pl-10'
        : 'inset-y-0 left-0 pr-10';

    return (
        <Transition show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={setOpen}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className={`pointer-events-none fixed ${positionClasses} flex max-w-full`}>
                            <TransitionChild
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom={slideDirection.from}
                                enterTo={slideDirection.to}
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom={slideDirection.to}
                                leaveTo={slideDirection.from}
                            >
                                <DialogPanel className={`pointer-events-auto w-screen ${sizeClasses[size]}`}>
                                    <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-gray-900 shadow-xl">
                                        {/* Header */}
                                        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-6 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                    {title}
                                                </h2>
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                                    onClick={() => setOpen(false)}
                                                >
                                                    <span className="sr-only">Close panel</span>
                                                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="relative flex-1 px-4 py-6 sm:px-6">
                                            {children}
                                        </div>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
