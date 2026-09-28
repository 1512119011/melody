// Netlify Edge Function: 动态生成歌曲分享页（带 Open Graph 标签）
// 路径: /share?name=歌名&artist=歌手&pic=封面URL&source=曲库&id=歌曲ID
// 微信/QQ 爬虫抓取此页面时能读到 og:title / og:image / og:description，从而生成带封面的预览卡片
// 固化「来源曲库 + 歌曲ID」：打开时优先按ID在对应曲库加载，禁止跨库模糊搜索；原始音源失效再降级
export const config = { path: "/share" };
// HTML 转义，防止歌名/歌手中的特殊字符破坏 HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export default async (request) => {
  const url = new URL(request.url);
  const rawName = url.searchParams.get("name") || "";
  const rawArtist = url.searchParams.get("artist") || "";
  const rawPic = url.searchParams.get("pic") || "";
  const rawSource = url.searchParams.get("source") || "";
  const rawId = url.searchParams.get("id") || "";
  const name = rawName || "未知歌曲";
  const artist = rawArtist || "未知歌手";
  // 默认封面：音乐盒 logo
  const defaultCover =
    "https://s1.music.126.net/style/favicon.ico?v20180823";
  const cover = rawPic || defaultCover;
  const title = `《${name}》- ${artist}`;
  const description = `正在听《${name}》- ${artist}，来自 Melody 音乐盒`;
  const shareUrl = url.toString();
  // 跳转播放页：有 source+id 时按ID精确加载（/#/play），缺失时兼容旧链接回退搜索（/#/search）
  let playUrl;
  if (rawSource && rawId) {
    playUrl = `${url.origin}/#/play?source=${encodeURIComponent(rawSource)}&id=${encodeURIComponent(rawId)}&name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist)}&pic=${encodeURIComponent(cover)}&autoplay=1`;
  } else {
    playUrl = `${url.origin}/#/search?keyword=${encodeURIComponent(
      name + " " + artist
    )}&autoplay=1`;
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>${escapeHtml(title)} - Melody音乐盒</title>
<!-- ===== Open Graph（微信/QQ/Facebook 预览卡片核心） ===== -->
<meta property="og:type" content="music.song" />
<meta property="og:site_name" content="Melody音乐盒" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(cover)}" />
<meta property="og:image:width" content="300" />
<meta property="og:image:height" content="300" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="music:musician" content="${escapeHtml(artist)}" />
<!-- ===== Twitter Card（兼容部分平台） ===== -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(cover)}" />
<!-- ===== QQ 空间 / 老版 QQ 兼容 ===== -->
<meta itemprop="name" content="${escapeHtml(title)}" />
<meta itemprop="description" content="${escapeHtml(description)}" />
<meta itemprop="image" content="${escapeHtml(cover)}" />
<!-- ===== 普通搜索引擎描述 ===== -->
<meta name="description" content="${escapeHtml(description)}" />
<link rel="shortcut icon" href="https://s1.music.126.net/style/favicon.ico?v20180823" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    -webkit-font-smoothing: antialiased;
  }
  .share-card {
    background: #fff;
    border-radius: 20px;
    padding: 36px 28px;
    text-align: center;
    box-shadow: 0 8px 40px rgba(0,0,0,0.1);
    max-width: 340px;
    width: 100%;
    animation: cardIn 0.5s ease;
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cover-wrap {
    width: 200px;
    height: 200px;
    margin: 0 auto 24px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
  }
  .cover-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .song-name {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 8px;
    line-height: 1.3;
    word-break: break-all;
  }
  .song-artist {
    font-size: 15px;
    color: #888;
    margin-bottom: 28px;
  }
  .play-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 36px;
    background: #d43c33;
    color: #fff;
    border-radius: 28px;
    text-decoration: none;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(212,60,51,0.3);
  }
  .play-btn:hover {
    background: #b32c2c;
    transform: translateY(-1px);
  }
  .play-btn i { font-size: 14px; }
  .brand {
    margin-top: 20px;
    font-size: 12px;
    color: #bbb;
  }
  .loading-dots {
    display: inline-flex;
    gap: 4px;
    margin-left: 4px;
  }
  .loading-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #d43c33;
    animation: dotBounce 1.2s infinite ease-in-out;
  }
  .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes dotBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
</style>
</head>
<body>
  <div class="share-card">
    <div class="cover-wrap">
      <img src="${escapeHtml(cover)}" alt="${escapeHtml(name)}" onerror="this.src='${escapeHtml(defaultCover)}'" />
    </div>
    <div class="song-name">${escapeHtml(name)}</div>
    <div class="song-artist">${escapeHtml(artist)}</div>
    <a class="play-btn" href="${escapeHtml(playUrl)}">
      <i class="fas fa-play"></i> 播放歌曲
    </a>
    <div class="brand">Melody 音乐盒</div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
};
