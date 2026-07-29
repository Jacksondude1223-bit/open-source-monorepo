'use client';

import { JSX, ReactNode, useCallback, useRef, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';
import Button, { ButtonVariants } from '~/components/forms/Button';

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Visual style of the confirm button. Defaults to `primary`. */
  confirmVariant?: ButtonVariants;
  /** Show a warning triangle icon next to the title. Defaults to true for danger. */
  destructive?: boolean;
};

type InternalState = ConfirmOptions & { open: boolean };

const DEFAULT_STATE: InternalState = { open: false, title: '' };

/**
 * Promise-based confirmation dialog that matches the app's Modal styling.
 *
 * Usage:
 * ```tsx
 * const [confirm, ConfirmDialog] = useConfirm();
 * // ...
 * if (!(await confirm({ title: 'Delete team?', destructive: true }))) return;
 * // ...
 * return (<>{ConfirmDialog}...</>);
 * ```
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, JSX.Element] {
  const [state, setState] = useState<InternalState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const isDestructive = state.destructive ?? state.confirmVariant === 'danger';

  const element = (
    <Modal open={state.open} setOpen={(v: boolean) => { if (!v) close(false); }} sizeOverride="sm">
      <div className="sm:flex sm:items-start">
        {isDestructive && (
          <div className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
        )}
        <div className={`mt-3 text-center sm:mt-0 sm:text-left ${isDestructive ? 'sm:ml-4' : ''} flex-1`}>
          <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">{state.title}</h3>
          {state.body && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{state.body}</div>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-4 sm:flex-row sm:justify-end">
        <Button variant="discrete" onClick={() => close(false)}>
          {state.cancelText ?? 'Cancel'}
        </Button>
        <Button
          variant={state.confirmVariant ?? (isDestructive ? 'danger' : 'primary')}
          onClick={() => close(true)}
        >
          {state.confirmText ?? 'Confirm'}
        </Button>
      </div>
    </Modal>
  );

  return [confirm, element];
}
