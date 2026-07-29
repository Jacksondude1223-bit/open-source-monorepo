import { ObjectId } from "mongodb";

export type OrderStatus =
  | "submitted"
  | "claimed"
  | "released"
  | "completed"
  | "cancelled"
  | "awaiting_customer"
  | "handed_to_customer";

// Where an order originated. Retail/api sources may skip prep entirely and be
// created already-completed (see the handler layer's instant-complete path).
export type OrderSource = "register" | "kiosk" | "drive_thru" | "api";

// A line item. Prices/names are SNAPSHOTTED at creation from the catalog — the
// client never sends prices, the server resolves them — so archiving/repricing a
// product never mutates historical orders. `productId` is kept for grouping/stats.
export type OrderItem = {
  productId: string;
  name: string;
  unitPrice?: number; // snapshot unit price; absent = unpriced/free
  quantity: number;
};

export type OrderLogEvent = {
  event: OrderStatus;
  userId: string;
  date: Date;
  // dedupe key of the op that produced this transition. A retried transition op
  // carrying a key already present in the log resolves to success (idempotent)
  // instead of failing the status precondition.
  idempotencyKey?: string;
};

export type Order = {
  _id?: ObjectId;
  groupId: string;
  distribution: number; // distribution period the order belongs to (for stats)
  gameId: string;
  placeId: string;
  schemaVersion: 2;

  // who
  customerId: string;
  cashierId?: string; // kiosk / drive-thru orders may have none
  preparedBy?: string;

  // routing / source
  source: OrderSource;
  queueId: string; // which queue the order lives in
  orderNumber: number; // short per-game daily counter for boards/receipts
  // dedupe key from the creating op; a retried sync tick carrying the same key
  // resolves to this same order instead of creating a duplicate (unique+sparse index)
  idempotencyKey?: string;

  // contents (snapshot)
  items: OrderItem[];
  total?: number; // snapshot at creation

  // lifecycle
  status: OrderStatus;
  log: OrderLogEvent[];
  involvedUsers: string[];
  created: Date;
  lastModified?: Date;
  claimed?: Date;
  prepared?: Date;
  finished?: Date;
  completed?: Date;
};
