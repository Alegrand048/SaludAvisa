-- SaludAvisa: registro de tomas de medicacion (historial para familiares/cuidadores)

create table if not exists public.registro_tomas_medicacion (
  id uuid primary key default gen_random_uuid(),
  medicamento_id uuid not null,
  creador_usuario_id uuid references auth.users(id) on delete set null,
  cliente_email text not null,
  nombre_medicamento text not null,
  dosis text,
  tomado_en timestamptz not null default now(),
  stock_restante integer not null default 0,
  completado boolean not null default false,
  registrado_por_email text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_registro_tomas_cliente_email
  on public.registro_tomas_medicacion (cliente_email);

create index if not exists idx_registro_tomas_creador
  on public.registro_tomas_medicacion (creador_usuario_id);

alter table public.registro_tomas_medicacion enable row level security;

drop policy if exists registro_tomas_creador_select on public.registro_tomas_medicacion;
create policy registro_tomas_creador_select
on public.registro_tomas_medicacion
for select
to authenticated
using (creador_usuario_id = auth.uid());

drop policy if exists registro_tomas_cliente_select on public.registro_tomas_medicacion;
create policy registro_tomas_cliente_select
on public.registro_tomas_medicacion
for select
to authenticated
using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists registro_tomas_cliente_insert on public.registro_tomas_medicacion;
create policy registro_tomas_cliente_insert
on public.registro_tomas_medicacion
for insert
to authenticated
with check (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists registro_tomas_creador_insert on public.registro_tomas_medicacion;
create policy registro_tomas_creador_insert
on public.registro_tomas_medicacion
for insert
to authenticated
with check (creador_usuario_id = auth.uid());

grant select, insert on public.registro_tomas_medicacion to authenticated;

notify pgrst, 'reload schema';
