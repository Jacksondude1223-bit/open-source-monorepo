import { useState } from 'react';
import TogglableCard from '~/components/ui/ToggleableCard';
import MagicToggleForAbsoloute from '~/components/forms/MagicToggleForAbsoloute';
import { WORKSPACE_NO_ACCESS_PERMISSIONS, WORKSPACE_OWNER_PERMISSIONS } from '~/services/constants/WorkspaceOwnerPermissions';
import { DepartmentGroupTypes, DepartmentPermissions, ExtractPermissionKeys } from '~/services/NewMongoTypes/Department.type';


export function PermissionGroup({ name, options, toggleOption }: {
  name: string;
  options: {
    name: string;
    id: string;
    value: boolean;
    toggleOption: (value: boolean) => void;
  }[];
  toggleOption: (value: boolean) => void;
}) {
  return (
    <TogglableCard
      title={name}
      optionalHeaderChildren={
        <MagicToggleForAbsoloute
          onChange={toggleOption}
          value={options.every((option) => option.value)}
        />
      }
    >
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <MagicToggleForAbsoloute
            className="flex flex-row-reverse"
            key={option.id}
            label={option.name}
            id={option.id}
            value={option.value}
            onChange={option.toggleOption}
          />
        ))}
      </div>
    </TogglableCard>
  );
}

