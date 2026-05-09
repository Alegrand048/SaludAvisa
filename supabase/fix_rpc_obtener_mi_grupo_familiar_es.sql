-- SaludAvisa: RPC robusta para obtener mi grupo familiar actual
-- Uso: frontend llama api_obtener_mi_grupo_familiar(p_email)
-- Devuelve el grupo activo del usuario (cliente o familiar) y todos sus miembros.

begin;

create or replace function public.api_obtener_mi_grupo_familiar(p_email text default null)
returns table(
  grupo_id uuid,
  propietario_id uuid,
  propietario_email text,
  creado_en timestamptz,
  email text,
  rol text,
  estado text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, auth.jwt() ->> 'email', '')));
  v_grupo_id uuid;
begin
  -- 1) Prioridad: grupo donde soy propietario por uid/email.
  select gf.id
  into v_grupo_id
  from public.grupos_familiares gf
  where (v_uid is not null and gf.propietario_id = v_uid)
     or (v_email <> '' and lower(gf.propietario_email) = v_email)
  order by gf.creado_en desc
  limit 1;

  -- 2) Si no, buscar por membresia (activo o invitado) por uid/email.
  if v_grupo_id is null then
    select mf.grupo_id
    into v_grupo_id
    from public.miembros_familia mf
    where mf.estado in ('activo', 'invitado')
      and (
        (v_uid is not null and mf.usuario_id = v_uid)
        or (v_email <> '' and lower(mf.email) = v_email)
      )
    order by mf.creado_en desc
    limit 1;
  end if;

  if v_grupo_id is null then
    return;
  end if;

  -- 3) Devolver todos los miembros del grupo.
  return query
  select
    gf.id as grupo_id,
    gf.propietario_id,
    gf.propietario_email,
    gf.creado_en,
    mf.email,
    mf.rol,
    mf.estado
  from public.grupos_familiares gf
  join public.miembros_familia mf
    on mf.grupo_id = gf.id
  where gf.id = v_grupo_id
  order by mf.creado_en asc;
end;
$$;

grant execute on function public.api_obtener_mi_grupo_familiar(text) to authenticated;

commit;

notify pgrst, 'reload schema';
