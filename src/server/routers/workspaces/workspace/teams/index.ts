import { router } from '~/server/trpc';
import { workspaceTeamsCoreRouter } from './teams';
import { workspaceTeamsMembersRouter } from './members';
import { workspaceTeamsHierarchyRouter } from './hierarchy';
import { workspaceTeamsTimeOffRouter } from './timeOff';
import { workspaceTeamsExpensesRouter } from './expenses';
import { workspaceTeamsFeedbackRouter } from './feedback';
import { workspaceTeamsDocumentsRouter } from './documents';

export const workspaceTeamsRouter = router({
  teams: workspaceTeamsCoreRouter,
  members: workspaceTeamsMembersRouter,
  hierarchy: workspaceTeamsHierarchyRouter,
  timeOff: workspaceTeamsTimeOffRouter,
  expenses: workspaceTeamsExpensesRouter,
  feedback: workspaceTeamsFeedbackRouter,
  documents: workspaceTeamsDocumentsRouter,
});
