-- No Resend key or recipient belongs in this file. The key lives only in Edge Secrets.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create schema if not exists blog_private;
revoke all on schema blog_private from public, anon, authenticated;

create table public.comment_email_jobs (
  comment_id uuid primary key references public.comments(id) on delete cascade,
  context jsonb not null,
  status text not null default 'pending' check (status in
    ('pending','processing','retry','accepted','failed','needs_review','skipped')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  locked_until timestamptz,
  email_request jsonb,
  resend_email_id text unique,
  last_error text,
  delivery_status text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.comment_email_jobs enable row level security;
revoke all on public.comment_email_jobs from public, anon, authenticated;
grant all on public.comment_email_jobs to service_role;
create index comment_email_jobs_due_idx on public.comment_email_jobs(next_attempt_at)
  where status in ('pending','retry','processing');

-- Generate inside PostgreSQL; it never appears in migration source or query results.
do $$ begin
  if not exists (select 1 from vault.secrets where name='blog_comment_webhook_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'blog_comment_webhook_token');
  end if;
end $$;

create function public.comment_email_authorized(token text) returns boolean
language sql security definer set search_path = '' as $$
  select coalesce(length(token)=64 and exists (
    select 1 from vault.decrypted_secrets where name='blog_comment_webhook_token'
    and extensions.digest(decrypted_secret,'sha256')=extensions.digest(token,'sha256')
  ),false);
$$;
revoke all on function public.comment_email_authorized(text) from public,anon,authenticated;
grant execute on function public.comment_email_authorized(text) to service_role;

create function blog_private.dispatch_comment_emails() returns void
language plpgsql security definer set search_path = '' as $$
declare credential text;
begin
  if not exists (select 1 from public.comment_email_jobs where
    (status in ('pending','retry') and next_attempt_at<=now()) or
    (status='processing' and locked_until<now())) then return; end if;
  select decrypted_secret into credential from vault.decrypted_secrets
    where name='blog_comment_webhook_token';
  if credential is null then return; end if;
  perform net.http_post(
    url:='https://uhcmzlhzrgyjnvqnnpss.supabase.co/functions/v1/comment-notify',
    headers:=jsonb_build_object('Content-Type','application/json','x-blog-webhook-token',credential),
    body:='{}'::jsonb, timeout_milliseconds:=10000);
exception when others then
  raise log 'comment_email_dispatch_failed sqlstate=%',sqlstate;
end $$;
revoke all on function blog_private.dispatch_comment_emails() from public,anon,authenticated;

-- Replace the existing direct-to-Resend implementation, preserving its trigger name.
create or replace function blog_private.notify_new_blog_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare article record;
begin
  select id,title,slug,author_id into article from public.articles
    where id=new.article_id and published and deleted_at is null;
  if not found or new.is_owner or not new.approved or
    auth.uid()=article.author_id or length(trim(new.body))=0 or
    length(trim(new.visitor_name))=0 then return new; end if;
  insert into public.comment_email_jobs(comment_id,context)
    values(new.id,jsonb_build_object(
      'comment',jsonb_build_object('visitor_name',new.visitor_name,'body',new.body,'created_at',new.created_at),
      'article',jsonb_build_object('title',article.title,'slug',article.slug)))
    on conflict(comment_id) do nothing;
  perform blog_private.dispatch_comment_emails();
  return new;
exception when others then
  -- Deliberately isolate all notification failures from public comment transactions.
  raise log 'comment_email_enqueue_failed comment_id=% sqlstate=%',new.id,sqlstate;
  return new;
end $$;
revoke all on function blog_private.notify_new_blog_comment() from public,anon,authenticated;
drop trigger if exists comments_notify_gmail_on_insert on public.comments;
create trigger comments_notify_gmail_on_insert after insert on public.comments
  for each row execute function blog_private.notify_new_blog_comment();
create trigger comments_notify_on_approval after update of approved on public.comments
  for each row when (new.approved and not old.approved)
  execute function blog_private.notify_new_blog_comment();

create function public.claim_comment_emails() returns setof public.comment_email_jobs
language plpgsql security definer set search_path = '' as $$
begin
  -- Resend retains keys for 24 hours. Never blindly resend an ambiguous event past
  -- 23 hours: it needs operator reconciliation against Resend before any replay.
  update public.comment_email_jobs set status='needs_review',last_error='idempotency_window_expired',updated_at=now()
    where status in ('retry','processing') and first_attempt_at<now()-interval '23 hours';
  update public.comment_email_jobs set status='needs_review',last_error='attempt_limit',updated_at=now()
    where status in ('retry','processing') and attempts>=8 and coalesce(locked_until,now())<=now();
  return query
    with due as (
      select comment_id from public.comment_email_jobs
      where ((status in ('pending','retry') and next_attempt_at<=now()) or
        (status='processing' and locked_until<now())) and attempts<8
      order by next_attempt_at for update skip locked limit 5
    )
    update public.comment_email_jobs j set status='processing',attempts=j.attempts+1,
      lease_token=gen_random_uuid(),locked_until=now()+interval '3 minutes',
      first_attempt_at=coalesce(j.first_attempt_at,now()),updated_at=now()
      from due where j.comment_id=due.comment_id returning j.*;
end $$;
revoke all on function public.claim_comment_emails() from public,anon,authenticated;
grant execute on function public.claim_comment_emails() to service_role;

create function public.prepare_comment_email(job_id uuid,lease uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.comments c join public.articles a on a.id=c.article_id
    where c.id=job_id and c.approved and not c.is_owner and a.published and a.deleted_at is null) then
    update public.comment_email_jobs set status='skipped',updated_at=now()
      where comment_id=job_id and lease_token=lease and status='processing';
    return null;
  end if;
  update public.comment_email_jobs set email_request=coalesce(email_request,payload),updated_at=now()
    where comment_id=job_id and lease_token=lease and status='processing' and locked_until>now()
    returning email_request into result;
  return result;
end $$;
revoke all on function public.prepare_comment_email(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_comment_email(uuid,uuid,jsonb) to service_role;

create function public.finish_comment_email(job_id uuid,lease uuid,state text,email_id text,error_code text,delay_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if state not in ('accepted','retry','failed') or (state='accepted' and email_id is null) then
    raise exception 'Invalid notification outcome'; end if;
  update public.comment_email_jobs set status=state,resend_email_id=email_id,
    last_error=error_code,next_attempt_at=now()+make_interval(secs=>greatest(30,least(delay_seconds,3600))),
    locked_until=null,lease_token=null,updated_at=now()
    where comment_id=job_id and lease_token=lease and status='processing';
end $$;
revoke all on function public.finish_comment_email(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.finish_comment_email(uuid,uuid,text,text,text,integer) to service_role;

select cron.schedule('blog-comment-email-retry','* * * * *',
  'select blog_private.dispatch_comment_emails()');
