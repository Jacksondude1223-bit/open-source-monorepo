import { router } from '~/server/trpc';
import { workspaceSessionsAttendanceRouter } from './attendance';
import { workspaceSessionsRolesRouter } from './roles';
import { workspaceSessionsTemplateRouter } from './templates';
import { workspaceSessionsV2Router } from './v2';

export const workspaceSessionsRouter = router({
  v2: workspaceSessionsV2Router,
  templates: workspaceSessionsTemplateRouter,
  roles: workspaceSessionsRolesRouter,
  attendance: workspaceSessionsAttendanceRouter,
});
