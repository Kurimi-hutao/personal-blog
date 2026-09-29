# 页面配套素材 · 2026-09-29

用户提供的六张原始 PNG 保存在 assets/page-scenes，未修改原图。

| 源文件时间尾缀 | 站内文件 | 用途 |
| --- | --- | --- |
| 18_41_12 | articles-writing-desk.png | 文章列表页头 |
| 18_41_19-1 | videos-riverside-stage.png | 视频列表页头 |
| 18_41_20-2 | works-maker-study.png | 作品页头 |
| 18_41_22-3 | article-ending.png | 文章成功加载后的篇尾装饰，保留透明通道 |
| 18_41_24-4 | kurumi-moonlit-background.png | 水墨画廊标题区，原动态开场保留 |
| 18_41_26-5 | not-found-crossroads.png | 404 页面插画 |

响应式与暗色适配位于 page-scenes.css。手机页头将文字与场景上下排布，避免横图裁切后遮挡标题。空状态两张插画不在本轮交付范围。

验证：node scripts/check-page-scenes.cjs。文章内容使用仅注入测试浏览器的 review-fixtures.cjs；检查 1440/390 宽度、明暗截图、图片加载和横向溢出。截图在 screenshots/page-scenes。