export default function WorkspaceDepartmentPermissions({ defaultPermissions = WORKSPACE_OWNER_PERMISSIONS, setPermissions = (p: DepartmentPermissions) => { } }) {
  const [perms, setPerms] = useState<DepartmentPermissions>(defaultPermissions);

  const updatePermissions = (newPermissions: DepartmentPermissions) => {
    let p = {};
    //@ts-expect-error ahh
    setPerms((prevPerms) => {
      p = { ...prevPerms, ...newPermissions };
      return p;
    });
    setPermissions(newPermissions);
  };

  const handleToggleOption = <
    G extends DepartmentGroupTypes,
    K extends ExtractPermissionKeys<G>
  >(group: G, optionName: K, value: boolean) => {
    const newPermissions = { ...perms };
    if (!newPermissions[group]) {
      newPermissions[group] = WORKSPACE_NO_ACCESS_PERMISSIONS[group];
    }
    //@ts-expect-error
    newPermissions[group][optionName] = value;
    if (value == false && optionName !== 'admin') {
      newPermissions.admin = value;
    }
    updatePermissions(newPermissions);
    setPermissions(newPermissions);
  };

  const handleGroupToggleOption = (group: DepartmentGroupTypes, value: boolean) => {
    const newPermissions = { ...perms };
    if (!newPermissions[group]) {
      //@ts-expect-error literaly valid
      newPermissions[group] = WORKSPACE_NO_ACCESS_PERMISSIONS[group];
    }
    const options = Object.keys(newPermissions[group]);
    for (const option of options) {
      //@ts-expect-error
      newPermissions[group][option] = value;
    }
    if (value == false && group !== 'admin') {
      newPermissions.admin = value;
    }
    updatePermissions(newPermissions);
    setPermissions(newPermissions);
  };

  const resetPermissions = (value: boolean) => {
    let setTo = value ? WORKSPACE_OWNER_PERMISSIONS : WORKSPACE_NO_ACCESS_PERMISSIONS;
    setPerms(setTo);
    setPermissions(setTo);
  };

  return (
    <>
      <PermissionGroup
        name="Feed"
        toggleOption={(value) => handleGroupToggleOption('feed', value)}
        options={[
          {
            name: 'Post to Workspace Feed',
            id: 'postPublic',
            value: perms.feed.postPublic,
            toggleOption: (value) => handleToggleOption('feed', 'postPublic', value),
          },
          {
            name: 'Post to Department Feed',
            id: 'postDepartment',
            value: perms.feed.postDepartment,
            toggleOption: (value) => handleToggleOption('feed', 'postDepartment', value),
          },
        ]}
      />
      <PermissionGroup
        name="Activity"
        toggleOption={(value) => handleGroupToggleOption('activity', value)}
        options={[
          {
            name: 'Allow user to view other users activity and time',
            id: 'view',
            value: perms.activity.view,
            toggleOption: (value) => handleToggleOption('activity', 'view', value),
          },
          {
            name: 'Allow user to create inactivity requests for themselves',
            id: 'createInactivity',
            value: perms.activity.createInactivity,
            toggleOption: (value) => handleToggleOption('activity', 'createInactivity', value),
          },
          {
            name: 'Automatically approve inactivity requests',
            id: 'approveInactivity',
            value: perms.activity.approveInactivity,
            toggleOption: (value) => handleToggleOption('activity', 'approveInactivity', value),
          },
          {
            name: 'Allow user to create inactivity requests for other users',
            id: 'requestInactivityForOtherUsers',
            value: perms.activity.requestInactivityForOtherUsers || false,
            toggleOption: (value) => handleToggleOption('activity', 'requestInactivityForOtherUsers', value),
          },
          {
            name: 'Allow user to view/approve/deny/delete other users inactivity',
            id: 'manageInactivity',
            value: perms.activity.manageInactivity,
            toggleOption: (value) => handleToggleOption('activity', 'manageInactivity', value),
          },
          {
            name: 'Allow user to read other users’ time-off reasons',
            id: 'viewTimeOffReasons',
            value: perms.activity.viewTimeOffReasons || false,
            toggleOption: (value) => handleToggleOption('activity', 'viewTimeOffReasons', value),
          },
          {
            name: 'Allow user to rank other users',
            id: 'ranking',
            value: perms.activity.ranking,
            toggleOption: (value) => handleToggleOption('activity', 'ranking', value),
          },
          {
            name: 'Give user admin to view privileged notes, and add/subtract manual time',
            id: 'admin',
            value: perms.activity.admin,
            toggleOption: (value) => handleToggleOption('activity', 'admin', value),
          },
        ]}
      />
      <PermissionGroup
        name="Staff History"
        toggleOption={(value) => handleGroupToggleOption('writeUps', value)}
        options={[
          {
            name: 'Allow user to promote users',
            id: 'promote',
            value: perms.writeUps?.promote || false,
            toggleOption: (value) => handleToggleOption('writeUps', 'promote', value),
          },
          {
            name: 'Allow user to demote users',
            id: 'demote',
            value: perms.writeUps?.demote || false,
            toggleOption: (value) => handleToggleOption('writeUps', 'demote', value),
          },
          {
            name: 'Allow user to read, and create write ups',
            id: 'writeUps',
            value: perms.writeUps.writeUps,
            toggleOption: (value) => handleToggleOption('writeUps', 'writeUps', value),
          },
          {
            name: 'Allow user to read, and create suspensions',
            id: 'suspensions',
            value: perms.writeUps.suspensions,
            toggleOption: (value) => handleToggleOption('writeUps', 'suspensions', value),
          },
          {
            name: 'Allow user to read, and create terminations',
            id: 'terminations',
            value: perms.writeUps.terminations,
            toggleOption: (value) => handleToggleOption('writeUps', 'terminations', value),
          },
          {
            name: 'Allow user to read hidden punishment reasons',
            id: 'viewHidden',
            value: perms.writeUps.viewHidden || false,
            toggleOption: (value) => handleToggleOption('writeUps', 'viewHidden', value),
          },
          {
            name: 'Require approval for logging creation (applies for all new logs, if enabled it will not allow users to create punishments for any above disabled punishment types)',
            id: 'approval_required',
            value: perms.writeUps.approval_required || false,
            toggleOption: (value) => handleToggleOption('writeUps', 'approval_required', value),
          },
          {
            name: 'Allow user to approve punishment requests',
            id: 'approver',
            value: perms.writeUps.approver || false,
            toggleOption: (value) => handleToggleOption('writeUps', 'approver', value),
          },
          {
            name: 'Allow user to delete punishments',
            id: 'delete',
            value: perms.writeUps.delete,
            toggleOption: (value) => handleToggleOption('writeUps', 'delete', value),
          },
        ]}
      />
      <PermissionGroup
        name="Personal Details"
        toggleOption={(value) => handleGroupToggleOption('profile', value)}
        options={[
          {
            name: 'Allow user to view members\u2019 personal & contact details (may contain PII)',
            id: 'view',
            value: perms?.profile?.view || false,
            toggleOption: (value) => handleToggleOption('profile', 'view', value),
          },
          {
            name: 'Allow user to add and edit members\u2019 personal details',
            id: 'edit',
            value: perms?.profile?.edit || false,
            toggleOption: (value) => handleToggleOption('profile', 'edit', value),
          },
        ]}
      />
      <PermissionGroup
        name="Knowledge Hub"
        toggleOption={(value) => handleGroupToggleOption('knowledgeHub', value)}
        options={[
          {
            name: 'Allow user to create and manage info on the knowledge hub',
            id: 'create',
            value: perms?.knowledgeHub?.manage || false,
            toggleOption: (value) => handleToggleOption('knowledgeHub', 'manage', value),
          },
        ]}
      />
      <PermissionGroup
        name="Views"
        toggleOption={(value) => handleGroupToggleOption('reports', value)}
        options={[
          {
            name: 'Allow user to look at views',
            id: 'view',
            value: perms.reports.view,
            toggleOption: (value) => handleToggleOption('reports', 'view', value),
          },
          {
            name: 'Allow user to manage (create/edit/delete) views',
            id: 'export',
            value: perms.reports.export,
            toggleOption: (value) => handleToggleOption('reports', 'export', value),
          },
        ]}
      />
      <PermissionGroup
        name="Games"
        toggleOption={(value) => handleGroupToggleOption('games', value)}
        options={[
          {
            name: 'Allow user to view running games',
            id: 'view',
            value: perms.games.view,
            toggleOption: (value) => handleToggleOption('games', 'view', value),
          },
          {
            name: 'Allow user to manage bans for all games',
            id: 'manageBans',
            value: perms.games.manageBans,
            toggleOption: (value) => handleToggleOption('games', 'manageBans', value),
          },
          {
            name: 'Allow user to perform commands, view logs, and real-time actions to games.',
            id: 'admin',
            value: perms.games.admin,
            toggleOption: (value) => handleToggleOption('games', 'admin', value),
          },
          // to do make discord message perm group
        ]}
      />
      <PermissionGroup
        name="Sessions"
        toggleOption={(value) => handleGroupToggleOption('sessions', value)}
        options={[
          {
            name: 'Allow user to view and claim positions for sessions',
            id: 'view',
            value: perms.sessions.view,
            toggleOption: (value) => handleToggleOption('sessions', 'view', value),
          },
          {
            name: 'Create one-time sessions',
            id: 'createOneTime',
            value: perms.sessions.createOneTime || false,
            toggleOption: (value) => handleToggleOption('sessions', 'createOneTime', value),
          },
          {
            name: 'Allow user to manage templates and roles',
            id: 'manage',
            value: perms.sessions.manage,
            toggleOption: (value) => handleToggleOption('sessions', 'manage', value),
          },
          {
            name: 'View the session attendance grid',
            id: 'attendance',
            value: perms.sessions.attendance || false,
            toggleOption: (value) => handleToggleOption('sessions', 'attendance', value),
          },
        ]}
      />
      <PermissionGroup
        name="Calls"
        toggleOption={(value) => handleGroupToggleOption('calls', value)}
        options={[
          {
            name: 'Allow user to view support calls and read chat logs',
            id: 'view',
            value: perms.calls?.view || false,
            toggleOption: (value) => handleToggleOption('calls', 'view', value),
          },
          {
            name: 'Allow user to claim, release, close, and reply to calls',
            id: 'manage',
            value: perms.calls?.manage || false,
            toggleOption: (value) => handleToggleOption('calls', 'manage', value),
          },
          {
            name: 'Allow user to remove call bans',
            id: 'deleteBans',
            value: perms.calls?.deleteBans || false,
            toggleOption: (value) => handleToggleOption('calls', 'deleteBans', value),
          },
        ]}
      />
      <PermissionGroup
        name="Applications"
        toggleOption={(value) => handleGroupToggleOption('applications', value)}
        options={[
          {
            name: 'Allow user to view applications',
            id: 'viewApplications',
            value: perms.applications.viewApplications,
            toggleOption: (value) => handleToggleOption('applications', 'viewApplications', value),
          },
          {
            name: 'Allow user to read applications (comment, pass/fail, etc.)',
            id: 'readApplications',
            value: perms.applications.readApplications,
            toggleOption: (value) => handleToggleOption('applications', 'readApplications', value),
          },
          {
            name: 'Allow user to edit application forms',
            id: 'editApplications',
            value: perms.applications.editApplications,
            toggleOption: (value) => handleToggleOption('applications', 'editApplications', value),
          },
        ]}
      />
      <PermissionGroup
        name="Promotion Requests"
        toggleOption={(value) => handleGroupToggleOption('promotionRequests', value)}
        options={[
          {
            name: 'Allow user to view and vote on promotion requests',
            id: 'view',
            value: perms.promotionRequests?.view || false,
            toggleOption: (value) => handleToggleOption('promotionRequests', 'view', value),
          },
          {
            name: 'Allow user to create promotion requests for other users',
            id: 'create',
            value: perms.promotionRequests?.create || false,
            toggleOption: (value) => handleToggleOption('promotionRequests', 'create', value),
          },
          {
            name: 'Allow user to view closed and approved promotion requests',
            id: 'viewClosed',
            value: perms.promotionRequests?.viewClosed || false,
            toggleOption: (value) => handleToggleOption('promotionRequests', 'viewClosed', value),
          },
          {
            name: 'Allow user to delete promotion requests',
            id: 'delete',
            value: perms.promotionRequests?.delete || false,
            toggleOption: (value) => handleToggleOption('promotionRequests', 'delete', value),
          },
          {
            name: 'Allow user to approve or decline promotion requests',
            id: 'manage',
            value: perms.promotionRequests?.manage || false,
            toggleOption: (value) => handleToggleOption('promotionRequests', 'manage', value),
          },
        ]}
      />
      <PermissionGroup
        name="Tasks"
        toggleOption={(value) => handleGroupToggleOption('tasks', value)}
        options={[
          {
            name: 'Allow user to assign tasks to users or departments',
            id: 'assign',
            value: perms.tasks.assign,
            toggleOption: (value) => handleToggleOption('tasks', 'assign', value),
          },
        ]}
      />
      <PermissionGroup
        name="Teams"
        toggleOption={(value) => handleGroupToggleOption('teams', value)}
        options={[
          {
            name: 'Allow user to view teams and the org chart',
            id: 'view',
            value: perms.teams?.view || false,
            toggleOption: (value) => handleToggleOption('teams', 'view', value),
          },
          {
            name: 'Allow user to manage the teams they lead (members, roles, feedback)',
            id: 'manage',
            value: perms.teams?.manage || false,
            toggleOption: (value) => handleToggleOption('teams', 'manage', value),
          },
          {
            name: 'Allow user to create and edit ALL teams, regardless of leadership',
            id: 'manageAll',
            value: perms.teams?.manageAll || false,
            toggleOption: (value) => handleToggleOption('teams', 'manageAll', value),
          },
          {
            name: 'Allow user to approve time off and expense requests across all teams',
            id: 'approve',
            value: perms.teams?.approve || false,
            toggleOption: (value) => handleToggleOption('teams', 'approve', value),
          },
        ]}
      />
      <PermissionGroup
        name="Job Postings"
        toggleOption={(value) => handleGroupToggleOption('postings', value)}
        options={[
          {
            name: 'Allow user to create, edit, and delete job postings',
            id: 'canManage',
            value: perms.postings?.canManage || false,
            toggleOption: (value) => handleToggleOption('postings', 'canManage', value),
          },
          {
            name: 'Allow user to view job applicants and update their status',
            id: 'canViewApplicants',
            value: perms.postings?.canViewApplicants || false,
            toggleOption: (value) => handleToggleOption('postings', 'canViewApplicants', value),
          },
        ]}
      />
      <PermissionGroup
        name="Orders"
        toggleOption={(value) => handleGroupToggleOption('orders', value)}
        options={[
          {
            name: 'Allow user to view orders pages and stats',
            id: 'view',
            value: perms.orders?.view || false,
            toggleOption: (value) => handleToggleOption('orders', 'view', value),
          },
          {
            name: 'Allow user to cancel and correct orders from the web',
            id: 'manage',
            value: perms.orders?.manage || false,
            toggleOption: (value) => handleToggleOption('orders', 'manage', value),
          },
          {
            name: 'Allow user to manage the product catalog (products and categories)',
            id: 'manageProducts',
            value: perms.orders?.manageProducts || false,
            toggleOption: (value) => handleToggleOption('orders', 'manageProducts', value),
          },
          {
            name: 'Allow user to manage POS settings (queues, theming, per-game overrides)',
            id: 'manageSettings',
            value: perms.orders?.manageSettings || false,
            toggleOption: (value) => handleToggleOption('orders', 'manageSettings', value),
          },
        ]}
      />
      <PermissionGroup
        name="Admin"
        toggleOption={(value) => {
          resetPermissions(value);
        }}
        options={[
          {
            name: 'Make user an admin of the entire workspace (overrides all permissions)',
            id: 'admin',
            value: perms.admin,
            toggleOption: (value) => resetPermissions(value),
          },
        ]}
      />
    </>
  );
}