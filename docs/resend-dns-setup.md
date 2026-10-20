# Resend 发送域名 DNS（2026-10-20 实时读取）

域名：`mail.joestarzhang.cn`。Resend ID：`cebbb88b-f3f1-479c-a37f-148f9e5c6420`。
读取时状态为 `failed`，发送启用、接收关闭。不得添加收件 MX 或修改网站业务解析。

在 DNSPod 的 `joestarzhang.cn` 解析中新增以下记录，线路默认、TTL 600（或自动）。先核对同名记录；已有相同值则保留，不重复添加；同名冲突则停止核查。

| 类型 | 主机记录 | 值 |
|---|---|---|
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDp6xXYmL4xi1YwLrNoU/JSweCJUiLbfcJrIdziXp4+BYdThAicSFxi5GWfT0U8GkiBo81F0dYhMVXjrMGTeet9r8j2Wd/ho/ucF4ALhp141i9MowkweRYC6kmAiM+fky6hYtHrMPqxWDcAaSuRCYgBXLRpN5GnvovxQtyhctTupQIDAQAB` |
| CNAME | `rsend.mail` | `rsend.forge.rmta.net` |
| CNAME | `send.mail` | `send.forge.rmta.net` |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none;` |

公开 DNS 查询时根域 `_dmarc.joestarzhang.cn` 和子域 `_dmarc.mail.joestarzhang.cn` 均不存在。
DMARC 优先使用邮件子域自己的 `_dmarc.mail`；不存在时才继承组织根域 DMARC 的 `sp` 或 `p`。
仅给邮件子域添加监测策略，保留根域策略与其他邮件服务。若操作时已出现根域/子域策略，先复查，不覆盖。

完成后在 Resend 对现有域名点击 Verify DNS Records。需要最终看到 `verified`，不能用提交 DNS 或 API 接受代替验证通过。

## 最终核验

2026-10-20：用户在 DNSPod 添加以上记录后，权威 DNS 与公开递归 DNS 均核对匹配。
Resend 最终返回域名 **verified**，DKIM 与两条发送 CNAME 全部 **verified**；Receiving 保持 disabled。
根域 DMARC 与网站现有业务解析均未修改。实际评论通知已发送并确认 delivered，用户已在 Gmail 确认收到。
