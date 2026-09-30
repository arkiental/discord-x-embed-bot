import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';

export const defaultEmoji = { reply: '💬', repost: '🔁', like: '❤️', x: '𝕏' };

export function escapeMarkdown(value) {
  return String(value).replace(/([\\*_~`>|\[\]()#])/g, '\\$1');
}

export function buildCard(post, { emoji = defaultEmoji, spoiler = false } = {}) {
  const author = `**${escapeMarkdown(post.author.name.slice(0, 150))}** ([@${post.author.handle}](https://x.com/${post.author.handle}))`;
  const text = escapeMarkdown(post.text || '').slice(0, 3200) +
    (escapeMarkdown(post.text || '').length > 3200 ? `…\n[Read full post](${post.url})` : '');
  const header = new TextDisplayBuilder().setContent(`${author}\n\n${text}`.trim());
  const container = new ContainerBuilder();
  if (post.author.avatar) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(header)
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(post.author.avatar)
        .setDescription(`${post.author.handle}'s profile image`)));
  } else container.addTextDisplayComponents(header);
  if (post.media.length) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      ...post.media.map(item => new MediaGalleryItemBuilder().setURL(item.url)
        .setDescription(item.description).setSpoiler(spoiler || post.sensitive))));
  }
  const number = value => value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${emoji.reply} ${number(post.replies)}  ${emoji.repost} ${number(post.reposts)}  ${emoji.like} ${number(post.likes)}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# [${emoji.x}](${post.url}) • ${post.timestamp ? `<t:${post.timestamp}:R>` : 'Date unavailable'}`));
  return { components: [container], flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [], repliedUser: false } };
}
