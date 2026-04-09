-- Fix: exponer nombres/foto de miembros del grupo familiar vía RPC (fallback cuando RLS bloquea select directo)
-- Seguro: no borra datos.

begin;

alter table public.perfiles
add column if not exists avatar_url text;

create or replace function public.api_obtener_perfiles_grupo_familiar(p_emails text[])
returns table(email text, nombre_completo text, avatar_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.email,
    p.nombre_completo,
    p.avatar_url
  from public.perfiles p
  where lower(p.email) = any (
    array(
      select lower(trim(e))
      from unnest(coalesce(p_emails, '{}'::text[])) as e
    )
  )
  and (
    p.usuario_id = auth.uid()
    or exists (
      select 1
      from public.miembros_familia mf_target
      join public.miembros_familia mf_me
        on mf_me.grupo_id = mf_target.grupo_id
      where lower(mf_target.email) = lower(p.email)
        and mf_target.estado = 'activo'
        and mf_me.estado = 'activo'
        and (
          mf_me.usuario_id = auth.uid()
          or lower(mf_me.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    or exists (
      select 1
      from public.solicitudes_union_familiar s
      where s.estado = 'aceptada'
        and (
          (s.solicitante_usuario_id = auth.uid() and lower(s.cliente_email) = lower(p.email))
          or (lower(s.solicitante_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(s.cliente_email) = lower(p.email))
          or (lower(s.solicitante_email) = lower(p.email) and lower(s.cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
        )
    )
  );
end;
$$;

grant execute on function public.api_obtener_perfiles_grupo_familiar(text[]) to authenticated;

commit;

notify pgrst, 'reload schema';
