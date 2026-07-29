import { OrderStatus } from "~/services/NewMongoTypes/Order.type";

// The set of actions that move an order through its lifecycle. One action ==
// one validated transition; the REST `/transition` endpoint and the sync
// `transition` op both resolve to exactly one of these.
export type OrderAction =
  | "claim"
  | "release"
  | "complete"
  | "cancel"
  | "set_awaiting_pickup"
  | "hand_to_customer";

type TransitionRule = {
  // Statuses an order MUST currently be in for this action to be legal. This is
  // applied as a `findOneAndUpdate` precondition so concurrent actors (bumpbar +
  // touch + kiosk) racing the same order resolve atomically — the loser gets a
  // conflict instead of a double-apply.
  from: OrderStatus[];
  to: OrderStatus;
  // Optional dedicated timestamp field on the Order to stamp with the transition time.
  timestamp?: "claimed" | "prepared" | "finished" | "completed";
  // Whether the acting user becomes the order's `preparedBy`.
  setPreparedBy?: boolean;
};

// The canonical state machine. Terminal statuses (`cancelled`,
// `handed_to_customer`) have no outgoing rule. Retail/instant-complete orders
// are created already in a finished status and never traverse this table.
export const ORDER_TRANSITIONS: Record<OrderAction, TransitionRule> = {
  claim: {
    from: ["submitted", "released"],
    to: "claimed",
    timestamp: "claimed",
    setPreparedBy: true,
  },
  release: {
    from: ["claimed"],
    to: "released",
  },
  complete: {
    from: ["submitted", "claimed", "released"],
    to: "completed",
    timestamp: "completed",
  },
  set_awaiting_pickup: {
    from: ["claimed", "completed"],
    to: "awaiting_customer",
  },
  hand_to_customer: {
    from: ["submitted", "claimed", "released", "completed", "awaiting_customer"],
    to: "handed_to_customer",
    timestamp: "finished",
  },
  cancel: {
    from: ["submitted", "claimed", "released", "completed", "awaiting_customer"],
    to: "cancelled",
    timestamp: "finished",
  },
};

// Statuses an order is still "live" in and should appear on a board / register.
// Everything else (cancelled, handed_to_customer) is terminal and drops off.
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "submitted",
  "claimed",
  "released",
  "completed",
  "awaiting_customer",
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "cancelled",
  "handed_to_customer",
];

export function isValidAction(action: string): action is OrderAction {
  return Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, action);
}
