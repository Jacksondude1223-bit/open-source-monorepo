import { DepartmentPermissions } from '~/services/NewMongoTypes/Department.type';
import {
  WORKSPACE_NO_ACCESS_PERMISSIONS,
  WORKSPACE_OWNER_PERMISSIONS,
} from '~/services/constants/WorkspaceOwnerPermissions';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Builds a full permissions object by deep-merging the provided overrides on top
 * of the "no access" baseline. This lets templates only specify the permissions
 * they grant.
 */
export function buildPermissions(
  overrides: DeepPartial<DepartmentPermissions>,
): DepartmentPermissions {
  const base: DepartmentPermissions = structuredClone(WORKSPACE_NO_ACCESS_PERMISSIONS);
  for (const key of Object.keys(overrides) as (keyof DepartmentPermissions)[]) {
    const value = overrides[key];
    if (value !== null && typeof value === 'object') {
      // @ts-expect-error deep merge of a permission group
      base[key] = { ...base[key], ...value };
    } else if (value !== undefined) {
      // @ts-expect-error scalar override (e.g. admin)
      base[key] = value;
    }
  }
  return base;
}

export type DepartmentTemplate = {
  id: string;
  name: string;
  description: string;
  permissions: DepartmentPermissions;
};

/**
 * Templates are modeled around the common Roblox staff rank tiers
 * (Low Rank, Medium Rank, High Rank) so admins can grant a sensible
 * starting set of permissions in one click, then fine-tune.
 */
export const DEPARTMENT_TEMPLATES: DepartmentTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch with no permissions and configure everything yourself.',
    permissions: structuredClone(WORKSPACE_NO_ACCESS_PERMISSIONS),
  },
  {
    id: 'lr',
    name: 'Low Rank (LR)',
    description:
      'Trial and junior staff. Can clock in, log their own inactivity, and handle basic in-game moderation.',
    permissions: buildPermissions({
      feed: { postDepartment: true },
      activity: { view: true, createInactivity: true },
      games: { view: true, manageBans: true },
      sessions: { view: true },
      calls: { view: true },
      timeclock: { clock: true },
    }),
  },
  {
    id: 'mr',
    name: 'Medium Rank (MR)',
    description:
      'Senior moderators and admins. Adds sessions, calls, write-ups/suspensions, and reporting on top of LR access.',
    permissions: buildPermissions({
      feed: { postPublic: true, postDepartment: true },
      activity: {
        view: true,
        createInactivity: true,
        requestInactivityForOtherUsers: true,
        viewTimeOffReasons: true,
        ranking: true,
      },
      writeUps: {
        writeUps: true,
        suspensions: true,
      },
      reports: { view: true },
      games: { view: true, manageBans: true },
      sessions: { view: true, manage: true, createOneTime: true },
      calls: { view: true, manage: true },
      applications: { viewApplications: true, readApplications: true },
      promotionRequests: { view: true, create: true },
      timeclock: { clock: true, view: true },
    }),
  },
  {
    id: 'hr',
    name: 'High Rank (HR)',
    description:
      'Leadership and management. Adds promotions, terminations, application management, inactivity management, and teams.',
    permissions: buildPermissions({
      feed: { postPublic: true, postDepartment: true },
      activity: {
        view: true,
        createInactivity: true,
        approveInactivity: true,
        requestInactivityForOtherUsers: true,
        manageInactivity: true,
        viewTimeOffReasons: true,
        ranking: true,
        admin: true,
      },
      writeUps: {
        promote: true,
        demote: true,
        writeUps: true,
        suspensions: true,
        terminations: true,
        approver: true,
        delete: true,
        viewHidden: true,
      },
      knowledgeHub: { manage: true },
      reports: { view: true, export: true },
      games: { view: true, manageBans: true, admin: true },
      sessions: { view: true, manage: true, createOneTime: true },
      calls: { view: true, manage: true },
      applications: {
        viewApplications: true,
        readApplications: true,
        editApplications: true,
      },
      promotionRequests: {
        view: true,
        create: true,
        viewClosed: true,
        delete: true,
        manage: true,
      },
      tasks: { assign: true },
      teams: { view: true, manage: true, manageAll: true, approve: true },
      postings: { canManage: true, canViewApplicants: true },
      timeclock: { clock: true, view: true, manage: true, edit: true },
      orders: { view: true, manage: true, manageProducts: true, manageSettings: true },
      profile: { view: true, edit: true },
    }),
  },
  {
    id: 'full-admin',
    name: 'Full Admin',
    description: 'Complete access to every feature, including workspace administration. Best for owners.',
    permissions: structuredClone(WORKSPACE_OWNER_PERMISSIONS),
  },
];
