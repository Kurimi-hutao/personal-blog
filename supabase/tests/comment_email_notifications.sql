-- Run as postgres in a transaction. Every fixture and pg_net request is rolled back.
begin;
do $$
declare
  article public.articles%rowtype;
  visitor uuid:=gen_random_uuid();
  reply uuid:=gen_random_uuid();
  held uuid:=gen_random_uuid();
  owner_comment uuid:=gen_random_uuid();
  hidden uuid:=gen_random_uuid();
  job public.comment_email_jobs%rowtype;
  count_before integer;
  ignored integer;
  frozen jsonb;
begin
  select * into article from public.articles where published and deleted_at is null limit 1;
  if article.id is null then raise exception 'No published article for integration test'; end if;
  if has_table_privilege('anon','public.comment_email_jobs','select') or
    has_table_privilege('authenticated','public.comment_email_jobs','insert') or
    has_function_privilege('anon','public.claim_comment_emails()','execute') or
    has_function_privilege('authenticated','public.comment_email_authorized(text)','execute') then
    raise exception 'Mail audit data or worker RPC exposed'; end if;
  if public.comment_email_authorized(repeat('0',64)) then raise exception 'Invalid webhook accepted'; end if;
  select count(*) into count_before from pg_policies where tablename='comments';
  if count_before<>5 then raise exception 'Existing comment RLS policies changed'; end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  insert into public.comments(id,article_id,visitor_name,body,visitor_token,attachments)
    values(visitor,article.id,'通知事务测试','中文正文 <>&',visitor::text,
    '[{"name":"fixture.png","type":"image/png","url":"https://example.test/fixture.png","__hutao_comment":{"version":1,"imageOnly":true}}]');
  if (select count(*) from public.comment_email_jobs where comment_id=visitor)<>1 then
    raise exception 'Visitor insert was not queued'; end if;
  insert into public.comments(id,article_id,parent_id,visitor_name,body,visitor_token)
    values(reply,article.id,visitor,'回复事务测试','回复正文',reply::text);
  if not exists(select 1 from public.comment_email_jobs where comment_id=reply) then
    raise exception 'Visitor reply was not queued'; end if;
  insert into public.comments(id,article_id,visitor_name,body,visitor_token,approved)
    values(held,article.id,'审核事务测试','待审核',held::text,false);
  if exists(select 1 from public.comment_email_jobs where comment_id=held) then raise exception 'Unapproved comment queued'; end if;
  update public.comments set approved=true where id=held;
  update public.comments set approved=false where id=held;
  update public.comments set approved=true where id=held;
  if (select count(*) from public.comment_email_jobs where comment_id=held)<>1 then raise exception 'Approval duplicated event'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',article.author_id,'role','authenticated')::text,true);
  insert into public.comments(id,article_id,visitor_name,body,visitor_token,is_owner)
    values(owner_comment,article.id,'站长','站长回复',owner_comment::text,false);
  if exists(select 1 from public.comment_email_jobs where comment_id=owner_comment) then
    raise exception 'Authenticated owner reply was queued'; end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  -- Make our fixture first due, without touching unrelated queued comments.
  update public.comment_email_jobs set next_attempt_at=now()-interval '1 day' where comment_id=visitor;
  select * into job from public.claim_comment_emails() where comment_id=visitor;
  if job.lease_token is null then raise exception 'Job was not claimed'; end if;
  frozen=public.prepare_comment_email(visitor,job.lease_token,'{"immutable":"first"}');
  if frozen<>public.prepare_comment_email(visitor,job.lease_token,'{"immutable":"changed"}') then
    raise exception 'Idempotent request changed'; end if;
  if public.prepare_comment_email(visitor,gen_random_uuid(),'{}') is not null then raise exception 'Incorrect lease accepted'; end if;
  perform public.record_comment_email_event('transaction-test-event',visitor::text,'email.delivered',now());
  perform public.record_comment_email_event('transaction-test-event',visitor::text,'email.delivered',now());
  perform public.finish_comment_email(visitor,job.lease_token,'accepted',visitor::text,null,0);
  if not exists(select 1 from public.comment_email_jobs where comment_id=visitor and status='accepted'
    and delivery_status='delivered' and resend_email_id=visitor::text) then raise exception 'Delivery race was not reconciled'; end if;
  if (select count(*) from public.comment_email_events where event_id='transaction-test-event')<>1 then raise exception 'Duplicate webhook persisted'; end if;
  select count(*) into ignored from public.claim_comment_emails() where comment_id=visitor;
  if ignored<>0 then raise exception 'Accepted event was reclaimed'; end if;
  -- Expired ambiguous sends must be reconciled instead of sent outside Resend's 24h cache.
  update public.comment_email_jobs set status='retry',attempts=1,first_attempt_at=now()-interval '24 hours',
    locked_until=null,next_attempt_at=now()-interval '1 day' where comment_id=held;
  perform public.claim_comment_emails();
  if (select status from public.comment_email_jobs where comment_id=held)<>'needs_review' then raise exception 'Expired idempotency window resent'; end if;
  update public.articles set published=false where id=article.id;
  insert into public.comments(id,article_id,visitor_name,body,visitor_token)
    values(hidden,article.id,'隐藏文章测试','不发送',hidden::text);
  if exists(select 1 from public.comment_email_jobs where comment_id=hidden) then raise exception 'Hidden article queued'; end if;
  raise notice 'PASS: visitor, reply, attachment metadata, moderation, owner exclusion, private RPCs, leases, immutable payload, duplicate events, early delivery, expiry, hidden article';
end $$;
rollback;
