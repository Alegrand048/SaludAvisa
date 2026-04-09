-- Fix minimo: elimina recursion de policies y expone foto/nombre del grupo sin depender de joins recursivos
-- Ejecutar en el SQL Editor del proyecto correcto.

begin;

alter table public.perfiles
add column if not exists avatar_url text;

-- 1) Perfil propio: solo lectura/escritura del propio usuario
alter table public.perfiles enable row level security;

drop policy if exists perfiles_select_own on public.perfiles;
create policy perfiles_select_own
on public.perfiles
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists perfiles_insert_own on public.perfiles;
create policy perfiles_insert_own
on public.perfiles
for insert
to authenticated
with check (auth.uid() = usuario_id);

drop policy if exists perfiles_update_own on public.perfiles;
create policy perfiles_update_own
on public.perfiles
for update
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

-- 2) RPC segura para leer perfiles del grupo familiar.
--    SECURITY DEFINER evita que RLS recursivo rompa la lectura.
create or replace function public.api_obtener_perfiles_grupo_familiar(p_emails text[])
returns table(email text, nombre_completo text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select
    lower(p.email) as email,
    p.nombre_completo,
    p.avatar_url
  from public.perfiles p
  where lower(p.email) = any (
    array(
      select lower(trim(e))
      from unnest(coalesce(p_emails, '{}'::text[])) as e
    )
  );
$$;

grant execute on function public.api_obtener_perfiles_grupo_familiar(text[]) to authenticated;

commit;

notify pgrst, 'reload schema';
