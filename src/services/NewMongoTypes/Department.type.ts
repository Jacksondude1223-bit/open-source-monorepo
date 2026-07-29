import { ObjectId } from "mongodb";
import { WORKSPACE_OWNER_PERMISSIONS } from "../constants/WorkspaceOwnerPermissions";
import { BrandColors } from "./Workspace.type";

export type DepartmentPermissions = {
  feed: {
    postPublic: boolean; // Allow user to post to workspace feed
    postDepartment: boolean; // Allow user to post to department only feed
  };
  activity: {
    view: boolean; // Allows user to view other users activity
    createInactivity: boolean; // Allow user to create inactivity request. (beuh whos idea was this)
    approveInactivity: boolean; // Automatically approve inactivity requests
    requestInactivityForOtherUsers?: boolean; // Allow user to request inactivity for other users
    manageInactivity: boolean; // Allows user to manage inactivity requests
    viewTimeOffReasons?: boolean; // Allow user to read other users' time-off reasons
    ranking: boolean; // Allow user to rank other users
    admin: boolean; // Manage other users times
  };
  writeUps: {
    writeUps: boolean; // allow user to manage write ups
    suspensions: boolean; // allow user to manage suspensions
    terminations: boolean; // allow user to manage terminations
    delete: boolean;
    promote?: boolean;
    demote?: boolean;
    approval_required?: boolean;
    approver?: boolean;
    viewHidden?: boolean; // allow user to read hidden writeup reasons / hidden writeups
  };
  profile: {
    view: boolean; // Allow user to view members' personal/contact details (PII)
    edit: boolean; // Allow user to add and edit members' personal details
  };
  knowledgeHub: {
    manage?: boolean;
  }
  reports: {
    view: boolean; // Allow user to view workspace wide reports
    export: boolean; // Allow user to save reports
  };
  games: {
    view: boolean; // Allow user to view running games
    manageBans: boolean; // Allow user to manage bans for all games
    admin: boolean; // Allows user to manage running games, and users within
  };
  sessions: {
    view: boolean; // Allow user to view sessions
    createOneTime?: boolean; // Allow user to create one time sessions
    manage: boolean; // Allow user to manage sessions
    attendance?: boolean; // Allow user to view the session attendance grid
  };
  calls: {
    view: boolean; // Allow user to view support calls and read chat logs
    manage: boolean; // Allow user to claim, release, close and reply to calls
    deleteBans: boolean; // Allow user to remove call bans
  };
  applications: {
    viewApplications: boolean; // allow user to view applications but not read applications
    readApplications: boolean; // allow user to read applications
    editApplications: boolean; // allow user to edit applications
  };
  promotionRequests: {
    view: boolean; // allow user to view & vote on promotion requests
    create: boolean; // allow user to create promotion requests for others
    viewClosed: boolean; // allow user to view closed/approved promotion requests
    delete: boolean; // allow user to delete promotion requests
    manage: boolean; // allow user to approve/decline promotion requests
  };
  tasks: {
    assign: boolean; // allow user to assign tasks to users/departments
  };
  teams: {
    view: boolean; // allow user to view teams and the org chart
    manage: boolean; // allow user to manage the teams they lead (members, roles, feedback)
    manageAll?: boolean; // allow user to create/edit ALL teams regardless of leadership
    approve: boolean; // allow user to approve time off and expense requests across all teams
  };
  postings: {
    canManage: boolean; // create/edit/delete job postings
    canViewApplicants: boolean; // view + update applicant status
  };
  timeclock: {
    clock: boolean; // clock self in/out
    view: boolean; // view timeclock records for other staff
    manage: boolean; // force clock out, add manual entries
    edit: boolean; // edit/approve recorded time (corrections)
  };
  orders: {
    view: boolean; // see orders pages + stats
    manage: boolean; // cancel/correct orders from the web
    manageProducts: boolean; // catalog (product/category) CRUD
    manageSettings: boolean; // POS config, queues, theming, per-game overrides
  };
  admin: boolean; // give user all access to workspace -- overrides all permissions
};

export type DepartmentGroupTypes = keyof typeof WORKSPACE_OWNER_PERMISSIONS;
export type ExtractPermissionKeys<GroupName extends DepartmentGroupTypes> = GroupName extends keyof DepartmentPermissions ? keyof DepartmentPermissions[GroupName] : never;


export type Department = {
  _id?: ObjectId;
  groupId: string;
  isOwner?: true;
  name: string;
  color?: BrandColors; // tag color shown on user profiles / badges
  permissions: DepartmentPermissions;
  cankRankRoles?: string[]; // admins: allows ranking everyone, non admins: this allows ranking specific roles
  isAddedBySupport?: boolean;
  created: Date;
}
