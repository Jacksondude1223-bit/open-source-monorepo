import { z } from 'zod';
import { DepartmentPermissions } from '~/services/NewMongoTypes/Department.type';

export const WORKSPACE_OWNER_PERMISSIONS: DepartmentPermissions = {
  feed: {
    postPublic: true,
    postDepartment: true,
  },
  activity: {
    view: true,
    createInactivity: true,
    approveInactivity: true,
    manageInactivity: true,
    viewTimeOffReasons: true,
    ranking: true,
    admin: true,
    requestInactivityForOtherUsers: true,
  },
  writeUps: {
    promote: true,
    writeUps: true,
    suspensions: true,
    terminations: true,
    delete: true,
    demote: true,
    approval_required: true,
    approver: true,
    viewHidden: true,
  },
  profile: {
    view: true,
    edit: true,
  },
  knowledgeHub: {
    manage: true,
  },
  reports: {
    view: true,
    export: true,
  },
  games: {
    view: true,
    manageBans: true,
    admin: true,
  },
  sessions: {
    view: true, // Allow user to view sessions
    manage: true, // Allow user to manage sessions
    createOneTime: true,
    attendance: true, // Allow user to view the session attendance grid
  },
  calls: {
    view: true,
    manage: true,
    deleteBans: true,
  },
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
  tasks: {
    assign: true,
  },
  teams: {
    view: true,
    manage: true,
    manageAll: true,
    approve: true,
  },
  postings: {
    canManage: true,
    canViewApplicants: true,
  },
  timeclock: {
    clock: true,
    view: true,
    manage: true,
    edit: true,
  },
  orders: {
    view: true,
    manage: true,
    manageProducts: true,
    manageSettings: true,
  },
  admin: true,
};
export const WORKSPACE_NO_ACCESS_PERMISSIONS: DepartmentPermissions = {
  feed: {
    postPublic: false,
    postDepartment: false,
  },
  activity: {
    view: false,
    createInactivity: false,
    approveInactivity: false,
    manageInactivity: false,
    viewTimeOffReasons: false,
    ranking: false,
    admin: false,
    requestInactivityForOtherUsers: false,
  },
  writeUps: {
    promote: false,
    writeUps: false,
    suspensions: false,
    terminations: false,
    delete: false,
    demote: false,
    approval_required: false,
    approver: false,
    viewHidden: false,
  },
  profile: {
    view: false,
    edit: false,
  },
  knowledgeHub: {
    manage: false,
  },
  reports: {
    view: false,
    export: false,
  },
  games: {
    view: false,
    manageBans: false,
    admin: false,
  },
  sessions: {
    view: false, // Allow user to view sessions
    manage: false, // Allow user to manage sessions
    createOneTime: false,
    attendance: false, // Allow user to view the session attendance grid
  },
  calls: {
    view: false,
    manage: false,
    deleteBans: false,
  },
  applications: {
    viewApplications: false,
    readApplications: false,
    editApplications: false,
  },
  promotionRequests: {
    view: false,
    create: false,
    viewClosed: false,
    delete: false,
    manage: false,
  },
  tasks: {
    assign: false,
  },
  teams: {
    view: false,
    manage: false,
    manageAll: false,
    approve: false,
  },
  postings: {
    canManage: false,
    canViewApplicants: false,
  },
  timeclock: {
    clock: false,
    view: false,
    manage: false,
    edit: false,
  },
  orders: {
    view: false,
    manage: false,
    manageProducts: false,
    manageSettings: false,
  },
  admin: false,
};

export const ZodDepartmentPermisisons = z.custom<DepartmentPermissions>();
