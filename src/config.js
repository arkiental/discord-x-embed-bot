import { fileURLToPath } from 'node:url';

export function loadEnv() {
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function readConfig(env = process.env) {
  const integer = (key, fallback, min, max) => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be ${min}–${max}.`);
    return value;
  };
  const channels = (env.ALLOWED_CHANNEL_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (channels.some(id => !/^\d{17,20}$/.test(id))) throw new Error('ALLOWED_CHANNEL_IDS must contain Discord channel IDs.');
  const suppress = (env.SUPPRESS_ORIGINAL_EMBEDS || 'true').toLowerCase();
  if (!['true', 'false'].includes(suppress)) throw new Error('SUPPRESS_ORIGINAL_EMBEDS must be true or false.');
  const icon = (key, fallback) => {
    const value = env[key]?.trim() || fallback;
    if (value.length > 100 || /[\r\n]/.test(value)) throw new Error(`${key} must be a single emoji string.`);
    return value;
  };
  return { token: env.DISCORD_TOKEN?.trim(), allowedChannels: new Set(channels),
    suppressOriginal: suppress === 'true', maxLinks: integer('MAX_LINKS_PER_MESSAGE', 3, 1, 3),
    timeoutMs: integer('FETCH_TIMEOUT_MS', 12000, 1000, 60000),
    cacheTtlMs: integer('CACHE_TTL_SECONDS', 60, 0, 3600) * 1000,
    emoji: { reply: icon('EMOJI_REPLY', '💬'), repost: icon('EMOJI_REPOST', '🔁'),
      like: icon('EMOJI_LIKE', '❤️'), x: icon('EMOJI_X', '𝕏') } };
}
