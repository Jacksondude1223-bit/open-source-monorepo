import { readminCollections } from '~/services/mongo.service';
import { fastify } from '~/fastifyAPI';

let loaderId = '';

beforeAll(async () => {
    const workspace = await readminCollections.workspace.findOne({
        groupId: '10792229'
    })
    if (!workspace) {
        throw new Error('Workspace not found');
    }
    loaderId = workspace?.loaderId;
    expect(loaderId).toBeDefined();
    expect(loaderId).not.toBeNull();
})

describe("Orders Integration Tests", () => {

    it('should pass', async () => {
        expect(true).toBe(true);
    })
})