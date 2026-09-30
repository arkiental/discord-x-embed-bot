import { PermissionFlagsBits } from 'discord.js';
const id = process.argv[2];
if (!/^\d{17,20}$/.test(id || '')) {
  console.error('Usage: npm run invite -- YOUR_APPLICATION_ID [--suppress]'); process.exit(1);
}
let permissions = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads | PermissionFlagsBits.EmbedLinks | PermissionFlagsBits.ReadMessageHistory;
if (process.argv.includes('--suppress')) permissions |= PermissionFlagsBits.ManageMessages;
const params = new URLSearchParams({ client_id: id, scope: 'bot', permissions: permissions.toString() });
console.log(`https://discord.com/oauth2/authorize?${params}`);
