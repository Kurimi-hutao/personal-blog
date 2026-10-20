# 评论邮件通知

生产 Supabase：`uhcmzlhzrgyjnvqnnpss`。发件人：`虎桃博客 <notifications@mail.joestarzhang.cn>`。
现有 Resend 模板：`blog-new-comment`，ID `8dab72c3-2ac5-4080-8509-4af11585b90f`。

## 流程与权限

`comments INSERT → comments_notify_gmail_on_insert → comment_email_jobs → pg_net → comment-notify → Resend → resend-delivery → comment_email_events`

审核由 false 变为 true 时，`comments_notify_on_approval` 补充入队；UUID 主键防止重复。
`blog_private.notify_new_blog_comment()` 已替换原数据库直接调用 Resend 的实现。
数据库端只读取 Vault 的 `blog_comment_webhook_token`；凭据由数据库生成，迁移没有明文。
Edge Function 通过仅 service_role 可调用的 RPC 验证该凭据，公开 Key、用户 JWT、无凭据请求均不能触发发送。
发送接口不接收收件人、正文或任意评论 ID，只处理已有服务端队列。

站长 `is_owner` 评论、当前认证身份等于文章作者的评论、不通过审核的评论、未发布或已删除文章均不入队。
访客回复和图片评论沿用现有评论存储语义，附件及回复上下文不变；邮件不复制附件，只提供原文入口。
文章链接来自前端的 `article.html?slug=...` 路由，时间显示为北京时间。
昵称、标题和正文在传入模板前进行 HTML 转义，防止用户内容成为邮件标记。

所有新增表启用 RLS，并撤销 anon/authenticated 访问；全部 worker RPC 只授权 service_role。
原评论、文章和 Storage RLS、前端发布流程与静态部署没有修改。
两个函数的 gateway JWT 验证关闭，因为各自执行专用鉴权：队列凭据验证、Svix HMAC-SHA256 签名及 5 分钟时间窗口验证。

## Secrets 与启用

以下值仅设置在 Supabase Edge Function Secrets，不放入前端、SQL 或 GitHub：

| Secret | 用途 |
|---|---|
| `RESEND_API_KEY` | 仅允许指定发送域名的 Sending-only Key |
| `COMMENT_NOTIFICATION_TO` | 管理员通知收件人 |
| `COMMENT_NOTIFICATIONS_ENABLED` | 域名验证、模板发布、Secrets 完成后设置为 `true` |
| `RESEND_WEBHOOK_SECRET` | Resend 送达 webhook 的签名密钥 |

`scripts/configure-comment-email-secrets.mjs` 接收 stdin JSON，通过官方 CLI 写入 Secrets；不用命令行参数传密钥，临时 env 文件完成后删除。
必须先完成 `supabase login`。请勿在终端开启命令回显/调试输出，勿把真实值写进可提交脚本或聊天。
内置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 由平台注入，无需自建。
域名记录见 [DNS 操作清单](resend-dns-setup.md)。域名未验证时保持发送开关关闭，队列保留且不消耗重试次数。

## 幂等、重试与送达

- 评论 UUID 是队列主键，每次 claim 使用 `FOR UPDATE SKIP LOCKED`、独立 lease UUID 和 3 分钟租约。队列保留原评论外键；另用 `comment_email_receipts` 保存不含正文、邮箱或密钥的 UUID 发送凭据，删除评论后仍保留该依据，避免 UUID 再利用造成重复通知。
- 首次发送前保存完整请求，后续重试保持一致；Resend `Idempotency-Key` 为 `blog-comment/<UUID>`。
- 网络超时、429、5xx 和并发 409 采用退避重试并尊重 Retry-After；其他 4xx 记为 failed，等待修正。
- `blog-comment-email-retry` 每分钟唤醒 worker；一次最多 5 条，并限制发信速率。首次 INSERT 也立即唤醒。
- Resend 只保留幂等键 24 小时。超过 23 小时的模糊结果或 8 次尝试后进入 `needs_review`，避免超出缓存后重复发信。
- 邮件失败不会使评论失败。入队/调度异常只记录脱敏日志；运行错误不记录凭据、邮箱、评论正文或 provider 返回全文。
- `accepted` 只表示 Resend API 接受；`delivery_status=delivered` 才表示收件服务器接受。不能据此证明进入 Gmail 主收件箱。
- 独立事件表按 Svix event ID 幂等。回调先于发送记录写入也能被对账；旧事件不能把 delivered 降级为 sent。

## 运维

仅在 Supabase 管理端运行以下只读检查，不向浏览器开放审计表：

```sql
select status,delivery_status,count(*) from public.comment_email_jobs group by 1,2;
select comment_id,status,attempts,last_error,resend_email_id,delivery_status,updated_at
from public.comment_email_jobs where status in ('failed','needs_review') order by updated_at;
select jobname,schedule,active from cron.job where jobname='blog-comment-email-retry';
```

对 `failed` 先修复发件域名、模板、配额或 Secrets。对 `needs_review` 必须先通过 Resend 查明该评论是否已经发送，不能直接改回 pending。
核对 Resend 邮件 ID 和事件日志；幂等窗口外，只有确认原请求未发送才可人工建立新的发送尝试。
停发时将 `COMMENT_NOTIFICATIONS_ENABLED=false`，评论功能继续正常，待发任务保留。

部署两个函数时只指定函数名，不使用 `--prune`，以保留现有 `bilibili-cover`。
迁移版本与生产 `supabase_migrations.schema_migrations` 对齐。仓库只保存本次新增迁移，不代表完整数据库基线；不要重建/重置生产库。

## 验证

```text
node --test scripts/check-comment-notifications.mjs scripts/check-resend-delivery.mjs
deno check --config supabase/functions/comment-notify/deno.json supabase/functions/comment-notify/index.ts supabase/functions/resend-delivery/index.ts
```

`supabase/tests/comment_email_notifications.sql` 在事务中验证触发器、站长排除、审核、访客回复、附件上下文、租约、幂等和送达事件竞态，最后 ROLLBACK；不会保留测试评论或提交 pg_net 请求。
`.github/workflows/comment-notifications.yml` 在 PR 和 main 的相关变更上运行离线通知测试，不需要任何生产密钥。
实际验收结果见 [部署测试记录](comment-email-validation-20261020.md)。
