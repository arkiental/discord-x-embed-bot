import { readFile, writeFile } from 'node:fs/promises';

// This is a local visual approximation, not a screenshot of a logged-in Discord client.
const root = new URL('../', import.meta.url);
let post;
try { post = JSON.parse(await readFile(new URL('examples/live-post.json', root), 'utf8')); }
catch { post = JSON.parse(await readFile(new URL('examples/sample-post.json', root), 'utf8')); }
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
const time = post.timestamp ? new Intl.RelativeTimeFormat('en', { numeric: 'always' })
  .format(-Math.max(0, Math.round((Date.now() / 1000 - post.timestamp) / 60)), 'minute') : 'Date unavailable';
const media = post.media.map(item => item.type === 'photo' ?
  `<img src="${escape(item.url)}" alt="${escape(item.description)}" ${post.sensitive ? 'class="blurred"' : ''}>` :
  `<video controls src="${escape(item.url)}"></video>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X card — local visual preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#252640;color:#e5e5e8;font-family:"Segoe UI",Arial,sans-serif;padding:32px 40px}
.message{max-width:1200px;margin:auto}.bot{display:flex;align-items:center;gap:10px;font-size:29px;font-weight:600;margin:0 0 12px}.badge{font-size:21px;background:#5865f2;color:white;padding:0 7px;border-radius:7px}.bot time{font-weight:400;font-size:23px;color:#85858e;margin-left:6px}
.card{background:#232428;border:2px solid #37383e;border-radius:17px;padding:32px}.header{display:flex;align-items:flex-start;gap:24px}.copy{min-width:0;flex:1}.author{font-size:28px;line-height:38px}.author strong{font-weight:700}a{color:#4599ff;text-decoration:none}.text{font-size:28px;line-height:38px;white-space:pre-wrap;margin:12px 0 0}.avatar{width:170px;height:170px;object-fit:cover;border-radius:18px}.gallery{display:grid;grid-template-columns:repeat(${post.media.length === 1 ? 1 : 2},1fr);gap:8px;margin-top:20px}.gallery img,.gallery video{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px}.blurred{filter:blur(18px)}hr{height:2px;background:#3b3c42;border:0;margin:16px 0}.stats{font-size:28px;display:flex;gap:18px;align-items:center}.footer{color:#a7a7ae;font-size:21px;margin-top:30px;display:flex;align-items:center;gap:8px}.x{display:inline-flex;align-items:center;justify-content:center;background:#000;color:white;width:31px;height:31px;font-size:26px}.timestamp{background:#35363d;border-radius:5px;padding:2px 5px}.note{max-width:1200px;margin:18px auto 0;color:#a7a7b7;font-size:14px}
@media(max-width:700px){body{padding:16px}.card{padding:18px}.text,.author,.stats{font-size:17px;line-height:25px}.avatar{width:80px;height:80px}.header{gap:12px}.bot{font-size:20px}.bot time{font-size:14px}.badge{font-size:14px}.footer{font-size:14px;margin-top:20px}.gallery img{border-radius:10px}}
</style><div class="message"><div class="bot">Embedded <span class="badge">APP</span><time>Local preview</time></div>
<article class="card"><div class="header"><div class="copy"><div class="author"><strong>${escape(post.author.name)}</strong> (<a href="https://x.com/${escape(post.author.handle)}">@${escape(post.author.handle)}</a>)</div><p class="text">${escape(post.text)}</p></div>${post.author.avatar ? `<img class="avatar" src="${escape(post.author.avatar)}" alt="Profile image">` : ''}</div>
${media ? `<div class="gallery">${media}</div>` : ''}<hr><div class="stats"><span>💬 ${number(post.replies)}</span><span>🔁 ${number(post.reposts)}</span><span>❤️ ${number(post.likes)}</span></div><div class="footer"><a class="x" href="${escape(post.url)}">𝕏</a> • <span class="timestamp">${escape(time)}</span></div></article></div>
<p class="note">Local visual approximation using the real post. Discord controls the final dimensions, typography, emojis and gallery crop.</p></html>`;
await writeFile(new URL('examples/preview.html', root), html);
console.log('Created examples/preview.html. Open it in your browser.');
