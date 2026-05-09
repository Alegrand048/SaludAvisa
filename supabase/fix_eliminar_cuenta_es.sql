-- Fix rapido: funcion RPC para borrar cuenta + refresco de cache PostgREST
-- Borra datos de la app, grupo familiar y usuario auth en una sola operacion.

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    raise exception 'No hay sesion autenticada';
  end if;

  -- Datos propios y compartidos asociados a la cuenta.
  delete from public.registro_tomas_medicacion
  where creador_usuario_id = v_uid
    or lower(cliente_email) = v_email;

  delete from public.medicamentos_familia_compartidos
  where creador_usuario_id = v_uid
    or lower(cliente_email) = v_email;

  delete from public.citas_familia_compartidas
  where creador_usuario_id = v_uid
    or lower(cliente_email) = v_email;

  delete from public.solicitudes_union_familiar
  where solicitante_usuario_id = v_uid
    or lower(solicitante_email) = v_email
    or lower(cliente_email) = v_email;

  delete from public.invitaciones_familia
  where lower(email_invitado) = v_email;

  delete from public.miembros_familia
  where usuario_id = v_uid
    or lower(email) = v_email;

  delete from public.medicamentos_usuario
  where usuario_id = v_uid;

  delete from public.preferencias_notificacion
  where usuario_id = v_uid;

  delete from public.perfiles
  where usuario_id = v_uid;

  delete from public.grupos_familiares
  where propietario_id = v_uid;

  -- El borrado de auth.users debe ir al final para conservar auth.uid/email durante la limpieza.
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- Fuerza a PostgREST a recargar esquema para que vea la funcion RPC
notify pgrst, 'reload schema';
