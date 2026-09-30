import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadEnv, readConfig } from './config.js';
import { PostProvider } from './provider.js';
import { createMessageHandler } from './handler.js';

loadEnv();
let config;
try {
  config = readConfig();
  if (!config.token || config.token === 'PASTE_YOUR_BOT_TOKEN_HERE') {
    throw new Error('Set DISCORD_TOKEN in .env (copy .env.example first).');
  }
} catch (error) { console.error(error.message); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const provider = new PostProvider(config);
const onMessage = createMessageHandler({ provider, config, botUser: () => client.user });
client.once(Events.ClientReady, ready => {
  console.log(`${ready.user.tag} is online. Post an X/Twitter status link in a permitted channel.`);
});
client.on(Events.MessageCreate, message => {
  onMessage(message).catch(() => console.error('Message processing failed. Check bot permissions and network connectivity.'));
});
client.on(Events.Error, () => console.error('Discord connection error. Check connectivity and the bot configuration.'));
client.on(Events.ShardError, () => console.error('Discord gateway error. Check connectivity and enabled intents.'));
client.on(Events.ShardDisconnect, event => {
  if (event.code === 4014) console.error('Enable Message Content Intent in Developer Portal → Bot → Privileged Gateway Intents.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { client.destroy(); process.exit(0); });
client.login(config.token).catch(() => {
  console.error('Login failed. Check DISCORD_TOKEN and enable Message Content Intent in the Developer Portal.');
  client.destroy(); process.exitCode = 1;
});
