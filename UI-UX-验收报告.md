# 水墨博客 UI/UX 改造与验收

已完成本地改造、构建、浏览器检查和截图后的二次修正。未发布到线上。

本地预览：<http://localhost:8000/zhengshen-atlas/>

截图对比：<http://localhost:8000/screenshots/index.html>

## 保留范围

- `index.html` 与 `next-generation-letter/` 共 143 个文件，改造前后 SHA-256 一致。记录见 `screenshots/protected-hashes.json`。
- 主站 `styles.css`、`theme.js`、`article-service.js`、`pet.js`、`pet-rig.js` 未修改。
- 魂玉、词条、潜能数据与配装计算引擎未修改。没有改变游戏数值或计算口径。
- 保留原生主站与既有 React 图鉴项目；没有引入新的 UI 框架。

## 逐页改动

| 页面 | 主要改动 |
| --- | --- |
| Zhengshen Atlas | 以“征神图鉴”为首屏视觉核心，暖黑纸面、纵向题签、细墨线与朱砂印。降低英文权重。魂玉改为档案条目，编号不随搜索筛选漂移。攻击、防御、元素、四象、效果使用克制的小面积辅助色。 |
| 图鉴交互 | 搜索采用纸面下划线与焦点态；卷宗索引、上一卷/下一卷、此卷未录空状态；手机每卷 12 项，桌面 24 项，长分页折叠为首尾与邻近页。详情抽屉保留完整效果和原图，支持 Esc 关闭。 |
| 潜能推演 | 统一纸面与题签风格，移动端增加按名称选择节点的入口，选中后滚动到详情进行加减点。星盘首次居中，可以横向查阅。保留原有连线、前置条件、导入导出和本地方案。 |
| 配装面板 | 减少圆角、阴影和发光，统一为暖黑账页；加大控件触摸范围，保留折叠词条、数值输入、潜能联动与本地保存。 |
| Articles | 改为书目式文章条目，封面与标题分层；移除筛选器外部卡片容器，分类、排序和标签采用细线选择态；移动端合并筛选行，减少首屏占用。 |
| Article | 保留阅读主体；缩短长标题的字号范围。1399px 以下目录转为正文前的独立目录，避免固定侧栏越界。检查正文、代码、公式、图片与评论。补充 Markdown 表格解析及独立可横向滚动区域。 |
| Videos | 首条视频采用横向主条目，其余为较轻的影片条目。真实封面优先；未配置或加载失败时显示纸面题字回退。播放标记移至图片左下，去掉大面积黑色渐变缩略图。 |
| Works | 征神图鉴成为明确的“本辑主作”，使用大幅横向编排；其他项目保持较低视觉权重。分类改为墨线索引，年表去除重复卡片框。主作身份不因筛选顺序改变。 |
| Kurumi | 保留现有视觉与动效。修正手机人物裁切，长幅、横幅作品使用完整展示，补充键盘焦点、触摸范围、横屏及安全区规则。 |
| Pet | 手机采用紧凑状态条、对话、人物舞台和三列互动菜单；减少人物前后空白。加入横屏双栏规则。桌面布局保留，背景由重复画卷改为轻纸纹。 |
| 404 | 统一为散佚书页，提供卷首、文章与作品三个返回入口。 |

## 代码整理

- 删除文章列表、视频列表的历史重复布局规则，统一到 `editorial.css`；保留文章详情和后台所需规则。
- 桌宠旧版多套移动断点及 `!important` 修补段已合并成一套响应式布局。
- 图鉴的页面布局从堆叠的压缩规则整理为独立 `archive.css`，使用统一变量与三个主要断点。
- 新增动画主要为 200–260ms 的边线、透明度、图片亮度变化，图鉴悬浮仅 2px 位移。
- 保留 `prefers-reduced-motion`，减少图鉴与桌宠面板的背景模糊。
- 更新 Service Worker 缓存版本与新增样式清单，使既有访问者能够获取改版资源。

## 实际浏览器检查

使用本机 Chrome，由已有 Playwright 驱动；没有下载新的浏览器。

| 类型 | 实际 viewport |
| --- | --- |
| 手机竖屏 | 375 × 812、390 × 844、430 × 932 |
| 平板 | 768 × 1024 |
| 桌面 | 1366 × 768、1440 × 900、1920 × 1080、1920 × 1200 |
| 横屏 | 844 × 390 |

上述 9 种尺寸分别检查了文章列表、文章详情、视频、作品、胡桃绘卷、桌宠、404、图鉴首页、潜能页、配装页，共 90 个页面与尺寸组合。逐页滚动后保留首屏与完整长图。

最终布局记录：`screenshots/final/results.json`。验收指标为页面宽度不超过 viewport、无未捕获脚本错误、无内容图片加载失败；故意设置的坏视频封面由回退逻辑处理。

### 实际操作

手机 390px 与桌面 1440px 共 30 组断言全部通过：

