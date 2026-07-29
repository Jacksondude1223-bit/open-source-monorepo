/**
 * Tiny client-side event bus used to open the global call chat drawer (owned by
 * <OngoingCallsWidget/>) from anywhere in the app. Pages that start a call
 * (player cards, the user profile) emit a callId here instead of navigating to
 * the legacy /calls/[callId] page, and the always-mounted widget pops the chat
 * context menu in the top-right.
 */

export type OpenCallDrawerDetail = {
  callId: string;
};

const OPEN_CALL_DRAWER_EVENT = 'readmin:open-call-drawer';

export function openCallDrawer(callId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenCallDrawerDetail>(OPEN_CALL_DRAWER_EVENT, {
      detail: { callId },
    }),
  );
}

export function onOpenCallDrawer(handler: (detail: OpenCallDrawerDetail) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<OpenCallDrawerDetail>).detail;
    if (detail?.callId) {
      handler(detail);
    }
  };
  window.addEventListener(OPEN_CALL_DRAWER_EVENT, listener);
  return () => window.removeEventListener(OPEN_CALL_DRAWER_EVENT, listener);
}
