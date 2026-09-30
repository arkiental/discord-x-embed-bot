const hosts = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com',
  'www.twitter.com', 'mobile.twitter.com', 'fxtwitter.com', 'www.fxtwitter.com',
  'fixupx.com', 'www.fixupx.com', 'vxtwitter.com', 'www.vxtwitter.com']);

export function extractPostLinks(content = '') {
  const result = [];
  const seen = new Set();
  for (const match of content.matchAll(/https?:\/\/[^\s<>"`|]+/gi)) {
    const raw = match[0].replace(/[),.!?:;\]}]+$/, '');
    let url;
    try { url = new URL(raw); } catch { continue; }
    if (!hosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) continue;
    const path = url.pathname.match(/^\/(?:([A-Za-z0-9_]{1,15})\/status|i\/(?:web\/)?status)\/(\d{5,25})(?:\/(?:photo|video)\/\d+)?\/?$/i);
    if (!path || seen.has(path[2])) continue;
    seen.add(path[2]);
    const [, handle, id] = path;
    result.push({ id, handle: handle || 'i', url: `https://x.com/${handle || 'i'}/status/${id}`,
      // Respect explicit Discord spoiler markup on a link.
      spoiler: /\|\|[^|]*$/.test(content.slice(0, match.index)) });
  }
  return result;
}
