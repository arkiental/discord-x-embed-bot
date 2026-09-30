import { loadEnv, readConfig } from '../src/config.js';
try {
  loadEnv();
  const config = readConfig();
  if (!config.token || config.token === 'PASTE_YOUR_BOT_TOKEN_HERE') {
    console.error('Set DISCORD_TOKEN in .env, save it, then run start.bat again.');
    process.exitCode = 2;
  } else console.log('Configuration is ready.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
