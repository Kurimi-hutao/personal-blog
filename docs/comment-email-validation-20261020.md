# 评论邮件部署测试记录（2026-10-20）

## 已验证

- 生产数据库核对了 `public.comments`、`public.articles`、5 条 comments RLS 与旧通知触发器。
- 原通知实现没有可用 Vault Key，也没有幂等、重试与审计。现已替换为队列与 Edge Function。
- `comment-notify` 与 `resend-delivery` 已在指定项目部署为 ACTIVE；原 `bilibili-cover` 保留。
- 现有 `blog-new-comment` 模板已清理并发布，ID 不变；全部 5 个必需变量保留。
- 新建域名受限 Sending-only Key；凭据与收件人只配置在 Supabase Secrets，SQL webhook 凭据由 Vault 保存。
- 29 项本地测试通过（15 项通知/回调测试，14 项现有动效及部署回归）。
- 两个 Edge Function 的 Deno 类型检查通过。
- 最终代码提交 `0f7012a903216cd00ffb3ad18f7da2464afb9691` 的 `Comment email notifications` 和 `Frontend interaction regressions` 两项 GitHub CI 均通过。
- 数据库事务集成断言全部通过并回滚，覆盖评论、回复、附件上下文、审核、站长排除、重复事件、租约、不可变请求、24 小时边界、隐藏文章与送达竞态。
- 生产 worker 无凭据及错误凭据均返回 401；未签名的送达回调返回 401。
- 真实匿名评论 POST 返回 201，触发器创建 pending 任务；停发状态下 attempts 保持 0。
- 原评论公开读取接口返回 200；原 5 条 comments RLS 未改动，附件与回复前端未改动。
- 安全顾问未发现新增可公开执行的 SECURITY DEFINER；既有 RPC 与 Auth 配置告警属于原系统，未扩大此次范围。
- 独立 `comment_email_receipts` 保留删除后的最小发送凭据；原评论外键保留。事务测试已验证删除评论与重用 UUID 不会重复建立发送任务，新增表和 RPC 无安全顾问告警。
- 静态打包采用既有文件白名单，不包含 `supabase/`、`docs/`、`scripts/` 或 env 文件。

## 最终生产验收

| 项目 | 结果 |
|---|---|
| 发送域名 | `mail.joestarzhang.cn` 为 **verified**，DKIM、`rsend.mail`、`send.mail` 全部 verified |
| 接收功能 | disabled，仅发送 |
| 模板 | `blog-new-comment` published，ID `8dab72c3-2ac5-4080-8509-4af11585b90f` |
| 生产开关 | `COMMENT_NOTIFICATIONS_ENABLED=true`，Secrets 摘要核对成功 |
| 真实访客插入 | 匿名 comments POST 返回 201，触发服务端队列，首次尝试 accepted |
| 评论 UUID | `1ca7e50b-86a4-4598-9dff-35bf9a2b1ccf` |
| Resend 邮件 ID | `01a157e7-eb9e-7775-83a5-6722f40043a5` |
| 最终送达 | Resend get-email 返回 delivered；签名回调记录 email.sent、email.delivered |
| Gmail 确认 | 用户明确确认“已收到，内容正常” |
| 重复事件 | 同一队列再次唤醒返回 HTTP 200，processed=0、accepted=0；attempts 仍为 1；Resend 最近发送列表只有该邮件 |

实际邮件包含昵称“通知联调访客”、文章“波”、两行中文正文、特殊字符、北京时间和可点击链接 `https://joestarzhang.cn/article.html?slug=wave#comments`。五个变量均已替换，没有残留模板占位符，HTML 对特殊字符正确转义。用户已确认 Gmail 显示正常。

已清理两条公开联调评论（`71901ead-1ddd-4d8b-b20b-572f9f175d06`、`1ca7e50b-86a4-4598-9dff-35bf9a2b1ccf`），原外键清理对应队列；最小发送凭据与签名送达事件保留，其他评论不受影响。

域名等待期间的一次受限 Key 测试被 Resend 以 400 拒绝，没有邮件 ID。随后保持停发，等待完整 verified 后启用；未改用 Full-access Key。系统保留针对明确域名未验证错误的 5 分钟重试保护，其他 4xx 不盲目重试。

本次实现和生产部署已完成。PR 尚待合并，生产 Edge Function、迁移、Secrets、模板与通知开关均已生效；无需前端部署。
