import { ObjectId } from "mongodb";

// A sellable item in a workspace's POS catalog. Catalog-only by design — there is
// no stock/inventory tracking (this matches the accepted norm for Roblox POS and
// keeps "grocery"/retail as scan-based checkout with infinite stock). Orders
// snapshot the product name + price at creation time, so archiving a product
// never breaks historical orders.
export type Product = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description?: string;
  imageAssetId?: string; // Roblox decal/image asset id, rendered via thumbnails.roblox.com
  price?: number; // absent = free / unpriced
  categoryId?: ObjectId; // ProductCategory this product belongs to
  toolName?: string; // optional: name of a Tool to hand the customer on completion (easyPOS parity)
  barcodeId?: string; // optional: short code matched by the retail scan mode
  queues?: string[]; // optional: when non-empty, the ONLY PosConfig.queues this product sells on (empty/absent = everywhere)
  sortOrder: number; // manual ordering within its category / the catalog
  enabled: boolean; // hidden from the POS when false, but still resolvable for historical orders
  archived: boolean; // soft delete — never hard-removed because orders reference it
  created: Date;
  createdBy: string; // robloxId of the staff member who created it
  lastModified?: Date;
  lastModifiedBy?: string;
};
