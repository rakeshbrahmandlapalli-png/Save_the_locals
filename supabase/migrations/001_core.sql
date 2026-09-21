create extension if not exists pgcrypto;

create table shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_local text,
  phone text not null,
  owner_email text,
  upi_id text,
  address text, lat numeric, lng numeric,
  zone_id uuid,
  hours jsonb not null default '{}',
  delivery_radius_km numeric not null default 2,
  min_order numeric not null default 199,
  delivery_fee numeric not null default 30,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default true,
  brand jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','staff')),
  active boolean not null default true,
  unique (shop_id, user_id)
);

create table platform_admins (user_id uuid primary key references auth.users(id) on delete cascade);

create table categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null, name_local text, sort int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  master_product_id uuid,
  name text not null, name_local text,
  unit text not null,
  price numeric not null check (price >= 0),
  in_stock boolean not null default true,
  image_url text,
  active boolean not null default true,
  sort int not null default 0
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  phone text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id uuid not null references customers(id),
  code text not null,
  status text not null default 'new'
    check (status in ('new','confirmed','out_for_delivery','delivered','cancelled')),
  fulfilment text not null check (fulfilment in ('delivery','pickup')),
  address text, notes text,
  payment_method text not null check (payment_method in ('cod','upi_on_delivery')),
  subtotal numeric not null, delivery_fee numeric not null default 0, total numeric not null,
  source text not null default 'direct',
  is_new_customer boolean not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz, delivered_at timestamptz,
  unique (shop_id, code)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null, unit text not null,
  price numeric not null, qty int not null check (qty > 0),
  status text not null default 'ok' check (status in ('ok','out_of_stock','substituted','skipped')),
  substitute_name text, substitute_price numeric
);

create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  shop_id uuid not null,
  status text not null, at timestamptz not null default now(), by_user uuid
);

create index categories_shop_id_idx on categories(shop_id);
create index products_shop_id_idx on products(shop_id);
create index customers_shop_phone_idx on customers(shop_id, phone);
create index orders_shop_created_idx on orders(shop_id, created_at desc);
create index order_items_shop_id_idx on order_items(shop_id);
create index order_events_shop_id_idx on order_events(shop_id);
