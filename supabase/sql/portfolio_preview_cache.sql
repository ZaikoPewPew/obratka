-- Storage-бакет для кэша превью-скриншотов портфолио (прокси/кэш перед thum.io).
-- Публичный GET (CDN), без client INSERT/UPDATE/DELETE — пишет только
-- Edge Function `portfolio-preview` через service_role (bypass RLS).
-- См. supabase/functions/portfolio-preview/README.md

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-previews',
  'portfolio-previews',
  true,
  5242880, -- 5 MB на скриншот, с большим запасом для сжатого JPEG превью
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Намеренно без RLS-политик на storage.objects для этого бакета:
-- `public = true` уже отдаёт GET через `/storage/v1/object/public/...` без
-- политики; отсутствие INSERT/UPDATE/DELETE политик = default-deny для
-- anon/authenticated. Edge Function пишет service_role ключом, который
-- полностью обходит RLS.
