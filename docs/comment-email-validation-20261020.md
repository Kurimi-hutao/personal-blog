# 评论邮件部署测试记录（2026-10-20）

## 已验证

- 生产数据库核对了 `public.comments`、`public.articles`、5 条 comments RLS 与旧通知触发器。
- 原通知实现没有可用 Vault Key，也没有幂等、重试与审计。现已替换为队列与 Edge Function。
- `comment-notify` 与 `resend-delivery` 已在指定项目部署为 ACTIVE；原 `bilibili-cover` 保留。
- 现有 `blog-new-comment` 模板已清理并发布，ID 不变；全部 5 个必需变量保留。
- 新建域名受限 Sending-only Key；凭据与收件人只配置在 Supabase Secrets，SQL webhook 凭据由 Vault 保存。
- 29 项本地测试通过（15 项通知/回调测试，14 项现有动效及部署回归）。
- 两个 Edge Function 的 Deno 类型检查通过。
- GitHub 的 `Comment email notifications` 和 `Frontend interaction regressions` 两项 CI 均通过。
- 数据库事务集成断言全部通过并回滚，覆盖评论、回复、附件上下文、审核、站长排除、重复事件、租约、不可变请求、24 小时边界、隐藏文章与送达竞态。
- 生产 worker 无凭据及错误凭据均返回 401；未签名的送达回调返回 401。
- 真实匿名评论 POST 返回 201，触发器创建 pending 任务；停发状态下 attempts 保持 0。
- 原评论公开读取接口返回 200；原 5 条 comments RLS 未改动，附件与回复前端未改动。
- 安全顾问未发现新增可公开执行的 SECURITY DEFINER；既有 RPC 与 Auth 配置告警属于原系统，未扩大此次范围。
- 独立 `comment_email_receipts` 保留删除后的最小发送凭据；原评论外键保留。事务测试已验证删除评论与重用 UUID 不会重复建立发送任务，新增表和 RPC 无安全顾问告警。
- 静态打包采用既有文件白名单，不包含 `supabase/`、`docs/`、`scripts/` 或 env 文件。

## 当前待验证

DNSPod 权威服务器及公开递归 DNS 已查到正确记录。Resend 当前为 `partially_verified`（DKIM 和 `send.mail` 已验证，`rsend.mail` pending）；发送开关保持 false。当前尚无生产发送邮件 ID，未宣称邮件送达。
曾在主通道验证后用域名受限 Key 执行一次真实测试，Resend 返回 400：该 Key 关联的域名尚未完整验证。请求未获接受，没有邮件 ID；开关已重新关闭。保持同一冻结请求和 `blog-comment/<UUID>` 幂等键，完整验证后才恢复这条任务。
已新增并部署仅针对明确域名未验证错误的 5 分钟重试，保留原 Key 权限。自动审批拒绝了在 partially_verified 状态提前启用生产发送，原因是可能耗尽队列重试次数；因此不会提前开启，待完整验证后再启用。
DNS 生效后需要启用开关，处理联调评论，核对 Resend ID、五变量实际内容、重复唤醒与签名送达事件，并由收件人在 Gmail 确认显示。
