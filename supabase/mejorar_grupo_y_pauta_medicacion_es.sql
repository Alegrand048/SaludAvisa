-- SaludAvisa: permitir salir del grupo familiar y mejorar la pauta de medicacion
-- Ejecuta en el SQL Editor del proyecto Supabase correcto.

-- ============================================================
-- 1) SALIR DEL GRUPO FAMILIAR COMO CLIENTE O MIEMBRO
-- ============================================================

create or replace function public.api_salir_grupo_familiar(p_user_id uuid, p_email_miembro text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_grupo_id uuid;
  v_owner_id uuid;
  v_owner_email text;
begin
  v_email := lower(trim(p_email_miembro));

  select gf.id, gf.propietario_id, lower(gf.propietario_email)
    into v_grupo_id, v_owner_id, v_owner_email
  from public.grupos_familiares gf
  where gf.propietario_id = p_user_id
  order by gf.creado_en desc
  limit 1;

  if not found then
    select mf.grupo_id, gf.propietario_id, lower(gf.propietario_email)
      into v_grupo_id, v_owner_id, v_owner_email
    from public.miembros_familia mf
    join public.grupos_familiares gf on gf.id = mf.grupo_id
    where mf.usuario_id = p_user_id
      and lower(mf.email) = v_email
    order by mf.creado_en desc
    limit 1;
  end if;

  if not found then
    raise exception 'No formas parte de ningun grupo activo';
  end if;

  if v_owner_id = p_user_id then
    update public.medicamentos_familia_compartidos
      set activa = false
    where lower(cliente_email) = v_owner_email;

    update public.citas_familia_compartidas
      set activa = false
    where lower(cliente_email) = v_owner_email;

    update public.solicitudes_union_familiar
      set estado = 'rechazada', actualizado_en = now()
    where lower(cliente_email) = v_owner_email and estado = 'pendiente';

    delete from public.miembros_familia where grupo_id = v_grupo_id;
    delete from public.invitaciones_familia where grupo_id = v_grupo_id;
    delete from public.grupos_familiares where id = v_grupo_id;
    return;
  end if;

  delete from public.miembros_familia
  where grupo_id = v_grupo_id
    and lower(email) = v_email
    and usuario_id = p_user_id;

  update public.medicamentos_familia_compartidos
    set activa = false
  where creador_usuario_id = p_user_id
    and lower(cliente_email) = v_owner_email;

  update public.citas_familia_compartidas
    set activa = false
  where creador_usuario_id = p_user_id
    and lower(cliente_email) = v_owner_email;

  delete from public.solicitudes_union_familiar
  where solicitante_usuario_id = p_user_id
    and lower(solicitante_email) = v_email
    and cliente_email in (
      select propietario_email
      from public.grupos_familiares
      where id = v_grupo_id
    );
end;
$$;

-- ============================================================
-- 2) PAUTA DE MEDICACION MAS RICA
-- ============================================================

alter table if exists public.medicamentos_usuario
  add column if not exists dias_semana text[] not null default '{}'::text[],
  add column if not exists duracion_dias integer,
  add column if not exists fecha_inicio date;

alter table if exists public.medicamentos_familia_compartidos
  add column if not exists dias_semana text[] not null default '{}'::text[],
  add column if not exists duracion_dias integer,
  add column if not exists fecha_inicio date;

alter table if exists public.user_medications
  add column if not exists days_of_week text[] not null default '{}'::text[],
  add column if not exists duration_days integer,
  add column if not exists start_date date;

notify pgrst, 'reload schema';
