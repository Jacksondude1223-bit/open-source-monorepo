import { router } from '~/server/trpc';
import { workspaceFormsApplicationsRouter } from './applications/applications';
import { workspaceFormsRankingRouter } from './ranking';

export const workspaceFormsRouter = router({
  applications: workspaceFormsApplicationsRouter,
  ranking: workspaceFormsRankingRouter,
});
