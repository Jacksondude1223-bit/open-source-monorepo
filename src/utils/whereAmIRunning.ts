import { env } from "~/services/env";

export default function getRunningEnviorment(): { platform: 'vercel' | 'lambda' | 'windows-pc' | 'mac' | unknown, prod?: boolean } {
    let platform;
    let prod = env.MONGODB_DATABASE == 'readmin';
    if (env.VERCEL_ENV) {
        platform = 'vercel';
    }
    if (env.AWS_ENV) {
        platform = 'lambda';
    }
    if (process.platform == 'win32') {
        platform = 'windows-pc';
    }
    if (process.platform == 'darwin') {
        platform = 'mac';
    }
    return { platform, prod };

}