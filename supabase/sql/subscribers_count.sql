-- Один раз выполни в Supabase → SQL Editor.
-- Даёт анону точное число подписчиков без политики SELECT на строки таблицы.
-- Клиент понимает и скаляр `returns bigint`, и `returns table (count bigint)`.

create or replace function public.subscribers_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.subscribers;
$$;

grant execute on function public.subscribers_count() to anon;
grant execute on function public.subscribers_count() to authenticated;
