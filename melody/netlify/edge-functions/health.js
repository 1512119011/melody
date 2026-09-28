// /api/health 边缘函数：直接探测 GDS 音乐 API 的稳定音源（netease / joox / bilibili）
// - search = 搜索接口能否返回曲目
// - play   = 第一首歌能否拿到可播放直链
// lastCheck 为本次检测完成时间。
const GDS_API = 'https://music-api.gdstudio.xyz/api.php';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function gdsUrl(params) {
  const qs = Object.keys(params)
    .map(k => k + '=' + encodeURIComponent(params[k]))
    .join('&');
  return GDS_API + '?' + qs;
}

async function gdsGet(params) {
  const r = await fetch(gdsUrl(params), {
    headers: { 'user-agent': BROWSER_UA, accept: 'application/json' },
  });
  try { return { status: r.status, json: await r.json() }; }
  catch(e) { return { status: r.status, json: null }; }
}

function fmtCheckTime(ts) {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
         p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

async function probeSource(src) {
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

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  try {
    const data = await runProbe();
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    });
  } catch(e) {
    const fallback = {
      sources: {
        netease:  { search:false, play:false },
        joox:     { search:false, play:false },
        bilibili: { search:false, play:false }
      },
      lastCheck: ''
    };
    return new Response(JSON.stringify(fallback), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    });
  }
};

export const config = { path: '/api/health' };
