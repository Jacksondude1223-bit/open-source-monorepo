import { ObjectId } from "mongodb";

// Default register behaviour for a station. Individual in-game stations can
// override this per-device, but this is the workspace/per-game default.
export type PosVenueMode = "restaurant" | "retail";

// How prices are treated:
//  - cosmetic:      prices shown for flavour, nothing is charged
//  - currency_hook: prices shown and the game's currency callbacks are invoked
//  - free:          every price label + totals row is hidden in-game
export type PosPricingMode = "cosmetic" | "currency_hook" | "free";

export type PosCornerRadius = "sharp" | "rounded" | "pill";

export type PosPricing = {
  mode: PosPricingMode;
  currencySymbol: string;
  showPrices: boolean;
};

// Web-managed theme synced live to the in-game POS at bootstrap (the
// differentiator vs easyPOS, where theming means editing Studio). All colours
// are hex strings (e.g. "#3b82f6"); validated against Enum.Font on the client.
export type PosTheme = {
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  font?: string; // validated Enum.Font name, e.g. "GothamMedium"
  logoAssetId?: string; // Roblox image asset id for the POS logo
  cornerRadius: PosCornerRadius;
};

// A named order queue. Registers/boards/kiosks bind to a queue by id so a single
// venue can run e.g. a front_counter line and a drive_thru line independently.
export type PosQueue = {
  id: string;
  name: string;
};

export type PosKiosk = {
  enabled: boolean;
  idleText?: string; // attract-screen copy shown when the kiosk is idle
};

export type PosRegister = {
  enabled: boolean;
};

export type PosPrepFlow = {
  requireClaim: boolean; // claim -> complete vs straight-to-complete
  awaitingPickupStep: boolean; // insert an awaiting_customer step before handover
};

// One workspace-default document (gameId absent) plus optional per-game override
// documents. The resolved config a station sees = deep-merge of the per-game
// override onto the workspace default (scalars override, arrays like `queues`
// replace wholesale). `catalogVersion` is bumped on ANY product/category/config
// change so games can cheaply detect a stale cache.
export type PosConfig = {
  _id?: ObjectId;
  groupId: string;
  gameId?: string; // absent = workspace default
  venueMode: PosVenueMode;
  pricing: PosPricing;
  theme: PosTheme;
  queues: PosQueue[];
  kiosk: PosKiosk;
  register: PosRegister;
  prepFlow: PosPrepFlow;
  catalogVersion: number;
  created: Date;
  lastModified?: Date;
  lastModifiedBy?: string;
};
