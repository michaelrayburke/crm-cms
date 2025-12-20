-- =========================================================
-- ServiceUp Core Schema (portable)
-- File: db/serviceup_schema.sql
-- =========================================================

-- Extensions (portable + safe)
create extension if not exists pgcrypto;

-- =========================================================
-- Utility: updated_at trigger helper
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Core tables
-- =========================================================

-- App-wide settings (single row, jsonb)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Key/value settings (for tokens, app branding, etc.)
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_key_unique unique (key)
);

-- Roles and permissions
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_slug_unique unique (slug)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint permissions_slug_unique unique (slug)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_slug text,
  permission_slug text,
  allowed boolean not null default true,
  created_at timestamptz default now(),
  constraint role_permissions_unique unique (role_slug, permission_slug)
);

-- Users (your app auth table; distinct from Supabase auth.users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  role text not null default 'ADMIN',
  name text,
  username text,
  avatar text,
  status text,
  supabase_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_unique unique (email)
);

create unique index if not exists users_username_unique
  on public.users (username)
  where username is not null;

create index if not exists users_email_idx on public.users (email);

-- =========================================================
-- Content modeling (types/fields/entries)
-- =========================================================

create table if not exists public.content_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  type text not null default 'content',
  label_singular text,
  label_plural text,
  description text,
  icon text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_types_slug_unique unique (slug)
);

create index if not exists idx_content_types_slug on public.content_types (slug);

-- Newer normalized field table (preferred)
create table if not exists public.content_fields (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null references public.content_types(id) on delete cascade,
  field_key text not null,
  label text not null,
  type text not null,
  required boolean not null default false,
  help_text text,
  order_index integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_fields_unique unique (content_type_id, field_key)
);

create index if not exists idx_content_fields_content_type
  on public.content_fields (content_type_id);

-- Legacy/alternate fields table (keep if you still have code reading it)
create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid references public.content_types(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null,
  required boolean not null default false,
  sort integer not null default 0,
  options jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fields_content_type_key_unique unique (content_type_id, key)
);

-- Entries
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid references public.content_types(id) on delete cascade,
  data jsonb not null,
  title text,
  slug text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists entries_content_type_slug_unique
  on public.entries (content_type_id, slug)
  where slug is not null;

-- Entry versions
create table if not exists public.entry_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.entries(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Relations
create table if not exists public.entry_relations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references public.fields(id) on delete cascade,
  from_id uuid references public.entries(id) on delete cascade,
  to_id uuid references public.entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint entry_relations_unique unique (field_id, from_id, to_id)
);

-- =========================================================
-- Taxonomies & terms (tenant-aware)
-- =========================================================

create table if not exists public.taxonomies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slug text not null,
  label text not null,
  is_hierarchical boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  constraint taxonomies_slug_unique unique (slug)
);

create unique index if not exists taxonomies_tenant_slug_unique
  on public.taxonomies (tenant_id, slug);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  taxonomy_id uuid not null references public.taxonomies(id) on delete cascade,
  parent_id uuid,
  name text not null,
  slug text not null,
  description text,
  image jsonb,
  seo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists terms_tenant_tax_slug_unique
  on public.terms (tenant_id, taxonomy_id, lower(slug));

create table if not exists public.entry_terms (
  tenant_id uuid not null,
  entry_id uuid not null references public.entries(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  primary key (tenant_id, entry_id, term_id)
);

-- =========================================================
-- Views system (entry list/editor views)
-- =========================================================

create table if not exists public.entry_list_views (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null references public.content_types(id) on delete cascade,
  slug text not null,
  label text not null,
  role text not null,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists entry_list_views_slug_idx
  on public.entry_list_views (content_type_id, role, slug);

create unique index if not exists entry_list_views_default_idx
  on public.entry_list_views (content_type_id, role)
  where is_default = true;

create table if not exists public.entry_editor_views (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null references public.content_types(id) on delete cascade,
  slug text not null default 'default',
  label text not null default 'Default editor',
  role text,
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_editor_views_unique unique (content_type_id, slug, role)
);

create unique index if not exists entry_editor_views_default_idx
  on public.entry_editor_views (content_type_id, role)
  where is_default = true;

-- =========================================================
-- Dashboard layouts/settings
-- =========================================================

create table if not exists public.dashboard_settings (
  id text primary key default 'global',
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  role text,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  constraint dashboard_layouts_user_id_unique unique (user_id),
  constraint dashboard_layouts_role_unique unique (role)
);

-- =========================================================
-- Gadgets / Gizmos / Widgets
-- =========================================================

create table if not exists public.gadgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  gadget_type text not null,
  description text,
  icon text,
  repo_url text,
  api_base_url text,
  supabase_url text,
  supabase_anon_key text,
  deploy_url_web text,
  deploy_url_app text,
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  favicon_url text,
  design_config jsonb not null default '{}'::jsonb,
  structure_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gadgets_slug_unique unique (slug)
);

create index if not exists gadgets_slug_idx on public.gadgets (slug);
create index if not exists gadgets_type_idx on public.gadgets (gadget_type);

create table if not exists public.gizmos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  icon text,
  gizmo_type text not null,
  is_system boolean not null default false,
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gizmos_slug_unique unique (slug)
);

create index if not exists gizmos_slug_idx on public.gizmos (slug);

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  widget_type text,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint widgets_slug_unique unique (slug)
);

create table if not exists public.gadget_widgets (
  id uuid primary key default gen_random_uuid(),
  gadget_id uuid not null references public.gadgets(id) on delete cascade,
  widget_id uuid not null references public.widgets(id) on delete cascade,
  slot text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gadget_gizmos (
  gadget_id uuid not null references public.gadgets(id) on delete cascade,
  gizmo_id uuid not null references public.gizmos(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  primary key (gadget_id, gizmo_id)
);

-- =========================================================
-- Triggers: updated_at (apply broadly)
-- =========================================================

do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'settings','app_settings','roles','permissions','users',
        'content_types','content_fields','fields','entries',
        'entry_list_views','entry_editor_views','terms',
        'gadgets','gizmos','widgets','gadget_widgets'
      )
  loop
    execute format('drop trigger if exists trg_%I_set_updated_at on public.%I;', t.tablename, t.tablename);
    execute format(
      'create trigger trg_%I_set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t.tablename, t.tablename
    );
  end loop;
end $$;

-- =========================================================
-- Optional: Seed minimum role (safe to re-run)
-- =========================================================
insert into public.roles (slug, label, is_system)
values ('ADMIN','Administrator', true)
on conflict (slug) do nothing;
