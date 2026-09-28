# Melody 音乐盒 - 分享链接音源固化修复

## 问题
分享链接丢失原始曲库与歌曲唯一 ID 信息。网易云曲库生成的分享链接打开后，未使用链接内指定的网易云歌曲资源，自动跳转酷我按歌名搜索歌曲，导致音源匹配错误，出现播放失败。

## 原因
- 分享链接只传了 `name`（歌名）、`artist`（歌手）、`pic`（封面），**没有传递来源曲库（source）和歌曲唯一 ID（id）**
- Edge Function 跳转目标是 `/#/search?keyword=歌名 歌手`，按歌名模糊搜索
- 搜索页默认曲库为酷我（`searchSource: 'kuwo'`），导致网易云的歌被迫用酷我搜索 → 匹配错误 → 播放失败

## 解决方案
分享链接**固化「来源曲库 + 歌曲 ID」**，打开时优先按链接存储的 ID 在对应曲库加载歌曲，禁止直接跨库模糊搜索；原始音源失效再做降级切换音源。

### 工作流程
1. 用户点分享 → 生成链接 `https://你的域名/share?name=歌名&artist=歌手&pic=封面URL&source=曲库&id=歌曲ID`
2. 微信/QQ 爬虫抓取该链接 → Edge Function 返回包含 `og:title` / `og:image` / `og:description` 的 HTML
3. 微信/QQ 显示带专辑封面、歌名、歌手的预览卡片
4. 用户点击卡片 → 跳转 `/#/play?source=曲库&id=歌曲ID&name=...&artist=...&pic=...&autoplay=1`
5. 页面按 `source + id` 在对应曲库精确加载并播放歌曲
6. 若原始音源播放失败（audio error 或 12 秒内未成功播放），自动按顺序在其他曲库搜索同一首歌并切换

### 兼容性
- 新版分享链接（带 `source` + `id`）→ 走 `/#/play` 按 ID 精确播放
- 旧版分享链接（无 `source`/`id`）→ Edge Function 自动回退到 `/#/search` 搜索播放，不影响已有链接

## 文件说明
```
melody-share-fix/
├── index.html                          # 主页面（分享链接生成增加 source/id；新增 /play 路由和降级逻辑）
├── netlify.toml                        # Netlify 部署配置（Edge Function 路由映射）
└── netlify/
    └── edge-functions/
        └── share.js                    # Edge Function（接收 source/id，跳转 /play 路由）
```

## 部署步骤
### 方式一：Git 部署（推荐）
1. 将这 3 个文件（保持目录结构）推送到你的 GitHub 仓库
2. 在 Netlify 控制台重新触发部署（Deploys → Trigger deploy）
3. 部署完成后，Edge Functions 会自动生效

### 方式二：拖拽部署
1. 将 `index.html`、`netlify.toml` 和 `netlify/` 文件夹一起打包
2. 登录 Netlify → 你的站点 → Deploys → 拖拽整个文件夹到部署区域
3. 等待部署完成

### 验证部署成功
部署完成后，在浏览器访问（替换为你的域名和真实歌曲参数）：
```
https://你的域名/share?name=Always Online&artist=林俊杰&pic=https://p1.music.126.net/xxx.jpg&source=netease&id=123456
```
应该能看到带封面的歌曲卡片页面，点击"播放歌曲"后跳转到播放页，顶部音源标签应显示"网易云音乐"（而非酷我），并能正常播放。

---

## 2026-09-18 音源与 MV 修复说明

### 修复内容
1. **搜索数据修复**：此前 QQ音乐 / 酷狗 的搜索结果与网易云完全一致（后端不支持这两个源，代码直接转发了网易云数据）。
   - **QQ音乐**：接入 XCloud `qq_source.php` 接口，现在返回**真实 QQ 曲库**的搜索数据（歌名/歌手/封面均为 QQ 源），不再与网易云重复。
   - **酷狗音乐**：后端不支持搜索且无法播放，已按需求**整体下线**——搜索 Tab、排行榜、导入选项、音源状态面板中的酷狗入口全部移除，页面不再出现任何酷狗相关数据。旧分享链接若残留 `source=kugou` 参数会自动归一为网易云播放，不影响使用。
2. **播放直链增强**：
   - **酷我**：优先请求 XCloud `kuwo_backup_source.php` 返回的真实酷我直链；失败再降级到网易云聚合库（原有兜底逻辑保留）。
   - **QQ音乐**：优先请求 QQ 源直链；QQ 源暂无可播放地址时自动降级到网易云聚合库取流，保证能播。
3. **MV 功能修复**：接入 XCloud `kuwo_mv.php` 接口（搜索 + 播放地址），搜索页「MV」Tab 与播放器 MV 按钮恢复正常，可搜索并播放酷我 MV。

### 后端依赖
页面依赖以下公共接口（开放 CORS），均可通过 `index.html` 顶部常量修改：
| 常量 | 用途 |
| --- | --- |
| `GDS_API` | 网易云搜索/播放/歌词/歌单、酷我搜索（`music-api.gdstudio.xyz`） |
| `XCLOUD_API` | QQ 搜索、酷我备用直链、酷我 MV（`https://xcloudm.top/php`） |

若 `XCLOUD_API` 对应站点不可用，QQ 搜索会显示"未找到相关歌曲"（**不会**再伪造网易云数据），酷我/MV 会走既有兜底逻辑。

### 验证
- QQ / 网易云 / 酷我 三个音源搜索「周杰伦」返回各自真实且互不相同的结果
- 酷我直链为 `car-er.kuwo.cn` 真实音频；QQ 播放降级后为网易云可播地址
- MV 搜索返回带封面列表，播放地址为 `other-bj.kuwo.cn` 可播放 mp4

## 注意事项
1. **微信缓存**：微信对链接预览有缓存，第一次测试如果没显示卡片，等几分钟再试，或换一个未分享过的歌曲链接测试
2. **封面图片**：`pic` 参数来自歌曲数据中的 `pic` 字段。如果某些歌曲封面图有防盗链导致微信抓不到，卡片会显示默认图标
3. **已有 netlify.toml**：如果你的项目已有 `netlify.toml`，把其中 `[[edge_functions]]` 和 `[build]` 部分合并进去即可，不要覆盖原有配置
4. **Edge Functions 配额**：Netlify 免费版每月有 100 万次 Edge Function 调用，个人使用完全足够
5. **降级逻辑**：原始音源失效后会自动尝试酷我 → 网易云 → QQ → 酷狗（排除原始曲库），找到可用音源即切换；全部失败则提示"所有音源均无法播放该歌曲"
