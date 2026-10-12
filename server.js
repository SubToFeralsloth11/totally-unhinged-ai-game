// Zero-dependency static server so ES modules load (browsers block them on file://).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 8787;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('GERALD ate this file.');
  }
}).listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`UNHINGED.EXE running at ${url}  (Ctrl+C to stop)`);
  if (process.argv.includes('--open')) exec(`${process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'} ${url}`);
});
