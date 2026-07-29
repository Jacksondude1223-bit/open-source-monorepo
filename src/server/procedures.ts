import { publicProcedure } from './trpc';
import hasConnected from './middleware/hasConnected';
import authenticated from './middleware/authenticated';
import getWorkspace from './middleware/getWorkspace';
import getWorkspaceGame from './middleware/getWorkspaceGame';
import getWorkspaceRunningGame from './middleware/getWorkspaceRunningGame';
import getPremiumWorkspace from './middleware/getPremiumWorkspace';
import isCustomerService from './middleware/isCustomerService';
import isTrustAndSaftey from './middleware/isTrustAndSaftey';
import isFounder from './middleware/isFounder';

export const connectedProcedure = publicProcedure.use(hasConnected);
export const authenticatedProcedure = publicProcedure.use(authenticated);

export const customerServiceProcedure = publicProcedure.use(isCustomerService);
export const trustAndSafteyProcedure = publicProcedure.use(isTrustAndSaftey);
export const founderProcedure = publicProcedure.use(isFounder);

export const workspaceProcedure = publicProcedure.use(getWorkspace);
export const workspaceGameProcedure = publicProcedure.use(getWorkspaceGame);
export const workspaceRunningGameProcedure = publicProcedure.use(getWorkspaceRunningGame);

export const workspacePremiumProcedure = publicProcedure.use(getPremiumWorkspace);