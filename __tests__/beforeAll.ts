import 'dotenv/config';
import { env } from '~/services/env';
export default function () {
    // console.log(env)
    if (!env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set in the environment variables');
    }
}