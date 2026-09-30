# Discord X Embed Bot

Paste an **X/Twitter post link into a Discord server channel** and this bot sends a card matching the layout of your reference: bold author and linked handle, profile image on the right, post text, image/video gallery, divider, reply/repost/like counts, and an X link with a relative timestamp.

It detects X/Twitter links shared **in Discord**, including FxTwitter, FixupX and VxTwitter links. Discord invite links and Discord message links are outside this bot's scope.

The card uses native **Discord Components V2**. Discord controls fonts, colors, widths, emoji artwork and gallery crops across desktop/mobile, so exact pixels cannot be guaranteed. The bot's name/avatar are configured in the Developer Portal; name it **Embedded** to match the reference. The APP badge and message timestamp are supplied by Discord.

## Setup

1. Install [Node.js](https://nodejs.org/) 20.12 or newer (a current LTS is recommended).
2. Open the [Discord Developer Portal](https://discord.com/developers/applications), create an application, and open **Bot**. Enable **Message Content Intent** under Privileged Gateway Intents and save.
3. Generate/reset the **bot token**. Keep it private. Set `DISCORD_TOKEN` in the local `.env`. A new GitHub clone creates `.env` from `.env.example` when you run `start.bat`. Do not use your personal Discord account token. `.env` is excluded from GitHub and ZIP packages.
4. Copy the **Application ID** from General Information. In a terminal opened in this folder, run:

   ```powershell
   npm ci
   npm run invite -- YOUR_APPLICATION_ID --suppress
   ```

   Open the printed invite URL and add the bot to your test server. The optional `--suppress` grants **Manage Messages** so the bot can hide the original automatic preview after its cards send successfully. For a bot without that permission, omit `--suppress`; its card still works, but Discord's original preview may also remain.

5. Run:

   ```powershell
   npm start
   ```

   On Windows, double-click **start.bat**. It creates `.env` if missing, opens it when the token is unset, installs locked dependencies if needed, registers Windows sign-in startup, and runs the crash-restart supervisor. **Start-Bot.cmd** is an alias for this launcher.

6. Wait for the terminal to say the bot is online, then post your test link **as a human user**:

   ```text
   https://x.com/Arkiental/status/2105227461642379749?s=20
   ```

The bot works in **any Discord guild/server where it is invited and has channel permissions**. There is no guild ID restriction; leave `ALLOWED_CHANNEL_IDS` empty for every accessible channel in every joined guild. Enable the application's **Public Bot** switch in the Developer Portal if other people should be able to invite it to their servers.

The computer must stay powered on and connected for the bot to remain online. Creating this package does not create a Discord application or deploy a hosted bot.

## Windows startup and crash recovery

- **start.bat** registers a shortcut named `Arkiental Discord X Embed Bot` in your Windows account's Startup folder. At future Windows sign-ins it launches hidden and logs to `logs/bot.log`. This is startup **after sign-in**, not a Windows service before sign-in. No administrator access is needed.
- The supervisor restarts the Node bot **5 seconds after it exits**, including crashes and unsuccessful logins. It stops when you use **stop.bat** or press **Ctrl+C** in its console. `stop.bat` leaves future sign-in startup enabled.
- **remove-startup.bat** removes the sign-in shortcut. Run `stop.bat` too if you also want to stop the current bot.
- The Windows launcher prevents duplicate launches for the current account. Keep this folder in a stable location. If you move it, run `start.bat` again to update the shortcut.
- Logs rotate at approximately 5 MB, retaining `bot.log` and `bot.previous.log`. `runtime/` holds local supervision state. Both folders and `.env` are ignored by Git.
- Invalid/missing token configuration stops the Windows launcher before it starts the bot. Set `.env` and run `start.bat` again. Network failures during normal operation are handled by Discord reconnects or the supervisor's restart loop.

`npm start` also uses the crash-restart supervisor, without registering Windows startup. `npm run start:once` runs the bot once for debugging. Prefer `start.bat` on Windows for duplicate prevention and automatic sign-in startup.

## Options

| Setting | Default | Behavior |
| --- | --- | --- |
| `ALLOWED_CHANNEL_IDS` | Empty | All accessible server channels; comma-separated IDs restrict it. Thread IDs must be included explicitly when using a list. |
| `SUPPRESS_ORIGINAL_EMBEDS` | `true` | Suppresses original automatic previews after every supported link succeeds, with Manage Messages. Preserves previews when unrelated URLs are present or the link cap is exceeded. Never deletes the original message. |
| `MAX_LINKS_PER_MESSAGE` | `3` | Between 1 and 3; one card per unique post ID. |
| `FETCH_TIMEOUT_MS` | `12000` | How long a provider request can take. |
| `CACHE_TTL_SECONDS` | `60` | Temporarily caches fetched posts and statistics. `0` disables reuse. |
| `EMOJI_REPLY`, `EMOJI_REPOST`, `EMOJI_LIKE`, `EMOJI_X` | `💬`, `🔁`, `❤️`, `𝕏` | Override with custom Discord emojis available to the application, such as `<:x_logo:123456789012345678>`. |

For the exact icon artwork from your reference, supply matching custom emojis in `.env`; standard Unicode icons vary with Discord's renderer. Counts are a snapshot when fetched, not continuously updated; the relative timestamp updates in Discord.

Sensitive media and links wrapped in `||spoiler markup||` are blurred. Bot/webhook messages are ignored to avoid loops. The bot processes newly posted messages; it does not scan history, process edits, or synchronize card deletions. Duplicate gateway events are suppressed in memory for up to 24 hours (bounded to 10,000 messages). Data requests are cached/coalesced and processed at most two messages at a time, with a bounded queue.

## Verification and preview

```powershell
npm test
npm run check-link -- "https://x.com/Arkiental/status/2105227461642379749?s=20"
npm run preview
```

`check-link` requires no Discord token and sends no Discord messages. It fetches the public post, validates the library's Components V2 payload, and saves `examples/live-post.json` and `examples/live-payload.json`. `preview` creates `examples/preview.html` using that data, or the included sample. Open it to inspect a **local visual approximation**, not a real Discord screenshot. `examples/preview.png` is the inspected local preview from development.

Automated tests cover supported and hostile URLs, spoiler handling, native card layout, text limits, caching, concurrent fetches, missing permissions, duplicate events, upstream failures, and when original previews should remain visible. The live post fetch and local serialization were checked during development. Sending/rendering in your Discord server still needs your bot token and your later test.

## Troubleshooting

- **Bot is online but silent:** enable Message Content Intent in the portal, restart the bot, verify `ALLOWED_CHANNEL_IDS`, and post a new link from a human account. Check channel permission overrides for View Channel, Send Messages and Embed Links; threads also need Send Messages in Threads.
- **Login fails / gateway code 4014:** check the bot token and privileged intent setting. Bots requiring Discord verification may need intent approval.
- **Two previews:** grant Manage Messages or keep both. Suppression is intentionally skipped if fetching/sending fails, another type of URL exists in the message, or more than the configured number of posts are pasted.
- **Private/deleted/rate-limited post:** the bot sends an explanatory reply and retains the original message/preview. Retry by posting the link again later.
- **Media fails to display:** X's CDN, Discord's media proxy or the public provider may be unavailable. The original post is reachable through the linked X footer. Video playback depends on Discord's proxy and the source video.

## Data source and API references

Public post data comes from the third-party [FxTwitter/FxEmbed public API](https://docs.fxembed.com/api/introduction/), using the supported [legacy status endpoint](https://github.com/FxEmbed/FxEmbed/wiki/Status-Fetch-API). No X API key is required for that endpoint. Availability depends on that service and X; private posts cannot be fetched.

The native layout follows [Discord's Components V2 reference](https://docs.discord.com/developers/components/reference), using discord.js 14.27.0. Automatic detection requires [Message Content Intent](https://docs.discord.com/developers/events/gateway#message-content-intent). Only post IDs parsed from supported hosts are requested; arbitrary pasted URLs are not fetched.
