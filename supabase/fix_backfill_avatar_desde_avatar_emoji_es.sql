-- Backfill: copiar foto de perfil legacy (avatar_emoji) a avatar_url
-- Seguro: no borra datos, solo completa avatar_url cuando está vacío.

begin;

alter table public.perfiles
add column if not exists avatar_url text;

update public.perfiles
set avatar_url = avatar_emoji,
    actualizado_en = now()
where (avatar_url is null or trim(avatar_url) = '')
  and avatar_emoji is not null
  and (
    avatar_emoji like 'data:image%'
    or avatar_emoji like 'http://%'
    or avatar_emoji like 'https://%'
  );

commit;

notify pgrst, 'reload schema';
