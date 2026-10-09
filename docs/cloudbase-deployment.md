# CloudBase 自动发布

`main` 分支推送以及 Actions 手动运行都会触发 `.github/workflows/deploy-cloudbase.yml`。
仓库 Secrets 需要 `TCB_ENV_ID`、`TCB_SECRET_ID`、`TCB_SECRET_KEY`。

## 2026-10-09 故障与修复

运行 37803975325 已成功登录，但上传 1678 个文件时出现 `User network is too slow`、
`socket hang up`，最终超过 30 分钟被取消。现有三个 Secrets 均已配置。

- 固定 CloudBase 官方 SDK 为 5.9.0，通过现有三个 Secrets 初始化，无需 CLI 登录。
- 使用 `scripts/prepare-cloudbase.mjs` 从干净 checkout 生成 `_deploy`，只包含根目录网页资源、
  `assets`、`next-generation-letter`、`zhengshen-atlas`。排除开发资料、截图和中间产物。
- 打包时检查 HTML 和第一方根目录 CSS 的本地引用；缺少必需文件则直接失败。
  第三方 CSS 中的旧浏览器字体备用格式不在此检查范围内。
- 按远端文件大小和 MD5 筛选变化文件。ETag 不匹配时，通过签名 HEAD 读取
  `x-cos-hash-crc64ecma`，与本地 CRC64 比较，避免把不透明的分块 ETag 当作 MD5。
  CRC64 采用腾讯官方 COSCLI 对应的 Go ECMA 参数，保留 64 位无符号十进制精度。
- 每组最多 10 个变化文件，最多 3 个文件独立上传；每个文件内部按顺序上传分块。
  失败重试 3 次，间隔 2000ms，关闭 COS KeepAlive。
- 使用 COS SDK 签名的 Buffer 上传，每次请求超时 120 秒；使用标准 HTTPS 端点，并在重试时交替使用
  CloudBase 的 HTTPS 端点。输出逐文件进度与错误码。共享桶路径使用固定版本 SDK 的路径解析器。
- COS SDK 只负责签名，实际上传使用 Node 原生 fetch 和 AbortSignal，确保请求超时真正终止，
  并避免旧请求库未捕获的 TLS socket EPIPE 导致进程崩溃。
- 超过 1 MiB 的文件走 1 MiB 分块上传，逐块重试；请求时限 120 秒。失败时尝试终止未完成的上传。
- 资源先上传，页面和 Service Worker 随后上传；校验全部应用文件的 MD5/CRC64 和大小后才发布版本标记，
  最后再次校验全部文件。
- 同一环境串行部署，不再因后续推送中断正在上传的版本；超时设为 45 分钟。
- 不清理远端旧文件，避免删除其他已有内容。

本地验证：在干净 checkout 执行 `node scripts/prepare-cloudbase.mjs`。
脚本拒绝复用已有 `_deploy`，防止旧文件混入；生成目录已加入 Git 忽略规则。
线上 `/deployment.json` 包含本次 Git commit SHA，便于核实版本。

部署顺序、相同大小内容变更、分块 ETag、资源失败和校验失败的回归测试：
`node --test scripts/check-cloudbase-deploy.mjs`。

降低 CLI 并发的首轮验证运行 37941342697 仍持续超过 35 分钟，因此改为上述增量串行策略。

运行 37952905337 证明 1 MiB 分块传输有效，但串行上传达到 45 分钟时限。
运行 37956651405 完成全部资源和页面上传，并证实腾讯云分块 ETag 与 S3 组合 MD5 假设不兼容。
最终采用官方 CRC64 补充校验，使这些已上传大文件可跳过并通过完整性检查。

CRC64 依据：[腾讯官方 COSCLI](https://github.com/tencentyun/coscli/blob/master/util/hash.go)。

上传参数依据：[CloudBase 静态托管 CLI](https://docs.cloudbase.net/en/cli-v1/hosting)。
最终发布结果应以对应 GitHub Actions 运行及远端校验为准。
