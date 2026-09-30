import { writeFile } from 'node:fs/promises';
import { extractPostLinks } from '../src/links.js';
import { PostProvider } from '../src/provider.js';
import { buildCard } from '../src/card.js';
import { loadEnv, readConfig } from '../src/config.js';

loadEnv();
const link = extractPostLinks(process.argv[2] || 'https://x.com/Arkiental/status/2105227461642379749?s=20')[0];
if (!link) { console.error('Provide an X/Twitter status URL.'); process.exit(1); }
try {
  const config = readConfig();
  const post = await new PostProvider(config).get(link);
  const card = buildCard(post, { emoji: config.emoji, spoiler: link.spoiler });
  const payload = { ...card, components: card.components.map(component => component.toJSON()) };
  await writeFile(new URL('../examples/live-post.json', import.meta.url), JSON.stringify(post, null, 2));
  await writeFile(new URL('../examples/live-payload.json', import.meta.url), JSON.stringify(payload, null, 2));
  console.log(`Fetched @${post.author.handle}: ${post.media.length} media items. Validated Discord Components V2 payload.`);
  console.log('Saved examples/live-post.json and examples/live-payload.json. No Discord message was sent.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
