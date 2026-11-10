-- Only the service role can read mail audit data or accept verified delivery events.
create policy "Service role manages email jobs" on public.comment_email_jobs
  to service_role using (true) with check (true);
create table public.comment_email_events (
  event_id text primary key check (length(event_id) between 1 and 200),
  resend_email_id text not null,
  event_type text not null check (event_type in ('email.sent','email.delivered','email.bounced',
    'email.complained','email.failed','email.suppressed','email.delivery_delayed')),
  event_time timestamptz not null,
  received_at timestamptz not null default now()
);
create index comment_email_events_email_idx on public.comment_email_events(resend_email_id,event_time desc);
alter table public.comment_email_events enable row level security;
revoke all on public.comment_email_events from public,anon,authenticated;
grant all on public.comment_email_events to service_role;
create policy "Service role manages email events" on public.comment_email_events
  to service_role using (true) with check (true);
alter table public.comment_email_jobs add column delivery_updated_at timestamptz;

create function public.record_comment_email_event(event_id text,email_id text,event_type text,event_time timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.comment_email_events(event_id,resend_email_id,event_type,event_time)
    values(event_id,email_id,event_type,event_time) on conflict do nothing;
  update public.comment_email_jobs j set delivery_status=substring(event_type from 7),
    delivery_updated_at=event_time,updated_at=now()
    where j.resend_email_id=email_id and
      (j.delivery_updated_at is null or j.delivery_updated_at<=event_time)
      and not (j.delivery_status in ('delivered','bounced','complained','failed','suppressed')
        and event_type in ('email.sent','email.delivery_delayed'));
end $$;
revoke all on function public.record_comment_email_event(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_comment_email_event(text,text,text,timestamptz) to service_role;

create or replace function public.finish_comment_email(job_id uuid,lease uuid,state text,email_id text,error_code text,delay_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare delivery record;
begin
  if state not in ('accepted','retry','failed') or (state='accepted' and email_id is null) then
    raise exception 'Invalid notification outcome'; end if;
  -- Webhooks can arrive before the send API returns. Reconcile from the separate log.
  select substring(e.event_type from 7) as status,e.event_time into delivery
    from public.comment_email_events e where e.resend_email_id=email_id
    order by (e.event_type not in ('email.sent','email.delivery_delayed')) desc,e.event_time desc limit 1;
  update public.comment_email_jobs set status=state,resend_email_id=email_id,
    last_error=error_code,next_attempt_at=now()+make_interval(secs=>greatest(30,least(delay_seconds,3600))),
    locked_until=null,lease_token=null,updated_at=now(),
    delivery_status=coalesce(delivery.status,'unknown'),delivery_updated_at=delivery.event_time
    where comment_id=job_id and lease_token=lease and status='processing';
end $$;
