import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits, PermissionsBitField, MessageFlags } from 'discord.js';
import { extractPostLinks } from '../src/links.js';
import { PostProvider, PostFetchError, normalizePost } from '../src/provider.js';
import { buildCard } from '../src/card.js';
import { createMessageHandler } from '../src/handler.js';
import { readConfig } from '../src/config.js';

const url = 'https://x.com/Arkiental/status/2105227461642379749?s=20';
const link = extractPostLinks(url)[0];
const tweet = { text: 'Watch render\n\n#Blender', author: { name: 'Arkiental', screen_name: 'Arkiental',
  avatar_url: 'https://pbs.twimg.com/profile_images/1/avatar.jpg' }, created_timestamp: 1790760314,
  replies: 0, retweets: 0, likes: 0, media: { all: [
    { type: 'photo', url: 'https://pbs.twimg.com/media/one.jpg' },
    { type: 'photo', url: 'https://pbs.twimg.com/media/two.jpg' }] } };
const normalized = () => normalizePost(structuredClone(tweet), link);
const response = (data, status = 200) => ({ status, ok: status < 400, json: async () => data });

test('detects pasted links, media suffixes, i/status, and mobile Twitter links; deduplicates by ID', () => {
  const links = extractPostLinks(`${url}\n<https://twitter.com/Arkiental/status/2105227461642379749/photo/2>\nhttps://mobile.twitter.com/test/status/123456789).\nhttps://x.com/i/web/status/987654321`);
  assert.deepEqual(links.map(v => v.id), ['2105227461642379749', '123456789', '987654321']);
  assert.equal(links[0].url, 'https://x.com/Arkiental/status/2105227461642379749');
});
test('recognizes supported preview services and preserves spoiler markup', () => {
  for (const host of ['fxtwitter.com', 'fixupx.com', 'vxtwitter.com']) {
    assert.equal(extractPostLinks(`||https://${host}/test/status/123456789||`)[0].spoiler, true);
  }
  assert.equal(extractPostLinks(url)[0].spoiler, false);
});
test('rejects lookalike domains, arbitrary URLs, credentials, ports and non-post links', () => {
  for (const bad of ['https://x.com.evil.test/test/status/123456', 'https://evil.test/x.com/test/status/123456',
    'https://x.com@evil.test/test/status/123456', 'https://user:pass@x.com/test/status/123456',
    'https://x.com:8080/test/status/123456', 'https://discord.gg/testing', 'https://x.com/Arkiental',
    'https://x.com/test/status/123456/extra']) assert.deepEqual(extractPostLinks(bad), [], bad);
});
test('provider uses the fixed public API URL and coalesces concurrent requests', async () => {
  let calls = 0;
  const provider = new PostProvider({ fetchImpl: async (target, options) => {
    calls++; assert.equal(target, `https://api.fxtwitter.com/status/${link.id}`);
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    await new Promise(resolve => setTimeout(resolve, 10));
    return response({ code: 200, tweet });
  } });
  const posts = await Promise.all([provider.get(link), provider.get(link), provider.get(link)]);
  assert.equal(calls, 1); assert.equal(posts[0].media.length, 2);
  await provider.get(link); assert.equal(calls, 1);
});
test('provider refreshes stale statistics and accepts status-shaped responses', async () => {
  let now = 0, calls = 0;
  const provider = new PostProvider({ now: () => now, cacheTtlMs: 100,
    fetchImpl: async () => response({ code: 200, status: { ...tweet, likes: ++calls } }) });
  assert.equal((await provider.get(link)).likes, 1);
  now = 99; assert.equal((await provider.get(link)).likes, 1);
  now = 101; assert.equal((await provider.get(link)).likes, 2);
});
for (const [status, code] of [[401, 'PRIVATE'], [403, 'PRIVATE'], [404, 'NOT_FOUND'], [429, 'RATE_LIMITED']]) {
  test(`provider explains HTTP ${status} and never caches failed fetches`, async () => {
    let calls = 0;
    const provider = new PostProvider({ fetchImpl: async () => { calls++; return response({}, status); } });
    for (let i = 0; i < 2; i++) await assert.rejects(provider.get(link), error => error.code === code);
    assert.equal(calls, 2);
  });
}
test('provider handles error codes in HTTP 200 responses and malformed JSON', async () => {
  const failed = new PostProvider({ fetchImpl: async () => response({ code: 404 }) });
  await assert.rejects(failed.get(link), error => error.code === 'NOT_FOUND');
  const invalid = new PostProvider({ fetchImpl: async () => ({ status: 200, ok: true,
    json: async () => { throw new SyntaxError('Unexpected JSON'); } }) });
  await assert.rejects(invalid.get(link), PostFetchError);
});
test('provider reports a timeout without leaking low-level errors', async () => {
  const provider = new PostProvider({ fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
  await assert.rejects(provider.get(link), error => error.code === 'TIMEOUT');
});
test('normalization rejects incomplete author data and strips unsafe media URLs', () => {
  assert.throws(() => normalizePost({ ...tweet, author: { screen_name: 'bad/handle' } }, link), PostFetchError);
  const post = normalizePost({ ...tweet, replies: null, media: { all: [
    { type: 'photo', url: 'http://pbs.twimg.com/one.jpg' },
    { type: 'photo', url: 'https://private.example/one.jpg' },
    { type: 'video', url: 'https://video.twimg.com/one.mp4' }] } }, link);
  assert.equal(post.replies, null); assert.equal(post.media.length, 1); assert.equal(post.media[0].type, 'video');
});
test('native card has header, right thumbnail, gallery, separator, stats and relative timestamp in order', () => {
  const card = buildCard(normalized());
  const container = card.components[0].toJSON();
  assert.equal(card.flags, MessageFlags.IsComponentsV2);
  assert.equal(container.type, 17);
  assert.deepEqual(container.components.map(v => v.type), [9, 12, 14, 10, 10]);
  assert.equal(container.components[0].accessory.type, 11);
  assert.equal(container.components[1].items.length, 2);
  assert.match(container.components[3].content, /💬 0.*🔁 0.*❤️ 0/);
  assert.match(container.components[4].content, /<t:1790760314:R>/);
  assert.deepEqual(card.allowedMentions.parse, []);
  assert.equal(card.embeds, undefined); assert.equal(card.content, undefined);
});
test('native card handles text-only posts, missing avatars and unknown counts', () => {
  const post = normalized(); post.media = []; post.author.avatar = null; post.likes = null;
  const children = buildCard(post).components[0].toJSON().components;
  assert.deepEqual(children.map(v => v.type), [10, 14, 10, 10]);
  assert.match(children[2].content, /❤️ —/);
});
test('spoiler and sensitive media are blurred; ordinary media stay visible', () => {
  for (const [sensitive, spoiler, expected] of [[false, false, false], [true, false, true], [false, true, true]]) {
    const post = normalized(); post.sensitive = sensitive;
    const items = buildCard(post, { spoiler }).components[0].toJSON().components[1].items;
    assert.ok(items.every(v => v.spoiler === expected));
  }
});
test('long hostile post text is bounded, escaped, and cannot trigger Discord notifications', () => {
  const post = normalized(); post.text = '@everyone <@123456789> **fake heading** ' + 'a'.repeat(30000);
  const card = buildCard(post);
  const texts = card.components[0].toJSON().components.flatMap(c => c.type === 9 ? c.components : [c])
    .filter(c => c.type === 10).map(c => c.content);
  assert.ok(texts.join('').length <= 4000);
  assert.match(texts[0], /\\\*\\\*fake heading/);
  assert.match(texts[0], /Read full post/);
  assert.deepEqual(card.allowedMentions, { parse: [], repliedUser: false });
});

function fakeMessage({ content = url, permissions = [], bot = false, webhookId = null, id = '100', thread = false } = {}) {
  const sent = [], replies = [], suppressed = [];
  const perms = new PermissionsBitField(permissions);
  return { id, content, channelId: '123456789012345678', author: { bot }, webhookId,
    inGuild: () => true, channel: { isSendable: () => true, isThread: () => thread,
      permissionsFor: () => perms, send: async payload => { sent.push(payload); return { id: '200' }; } },
    reply: async payload => { replies.push(payload); }, suppressEmbeds: async flag => { suppressed.push(flag); },
    sent, replies, suppressed };
}
const sendPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
const createHandler = (options = {}) => createMessageHandler({ provider: { get: async () => normalized() },
  config: readConfig({}), botUser: () => ({ id: 'bot' }), logger: { warn: () => {} }, ...options });

test('handler sends only one card for duplicate gateway delivery, including concurrent events', async () => {
  const msg = fakeMessage({ permissions: sendPermissions });
  const handle = createHandler(); await Promise.all([handle(msg), handle(msg)]);
  assert.equal(msg.sent.length, 1); assert.deepEqual(msg.suppressed, []);
});
test('handler ignores bot/webhook messages, unrelated links and channels outside the allow list', async () => {
  const handle = createHandler({ config: readConfig({ ALLOWED_CHANNEL_IDS: '987654321012345678' }) });
  const messages = [fakeMessage({ bot: true }), fakeMessage({ webhookId: '123' }),
    fakeMessage({ content: 'https://discord.gg/hello' }), fakeMessage({ permissions: sendPermissions })];
  for (const msg of messages) { await handle(msg); assert.equal(msg.sent.length, 0); }
});
test('handler requires send permissions and supports thread-specific permissions', async () => {
  const noPermissions = fakeMessage(); await createHandler()(noPermissions); assert.equal(noPermissions.sent.length, 0);
  const thread = fakeMessage({ thread: true, permissions: [PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.EmbedLinks] });
  await createHandler()(thread); assert.equal(thread.sent.length, 1);
});
test('handler suppresses original URL embeds only after successful cards and only with permission', async () => {
  const msg = fakeMessage({ permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  await createHandler()(msg); assert.equal(msg.sent.length, 1); assert.deepEqual(msg.suppressed, [true]);
  const mixed = fakeMessage({ content: url + ' https://example.com', permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  await createHandler()(mixed); assert.deepEqual(mixed.suppressed, []);
  const disabled = fakeMessage({ permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  await createHandler({ config: readConfig({ SUPPRESS_ORIGINAL_EMBEDS: 'false' }) })(disabled);
  assert.deepEqual(disabled.suppressed, []);
});
test('failed fetch leaves the original preview and sends a clear error without mentions', async () => {
  const msg = fakeMessage({ permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  await createHandler({ provider: { get: async () => { throw new PostFetchError('Post deleted.', 'NOT_FOUND'); } } })(msg);
  assert.equal(msg.sent.length, 0); assert.deepEqual(msg.suppressed, []);
  assert.match(msg.replies[0].content, /Post deleted/); assert.deepEqual(msg.replies[0].allowedMentions.parse, []);
});
test('failed Discord send leaves the original preview visible', async () => {
  const msg = fakeMessage({ permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  msg.channel.send = async () => { throw new Error('Missing Permissions'); };
  await createHandler()(msg); assert.deepEqual(msg.suppressed, []);
});
test('message link cap does not hide unsent original previews', async () => {
  const content = `${url} https://x.com/test/status/123456 https://x.com/test/status/123457 https://x.com/test/status/123458`;
  const msg = fakeMessage({ content, permissions: [...sendPermissions, PermissionFlagsBits.ManageMessages] });
  await createHandler()(msg); assert.equal(msg.sent.length, 3); assert.deepEqual(msg.suppressed, []);
});
test('global handler queue keeps provider concurrency at two', async () => {
  let active = 0, maximum = 0;
  const handle = createHandler({ provider: { get: async () => {
    maximum = Math.max(maximum, ++active); await new Promise(resolve => setTimeout(resolve, 10));
    active--; return normalized();
  } } });
  const messages = Array.from({ length: 8 }, (_, i) => fakeMessage({ id: String(i), permissions: sendPermissions }));
  await Promise.all(messages.map(handle)); assert.equal(maximum, 2); assert.ok(messages.every(msg => msg.sent.length === 1));
});
test('invalid configuration fails early', () => {
  for (const env of [{ MAX_LINKS_PER_MESSAGE: '50' }, { FETCH_TIMEOUT_MS: 'no' },
    { ALLOWED_CHANNEL_IDS: 'not-an-id' }, { SUPPRESS_ORIGINAL_EMBEDS: 'maybe' }]) {
    assert.throws(() => readConfig(env));
  }
});
