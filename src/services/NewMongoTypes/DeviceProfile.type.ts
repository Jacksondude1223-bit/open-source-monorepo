import { ObjectId } from "mongodb";
import { OrderSource } from "./Order.type";
import { PosVenueMode } from "./PosConfig.type";

export type DeviceType =
  | "register"
  | "kiosk"
  | "board"
  | "bumpbar"
  | "scanner"
  | "drivethru";

export type DeviceDisplayMode = "prompt" | "surface" | "both";

// A web-managed device configuration. This is the headline differentiator vs
// easyPOS, where every device is configured by hand-editing Lua `Settings`
// ModuleScripts in Studio (per-device whitelists, screen-id routing, etc.). Here
// a builder defines a profile on the website, drops a part in Studio, and points
// it at the profile by `key` (a `Profile` attribute) — or skips profiles
// entirely and relies on tag-and-go defaults. Profiles sync live with the
// catalog, so changing a device's queue/mode/range never requires a Studio edit.
//
// Resolution precedence in-game: explicit Studio attribute > profile field >
// built-in tag default.
export type DeviceProfile = {
  _id?: ObjectId;
  groupId: string;
  name: string; // human label shown on the web
  key: string; // stable slug, unique per group; referenced by a device's `Profile` attribute
  deviceType: DeviceType;
  queueId?: string; // which queue this device serves
  venueMode?: PosVenueMode; // restaurant / retail override
  display?: DeviceDisplayMode; // prompt (walk-up panel) / surface (on-part) / both
  boardTags?: string[]; // category routing ↔ board listening tags
  idleText?: string; // kiosk attract-screen text
  activationDistance?: number; // walk-up prompt reach in studs
  promptKey?: string; // key for the walk-up prompt (default "E")
  source?: OrderSource; // overrides created-order source
  enabled: boolean; // a disabled profile resolves to tag-and-go defaults
  sortOrder: number;
  created: Date;
  createdBy: string;
  lastModified?: Date;
  lastModifiedBy?: string;
};
