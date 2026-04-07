-- Fix rapido: funcion RPC para borrar cuenta + refresco de cache PostgREST

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No hay sesion autenticada';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- Fuerza a PostgREST a recargar esquema para que vea la funcion RPC
notify pgrst, 'reload schema';
