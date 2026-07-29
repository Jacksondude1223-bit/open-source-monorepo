import { WithId } from "mongodb";
import { readminCollections } from "~/services/mongo.service";
import {
  PosConfig,
  PosTheme,
  PosPricing,
  PosQueue,
} from "~/services/NewMongoTypes/PosConfig.type";
import { Product } from "~/services/NewMongoTypes/Product.type";
import { ProductCategory } from "~/services/NewMongoTypes/ProductCategory.type";
import { DeviceProfile } from "~/services/NewMongoTypes/DeviceProfile.type";

// The resolved (merged) config a station sees. Structurally a PosConfig minus
// the persistence-only fields, but we just reuse PosConfig for simplicity.
export type ResolvedPosConfig = PosConfig;

export type CatalogPayload = {
  products: WithId<Product>[];
  categories: WithId<ProductCategory>[];
  config: ResolvedPosConfig;
  // Web-managed device profiles, synced so in-game devices resolve their config
  // by `key` instead of needing Studio edits.
  deviceProfiles: WithId<DeviceProfile>[];
  catalogVersion: number;
};

const DEFAULT_THEME: PosTheme = {
  accent: "#3b82f6",
  background: "#090b12",
  surface: "#11141f",
  textPrimary: "#edf0f8",
  textSecondary: "#9ca3b8",
  cornerRadius: "rounded",
};

const DEFAULT_PRICING: PosPricing = {
  mode: "cosmetic",
  currencySymbol: "$",
  showPrices: true,
};

const DEFAULT_QUEUES: PosQueue[] = [
  { id: "front_counter", name: "Front Counter" },
];

// The factory default a workspace gets before it has ever saved POS settings.
// `catalogVersion` starts at 1; it is the single group-level version counter
// (stored on the workspace-default doc) bumped on any catalog/config change.
export function defaultPosConfig(groupId: string): ResolvedPosConfig {
  return {
    groupId,
    venueMode: "restaurant",
    pricing: { ...DEFAULT_PRICING },
    theme: { ...DEFAULT_THEME },
    queues: DEFAULT_QUEUES.map((q) => ({ ...q })),
    kiosk: { enabled: false },
    register: { enabled: true },
    prepFlow: { requireClaim: true, awaitingPickupStep: false },
    catalogVersion: 1,
    created: new Date(),
  };
}

// The insert body used when a catalog bump has to lazily create the
// workspace-default doc. Omits `catalogVersion` (the $inc owns it) and the
// filter-supplied `groupId`.
function defaultPosConfigSeed(): Omit<
  ResolvedPosConfig,
  "groupId" | "catalogVersion" | "_id" | "gameId"
> {
  return {
    venueMode: "restaurant",
    pricing: { ...DEFAULT_PRICING },
    theme: { ...DEFAULT_THEME },
    queues: DEFAULT_QUEUES.map((q) => ({ ...q })),
    kiosk: { enabled: false },
    register: { enabled: true },
    prepFlow: { requireClaim: true, awaitingPickupStep: false },
    created: new Date(),
  };
}

// Deep-merge a per-game override onto the workspace default. Semantics (per the
// plan's "open questions"): scalars override, nested objects merge field-by-field
// (a partial override only changes the fields it sets), and arrays like `queues`
// REPLACE wholesale when present on the override.
function mergeConfig(
  base: ResolvedPosConfig,
  override: WithId<PosConfig> | null,
): ResolvedPosConfig {
  if (!override) {
    return { ...base, _id: base._id, gameId: undefined };
  }
  return {
    ...base,
    gameId: override.gameId,
    venueMode: override.venueMode ?? base.venueMode,
    pricing: { ...base.pricing, ...override.pricing },
    theme: { ...base.theme, ...override.theme },
    queues:
      override.queues && override.queues.length ? override.queues : base.queues,
    kiosk: { ...base.kiosk, ...override.kiosk },
    register: { ...base.register, ...override.register },
    prepFlow: { ...base.prepFlow, ...override.prepFlow },
  };
}

// Resolve the config a station should use. Workspace default (gameId absent)
// deep-merged with the optional per-game override. The catalog version is always
// group-level (the default's), since the product catalog is shared across games.
export async function resolvePosConfig(
  groupId: string,
  gameId?: string,
): Promise<ResolvedPosConfig> {
  const [workspaceDefault, gameOverride] = await Promise.all([
    readminCollections.pos_config.findOne({
      groupId,
      gameId: { $exists: false },
    }),
    gameId
      ? readminCollections.pos_config.findOne({ groupId, gameId })
      : Promise.resolve(null),
  ]);

  const base: ResolvedPosConfig = workspaceDefault ?? defaultPosConfig(groupId);
  const merged = mergeConfig(base, gameOverride);
  // Catalog version is group-level — always the workspace default's.
  merged.catalogVersion = base.catalogVersion;
  return merged;
}

export async function getWorkspaceDefaultConfig(
  groupId: string,
): Promise<ResolvedPosConfig> {
  const doc = await readminCollections.pos_config.findOne({
    groupId,
    gameId: { $exists: false },
  });
  return doc ?? defaultPosConfig(groupId);
}

// Bump the single group-level catalog version. Lazily creates the
// workspace-default doc if it doesn't exist yet. Returns the new version.
export async function bumpCatalogVersion(groupId: string): Promise<number> {
  const res = await readminCollections.pos_config.findOneAndUpdate(
    { groupId, gameId: { $exists: false } },
    {
      $inc: { catalogVersion: 1 },
      $setOnInsert: defaultPosConfigSeed(),
    },
    { upsert: true, returnDocument: "after" },
  );
  return res?.catalogVersion ?? 1;
}

// Active (non-archived) products + categories for a group, sorted for display.
export async function getCatalogProducts(groupId: string) {
  const [products, categories] = await Promise.all([
    readminCollections.product
      .find({ groupId, archived: false })
      .sort({ sortOrder: 1 })
      .toArray(),
    readminCollections.product_category
      .find({ groupId })
      .sort({ sortOrder: 1 })
      .toArray(),
  ]);
  return { products, categories };
}

// The full bootstrap payload: resolved config + catalog + version. Used by the
// REST `/v2/pos/bootstrap` route and returned in the sync `orders.catalog`
// block when the client's cached version is stale.
export async function getCatalogPayload(
  groupId: string,
  gameId?: string,
): Promise<CatalogPayload> {
  const [{ products, categories }, config, deviceProfiles] = await Promise.all([
    getCatalogProducts(groupId),
    resolvePosConfig(groupId, gameId),
    readminCollections.device_profile
      .find({ groupId, enabled: true })
      .sort({ sortOrder: 1 })
      .toArray(),
  ]);
  return {
    products,
    categories,
    config,
    deviceProfiles,
    catalogVersion: config.catalogVersion,
  };
}
