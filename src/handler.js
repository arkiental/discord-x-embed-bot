import { PermissionFlagsBits } from 'discord.js';
import { extractPostLinks } from './links.js';
import { buildCard } from './card.js';
import { PostFetchError } from './provider.js';

export function createMessageHandler({ provider, config, botUser, logger = console, now = Date.now }) {
  const handled = new Map();
  let active = 0;
  const queue = [];
  // Bound provider traffic across all channels, not just within one message.
  const acquire = () => active < 2 ? (active++, Promise.resolve()) :
    new Promise(resolve => queue.push(resolve));
  const release = () => { if (queue.length) queue.shift()(); else active--; };
  const mentionOptions = { parse: [], repliedUser: false };
  return async function onMessage(message) {
    if (!message.inGuild() || message.author.bot || message.webhookId ||
        !message.channel.isSendable() ||
        (config.allowedChannels.size && !config.allowedChannels.has(message.channelId))) return;
    const allLinks = extractPostLinks(message.content);
    if (!allLinks.length) return;
    const permissions = message.channel.permissionsFor(botUser());
    const canSend = message.channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, canSend, PermissionFlagsBits.EmbedLinks])) {
      logger.warn(`Skipping message ${message.id}: missing View Channel, Send Messages, or Embed Links.`);
      return;
    }
    const cutoff = now() - 86400000;
    for (const [id, at] of handled) { if (at < cutoff) handled.delete(id); else break; }
    if (handled.has(message.id)) return;
    if (queue.length >= 40) { logger.warn('Preview queue is full; skipping a new message.'); return; }
    handled.set(message.id, now());
    if (handled.size > 10000) handled.delete(handled.keys().next().value);
    await acquire();
    let allSucceeded = true;
    try {
      for (const link of allLinks.slice(0, config.maxLinks)) {
        try {
          const post = await provider.get(link);
          await message.channel.send(buildCard(post, { emoji: config.emoji, spoiler: link.spoiler }));
        } catch (error) {
          allSucceeded = false;
          // Log only safe codes, never raw requests (which could contain the Discord token).
          logger.warn(`Preview failed for post ${link.id}: ${error instanceof PostFetchError ? error.code : 'DISCORD_SEND_FAILED'}`);
          if (error instanceof PostFetchError) {
            await message.reply({ content: `Could not preview <${link.url}>. ${error.message}`,
              allowedMentions: mentionOptions }).catch(() => logger.warn('Could not send the preview error reply.'));
          }
        }
      }
      // Discord suppresses ALL previews on a message; retain previews for unrelated URLs.
      const rawUrls = message.content.match(/https?:\/\/[^\s<>"`|]+/gi) || [];
      const onlySupportedLinks = rawUrls.every(url => extractPostLinks(url).length > 0);
      if (config.suppressOriginal && allSucceeded && allLinks.length <= config.maxLinks &&
          onlySupportedLinks && permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.suppressEmbeds(true).catch(() => logger.warn('Could not suppress the original URL preview.'));
      }
    } finally { release(); }
  };
}
