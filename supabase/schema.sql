-- Praxis Stärke & Staack — Schema für das neue Supabase-Projekt.
-- Einmalig im Supabase SQL Editor ausführen.
-- Region: eu-west-1 (Irland) — so steht es in der Datenschutzerklärung.

create table posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('neuigkeit', 'urlaub', 'info')),
  title text not null,
  content text not null,
  date timestamptz not null default now()
);

create table anfragen (
  id uuid primary key default gen_random_uuid(),
  vorname text not null,
  nachname text not null,
  email text not null,
  telefon text,
  anliegen text,
  nachricht text not null,
  status text not null default 'Neu' check (status in ('Neu', 'In Arbeit', 'Erledigt')),
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

create index rate_limits_window_start_idx on rate_limits (window_start);

-- Kein anon/authenticated Zugriff. Nur der service_role Key aus den Vercel
-- Env-Vars kommt durch, und der verlässt niemals den Server.
alter table posts enable row level security;
alter table anfragen enable row level security;
alter table rate_limits enable row level security;

-- Zählt Requests pro Bucket+IP atomar in einer Anweisung. Ohne das würde
-- zwischen SELECT und UPDATE ein paralleler Request durchrutschen.
create or replace function check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else rl.window_start
        end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

-- Jede fremde IP legt eine Zeile an, die nach Ablauf ihres Fensters nutzlos
-- ist. Ohne Aufräumen wächst die Tabelle unbegrenzt. Wird vom täglichen Cron
-- über /api/ping mitgerufen.
create or replace function prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