- 图鉴搜索、空结果、清空、分类、元素筛选、稳定编号、详情抽屉、Esc 关闭、分页、魂玉与词条切换；桌面悬浮。
- 文章搜索、空结果、分类下拉、恢复筛选；移动导航；夜间模式。
- 文章目录跳转、字号调整、表格横向容器、代码块、KaTeX 公式。
- 收藏、点赞、分享、评论提交反馈。涉及网络写入的操作由测试浏览器拦截，只验证前端流程，没有发送线上测试评论或点赞。
- 视频真实封面测试样本、无封面、坏封面回退，以及搜索与重置。
- 作品分类、空分类、主作恢复。
- 画廊大图打开与 Esc 关闭。
- Live2D canvas 实际加载，摸摸、投喂、场景切换、角色串门及归位。
- 潜能节点选取、加减点、规则弹窗、方案保存。
- 配装魂玉选择、攻击词条输入，刷新后的本地数据恢复。

交互记录与截图：`screenshots/interactions/`。

### 真实线上内容的只读复核

最初沙箱阻止了外部网络请求；获得网络权限后，重新只读复核成功：

- 文章列表成功加载 7 个发布条目。
- 视频列表成功加载 5 个视频。当前视频没有配置封面，因此采用纸面回退。
- 打开真实《博客开发日志总结》，检查目录与正文，390px 下页面无横向溢出。
- 打开真实《双曲函数》，播放器开始播放，读到时长 47.81 秒，进度推进至约 1.55 秒后暂停；390px 下无横向溢出。
- 读取实际评论区域，所有统计、点赞、评论等写入请求均被阻止。

证据：`screenshots/live-service/`。列表与详情都保留了截图，视频详情另有手机截图。

### 截图后的二次调整

1. 图鉴手机长图过长：从 24 项缩为 12 项，压缩 Hero 与索引高度，补充紧凑分页。
2. 手机筛选框显示两枚箭头：为支持原生自定义下拉的浏览器移除重复图标。
3. 1366px 与平板目录占位不合适：将中小屏目录移到正文前，取消侧栏固定定位。
4. 表格长备注导致行高过大：给表格合理最小宽度，在局部区域横向滚动。
5. 手机桌宠人物区前后空白过多：缩小舞台高度，状态栏紧凑化，增加操作文字对比度。
6. 胡桃人物在部分手机比例下偏右裁切：校准移动端图片焦点，并重新截图。
7. 桌宠大屏重复背景接缝明显：改用轻纸纹，保留房间主体。

## 修改文件清单

### 主站

```text
articles.html
article.html
videos.html
works.html
kurumi.html
pet.html
404.html
article-pages.css
editorial.css                 新增，文章/视频/阅读区域
works.css
kurumi-refinements.css        新增，仅绘卷页加载
pet.css
article-detail.js
markdown.js
videos.js
works.js
works-data.js
service-worker.js
```

### 征神图鉴

```text
sources/zhengshen-atlas/index.html
sources/zhengshen-atlas/app/page.tsx
sources/zhengshen-atlas/app/globals.css
sources/zhengshen-atlas/app/archive.css       新增
sources/zhengshen-atlas/app/motion.css
sources/zhengshen-atlas/components/ui/sheet.tsx
zhengshen-atlas/index.html
zhengshen-atlas/assets/index-DDvHNdMN.css     构建产物
zhengshen-atlas/assets/index-CMwLpbtd.js      构建产物
zhengshen-atlas/book-tools.css               新增
zhengshen-atlas/motion.css
zhengshen-atlas/potential/index.html
zhengshen-atlas/potential/potential.js
zhengshen-atlas/calculator/index.html
```

### 验收资料

```text
scripts/visual-review.cjs
scripts/review-fixtures.cjs
scripts/check-ui.cjs
scripts/check-live.cjs
scripts/verify-markdown.cjs
screenshots/index.html
screenshots/before/
screenshots/round-one/
screenshots/final/
screenshots/interactions/
screenshots/live-service/
screenshots/protected-hashes.json
UI-UX-验收报告.md
```

## 验证边界与复用

- 最终响应式矩阵中的文章、视频及文章详情使用本地测试样本，覆盖长标题、有图/无图、代码、表格、公式和评论。样本只由测试浏览器响应拦截提供，未写入网站或线上数据库。真实内容证据单独存放。
- 已验证 Chrome 的桌面与触摸模拟；没有实体 iPhone，也没有运行 Safari，因此不将 safe-area 与 Safari 的兼容性规则等同于真机验收。
- 构建成功，修改过的 JS 通过语法检查；Markdown 表格针对转义、代码围栏、普通段落和列对齐的检查通过。
- 保留原有数据与服务接口；未对后台管理、线上发布和外部站点做写入操作。
- 后续可运行 `node scripts/visual-review.cjs final` 重拍全部尺寸；`node scripts/check-ui.cjs` 重跑交互；`node scripts/verify-markdown.cjs` 检查表格解析。浏览器与 Python 路径使用当前电脑已有运行环境。

本地服务器若关闭，在仓库根目录运行可用的 Python：`python -m http.server 8000`，再打开截图索引或网站。
