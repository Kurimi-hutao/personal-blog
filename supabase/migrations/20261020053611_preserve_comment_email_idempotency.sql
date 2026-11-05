-- Keep the queue's existing comment FK. Store minimal, independent send receipts
-- so deleting a source comment cannot erase its UUID idempotency evidence.
create table public.comment_email_receipts (
  comment_id uuid primary key,
  first_attempt_at timestamptz not null,
  status text not null,
  resend_email_id text,
  delivery_status text not null,
  updated_at timestamptz not null default now()
);
alter table public.comment_email_receipts enable row level security;
revoke all on public.comment_email_receipts from public,anon,authenticated;
grant select on public.comment_email_receipts to service_role;
create policy "Service role reads email receipts" on public.comment_email_receipts
  for select to service_role using (true);

create function blog_private.capture_comment_email_receipt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.comment_email_receipts(comment_id,first_attempt_at,status,resend_email_id,delivery_status)
    values(new.comment_id,new.first_attempt_at,new.status,new.resend_email_id,new.delivery_status)
    on conflict(comment_id) do update set status=excluded.status,
      resend_email_id=excluded.resend_email_id,delivery_status=excluded.delivery_status,updated_at=now();
  return new;
end $$;
revoke all on function blog_private.capture_comment_email_receipt() from public,anon,authenticated;
create trigger comment_email_capture_receipt after update on public.comment_email_jobs
  for each row when (new.email_request is not null)
  execute function blog_private.capture_comment_email_receipt();

create function blog_private.guard_comment_email_receipt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.comment_email_receipts where comment_id=new.comment_id) then
    return null; -- A UUID that has reached a send attempt must never be reused.
  end if;
  return new;
end $$;
revoke all on function blog_private.guard_comment_email_receipt() from public,anon,authenticated;
create trigger comment_email_guard_receipt before insert on public.comment_email_jobs
  for each row execute function blog_private.guard_comment_email_receipt();

insert into public.comment_email_receipts(comment_id,first_attempt_at,status,resend_email_id,delivery_status)
  select comment_id,first_attempt_at,status,resend_email_id,delivery_status
  from public.comment_email_jobs where email_request is not null on conflict do nothing;
