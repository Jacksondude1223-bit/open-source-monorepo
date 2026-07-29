import { FastifyInstance } from 'fastify';
import { canApply } from '~/fastifyAPI/apiHandlers/applications/canApply';
import { getWorkspace } from '~/fastifyAPI/apiHandlers/applications/getWorkspace';
import { getSubmissions } from '~/fastifyAPI/apiHandlers/applications/getSubmissions';
import { submitApplication } from '~/fastifyAPI/apiHandlers/applications/submitApplication';

export const applicationsRouter = async (applications: FastifyInstance) => {
    applications.get('/getWorkspace', { config: { workspaceFromLoaderId: true } }, getWorkspace);
    applications.get('/getSubmissions', { config: { workspaceFromLoaderId: true } }, getSubmissions);
    applications.post('/canApply', { config: { workspaceFromLoaderId: true } }, canApply);
    applications.post('/submitApplication', { config: { workspaceFromLoaderId: true } }, submitApplication);
}