import { router } from '~/server/trpc';
import { adminAlertsRouter } from './alerts';
import { adminBotsRouter } from './bots';
import { adminReportsRouter } from './reports';
import { adminUsersRouter } from './users';
import { adminWorkspacesRouter } from './workspaces';
import { adminPostingsModerationRouter } from './postings';

export const adminRouter = router({
  alerts: adminAlertsRouter,
  bots: adminBotsRouter,
  reports: adminReportsRouter,
  users: adminUsersRouter,
  workspaces: adminWorkspacesRouter,
  moderation: adminPostingsModerationRouter,
})