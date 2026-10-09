# 胡桃小屋素材接入记录

## 已接入

来自用户提供的 `HuTao_Cottage_UI_Assets`，使用 `png/` 下的 24 张透明 PNG，原样复制到 `assets/pet-cottage/ui/`，未修改原始画面。高清源文件保留在用户下载目录，不参与网站加载。

- 六个互动入口：摸摸、投喂、玩耍、跳舞、休息、招手。
- 五个辅助入口：串门、归位、每日小礼、重试、重看入境。
- 动态、声音各两种开关图案，随设置即时替换。
- 随时间、清晨、白天、黄昏、夜晚五种场景图案，随场景偏好即时替换。
- 默认、悬停、按下、禁用四种木牌底座，接入互动按钮和桌面串门按钮。
- 三张角色头像：角色选择卡与当前角色状态卡。
- 三张备用立绘：初始加载及无可用 Live2D 模型时显示；保留图片原有白底，以立绘卡片展示。角色首次加载失败后，可选择其他角色并使用对应备用图。已有模型时，新访客加载失败仍保留当前模型。
- 手机夜景背景：`月下水阁望湖山.png`，宽度不超过 620px 且处于夜晚场景时使用。桌面继续使用原有横版夜景。
- 投喂台词：“唔，这个味道不错！”，接入 `hutao-feed-01.mp3`。44 条语音映射均有文件。

所有按钮的文字保持 HTML 文本；保留键盘操作、焦点提示与开关状态。移动端六个互动入口分两行，设置入口另成一行。

## 文件位置

- `assets/pet-cottage/ui/`：24 张 UI 图片及其原分类。
- `assets/pet-cottage/avatars/`：三位角色头像。
- `assets/pet-cottage/fallbacks/`：三位角色备用图。
- `assets/pet-cottage/room-night-mobile.png`：手机竖屏夜景。
- `assets/pet-cottage/source-manifest.json`：原素材包映射信息。
- `assets/audio/hutao/hutao-feed-01.mp3`：新增投喂语音。
- `cottage-ui.css`：本轮样式与响应式布局。

更新了页面资源版本与 Service Worker 缓存版本，并收录新增图片、样式和音频。

## 本地运行与验收

本地预览地址：`http://127.0.0.1:8124/pet.html`。

`node scripts/check-pet-room.cjs` 覆盖 320、390、768、1440 像素，验证按钮开关图案、夜景、角色头像、加载恢复、每日奖励与进度保留，检查页面溢出、重复 ID 和破损图片。日夜截图见 `screenshots/pet-cottage-assets-20261009/`。

`node scripts/check-pet-assets.cjs` 检查 24 张 UI 素材可访问、三位角色的备用立绘、四种按钮底座状态以及新增 MP3 的浏览器解码。

`node scripts/audit-pet-voices.mjs` 核对语音配置与文件：44 条映射、44 个文件、零缺失。
