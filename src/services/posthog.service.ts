import { PostHog } from 'posthog-node'

export const PostHogClient = new PostHog(
    '',
    { host: 'https://app.posthog.com' }
)