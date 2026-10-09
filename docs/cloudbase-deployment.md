# CloudBase 自动发布

`main` 分支推送以及 Actions 手动运行都会触发 `.github/workflows/deploy-cloudbase.yml`。
仓库 Secrets 需要 `TCB_ENV_ID`、`TCB_SECRET_ID`、`TCB_SECRET_KEY`。

## 2026-10-09 故障与修复

运行 37803975325 已成功登录，但上传 1678 个文件时出现 `User network is too slow`、
`socket hang up`，最终超过 30 分钟被取消。现有三个 Secrets 均已配置。

- 固定 CloudBase CLI 为 3.8.5，避免未经验证的工具更新改变发布行为。
- 使用 `scripts/prepare-cloudbase.mjs` 从干净 checkout 生成 `_deploy`，只包含根目录网页资源、
  `assets`、`next-generation-letter`、`zhengshen-atlas`。排除开发资料、截图和中间产物。
- 打包时检查 HTML 和第一方根目录 CSS 的本地引用；缺少必需文件则直接失败。
  第三方 CSS 中的旧浏览器字体备用格式不在此检查范围内。
- 上传并发设为 5，失败重试 3 次，间隔 2000ms，关闭 COS KeepAlive。
- 页面、Service Worker 和版本标记最后上传，启用远端文件一致性校验。
- 同一环境串行部署，不再因后续推送中断正在上传的版本；超时设为 45 分钟。
- 不清理远端旧文件，避免删除其他已有内容。

本地验证：在干净 checkout 执行 `node scripts/prepare-cloudbase.mjs`。
脚本拒绝复用已有 `_deploy`，防止旧文件混入；生成目录已加入 Git 忽略规则。
线上 `/deployment.json` 包含本次 Git commit SHA，便于核实版本。

上传参数依据：[CloudBase 静态托管 CLI](https://docs.cloudbase.net/en/cli-v1/hosting)。
最终发布结果应以对应 GitHub Actions 运行及远端校验为准。
