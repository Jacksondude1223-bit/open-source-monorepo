import { Fragment, useRef } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';

export default function Modal({
  children,
  open,
  setOpen,
  sizeOverride = 'lg',
}: {
  children: React.ReactNode;
  open: boolean;
  sizeOverride?:
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl';
  setOpen: any;
}) {
  const cancelButtonRef = useRef(null);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-40"
        style={{
          zIndex: 50
        }}
        initialFocus={cancelButtonRef}
        onClose={setOpen}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel
                className={`relative transform rounded-xl bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 transition-all dark:text-gray-100 sm:my-8 sm:w-full max-w-${sizeOverride} sm:p-6`}
              >
                {children}
                <div className="hidden max-w-sm" />
                <div className="hidden max-w-md" />
                <div className="hidden max-w-lg" />
                <div className="hidden max-w-xl" />
                <div className="hidden max-w-2xl" />
                <div className="hidden max-w-3xl" />
                <div className="hidden max-w-4xl" />
                <div className="hidden max-w-5xl" />
                <div className="hidden max-w-6xl" />
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
