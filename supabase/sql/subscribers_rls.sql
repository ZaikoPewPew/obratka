-- Legacy waitlist table (optional). Apply if `public.subscribers` exists in Dashboard.
-- Without RLS, a GRANT SELECT would leak rows; count RPC is security definer.

do $$
begin
  if to_regclass('public.subscribers') is null then
    raise notice 'subscribers: table missing — skip RLS (legacy unused)';
    return;
  end if;

  execute 'alter table public.subscribers enable row level security';

  -- No direct client policies: only security definer subscribers_count() reads.
  revoke all on table public.subscribers from anon;
  revoke all on table public.subscribers from authenticated;
  revoke all on table public.subscribers from public;

  raise notice 'subscribers: RLS enabled, client table access revoked';
end;
$$;
