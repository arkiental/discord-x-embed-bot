export class PostFetchError extends Error {
  constructor(message, code = 'UPSTREAM_ERROR') { super(message); this.name = 'PostFetchError'; this.code = code; }
}

// Only these provider/media hosts are passed to Discord; never request arbitrary user URLs.
export function safeMediaUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!['pbs.twimg.com', 'video.twimg.com', 'mosaic.fxtwitter.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function normalizePost(tweet, link) {
  if (!tweet || typeof tweet.text !== 'string' || !tweet.author ||
      !/^[A-Za-z0-9_]{1,15}$/.test(tweet.author.screen_name)) {
    throw new PostFetchError('The post provider returned incomplete data. Try again later.', 'INVALID_DATA');
  }
  const timestamp = Number(tweet.created_timestamp) || Math.floor(Date.parse(tweet.created_at) / 1000);
  const ordered = Array.isArray(tweet.media?.all) ? tweet.media.all :
    [...(tweet.media?.photos || []), ...(tweet.media?.videos || [])];
  const media = ordered.flatMap(item => {
    const url = safeMediaUrl(item.url);
    if (!url || !['photo', 'video', 'gif'].includes(item.type)) return [];
    return [{ url, type: item.type, description: String(item.alt_text || item.description ||
      `Media from @${tweet.author.screen_name}`).slice(0, 1024) }];
  }).slice(0, 10);
  const count = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : null;
  return {
    id: link.id, url: `https://x.com/${tweet.author.screen_name}/status/${link.id}`,
    text: tweet.text, author: { name: String(tweet.author.name || tweet.author.screen_name),
      handle: tweet.author.screen_name, avatar: safeMediaUrl(tweet.author.avatar_url) },
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : null,
    replies: count(tweet.replies), reposts: count(tweet.retweets), likes: count(tweet.likes),
    sensitive: Boolean(tweet.possibly_sensitive), media
  };
}

export class PostProvider {
  constructor({ timeoutMs = 12000, cacheTtlMs = 60000, fetchImpl = fetch, now = Date.now } = {}) {
    this.timeoutMs = timeoutMs; this.cacheTtlMs = cacheTtlMs; this.fetch = fetchImpl; this.now = now;
    this.cache = new Map(); this.inFlight = new Map();
  }
  async get(link) {
    const cached = this.cache.get(link.id);
    if (cached && cached.expires > this.now()) return cached.post;
    if (this.inFlight.has(link.id)) return this.inFlight.get(link.id);
    const pending = this.load(link).then(post => {
      // Bound memory even when a busy server shares many unique links.
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(link.id, { post, expires: this.now() + this.cacheTtlMs });
      return post;
    }).finally(() => this.inFlight.delete(link.id));
    this.inFlight.set(link.id, pending);
    return pending;
  }
  async load(link) {
    let response, data;
    try {
      response = await this.fetch(`https://api.fxtwitter.com/status/${link.id}`, {
        signal: AbortSignal.timeout(this.timeoutMs), redirect: 'error',
        headers: { 'User-Agent': 'DiscordXEmbedBot/1.0 (public post preview)', Accept: 'application/json' }
      });
      if ([401, 403, 404, 429].includes(response.status)) throw statusError(response.status);
      if (!response.ok) throw new PostFetchError('The post provider is unavailable. Try again later.');
      data = await response.json();
    } catch (error) {
      if (error instanceof PostFetchError) throw error;
      if (['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new PostFetchError('Fetching the post timed out. Try again later.', 'TIMEOUT');
      }
      throw new PostFetchError('Could not reach the post provider. Try again later.');
    }
    if (Number(data.code) !== 200) throw statusError(Number(data.code));
    return normalizePost(data.tweet || data.status, link);
  }
}

function statusError(code) {
  if ([401, 403].includes(code)) return new PostFetchError('This post is private or unavailable.', 'PRIVATE');
  if (code === 404) return new PostFetchError('This post could not be found; it may have been deleted.', 'NOT_FOUND');
  if (code === 429) return new PostFetchError('The post provider is rate limited. Try again in a minute.', 'RATE_LIMITED');
  return new PostFetchError('The post provider could not load this post. Try again later.');
}
