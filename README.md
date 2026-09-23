# 虎桃不会振刀

一个水墨武侠风格的个人博客，使用原生 HTML、CSS 和 JavaScript 构建，并通过 GitHub Pages 发布。文章、视频、评论、留言、登录和附件存储由 Supabase 提供。

## 本地预览

直接打开 `index.html`，或在项目目录运行：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 《下一代，来信了》子站

作品页 `works.html` 已收录子站，入口为 `next-generation-letter/`。子站使用独立样式与脚本，顶部“返回作品”链接回到博客。整个博客作为静态文件部署时，保留这个目录即可，无需额外服务。

当前版本来自 `Kurimi-hutao/next-generation-letter` 的 `13aa883` 提交。更新时，在原项目安装依赖并执行 `npm run build`，然后在博客目录运行：

```powershell
node scripts/import-next-generation.mjs "原项目路径/dist"
```

导入脚本复制构建文件、接入返回导航并更新作品封面。原项目需保持 Vite 的 `base: "./"`，以兼容博客域名及 GitHub Pages 子路径。`.download/` 为本地下载和构建临时目录，不需要部署。

## 配置网站数据

1. 创建一个 Supabase 项目。
2. 在 Authentication 的 Users 页面创建唯一的站长用户，关闭公开注册，并复制用户 UUID。
3. 检查 `supabase-schema.sql` 中的站长 UUID，然后在 Supabase SQL Editor 执行完整脚本。已有项目也需要重新执行，以添加作品统计、视频系列与完播、评论点赞与置顶、作品回收站、签到和成就数据。
4. 在 Supabase 的 Project Settings > API 中复制 Project URL 和 anon public key，填写到 `supabase-config.js`。
5. 部署后访问 `admin.html`，使用站长邮箱和密码登录，可查看近 14 天统计与热门作品、管理文章和视频、自动保存草稿、使用回收站、置顶或回复评论。

视频支持系列与集数、自动读取时长、播放进度记忆和完播统计。评论支持点赞、站长身份标识与置顶。主页签到以匿名访客令牌计算连续签到和累计成就，不要求访客注册。

文章正文支持 Markdown 与 KaTeX 数学公式。行内公式使用 `$E = mc^2$`，块级公式使用 `$$...$$`。

`anon key` 可以公开在前端；真正的文章管理权限由 `supabase-schema.sql` 中的 RLS 策略限制为唯一站长。评论附件仅在前端允许图片、TXT 和 PDF，单个不超过 5 MB；生产环境还应在 Supabase Storage 中配置相同的 MIME 限制。不要把 `service_role key` 写入本项目。

页边 AI 助手使用 DeepSeek 免费网页版的安全跳转方案：它会把包含当前页面上下文的问题复制到剪贴板，并打开 `chat.deepseek.com`。免费网页端没有可供静态站点直接调用的公开免密接口，因此本站不会在前端保存 DeepSeek 账号、Cookie 或 API Key。

## 永劫无间征神图鉴

作品页入口为 `zhengshen-atlas/`。已从本地图鉴项目转换为静态子站，无需 ChatGPT 登录或服务端，包含魂玉检索、词条详情、潜能推演和配装面板。三个页面均可返回博客作品页。配装和潜能方案保存在当前浏览器；原托管域名的数据不会自动迁移。

部署时保留整个 `zhengshen-atlas` 目录；资源及页面链接使用相对路径，兼容独立域名与 GitHub Pages 仓库子路径。原始资料及计算口径沿用项目内容，此次迁移不更新游戏数值。

图鉴 React 入口及数据保留在 `sources/zhengshen-atlas/`，在该目录安装依赖后运行 `npm run build` 可重新生成首页。静态图片、潜能页与配装页直接维护于 `zhengshen-atlas/`；构建不会清空这些文件。
