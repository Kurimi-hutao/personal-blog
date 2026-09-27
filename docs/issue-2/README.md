# Issue #2：水墨博客视觉重构验收

基线：`f9075b6`。修改分支：`refactor/issue-2-ink-editorial`。本地 Chromium 实际渲染、截图和操作验收；不是仅按源码推断。

## 设计变化

- 全局：纸色、墨色、朱砂为主，方正细线控件，明确键盘焦点和深色模式对比度；去掉大面积玻璃、重阴影、过度圆角和重复英文标题。
- 首页：保留水墨主视觉和原有诗句；文章改为文字目录，视频保持宽幅封面，作者介绍采用图文编排。江湖驿站和成就默认收起，成就移到页面后部，降低首屏工具面板感。
- 文章：标题、摘要、分类、日期和阅读反馈优先，封面退到侧栏；无封面条目不制造大块占位图。保留分类、标签、搜索、排序和详情页能力。
- 视频：保留 16:9 影像入口，与文字文章形成不同浏览节奏，去掉重复的通用“视频”标记。
- 作品：重点作品更大，次要作品采用不同跨度与错落留白；分类显示改为简短中文，原始数据值与链接保留。
- 胡桃绘卷：人物志提高文字对比度；画作采用不同幅面，说明常驻，手机端调整节奏。保留原画、角色介绍、官网链接和灯箱。
- 桌宠：角色与山水房间成为主体，操作收束为纸面工具区；数值、奖励与帮助降为可展开的次级信息，保留 Live2D、角色切换、互动和本地状态保存。

## 前后对比

同一浏览器、尺寸、内容夹具与减少动态效果设置，分别加载基线与修改版本后截图。以下是对应区块的完整截图拼接，左侧为修改前、右侧为修改后；原始 PNG 留在本地 `screenshots/issue-2/`。

| 页面区块 | 1920 × 1200 | 390 × 844 |
| --- | --- | --- |
| 首页文章区 | [对比](home-1920.jpg) | [对比](home-390.jpg) |
| 文章目录 | [对比](articles-1920.jpg) | [对比](articles-390.jpg) |
| 视频目录 | [对比](videos-1920.jpg) | [对比](videos-390.jpg) |
| 作品 | [对比](works-1920.jpg) | [对比](works-390.jpg) |
| 胡桃画廊 | [对比](gallery-1920.jpg) | [对比](gallery-390.jpg) |
| 桌宠房间 | [对比](pet-1920.jpg) | [对比](pet-390.jpg) |

[手机页面总览](mobile-overview.jpg)。截图经过多轮检查，继续修复了画廊图片重叠、人物志浅色文字、手机操作按钮换行、深色导航和作者区对比度、首页顺序与内容可见性、画像裁切和触控尺寸问题。

## 实际测试

- 首页、文章目录、文章详情、视频目录、作品、胡桃绘卷、桌宠：分别检查 **1920×1200、390×844、768×1024**，共 21 个页面/尺寸组合，最终记录无横向溢出、损坏图片或未捕获脚本异常。首页、文章目录和桌宠额外检查深色截图。[视觉记录](visual-results.json)
- 两种目标尺寸共 **26 项通过记录**：首页锚点、驿站展开、原有链接数量、键盘焦点、分类/标签/搜索/排序/清空/空结果、手机导航与主题、文章长标题/目录/表格/代码/数学、收藏/点赞/分享/评论、作品筛选、画廊灯箱与 Escape、桌宠画布/角色与动作/场景/状态展开/经验刷新保存，以及操作按钮尺寸和画廊无重叠。[交互记录](interaction-results.json)
- **12 个状态组合**：文章与视频的真实 Supabase 只读加载、服务失败和加载中提示，以及正常动态效果下的首页、作品、画廊显示。[状态记录](state-results.json)
- 写入型交互使用本地夹具拦截验证，未向真实 Supabase 发布评论或点赞。测试使用桌面 Chromium 的视口模拟；不宣称已测试实体手机、Safari 或声音听感。404 仅接入全局样式，不计入上述 21 个页面组合。

## 修改文件

| 范围 | 文件 |
| --- | --- |
| 全局 | `ink-system.css`（新增）、`styles.css`、`service-worker.js`、`404.html` |
| 首页 | `index.html`、`hutao-exhibit.css`、`script.js`、`motion-home.css`、`motion-home.js` |
| 文章与视频 | `articles.html`、`articles.js`、`article.html`、`videos.html`、`videos.js`、`editorial.css` |
| 作品 | `works.html`、`works.css`、`works.js`、`works-data.js` |
| 胡桃绘卷 | `kurumi.html`、`kurumi-refinements.css` |
| 桌宠 | `pet.html`、`pet.css` |
| 验收 | `scripts/issue-2-visual.cjs`、`scripts/issue-2-comparison.cjs`、`scripts/issue-2-interactions.cjs`、`scripts/issue-2-states.cjs`、`scripts/review-fixtures.cjs`、`.gitignore`、本目录截图和 JSON 记录 |

## 保留与边界

保留水墨纸感、书法标题、朱砂点色、桃花、原有角色/山水/封面素材、首页诗句、适度开场动态、明暗主题。保留现有链接目标、Supabase 配置与服务接口、内容与筛选数据逻辑、文章渲染能力、Live2D 模型及运行代码、签到和桌宠状态存储。没有改动 `next-generation-letter/`，没有新增框架、CDN 或生成式图片。

## 复跑

在仓库目录运行静态服务器：`python -m http.server 8123 --bind 127.0.0.1`。对比脚本另需将 `f9075b6` 的网站副本服务于 8124。

依次运行（避免同时加载大字体和 Live2D）：

```text
node scripts/issue-2-visual.cjs final
node scripts/issue-2-interactions.cjs
node scripts/issue-2-states.cjs
node scripts/issue-2-comparison.cjs
```

脚本当前使用本机 Codex Playwright 依赖与 Chrome 路径；其他机器需调整顶部依赖/浏览器路径。真实数据会随线上内容变化；确定性布局及写入交互使用已有 review fixtures。本地静态服务并发加载曾出现瞬时资源失败，按顺序重跑对应页面后已通过，最终 JSON 和截图为重跑后的结果。
