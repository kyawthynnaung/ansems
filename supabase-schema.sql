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
