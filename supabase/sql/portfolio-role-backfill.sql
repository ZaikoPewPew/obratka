-- =============================================================================
-- Backfill portfolios.role: Lead/Head naming (snapshot-строки на карточках)
-- Одноразово в Supabase → SQL Editor → Run
-- Новые submit’ы уже идут через formatPortfolioRole (src/api/portfolios.js)
-- =============================================================================

-- Lead: «Lead X Designer» → «X Design Lead»
update public.portfolios
set role = 'Product Design Lead'
where role = 'Lead Product Designer';

update public.portfolios
set role = 'Web Design Lead'
where role = 'Lead Web Designer';

update public.portfolios
set role = 'Emotional Design Lead'
where role = 'Lead Emotional Designer';

update public.portfolios
set role = 'UX / UI Design Lead'
where role = 'Lead UX / UI Designer';

update public.portfolios
set role = 'Design Lead'
where role = 'Lead Designer';

-- Head: «Head X Designer» → «Head Of …»
update public.portfolios
set role = 'Head Of Design'
where role = 'Head Product Designer';

update public.portfolios
set role = 'Head Of Web Design'
where role = 'Head Web Designer';

update public.portfolios
set role = 'Head Of Emotional Design'
where role = 'Head Emotional Designer';

update public.portfolios
set role = 'Head Of UX / UI Design'
where role = 'Head UX / UI Designer';

update public.portfolios
set role = 'Head Of Design'
where role = 'Head Designer';

-- Проверка
-- select role, count(*) from public.portfolios group by role order by count(*) desc;
