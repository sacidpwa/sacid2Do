-- ─── MÓDULO FINIQUITO/LIQUIDACIÓN ─────────────────────
-- Agregar a Supabase > SQL Editor > New query

create table if not exists finiquitos (
  id              uuid primary key default gen_random_uuid(),
  ref             text,
  tipo_separacion text not null,
  -- Trabajador
  trabajador_nombre text not null,
  trabajador_rfc    text,
  -- Patrón
  patron_nombre     text not null,
  patron_rfc        text,
  es_persona_moral  boolean default false,
  rep_legal         text,
  -- Fechas
  fecha_ingreso   date not null,
  fecha_baja      date not null,
  -- Salario
  salario_diario  numeric(10,2) not null,
  -- Días adicionales
  dias_no_pagados numeric(6,2) default 0,
  -- Prestaciones anteriores pendientes
  prestaciones_anteriores boolean default false,
  monto_prestaciones_ant  numeric(10,2) default 0,
  -- Cálculo resultante (guardado para historial)
  dias_trabajados     numeric(6,2),
  aguinaldo           numeric(10,2),
  vacaciones          numeric(10,2),
  prima_vacacional    numeric(10,2),
  salarios_caidos     numeric(10,2) default 0,
  tres_meses          numeric(10,2) default 0,
  veinte_dias_anio    numeric(10,2) default 0,
  partes_proporcionales numeric(10,2) default 0,
  total_neto          numeric(10,2),
  -- Meta
  ciudad    text default 'Toluca',
  estado    text default 'Estado de México',
  notas     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists finiquitos_fecha_idx on finiquitos(fecha_baja);
create index if not exists finiquitos_trabajador_idx on finiquitos(trabajador_nombre);

alter table finiquitos enable row level security;
create policy "Allow all for anon" on finiquitos for all to anon using (true) with check (true);
alter publication supabase_realtime add table finiquitos;

create trigger set_finiquitos_updated_at before update on finiquitos
  for each row execute function update_updated_at();
