-- Migration: 001_initial_schema
-- Beschreibung: Initiales Datenmodell für Nebenkosten-App (6 Tabellen, RLS, Trigger)

-- 1. Objekte (Liegenschaften)
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  street text,
  zip text,
  city text,
  created_at timestamptz not null default now()
);

-- 2. Wohneinheiten
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  area_m2 numeric(10,2) not null check (area_m2 > 0),
  created_at timestamptz not null default now()
);

-- 3. Mietverhältnisse
create table if not exists public.tenancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_name text not null,
  persons int not null check (persons >= 0),
  monthly_prepayment_eur numeric(10,2) not null default 0 check (monthly_prepayment_eur >= 0),
  start_date date not null,
  end_date date,
  check (end_date is null or end_date >= start_date)
);

-- 4. Kostenpositionen inkl. Belegreferenz
create table if not exists public.cost_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  billing_year int not null check (billing_year between 2000 and 2100),
  category text not null,
  description text,
  amount_eur numeric(12,2) not null check (amount_eur >= 0),
  distribution_key text not null check (distribution_key in ('flaeche', 'personen', 'einheiten')),
  receipt_path text,
  created_at timestamptz not null default now()
);

-- 5. Festgeschriebene Abrechnung (Archiv)
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  billing_year int not null,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  result jsonb,
  pdf_path text,
  finalized_at timestamptz,
  unique (property_id, billing_year)
);

-- 6. Abonnements & Kontingente
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz
);

-- Performance-Indizes für Fremdschlüssel und Nutzerabfragen
create index if not exists idx_properties_user_id on public.properties(user_id);
create index if not exists idx_units_property_id on public.units(property_id);
create index if not exists idx_units_user_id on public.units(user_id);
create index if not exists idx_tenancies_unit_id on public.tenancies(unit_id);
create index if not exists idx_tenancies_user_id on public.tenancies(user_id);
create index if not exists idx_cost_items_property_id on public.cost_items(property_id);
create index if not exists idx_cost_items_user_id on public.cost_items(user_id);
create index if not exists idx_cost_items_billing_year on public.cost_items(billing_year);
create index if not exists idx_statements_property_id on public.statements(property_id);
create index if not exists idx_statements_user_id on public.statements(user_id);

-- Row Level Security (RLS) aktivieren
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenancies enable row level security;
alter table public.cost_items enable row level security;
alter table public.statements enable row level security;
alter table public.subscriptions enable row level security;

-- RLS-Policies: properties
drop policy if exists "Users can select own properties" on public.properties;
drop policy if exists "Users can insert own properties" on public.properties;
drop policy if exists "Users can update own properties" on public.properties;
drop policy if exists "Users can delete own properties" on public.properties;

create policy "Users can select own properties" on public.properties
  for select using (auth.uid() = user_id);
create policy "Users can insert own properties" on public.properties
  for insert with check (auth.uid() = user_id);
create policy "Users can update own properties" on public.properties
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own properties" on public.properties
  for delete using (auth.uid() = user_id);

-- RLS-Policies: units
drop policy if exists "Users can select own units" on public.units;
drop policy if exists "Users can insert own units" on public.units;
drop policy if exists "Users can update own units" on public.units;
drop policy if exists "Users can delete own units" on public.units;

create policy "Users can select own units" on public.units
  for select using (auth.uid() = user_id);
create policy "Users can insert own units" on public.units
  for insert with check (auth.uid() = user_id);
create policy "Users can update own units" on public.units
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own units" on public.units
  for delete using (auth.uid() = user_id);

-- RLS-Policies: tenancies
drop policy if exists "Users can select own tenancies" on public.tenancies;
drop policy if exists "Users can insert own tenancies" on public.tenancies;
drop policy if exists "Users can update own tenancies" on public.tenancies;
drop policy if exists "Users can delete own tenancies" on public.tenancies;

create policy "Users can select own tenancies" on public.tenancies
  for select using (auth.uid() = user_id);
create policy "Users can insert own tenancies" on public.tenancies
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tenancies" on public.tenancies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own tenancies" on public.tenancies
  for delete using (auth.uid() = user_id);

-- RLS-Policies: cost_items
drop policy if exists "Users can select own cost_items" on public.cost_items;
drop policy if exists "Users can insert own cost_items" on public.cost_items;
drop policy if exists "Users can update own cost_items" on public.cost_items;
drop policy if exists "Users can delete own cost_items" on public.cost_items;

create policy "Users can select own cost_items" on public.cost_items
  for select using (auth.uid() = user_id);
create policy "Users can insert own cost_items" on public.cost_items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own cost_items" on public.cost_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own cost_items" on public.cost_items
  for delete using (auth.uid() = user_id);

-- RLS-Policies: statements
drop policy if exists "Users can select own statements" on public.statements;
drop policy if exists "Users can insert own statements" on public.statements;
drop policy if exists "Users can update own statements" on public.statements;
drop policy if exists "Users can delete own statements" on public.statements;

create policy "Users can select own statements" on public.statements
  for select using (auth.uid() = user_id);
create policy "Users can insert own statements" on public.statements
  for insert with check (auth.uid() = user_id);
create policy "Users can update own statements" on public.statements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own statements" on public.statements
  for delete using (auth.uid() = user_id);

-- RLS-Policies: subscriptions (nur lesender Zugriff für Nutzer, Schreibzugriff via Service-Role)
drop policy if exists "Users can select own subscription" on public.subscriptions;

create policy "Users can select own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Trigger: Automatisches Anlegen eines Free-Plans bei Nutzerregistrierung
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Einmaliger Abgleich für bereits existierende Auth-Nutzer
insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
on conflict (user_id) do nothing;

-- Private Beleg- und Abrechnungsarchive.
-- Dateien werden innerhalb des Buckets unter {user_id}/... gespeichert.
insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('statements', 'statements', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can read own receipts" on storage.objects;
drop policy if exists "Users can upload own receipts" on storage.objects;
drop policy if exists "Users can update own receipts" on storage.objects;
drop policy if exists "Users can delete own receipts" on storage.objects;

create policy "Users can read own receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can upload own receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can update own receipts" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can delete own receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can read own statements" on storage.objects;
drop policy if exists "Users can upload own statements" on storage.objects;
drop policy if exists "Users can update own statements" on storage.objects;
drop policy if exists "Users can delete own statements" on storage.objects;

create policy "Users can read own statements" on storage.objects
  for select to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can upload own statements" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can update own statements" on storage.objects
  for update to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can delete own statements" on storage.objects
  for delete to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select auth.uid()::text));
