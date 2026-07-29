import { ObjectId } from "mongodb";

// Per-workspace banner / site alert. Distinct from the platform-wide
// `site_alert` collection (managed by ReAdmin founders) — these are created by
// workspace admins and only ever shown inside their own workspace. Banners can
// optionally be restricted to specific departments, carry an image attachment
// and a call-to-action link.
export type WorkspaceBanner = {
  _id?: ObjectId;
  id: string; // uuid, stable client-facing id (used for localStorage dismiss key)
  groupId: string; // workspace scope
  type: 'primary' | 'warning' | 'danger';
  title?: string;
  message: string;
  link?: string; // optional call-to-action URL
  linkMessage?: string; // label for the link
  // CDN object key for the optional image attachment. Stored private and
  // presigned on read (never a public URL).
  imageUrl?: string;
  closable?: boolean; // allow members to dismiss the banner locally
  enabled: boolean; // master on/off without deleting the banner
  // Department _ids the banner is shown to. Empty / undefined = every
  // department in the workspace sees it.
  departmentIds?: string[];
  createdBy: string; // robloxId of the admin who created it
  created: Date;
  updated?: Date;
};
