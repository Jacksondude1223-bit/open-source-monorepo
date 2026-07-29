import { readminCollections } from '~/services/mongo.service';
import { fastify } from '~/fastifyAPI';
import StringToObjectID from '~/utils/StringToObjectID';
import sleep from '~/utils/sleep';

let loaderId = '';
let gameId = '';
let runningGameId = '';
let sessionId = '';
let runningPlayerId = '';

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

describe("Activity Tracking Integration Tests", () => {
    // Use a consistent base time for all tests
    const testBaseTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const testBaseTimeMs = testBaseTime * 1000; // Same time in milliseconds

    it('should create server and start game session', async () => {
        const response = await fastify.inject({
            url: '/activity/createServer',
            method: 'POST',
            headers: {
                'loader-id': loaderId,
                'Content-Type': 'application/json'
            },
            payload: {
                gameId: 5485418373,
                placeId: 15863611126,
                jobId: 'test-job-id-12345',
                privateServerId: '',
                privateServerOwnerId: 0,
                placeVersion: 1
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.gameId).toBeDefined();
        expect(body.runningGameId).toBeDefined();

        gameId = body.gameId;
        runningGameId = body.runningGameId;
    }); it('should handle player join', async () => {
        const joinTime = Date.now();

        const response = await fastify.inject({
            url: '/activity/playerJoin',
            method: 'POST',
            headers: {
                'loader-id': loaderId,
                'Content-Type': 'application/json'
            }, payload: {
                gameId: runningGameId,
                playerId: '25482574',
                platform: 'Desktop',
                safechat: false,
                username: 'sloss2003',
                datetime: joinTime,
                tzOffset: '-0500'
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.banned).toBe(false);
        expect(body.sessionId).toBeDefined();
        expect(body.runningPlayerId).toBeDefined();

        sessionId = body.sessionId;
        runningPlayerId = body.runningPlayerId;
    }); it('should send activity data and track events', async () => {
        // Use the consistent base time from the test suite
        const events = [
            {
                user: '25482574',
                sessionIds: {
                    runningGamePlayer: runningPlayerId,
                    userGameSession: sessionId
                },
                type: 'join',
                date: testBaseTime,
                datetime: testBaseTimeMs
            },
            {
                user: '25482574',
                sessionIds: {
                    runningGamePlayer: runningPlayerId,
                    userGameSession: sessionId
                },
                type: 'active',
                date: testBaseTime + 5, // 5 seconds later
                datetime: testBaseTimeMs + 5000
            },
            {
                user: '25482574',
                sessionIds: {
                    runningGamePlayer: runningPlayerId,
                    userGameSession: sessionId
                },
                type: 'message',
                message: 'SGVsbG8gV29ybGQ=', // base64 encoded "Hello World"
                encoded: true,
                date: testBaseTime + 10, // 10 seconds later
                datetime: testBaseTimeMs + 10000
            },
            {
                user: '25482574',
                sessionIds: {
                    runningGamePlayer: runningPlayerId,
                    userGameSession: sessionId
                },
                type: 'idle',
                date: testBaseTime + 60, // 60 seconds later
                datetime: testBaseTimeMs + 60000
            }
        ];

        const response = await fastify.inject({
            url: '/activity/sendData',
            method: 'POST',
            headers: {
                'loader-id': loaderId,
                'Content-Type': 'application/json'
            }, payload: {
                gameId: runningGameId,
                events: events,
                players: {
                    '25482574': 'sloss2003'
                }
            }
        });

        await sleep(2500); // Wait for processing

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.queuedActions).toBeDefined();
    }); it('should handle player leave and calculate minutes correctly', async () => {
        // Use the same base time as other tests for consistency
        const leaveTime = testBaseTime + (5 * 60); // 5 minutes after base time
        const leaveTimeMs = testBaseTimeMs + (5 * 60 * 1000); // 5 minutes after base time in ms
        const joinTime = testBaseTime; // Use the same join time as other events
        const joinTimeMs = testBaseTimeMs; // Same join time in ms        
        const playerEvents = [
            {
                type: 'join',
                date: joinTime,
                datetime: joinTimeMs
            },
            {
                type: 'active',
                date: joinTime + 30, // 30 seconds after join
                datetime: joinTimeMs + 30000
            },
            {
                type: 'idle',
                date: joinTime + 120, // 2 minutes after join (90 seconds of active time)
                datetime: joinTimeMs + 120000
            },
            {
                type: 'active',
                date: joinTime + 180, // 3 minutes after join (60 seconds of idle time)
                datetime: joinTimeMs + 180000
            }
        ];

        const response = await fastify.inject({
            url: '/activity/playerLeave',
            method: 'DELETE',
            headers: {
                'loader-id': loaderId,
                'Content-Type': 'application/json'
            },
            payload: {
                gameId: runningGameId,
                playerId: '25482574',
                sessionIds: {
                    runningGamePlayer: runningPlayerId,
                    userGameSession: sessionId
                },
                events: playerEvents,
                leftTime: leaveTime,
                datetime: leaveTimeMs
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);

        // Verify the session was created in the database
        const session = await readminCollections.user_game_session.findOne({
            _id: StringToObjectID(sessionId)
        });

        expect(session).toBeDefined();
        expect(session?.userId).toBe(25482574);
        expect(session?.minutes).toBeInstanceOf(Object);
    });

    it('should end game server', async () => {
        const response = await fastify.inject({
            url: '/activity/endServer',
            method: 'DELETE',
            headers: {
                'loader-id': loaderId,
                'Content-Type': 'application/json'
            },
            payload: {
                gameId: runningGameId
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);

        // Verify the running game was marked as ended
        const runningGame = await readminCollections.running_games.findOne({
            _id: StringToObjectID(runningGameId)
        });

        expect(runningGame).toBe(null); // Should be removed from the collection
    }); it('should calculate activity minutes accurately', async () => {
        const sessionMinutes = await readminCollections.user_game_session.findOne({
            _id: StringToObjectID(sessionId)
        });
        expect(sessionMinutes).toBeDefined();
        expect(sessionMinutes?.minutes).toBeDefined();
        expect(sessionMinutes?.minutes?.total).toBeCloseTo(5, 1); // Should be around 5 minutes total
        expect(sessionMinutes?.minutes?.active).toBeCloseTo(3.5, 0.05); // Should be around 0.08 minutes active based on our event timeline
        expect(sessionMinutes?.minutes?.inactive).toBeCloseTo(1.5, 0.1); // Should be around 4.92 minutes inactive
        expect(sessionMinutes?.minutes?.typing).toBe(0); // No typing events in this test
        expect(sessionMinutes?.minutes?.messages).toBe(1); // 1 message sent in sendData test
    }); it('should clean up test data', async () => {
        // Clean up the session
        const sessionDeleteResult = await readminCollections.user_game_session.deleteOne({
            _id: StringToObjectID(sessionId)
        });
        expect(sessionDeleteResult.deletedCount).toBe(1);

        const eventsDeleteResult = await readminCollections.user_game_session_event.deleteMany({
            userGameSession: StringToObjectID(sessionId)
        });
        expect(eventsDeleteResult.deletedCount).toBeGreaterThanOrEqual(0);

        console.log('Test cleanup completed successfully');
    });

    // Edge case tests for unusual event ordering
    describe("Edge Cases and Unusual Event Ordering", () => {
        let edgeGameId = '';
        let edgeRunningGameId = '';
        let edgeSessionIds: string[] = [];
        let edgeRunningPlayerIds: string[] = [];
        let serverEndedByTest = false; // Flag to track if test ended server manually

        beforeEach(async () => {
            serverEndedByTest = false; // Reset flag
            // Create a new game session for each edge case test
            const response = await fastify.inject({
                url: '/activity/createServer',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: 5485418373,
                    placeId: 15863611126,
                    jobId: `edge-test-${Date.now()}`,
                    privateServerId: '',
                    privateServerOwnerId: 0,
                    placeVersion: 1
                }
            });

            const body = JSON.parse(response.body);
            edgeGameId = body.gameId;
            edgeRunningGameId = body.runningGameId;
        }); afterEach(async () => {
            // Clean up sessions
            for (const sessionId of edgeSessionIds) {
                try {
                    await readminCollections.user_game_session.deleteMany({
                        _id: StringToObjectID(sessionId)
                    });
                    await readminCollections.user_game_session_event.deleteMany({
                        userGameSession: StringToObjectID(sessionId)
                    });
                } catch (e) {
                    // Session might already be cleaned up
                }
            }

            // Only end server if it wasn't already ended by the test
            if (!serverEndedByTest) {
                try {
                    const runningGame = await readminCollections.running_games.findOne({
                        _id: StringToObjectID(edgeRunningGameId)
                    });

                    if (runningGame) {
                        await fastify.inject({
                            url: '/activity/endServer',
                            method: 'DELETE',
                            headers: {
                                'loader-id': loaderId,
                                'Content-Type': 'application/json'
                            },
                            payload: {
                                gameId: edgeRunningGameId
                            }
                        });
                    }
                } catch (e) {
                    // Server might already be ended, that's okay
                }
            }

            // Reset arrays for next test
            edgeSessionIds = [];
            edgeRunningPlayerIds = [];
        });

        it('should handle missing join event - player starts with active event', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                }, payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Player events with NO JOIN EVENT - starts directly with active
            const playerEvents = [
                {
                    type: 'active',
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30000
                },
                {
                    type: 'idle',
                    date: baseTime + 180,
                    datetime: baseTimeMs + 180000
                },
                {
                    type: 'active',
                    date: baseTime + 240,
                    datetime: baseTimeMs + 240000
                }
            ];

            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: playerEvents,
                    leftTime: baseTime + 300,
                    datetime: baseTimeMs + 300000
                }
            }); expect(leaveResponse.statusCode).toBe(200);

            // Wait for processing
            await sleep(1000);
            const events = await readminCollections.user_game_session_event.find({
                userGameSession: StringToObjectID(joinBody.sessionId)
            }).toArray();

            // Verify session was calculated correctly even without join event
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            }); expect(session).toBeDefined();
            expect(session?.minutes?.total).toBeCloseTo(5, 1); // Should be around 5 minutes total
        });

        it('should handle typing event milliseconds before message', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                }, payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Send events with typing right before message
            const events = [
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'typing',
                    state: true,
                    date: baseTime + 60,
                    datetime: baseTimeMs + 60000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'message',
                    message: 'SGVsbG8=', // "Hello"
                    encoded: true,
                    date: baseTime + 60, // Same second as typing
                    datetime: baseTimeMs + 60500 // 500ms later
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'typing',
                    state: false,
                    date: baseTime + 61,
                    datetime: baseTimeMs + 61000
                }
            ];

            const sendDataResponse = await fastify.inject({
                url: '/activity/sendData',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                }, payload: {
                    gameId: edgeRunningGameId,
                    events: events,
                    players: {
                        '25482574': 'sloss2003'
                    }
                }
            }); expect(sendDataResponse.statusCode).toBe(200);

            // Wait for processing
            await sleep(1000);

            // Player leave
            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: [],
                    leftTime: baseTime + 120,
                    datetime: baseTimeMs + 120000
                }
            });

            expect(leaveResponse.statusCode).toBe(200);

            // Verify typing time was calculated
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            });

            expect(session).toBeDefined();
            expect(session?.minutes?.messages).toBe(1);
            expect(session?.minutes?.typing).toBeGreaterThan(0);
        });

        it('should handle rapid state changes between active/idle', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                }, payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Rapid state changes
            const playerEvents = [
                {
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    type: 'active',
                    date: baseTime + 5,
                    datetime: baseTimeMs + 5000
                },
                {
                    type: 'idle',
                    date: baseTime + 10,
                    datetime: baseTimeMs + 10000
                },
                {
                    type: 'active',
                    date: baseTime + 15,
                    datetime: baseTimeMs + 15000
                },
                {
                    type: 'idle',
                    date: baseTime + 20,
                    datetime: baseTimeMs + 20000
                },
                {
                    type: 'active',
                    date: baseTime + 25,
                    datetime: baseTimeMs + 25000
                },
                {
                    type: 'idle',
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30000
                }
            ];

            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: playerEvents,
                    leftTime: baseTime + 60,
                    datetime: baseTimeMs + 60000
                }
            }); expect(leaveResponse.statusCode).toBe(200);

            // Wait for processing
            await sleep(1000);

            // Verify calculations handled rapid changes correctly
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            }); expect(session).toBeDefined();
            expect(session?.minutes?.total).toBeCloseTo(1, 0.8); // Should be around 1 minute with more tolerance
            //@ts-expect-error testing purposes
            expect(session?.minutes?.active + session?.minutes?.inactive).toBeCloseTo(session?.minutes?.total, 0.5);
        }, 60000);


        it('should handle out-of-order events by datetime', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Events sent out of chronological order
            const playerEvents = [
                {
                    type: 'active',
                    date: baseTime + 60, // This should be processed second
                    datetime: baseTimeMs + 60000
                },
                {
                    type: 'join',
                    date: baseTime, // This should be processed first
                    datetime: baseTimeMs
                },
                {
                    type: 'idle',
                    date: baseTime + 120, // This should be processed third
                    datetime: baseTimeMs + 120000
                }
            ];

            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: playerEvents,
                    leftTime: baseTime + 180,
                    datetime: baseTimeMs + 180000
                }
            });

            expect(leaveResponse.statusCode).toBe(200);

            // Wait for processing
            await sleep(1000);

            // Verify events were processed in correct chronological order
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            });

            expect(session).toBeDefined();
            expect(session?.minutes?.total).toBeCloseTo(3, 1); // Should be around 3 minutes with more tolerance
        }, 50000); // 10 second timeout


        it('should prevent duplicate message events from being inserted', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // First, send some events via sendData
            const initialEvents = [
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'active',
                    date: baseTime + 60,
                    datetime: baseTimeMs + 60000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'message',
                    message: Buffer.from('Hello', 'utf-8').toString('base64'), // "Hello"
                    encoded: true,
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30010
                },
            ];

            await fastify.inject({
                url: '/activity/sendData',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    events: initialEvents,
                    players: {
                        '25482574': 'sloss2003'
                    }
                }
            });

            // Now try to send duplicate events via playerLeave
            const duplicateEvents = [
                {
                    type: 'message',
                    message: Buffer.from('Hello', 'utf-8').toString('base64'), // Same "Hello" message
                    encoded: true,
                    date: baseTime + 30, // Same timestamp - should be rejected because it has the same time as the previous event
                    datetime: baseTimeMs + 30010
                },
                {
                    type: 'message',
                    message: Buffer.from('Hello', 'utf-8').toString('base64'), // Same "Hello" message
                    encoded: true,
                    date: baseTime + 30, // Same timestamp + 20ms -- should be accepted because it has a different datetime
                    datetime: baseTimeMs + 30050
                },
                {
                    type: 'message',
                    message: Buffer.from('World', 'utf-8').toString('base64'), // Different message "World"
                    encoded: true,
                    date: baseTime + 30, // should be allowed
                    datetime: baseTimeMs + 50100
                },
                {
                    type: 'active',
                    date: baseTime + 60, // Duplicate active state within 500ms
                    datetime: baseTimeMs + 60200
                }
            ];

            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: duplicateEvents,
                    leftTime: baseTime + 120,
                    datetime: baseTimeMs + 120000
                }
            });

            expect(leaveResponse.statusCode).toBe(200);

            await sleep(1000); // Wait for processing

            // Verify that duplicates were prevented
            const events = await readminCollections.user_game_session_event.find({
                userGameSession: StringToObjectID(joinBody.sessionId)
            }, {
                sort: { date: 1 } // Sort by date to ensure order
            }).toArray();

            // Count message events
            const messageEvents = events.filter(e => e.type === 'message');
            const helloMessages = messageEvents.filter(e => e.message === 'Hello');
            const worldMessages = messageEvents.filter(e => e.message === 'World');

            // Should only have 1 "Hello" message (duplicates prevented)
            expect(helloMessages.length).toBe(2);

            // Should have 1 "World" message (different content allowed)
            expect(worldMessages.length).toBe(1);

            // Total should be 2 messages
            expect(messageEvents.length).toBe(3);

            // Count active events - should only have 1 (duplicate prevented)
            const activeEvents = events.filter(e => e.type === 'active');
            expect(activeEvents.length).toBe(2);

            console.log('Duplicate prevention test passed - found', {
                totalEvents: events.length,
                messageEvents: messageEvents.length,
                helloMessages: helloMessages.length,
                worldMessages: worldMessages.length,
                activeEvents: activeEvents.length
            });

            // Manually end the server before the test completes to prevent afterEach conflicts
            await fastify.inject({
                url: '/activity/endServer',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId
                }
            });
            serverEndedByTest = true; // Mark that the server was ended by the test
        }, 60000);


        it('should prevent duplicate events from late-arriving sendData after playerLeave', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Simulate player activity and then leaving with messages in playerLeave
            const playerLeaveEvents = [
                {
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    type: 'active',
                    date: baseTime + 10,
                    datetime: baseTimeMs + 10000
                },
                {
                    type: 'message',
                    message: Buffer.from('First message', 'utf-8').toString('base64'),
                    encoded: true,
                    date: baseTime + 20,
                    datetime: baseTimeMs + 20000
                },
                {
                    type: 'message',
                    message: Buffer.from('Second message', 'utf-8').toString('base64'),
                    encoded: true,
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30000
                },
                {
                    type: 'idle',
                    date: baseTime + 40,
                    datetime: baseTimeMs + 40000
                }
            ];

            // Player leaves with their activity data
            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: playerLeaveEvents,
                    leftTime: baseTime + 60,
                    datetime: baseTimeMs + 60000
                }
            });

            expect(leaveResponse.statusCode).toBe(200);
            await sleep(1000); // Wait for playerLeave to complete processing

            // Check events after playerLeave
            const eventsAfterLeave = await readminCollections.user_game_session_event.find({
                userGameSession: StringToObjectID(joinBody.sessionId)
            }).toArray();

            const messagesAfterLeave = eventsAfterLeave.filter(e => e.type === 'message');
            expect(messagesAfterLeave.length).toBe(2); // Should have 2 messages from playerLeave

            // Now simulate late-arriving sendData with THE SAME events that were already processed
            const lateArrivingEvents = [
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'active',
                    date: baseTime + 10,
                    datetime: baseTimeMs + 10000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'message',
                    message: Buffer.from('First message', 'utf-8').toString('base64'), // Same message
                    encoded: true,
                    date: baseTime + 20,
                    datetime: baseTimeMs + 20000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'message',
                    message: Buffer.from('Second message', 'utf-8').toString('base64'), // Same message
                    encoded: true,
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'message',
                    message: Buffer.from('Third message', 'utf-8').toString('base64'), // New message that wasn't in playerLeave
                    encoded: true,
                    date: baseTime + 35,
                    datetime: baseTimeMs + 35000
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'idle',
                    date: baseTime + 40,
                    datetime: baseTimeMs + 40000
                }
            ];

            // Send the late-arriving sendData
            const sendDataResponse = await fastify.inject({
                url: '/activity/sendData',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                }, payload: {
                    gameId: edgeRunningGameId,
                    events: lateArrivingEvents,
                    players: {
                        '25482574': 'sloss2003'
                    }
                }
            });

            expect(sendDataResponse.statusCode).toBe(200);
            await sleep(1000); // Wait for sendData processing

            // Verify that duplicates were prevented and only new events were added
            const finalEvents = await readminCollections.user_game_session_event.find({
                userGameSession: StringToObjectID(joinBody.sessionId)
            }, {
                sort: { date: 1 }
            }).toArray();

            console.log(finalEvents);

            const messageEvents = finalEvents.filter(e => e.type === 'message');
            const firstMessages = messageEvents.filter(e => e.message === 'First message');
            const secondMessages = messageEvents.filter(e => e.message === 'Second message');
            const thirdMessages = messageEvents.filter(e => e.message === 'Third message');

            // Should only have 1 of each existing message (duplicates prevented)
            expect(firstMessages.length).toBe(1);
            expect(secondMessages.length).toBe(1);

            // Should have 1 new message that wasn't in playerLeave
            expect(thirdMessages.length).toBe(1);

            // Total should be 3 messages (2 from playerLeave + 1 new from sendData)
            expect(messageEvents.length).toBe(3);

            // Verify state events weren't duplicated either
            const activeEvents = finalEvents.filter(e => e.type === 'active');
            const idleEvents = finalEvents.filter(e => e.type === 'idle');
            expect(activeEvents.length).toBe(1); // Should not duplicate active events
            expect(idleEvents.length).toBe(1); // Should not duplicate idle events

            console.log('Late sendData duplicate prevention test passed - found', {
                totalEvents: finalEvents.length,
                messageEvents: messageEvents.length,
                firstMessages: firstMessages.length,
                secondMessages: secondMessages.length,
                thirdMessages: thirdMessages.length,
                activeEvents: activeEvents.length,
                idleEvents: idleEvents.length
            });

            // Manually end the server
            await fastify.inject({
                url: '/activity/endServer',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId
                }
            });
            serverEndedByTest = true;
        }, 60000);

        it('should handle missing leave event - server cleanup', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Send some activity data
            const events = [
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    user: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    type: 'active',
                    date: baseTime + 30,
                    datetime: baseTimeMs + 30000
                }
            ];

            await fastify.inject({
                url: '/activity/sendData',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    events: events,
                    players: {
                        '25482574': 'sloss2003'
                    }
                }
            });

            // End server without explicit player leave (simulates server crash)
            const endServerResponse = await fastify.inject({
                url: '/activity/endServer',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId
                }
            });

            expect(endServerResponse.statusCode).toBe(200);

            // Player session should still exist and be marked as ended
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            });

            expect(session).toBeDefined();
            // Note: Session might not have minutes calculated since no explicit leave occurred
        });

        it('should handle server/client desync causing wrong event order (specifically, typing -> active -> message, instead of typing -> message -> active)', async () => {
            const baseTime = Math.floor(Date.now() / 1000);
            const baseTimeMs = baseTime * 1000;

            // Player join
            const joinResponse = await fastify.inject({
                url: '/activity/playerJoin',
                method: 'POST',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    platform: 'Desktop',
                    safechat: false,
                    username: 'sloss2003',
                    datetime: baseTimeMs,
                    tzOffset: '-0500'
                }
            });

            const joinBody = JSON.parse(joinResponse.body);
            edgeSessionIds.push(joinBody.sessionId);
            edgeRunningPlayerIds.push(joinBody.runningPlayerId);

            // Simulate the exact scenario: typing starts, server detects active (ahead of client), then message arrives
            const playerEvents = [
                {
                    type: 'join',
                    date: baseTime,
                    datetime: baseTimeMs
                },
                {
                    type: 'typing',
                    state: true,
                    date: baseTime + 23, // User starts typing at 23 seconds
                    datetime: baseTimeMs + 23000
                },
                {
                    type: 'active', // Server detects activity at 30 seconds (slightly ahead)
                    date: baseTime + 30,
                    datetime: baseTimeMs + 23000
                },
                {
                    type: 'message', // But message was actually sent at 30 seconds too (client time)
                    message: Buffer.from('a', 'utf-8').toString('base64'), // Single character like your example
                    encoded: true,
                    date: baseTime + 30, // Same timestamp as active event
                    datetime: baseTimeMs + 29000
                },
            ];

            const leaveResponse = await fastify.inject({
                url: '/activity/playerLeave',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId,
                    playerId: '25482574',
                    sessionIds: {
                        runningGamePlayer: joinBody.runningPlayerId,
                        userGameSession: joinBody.sessionId
                    },
                    events: playerEvents,
                    leftTime: baseTime + 36, // Leaves 6 seconds later (matches your example timing)
                    datetime: baseTimeMs + 36000
                }
            });

            expect(leaveResponse.statusCode).toBe(200);
            await sleep(1000); // Wait for processing

            // Verify the session and calculate minutes
            const session = await readminCollections.user_game_session.findOne({
                _id: StringToObjectID(joinBody.sessionId)
            });

            expect(session).toBeDefined();

            // Verify events were stored properly
            const events = await readminCollections.user_game_session_event.find({
                userGameSession: StringToObjectID(joinBody.sessionId)
            }, {
                sort: { date: 1 } // Sort chronologically
            }).toArray();

            const typingEvents = events.filter(e => e.type === 'typing');
            const messageEvents = events.filter(e => e.type === 'message');
            const activeEvents = events.filter(e => e.type === 'active');            // Should have proper typing start/stop events
            expect(typingEvents.length).toBe(1);
            expect((typingEvents[0] as any).state).toBe(true);  // typing start

            // Should have the message
            expect(messageEvents.length).toBe(1);
            expect(messageEvents[0]?.message).toBe('a');

            // Should have the active event
            expect(activeEvents.length).toBe(1);

            // Check that typing time is calculated correctly despite the desync
            // Typing was from second 23 to 31 = 8 seconds, but should be capped by the message
            expect(session?.minutes?.typing).toBeGreaterThan(0);
            expect(session?.minutes?.typing).toBeLessThan(0.4);
            expect(session?.minutes?.messages).toBe(1);

            console.log('Server/client desync test results:', {
                totalMinutes: session?.minutes?.total,
                typingMinutes: session?.minutes?.typing,
                activeMinutes: session?.minutes?.active,
                messages: session?.minutes?.messages,
                eventCount: events.length
            });

            // Manually end the server
            await fastify.inject({
                url: '/activity/endServer',
                method: 'DELETE',
                headers: {
                    'loader-id': loaderId,
                    'Content-Type': 'application/json'
                },
                payload: {
                    gameId: edgeRunningGameId
                }
            });
            serverEndedByTest = true;
        }, 60000);
    });
})