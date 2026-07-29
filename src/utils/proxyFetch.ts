const userAgent = 'ReAdmin (https://readmin.app)';

export default async function proxyFetch(
  url: string,
  config?: RequestInit,
  disableProxy = true,
  maxRetries = 3,
): Promise<Response> {
  if (!config){
    config = {
      headers: {
        'user-agent': userAgent
      }
    };
  }
  if (!config.headers) {
    config.headers = {
      'user-agent': userAgent
    };
  }
  if (!('user-agent' in config.headers)) {
    //@ts-expect-error why does node-fetch's RequestInit type not recognize 'user-agent' as a valid header key? who knows
    config.headers['user-agent'] = userAgent;
  }
  
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const useProxy = attempt >= 2 && !disableProxy;
    const attemptConfig: RequestInit = config;

    try {
      const response = await fetch(url, attemptConfig);
      if (response.ok) return response;

      // Don't retry client errors (4xx) — they won't succeed on retry
      if (response.status >= 400 && response.status < 500) return response;

      // On server error, store it and retry (unless it's the last attempt)
      if (attempt === maxRetries - 1) return response;

      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError;
}