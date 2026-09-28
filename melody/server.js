// Railway / Node 自托管服务器：
// 1) 托管 index.html 等静态文件
// 2) 提供 /api/health：直接探测 GDS 音乐 API 的稳定音源（netease / joox / bilibili）
//    - search = 搜索接口能否返回曲目
//    - play   = 第一首歌能否拿到可播放直链
//    结果缓存 60 秒；lastCheck 为服务器本次检测完成时间。
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PROBE_TTL_MS = 60 * 1000;

const GDS_API = 'https://music-api.gdstudio.xyz/api.php';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 内存缓存：归一后的健康检测结果
let cache = { data: null, fetchedAt: 0 };

function gdsUrl(params) {
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  return GDS_API + '?' + qs;
}
async function gdsGet(params) {
  const res = await fetch(gdsUrl(params), {
    headers: { 'user-agent': BROWSER_UA, accept: 'application/json' },
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch(e) { return { status: res.status, json: null }; }
}

function fmtCheckTime(ts) {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
         p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

async function probeSource(src) {
  // bilibili 曲库对通用词收录较少，用其稳定可命中的特色关键词探测
  const kw = src === 'bilibili' ? '普通DISCO' : '周杰伦';
  const r = { search: false, play: false };
  try {
    const s = await gdsGet({ types:'search', source:src, name:kw, count:5, pages:1 });
    const arr = Array.isArray(s.json) ? s.json : [];
    if (!arr.length) return r;
    r.search = true;
    const u = await gdsGet({ types:'url', source:src, id:String(arr[0].id), br:'192' });
    r.play = !!(u.json && u.json.url && /^https?:\/\//i.test(u.json.url));
  } catch(e) { /* 保持 false */ }
  return r;
}

async function runProbe() {
  const sources = {};
  await Promise.all(['netease', 'joox', 'bilibili'].map(async src => {
    sources[src] = await probeSource(src);
  }));
  return { sources, lastCheck: fmtCheckTime(Date.now()) };
}

async function getHealth() {
  if (cache.data && Date.now() - cache.fetchedAt < PROBE_TTL_MS) return cache.data;
  try {
    cache.data = await runProbe();
    cache.fetchedAt = Date.now();
  } catch(e) {
    if (!cache.data) {
      cache.data = {
        sources: {
          netease:  { search:false, play:false },
          joox:     { search:false, play:false },
          bilibili: { search:false, play:false }
        },
        lastCheck: ''
      };
    }
  }
  return cache.data;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.toml': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }
  if (req.url.split('?')[0] === '/api/health') {
    const data = await getHealth();
    res.writeHead(200, {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify(data));
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Melody server listening on :${PORT}`);
  getHealth();
});
