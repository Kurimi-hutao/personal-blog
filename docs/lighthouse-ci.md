# Lighthouse CI

## 项目核查（2026-10-19）

主站为原生静态 HTML/CSS/JavaScript，不是 Next.js；未发现 Next.js 配置。
根目录原来没有 package.json。`sources/zhengshen-atlas` 是 npm/Vite 子项目；
`cloudflare-video-worker` 是独立服务。新增根目录 npm 包只管理质量工具。
工作目录没有 `.git` 元数据；发布时使用独立 Git 检出，与线上 deployment.json 和远端主分支核对版本。
现有 `deploy-cloudbase.yml` 使用 Node 22 和 `scripts/prepare-cloudbase.mjs` 打包，保留其默认行为。

## 运行

需要 Node 22+ 和已安装的 Chrome/Chromium。必要时通过 `CHROME_PATH` 指定浏览器。

```sh
npm ci --ignore-scripts
npm run test:perf
npm run test:regression
npm run build:perf
npm run perf
npm run perf:summary
```

`npm run build` 保留生产打包入口，要求 `_deploy` 不存在；不会删除旧包。
根目录 package-lock.json 固定开发工具的传递依赖，CI 使用 `npm ci --ignore-scripts`。
性能构建复用同一打包器，写入独立的 `.lighthouseci-site`，每次重新生成。
不会重新构建或替换已有图鉴、来信子站。不要将性能构建目录部署到生产。

检测首页、文章列表、合成文章详情、视频列表、合成视频详情和作品页；每端每 URL 三次，共 36 次。
移动端沿用 Lighthouse 默认模拟，桌面端使用 desktop preset；均使用模拟节流、全新存储，保留默认动画。
门槛采用 median：LCP ≤2500ms、CLS ≤0.1、TBT ≤200ms、JS 启动执行 ≤2000ms、主线程工作 ≤4000ms；
性能 ≥90、无障碍/SEO ≥95。当前为警告预算，先建立基线，避免历史问题立即阻断 PR；采集错误仍然失败。
TBT 是实验室交互阻塞指标，不能替代真实用户 INP。

## 隐私和基线范围

报告使用 filesystem 输出，没有临时公共存储回退。工作流不使用后端 secrets、LHCI token，
不上传 Actions artifact、不评论 PR、不部署。原始 `.lighthouseci`、报告与性能构建产物均被 gitignore 排除。
原始报告仍可能包括页面 DOM、截图、资源信息，分享前必须人工审阅。

性能包的 Supabase 配置被替换为本地回环地址和合成 key；原配置文件、后端 schema 与 RLS 不变。
测试服务器提供固定合成文章和视频，并在本地吸收所有 API 写请求；不会转发到 Supabase。
HTTPS 子资源被阻止，避免第三方请求；本地打包资源正常加载。
合成视频没有实际媒体流，因此只检查封面、播放器和详情布局，不代表播放启动或解码性能。
报告不代表真实后端延迟、CDN 压缩/缓存和生产网络环境。

本地报告在 `.lighthouseci-reports/{desktop,mobile}/`，包括 HTML/JSON、每次原始报告和断言结果。
`perf:summary` 只导出路由、版本、运行数、分数和指标到 `metrics.json`，不导出 DOM、截图和请求详情。
默认要求两端各 18 份完整报告，逐项检查运行错误、指标缺失与端类型，避免空报告产生有效基线。
单端摘要可用 `npm run perf:summary -- mobile` 或 `desktop`，写入对应端目录。
独立 GitHub Actions 在 PR 和手动触发时运行两端检测，只将数值摘要写入 Job Summary；
远端执行结果请查看修复分支的 PR 检查。

配置依据：[Lighthouse CI 官方配置文档](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)。

## 资源维护

修改源 CSS 后运行 `npm run assets:styles`，将生成的五个 bundle 与页面引用一并提交；打包器会拒绝过期文件。图片导出使用 `python scripts/optimize-performance-assets.py`（Pillow）；字体导出使用 `python scripts/build-brush-core.py`（fontTools、Brotli），然后重新生成样式。Python 仅用于维护已有素材，不加入生产/CI 运行依赖。

[优化结果与版本记录](./lighthouse-optimization-20261019.md)。
