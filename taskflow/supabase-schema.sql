-- ─── TASKFLOW PRO — ESQUEMA DE BASE DE DATOS ──────────
-- Ejecuta este SQL en: Supabase > SQL Editor > New query

-- ─── TABLA: clients ────────────────────────────────────
create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  company      text,
  email        text,
  color        text default '#7c5cfc',
  iguala       boolean default false,
  iguala_amount numeric(10,2) default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── TABLA: tasks ──────────────────────────────────────
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  cat          text,
  client_id    uuid references clients(id) on delete set null,
  date         date,
  priority     text default 'normal'
                check (priority in ('urgente','alta','normal','baja')),
  done         boolean default false,
  recurrent    boolean default false,
  recurrence   text,
  cobro        boolean default false,
  iguala       boolean default false,
  amount       numeric(10,2) default 0,
  cobro_status text check (cobro_status in ('pendiente','facturado','pagado') or cobro_status is null),
  paid_amount  numeric(10,2) default 0,
  paid_date    date,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── ÍNDICES ────────────────────────────────────────────
create index if not exists tasks_client_id_idx on tasks(client_id);
create index if not exists tasks_date_idx       on tasks(date);
create index if not exists tasks_done_idx       on tasks(done);
create index if not exists tasks_cobro_idx      on tasks(cobro, cobro_status);

-- ─── ROW LEVEL SECURITY (RLS) ──────────────────────────
-- Activa RLS (sin auth, permite acceso total con anon key)
alter table clients enable row level security;
alter table tasks   enable row level security;

-- Políticas: acceso total para uso personal (sin autenticación)
create policy "Allow all for anon" on clients for all to anon using (true) with check (true);
create policy "Allow all for anon" on tasks   for all to anon using (true) with check (true);

-- ─── REALTIME ───────────────────────────────────────────
-- Habilitar realtime en ambas tablas
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table tasks;

-- ─── TRIGGER: updated_at automático ────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_clients_updated_at before update on clients
  for each row execute function update_updated_at();

create trigger set_tasks_updated_at before update on tasks
  for each row execute function update_updated_at();
