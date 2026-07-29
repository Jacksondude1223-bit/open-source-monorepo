import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
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

describe("Application Center Integration Tests", () => {
    it("should get workspace", async () => {
        fastify.inject({
            url: '/applications/getWorkspace',
            method: 'GET',
            headers: {
                'loader-id': loaderId
            }
        }).then((res) => {
            expect(res.statusCode).toEqual(200);
            const body = res.body as any;
            expect(body).toBeDefined();
            expect(body.success).toEqual(true);
            expect(body.workspace).toBeDefined();
            expect(body.applications).toBeDefined();
        }).catch((err) => {
            console.error(err);
        })
    })
    it("should NOT allow me to apply W/ disabled application", async () => {
        await readminCollections.application.updateOne({
            groupId: '10792229',
            _id: StringToObjectID('6830cc60fc0a42714f81c255')
        }, {
            $set: {
                enabled: false
            }
        })
        fastify.inject({
            url: '/applications/canApply',
            method: 'POST',
            headers: {
                'loader-id': loaderId
            },
            body: {
                applicationId: '6830cc60fc0a42714f81c255',
                userId: '25482574'
            }
        }).then((res) => {
            expect(res).toBeDefined();
            expect(res.statusCode).toEqual(200);
            const body = res.body as any;
            expect(body).toBeDefined();
            expect(body.success).toEqual(true);
            expect(body.canApply).toEqual(true);
        }).catch((err) => {
            console.error(err);
        })
    })
    it("should allow me to apply", async () => {
        await readminCollections.application.updateOne({
            groupId: '10792229',
            _id: StringToObjectID('6830cc60fc0a42714f81c255')
        }, {
            $set: {
                enabled: true,
                'permissions.acceptingResponses': false
            }
        })
        fastify.inject({
            url: '/applications/canApply',
            method: 'POST',
            headers: {
                'loader-id': loaderId
            },
            body: {
                applicationId: '6830cc60fc0a42714f81c255',
                userId: '25482574'
            }
        }).then((res) => {
            expect(res).toBeDefined();
            expect(res.statusCode).toEqual(200);
            const body = res.body as any;
            expect(body).toBeDefined();
            expect(body.success).toEqual(true);
            expect(body.canApply).toEqual(true);
        }).catch((err) => {
            console.error(err);
        })
    })
    it("should submit application", async () => {
        await readminCollections.application.updateOne({
            groupId: '10792229',
            _id: StringToObjectID('6830cc60fc0a42714f81c255')
        }, {
            $set: {
                enabled: true,
                'permissions.acceptingResponses': true
            }
        })
        fastify.inject({
            url: '/applications/submitApplication',
            method: 'POST',
            headers: {
                'loader-id': loaderId
            },
            body: {
                applicationId: '6830cc60fc0a42714f81c255',
                userId: '25482574',
                applicationBody: {
                    '8aa3e1d5-33a3-4bf9-a066-3bbf439d686f': 'Testing 123'
                },
                startTime: new Date().getTime() - 1000 * 60,
                endTime: new Date().getTime()
            }
        }).then((res) => {
            expect(res).toBeDefined();
            expect(res.statusCode).toEqual(200);
            const body = res.body as any;
            expect(body).toBeDefined();
            expect(body.success).toEqual(true);
            if (!('sent' in body)) {
                throw new Error('sent not found in response');
            }
            expect(body.sent).toEqual(true);
        }).catch((err) => {
            console.error(err);
        })
    })
})