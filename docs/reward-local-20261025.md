# 文章与视频打赏

运行 `node scripts/preview-reward.cjs`，打开：

http://127.0.0.1:8000/article.html?slug=reward-preview&preview=reward#rewardTitle

本地预览使用合成文章和本地统计方法，不发布测试文章。

## 页面内卡片

- 文末「留白朱印」入口沿用宣纸底色、细墨线与圆形「赏」按钮。
- 点击后使用原生 `dialog.showModal()` 在当前文章页面居中弹出卡片，附遮罩与轻微背景模糊。不会打开新窗口、标签页或改动文章地址。
- 预设 1、5、10 元，默认 5 元；自选 0.01–200 元，最多两位小数。无效金额时隐藏收款码与下载入口。
- 微信/支付宝切换与保存二维码；收款码不含原图的姓名文字。
- 支持右上角关闭、底部收起、点击卡片外遮罩、Escape。Tab 键保持在弹窗内，关闭后焦点返回「赏」按钮。
- 弹出时锁定文章滚动，关闭后恢复打开时的阅读位置。短屏时仅卡片内容滚动，顶部关闭按钮始终可见。
- 跟随博客明暗主题，适应手机可视区域；220 ms 淡入、140 ms 收起，减少动态效果模式下关闭动画。
- `reward.html` 仅保留为旧地址兼容页；文章入口不再跳转到该页。支付组件由 `reward.js` 统一创建，样式限定在 `.reward-payment` 内。

## 素材与支付边界

使用用户提供的宣纸纹理与透明咖啡杯插画，无损转存为 `assets/reward/xuan-paper.webp` 和 `assets/reward/ink-coffee.webp`，已逐像素验证一致并保留透明通道。

微信、支付宝二维码从原图识别支付内容后重新生成，并验证内容一致。个人静态码仍需用户扫码后手动输入金额；网站上的 200 元校验无法限制支付 App 中实际输入的金额。尚未接入支付订单、金额锁定或到账回调。支付平台展示的账户信息由平台决定。

## 验证

运行 `node scripts/check-reward-modal.cjs`（原 `check-reward.cjs` 和 `check-reward-position.cjs` 命令仍可用）。测试拦截远程请求，覆盖：

- 当前页面弹窗、零新窗口与地址不变，文章和视频入口。
- 金额范围与精度、支付方式切换、下载入口。
- 四种关闭操作、焦点循环与恢复、滚动锁定和阅读位置恢复、反复打开。
- 明暗两种主题下 1440×1000、390×844、320×568、844×390 的居中、裁切、关闭按钮可达性。
- 模拟键盘占用后的可视区域，以及开场动画分段采样与减少动态效果模式。

实际截图和动画数值保存在 `outputs/reward-modal/`，已逐张检查桌面、手机、短屏横屏及深色自选金额状态。键盘场景为可视区域模拟，不代表真机软键盘测试。

## 支付实现参考

- [GoFrame 捐赠页](https://github.com/gogf/gf-site/blob/main/docs/community/%E6%94%AF%E6%8C%81%E6%88%91%E4%BB%AC/%E6%9D%A5%E6%9D%AF%E5%92%96%E5%95%A1.md)：收款图片展示。
- [腾讯云微信 Native 支付](https://docs.cloudbase.net/integration/wechat-pay-native)：商户接口创建带金额的订单并返回二维码。
- [支付宝交易预创建接口](https://developer.alibaba.com/docs/api.htm?apiId=862&docType=4)：提交 `total_amount` 创建订单。
