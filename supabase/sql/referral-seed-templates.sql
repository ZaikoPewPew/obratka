-- =============================================================================
-- Операторские seed-инвайты (public.referral_seed_codes)
-- Живые коды в git не класть — только Dashboard / чат ops.
-- Клиенту таблица закрыта: validate/redeem только через RPC.
-- =============================================================================

-- --- Список пачек ------------------------------------------------------------
select code, max_uses, uses, (max_uses - uses) as slots_left, created_at
from public.referral_seed_codes
order by created_at;

-- --- Новая пачка (подставь код 10 символов из алфавита generate_referral_code)
-- insert into public.referral_seed_codes (code, max_uses, uses)
-- values ('XXXXXXXXXX', 100, 0);

-- --- Закрыть пачку (exhausted), не трогая остальные
-- update public.referral_seed_codes
-- set max_uses = uses
-- where code = 'XXXXXXXXXX';

-- --- Расширить потолок пачки
-- update public.referral_seed_codes
-- set max_uses = 200
-- where code = 'XXXXXXXXXX';
