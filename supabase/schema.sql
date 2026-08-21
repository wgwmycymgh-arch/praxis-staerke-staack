-- Praxis Stärke & Staack — Schema für das neue Supabase-Projekt.
-- Einmalig im Supabase SQL Editor ausführen (Region eu-central-1 / Frankfurt).

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
  v_expired boolean;
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

-- Aufräumen alter Zähler, damit die Tabelle nicht unbegrenzt wächst.
create index rate_limits_window_start_idx on rate_limits (window_start);
