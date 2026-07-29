import { createClient } from 'redis';
import { env } from "./env";


const redisClient = createClient({
    url: env.REDIS_URL,
    pingInterval: 1000 * 5,
});

redisClient.connect().catch((err: string) => {
    console.log(`Redis connection error ${err}`);
});

export function createRedisClient() {
    const redisClient = createClient({
        url: env.REDIS_URL,
        pingInterval: 1000 * 5,
    });
    redisClient.connect().catch((err: string) => {
        console.log(`Redis connection error ${err}`);
    });
    return redisClient;
}

export const redisNamespace = `readmin-${env.NEXT_PUBLIC_VERCEL_ENV || 'development'}`

export default redisClient;