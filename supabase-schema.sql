create table if not exists public.wl_entries (
  id uuid primary key default gen_random_uuid(),
  x_username text not null,
  wallet_address text not null,
  comment_link text not null,
  liked_post boolean not null default false,
  commented_post boolean not null default false,
  reposted_post boolean not null default false,
  confirmed boolean not null default false,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists wl_entries_wallet_address_key
  on public.wl_entries (wallet_address);

create unique index if not exists wl_entries_x_username_key
  on public.wl_entries (lower(x_username));

create table if not exists public.wl_raffles (
  id uuid primary key default gen_random_uuid(),
  winner_count integer not null check (winner_count > 0),
  seed text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wl_winners (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.wl_raffles(id) on delete cascade,
  entry_id uuid not null references public.wl_entries(id) on delete cascade,
  x_username text not null,
  wallet_address text not null,
  comment_link text not null,
  selected_at timestamptz not null default now()
);

create unique index if not exists wl_winners_entry_id_key
  on public.wl_winners (entry_id);

create index if not exists wl_winners_raffle_id_idx
  on public.wl_winners (raffle_id);
