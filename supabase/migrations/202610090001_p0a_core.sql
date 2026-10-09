-- P0a core schema for Ca Bong Song Tra.
-- Baseline date: 2026-10-09. Timestamps are stored in UTC; business timezone is Asia/Ho_Chi_Minh.

create extension if not exists pgcrypto;

create type public.role as enum ('OWNER_ADMIN', 'MEMBER');
create type public.product_status as enum ('DRAFT', 'ACTIVE', 'HIDDEN', 'DISCONTINUED');
create type public.batch_status as enum ('AVAILABLE', 'QUARANTINED', 'DEPLETED', 'EXPIRED');
create type public.reservation_status as enum ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
create type public.order_status as enum ('DRAFT', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'PARTIALLY_RETURNED', 'RETURNED');
create type public.payment_status as enum ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');
create type public.payment_method as enum ('BANK_TRANSFER', 'CASH_COD');
create type public.payment_kind as enum ('RECEIPT', 'REFUND');
create type public.ledger_reason as enum ('RECEIVE', 'FULFILL', 'RETURN_RESTOCK', 'RETURN_QUARANTINE', 'DAMAGE', 'ADJUST', 'EXPIRE');
create type public.cost_type as enum ('SHOP_SHIPPING', 'PACKAGING', 'PAYMENT_FEE', 'OTHER_DIRECT', 'MEMBER_ADVANCE_REIMBURSEMENT');
create type public.cost_payer as enum ('SHOP', 'CUSTOMER', 'ADVANCED_BY_MEMBER');
create type public.commission_status as enum ('ESTIMATED', 'ELIGIBLE', 'APPROVED', 'PAID', 'ADJUSTED', 'REVERSED');
create type public.payout_status as enum ('DRAFT', 'APPROVED', 'PAID', 'VOID');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  display_name text not null,
  role public.role not null default 'MEMBER',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sku text not null,
  slug text not null,
  name text not null,
  label_net_weight_g integer not null check (label_net_weight_g > 0),
  description_public text,
  status public.product_status not null default 'DRAFT',
  hero_image_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  unique (organization_id, slug)
);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id),
  retail_price bigint not null check (retail_price > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id),
  lot_code text not null,
  supplier text,
  received_at timestamptz not null default now(),
  manufactured_at date,
  expires_at date,
  purchase_unit_cost bigint not null check (purchase_unit_cost >= 0),
  inbound_cost_total bigint not null default 0 check (inbound_cost_total >= 0),
  landed_unit_cost bigint not null check (landed_unit_cost >= 0),
  received_qty integer not null check (received_qty > 0),
  status public.batch_status not null default 'QUARANTINED',
  label_evidence_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id, lot_code)
);

create table public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  batch_id uuid not null references public.inventory_batches(id),
  product_id uuid not null references public.products(id),
  order_item_id uuid,
  qty_delta integer not null check (qty_delta <> 0),
  reason public.ledger_reason not null,
  reference_type text not null,
  reference_id uuid not null,
  actor_id uuid references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  display_name text not null,
  phone_e164 text,
  phone_hash text,
  area text,
  address text,
  zalo_id text,
  marketing_opt_in boolean not null default false,
  consent_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone_e164)
);

create table public.customer_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  label text not null,
  channel text not null,
  campaign_tag text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_code text not null unique,
  customer_id uuid not null references public.customers(id),
  owner_member_id uuid not null references public.profiles(id),
  source_id uuid references public.customer_sources(id),
  status public.order_status not null default 'DRAFT',
  payment_status public.payment_status not null default 'UNPAID',
  currency text not null default 'VND',
  item_subtotal bigint not null default 0,
  discount_total bigint not null default 0,
  customer_shipping_fee bigint not null default 0,
  gross_due bigint not null default 0,
  gross_collected bigint not null default 0,
  placed_at timestamptz,
  confirmed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer not null default 1,
  created_by uuid references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_list_price_snapshot bigint not null check (unit_list_price_snapshot >= 0),
  unit_sell_price_snapshot bigint not null check (unit_sell_price_snapshot >= 0),
  discount_allocated bigint not null default 0,
  unit_cogs_snapshot bigint,
  subtotal bigint not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

alter table public.inventory_ledger add constraint inventory_ledger_order_item_fk foreign key (order_item_id) references public.order_items(id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id),
  order_item_id uuid not null references public.order_items(id),
  batch_id uuid not null references public.inventory_batches(id),
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'ACTIVE',
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  consumed_at timestamptz,
  idempotency_key uuid not null,
  unique (organization_id, idempotency_key, order_item_id, batch_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id),
  kind public.payment_kind not null,
  method public.payment_method not null,
  amount bigint not null check (amount > 0),
  status text not null default 'POSTED',
  received_at timestamptz not null default now(),
  reference text,
  reverses_payment_id uuid references public.payments(id),
  actor_id uuid references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.order_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id),
  type public.cost_type not null,
  payer public.cost_payer not null,
  amount bigint not null check (amount > 0),
  reconciled boolean not null default false,
  evidence_path text,
  note text,
  entered_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commission_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id),
  member_id uuid not null references public.profiles(id),
  base_profit bigint not null,
  member_rate_bps integer not null default 4000,
  member_amount bigint not null,
  owner_amount bigint not null,
  policy_version text not null default 'P0a-2026-10-09',
  status public.commission_status not null default 'ESTIMATED',
  eligible_at timestamptz,
  approved_at timestamptz,
  payout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create table public.commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  commission_record_id uuid not null references public.commission_records(id),
  amount_delta bigint not null,
  reason text not null,
  source_type text not null,
  source_id uuid not null,
  effective_period date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  member_id uuid not null references public.profiles(id),
  period_start date not null,
  period_end date not null,
  amount bigint not null default 0,
  status public.payout_status not null default 'DRAFT',
  paid_at timestamptz,
  method text,
  proof_path text,
  approved_by uuid references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
alter table public.commission_records add constraint commission_records_payout_fk foreign key (payout_id) references public.commission_payouts(id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  request_id uuid default gen_random_uuid(),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  organization_id uuid not null references public.organizations(id),
  name text not null,
  value_json jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, name)
);

create index orders_owner_idx on public.orders(organization_id, owner_member_id, created_at desc);
create index orders_status_idx on public.orders(organization_id, status, created_at desc);
create index orders_customer_idx on public.orders(organization_id, customer_id, fulfilled_at desc);
create index batches_lookup_idx on public.inventory_batches(organization_id, product_id, status, expires_at, received_at);
create index reservations_expiry_idx on public.inventory_reservations(organization_id, batch_id, status, expires_at);
create index ledger_batch_idx on public.inventory_ledger(organization_id, batch_id, created_at);
create index payments_order_idx on public.payments(organization_id, order_id, received_at);
create index commission_member_idx on public.commission_records(organization_id, member_id, status, eligible_at);
create index audit_entity_idx on public.audit_logs(organization_id, entity_type, entity_id, created_at desc);

create view public.stock_on_hand_by_batch as
select b.organization_id, b.id as batch_id, b.product_id, coalesce(sum(l.qty_delta), 0)::integer as on_hand_qty
from public.inventory_batches b left join public.inventory_ledger l on l.batch_id = b.id
group by b.organization_id, b.id, b.product_id;

create view public.stock_reserved_by_batch as
select organization_id, batch_id, coalesce(sum(quantity) filter (where status = 'ACTIVE'), 0)::integer as reserved_qty
from public.inventory_reservations group by organization_id, batch_id;

create view public.stock_available_by_batch as
select b.organization_id, b.id as batch_id, b.product_id, b.status, b.expires_at, b.received_at, b.landed_unit_cost,
  coalesce(h.on_hand_qty, 0) as on_hand_qty,
  coalesce(r.reserved_qty, 0) as reserved_qty,
  greatest(coalesce(h.on_hand_qty, 0) - coalesce(r.reserved_qty, 0), 0) as available_qty
from public.inventory_batches b
left join public.stock_on_hand_by_batch h on h.batch_id = b.id
left join public.stock_reserved_by_batch r on r.batch_id = b.id;

create view public.stock_available_by_product as
select p.organization_id, p.id as product_id, p.sku, p.name,
  coalesce(sum(a.on_hand_qty), 0)::integer as on_hand_qty,
  coalesce(sum(a.reserved_qty), 0)::integer as reserved_qty,
  coalesce(sum(a.available_qty) filter (where a.status = 'AVAILABLE' and a.expires_at is not null and a.expires_at > current_date), 0)::integer as available_qty
from public.products p left join public.stock_available_by_batch a on a.product_id = p.id
group by p.organization_id, p.id, p.sku, p.name;

create view public.order_payment_summary as
select o.organization_id, o.id as order_id,
  coalesce(sum(p.amount) filter (where p.kind = 'RECEIPT'), 0) as receipts,
  coalesce(sum(p.amount) filter (where p.kind = 'REFUND'), 0) as refunds,
  greatest(coalesce(sum(p.amount) filter (where p.kind = 'RECEIPT'), 0) - coalesce(sum(p.amount) filter (where p.kind = 'REFUND'), 0), 0) as net_collected
from public.orders o left join public.payments p on p.order_id = o.id
group by o.organization_id, o.id;

create function public.current_profile_org() returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid() and active = true
$$;
create function public.current_profile_role() returns public.role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;
create function public.is_owner_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_profile_role() = 'OWNER_ADMIN', false)
$$;
create function public.audit_event(p_action text, p_entity_type text, p_entity_id uuid, p_before jsonb, p_after jsonb, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, before_json, after_json, reason)
  values (public.current_profile_org(), auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason);
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_ledger enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.customers enable row level security;
alter table public.customer_sources enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_costs enable row level security;
alter table public.commission_records enable row level security;
alter table public.commission_adjustments enable row level security;
alter table public.commission_payouts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy org_read on public.organizations for select using (id = public.current_profile_org());
create policy profiles_self_or_admin_read on public.profiles for select using (organization_id = public.current_profile_org() and (id = auth.uid() or public.is_owner_admin()));
create policy admin_all_products on public.products for all using (organization_id = public.current_profile_org() and public.is_owner_admin()) with check (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy member_read_products on public.products for select using (organization_id = public.current_profile_org() and status = 'ACTIVE');
create policy admin_prices on public.product_prices for all using (organization_id = public.current_profile_org() and public.is_owner_admin()) with check (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy member_read_prices on public.product_prices for select using (organization_id = public.current_profile_org());
create policy admin_batches on public.inventory_batches for all using (organization_id = public.current_profile_org() and public.is_owner_admin()) with check (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy admin_ledger on public.inventory_ledger for select using (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy reservations_admin on public.inventory_reservations for select using (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy customers_admin_or_owner on public.customers for select using (organization_id = public.current_profile_org() and (public.is_owner_admin() or exists (select 1 from public.orders o where o.customer_id = customers.id and o.owner_member_id = auth.uid())));
create policy sources_org_read on public.customer_sources for select using (organization_id = public.current_profile_org());
create policy orders_admin_or_owner on public.orders for select using (organization_id = public.current_profile_org() and (public.is_owner_admin() or owner_member_id = auth.uid()));
create policy order_items_admin_or_owner on public.order_items for select using (organization_id = public.current_profile_org() and exists (select 1 from public.orders o where o.id = order_items.order_id and (public.is_owner_admin() or o.owner_member_id = auth.uid())));
create policy payments_admin_or_owner on public.payments for select using (organization_id = public.current_profile_org() and exists (select 1 from public.orders o where o.id = payments.order_id and (public.is_owner_admin() or o.owner_member_id = auth.uid())));
create policy costs_admin_or_owner on public.order_costs for select using (organization_id = public.current_profile_org() and exists (select 1 from public.orders o where o.id = order_costs.order_id and (public.is_owner_admin() or o.owner_member_id = auth.uid())));
create policy commission_admin_or_self on public.commission_records for select using (organization_id = public.current_profile_org() and (public.is_owner_admin() or member_id = auth.uid()));
create policy payout_admin_or_self on public.commission_payouts for select using (organization_id = public.current_profile_org() and (public.is_owner_admin() or member_id = auth.uid()));
create policy audit_admin_read on public.audit_logs for select using (organization_id = public.current_profile_org() and public.is_owner_admin());
create policy settings_admin on public.system_settings for all using (organization_id = public.current_profile_org() and public.is_owner_admin()) with check (organization_id = public.current_profile_org() and public.is_owner_admin());

create function public.receive_batch(p_product_id uuid, p_lot_code text, p_received_qty integer, p_purchase_unit_cost bigint, p_inbound_cost_total bigint, p_expires_at date, p_label_evidence_path text, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_profile_org(); v_batch_id uuid; v_landed bigint;
begin
  if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  select id into v_batch_id from inventory_batches where organization_id = v_org and lot_code = p_lot_code and product_id = p_product_id;
  if v_batch_id is not null then return v_batch_id; end if;
  v_landed := p_purchase_unit_cost + ceil(p_inbound_cost_total::numeric / p_received_qty)::bigint;
  insert into inventory_batches(organization_id, product_id, lot_code, expires_at, purchase_unit_cost, inbound_cost_total, landed_unit_cost, received_qty, status, label_evidence_path)
  values (v_org, p_product_id, p_lot_code, p_expires_at, p_purchase_unit_cost, p_inbound_cost_total, v_landed, p_received_qty, case when p_expires_at > current_date and p_label_evidence_path is not null then 'AVAILABLE'::batch_status else 'QUARANTINED'::batch_status end, p_label_evidence_path)
  returning id into v_batch_id;
  insert into inventory_ledger(organization_id, batch_id, product_id, qty_delta, reason, reference_type, reference_id, actor_id, idempotency_key)
  values (v_org, v_batch_id, p_product_id, p_received_qty, 'RECEIVE', 'inventory_batches', v_batch_id, auth.uid(), p_idempotency_key);
  perform public.audit_event('RECEIVE_BATCH', 'inventory_batches', v_batch_id, null, jsonb_build_object('qty', p_received_qty), 'receive batch');
  return v_batch_id;
end;
$$;

create function public.create_price_version(p_product_id uuid, p_retail_price bigint, p_effective_from timestamptz, p_reason text, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_profile_org(); v_id uuid;
begin
  if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from product_prices where organization_id = v_org and product_id = p_product_id and effective_to is null and effective_from <= p_effective_from) then
    update product_prices set effective_to = p_effective_from where organization_id = v_org and product_id = p_product_id and effective_to is null;
  end if;
  insert into product_prices(organization_id, product_id, retail_price, effective_from, created_by, reason)
  values (v_org, p_product_id, p_retail_price, p_effective_from, auth.uid(), p_reason) returning id into v_id;
  perform public.audit_event('CREATE_PRICE_VERSION', 'product_prices', v_id, null, jsonb_build_object('price', p_retail_price), p_reason);
  return v_id;
end;
$$;

create function public.create_draft_order(p_customer_name text, p_customer_phone text, p_customer_area text, p_customer_address text, p_product_id uuid, p_quantity integer, p_customer_shipping_fee bigint, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_profile_org(); v_customer_id uuid; v_order_id uuid; v_price bigint; v_code text;
begin
  if auth.uid() is null or v_org is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_quantity <= 0 or p_customer_shipping_fee < 0 then raise exception 'VALIDATION_ERROR'; end if;
  select id into v_order_id from orders where organization_id = v_org and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;
  select retail_price into v_price from product_prices where organization_id = v_org and product_id = p_product_id and effective_from <= now() and (effective_to is null or effective_to > now()) order by effective_from desc limit 1;
  if v_price is null then raise exception 'PRICE_CHANGED'; end if;
  insert into customers(organization_id, display_name, phone_e164, phone_hash, area, address, created_by)
  values (v_org, p_customer_name, p_customer_phone, encode(digest(p_customer_phone, 'sha256'), 'hex'), p_customer_area, p_customer_address, auth.uid())
  on conflict (organization_id, phone_e164) do update set display_name = excluded.display_name, area = coalesce(excluded.area, customers.area), address = coalesce(excluded.address, customers.address), updated_at = now()
  returning id into v_customer_id;
  v_code := 'CBST-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into orders(organization_id, order_code, customer_id, owner_member_id, status, item_subtotal, customer_shipping_fee, gross_due, created_by, idempotency_key)
  values (v_org, v_code, v_customer_id, auth.uid(), 'DRAFT', v_price * p_quantity, p_customer_shipping_fee, v_price * p_quantity + p_customer_shipping_fee, auth.uid(), p_idempotency_key)
  returning id into v_order_id;
  insert into order_items(organization_id, order_id, product_id, qty, unit_list_price_snapshot, unit_sell_price_snapshot, subtotal)
  values (v_org, v_order_id, p_product_id, p_quantity, v_price, v_price, v_price * p_quantity);
  perform public.audit_event('CREATE_DRAFT_ORDER', 'orders', v_order_id, null, jsonb_build_object('order_code', v_code), 'create draft');
  return v_order_id;
end;
$$;

-- Forward declaration: transition/payment/cost RPCs call this function before its full body below.
create or replace function public.recalculate_commission(p_order_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
begin
  return null;
end;
$$;

create function public.confirm_order(p_order_id uuid, p_expected_version integer, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_item order_items%rowtype; v_batch record; v_remaining integer; v_available integer;
begin
  select * into v_order from orders where id = p_order_id and organization_id = public.current_profile_org() for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not public.is_owner_admin() and v_order.owner_member_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_order.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_order.status <> 'DRAFT' then raise exception 'INVALID_STATE_TRANSITION'; end if;
  if exists (select 1 from inventory_reservations where organization_id = v_order.organization_id and idempotency_key = p_idempotency_key) then return p_order_id; end if;
  for v_item in select * from order_items where order_id = p_order_id loop
    v_remaining := v_item.qty;
    -- Lock base batch rows; PostgreSQL does not allow FOR UPDATE directly on this aggregate view.
    for v_batch in
      select b.id as batch_id, b.received_at, b.expires_at,
        greatest(
          coalesce((select sum(l.qty_delta) from inventory_ledger l where l.batch_id = b.id), 0)
          - coalesce((select sum(r.quantity) from inventory_reservations r where r.batch_id = b.id and r.status = 'ACTIVE'), 0),
          0
        )::integer as available_qty
      from inventory_batches b
      where b.organization_id = v_order.organization_id
        and b.product_id = v_item.product_id
        and b.status = 'AVAILABLE'
        and b.expires_at is not null
        and b.expires_at > current_date
      order by b.expires_at asc, b.received_at asc
      for update of b
    loop
      exit when v_remaining = 0;
      v_available := least(v_batch.available_qty, v_remaining);
      insert into inventory_reservations(organization_id, order_id, order_item_id, batch_id, quantity, expires_at, idempotency_key)
      values (v_order.organization_id, p_order_id, v_item.id, v_batch.batch_id, v_available, now() + interval '24 hours', p_idempotency_key);
      v_remaining := v_remaining - v_available;
    end loop;
    if v_remaining > 0 then raise exception 'OUT_OF_STOCK'; end if;
  end loop;
  update orders set status = 'CONFIRMED', confirmed_at = now(), version = version + 1, updated_at = now() where id = p_order_id;
  perform public.audit_event('CONFIRM_ORDER', 'orders', p_order_id, to_jsonb(v_order), jsonb_build_object('status', 'CONFIRMED'), 'confirm order');
  return p_order_id;
end;
$$;

create function public.transition_order(p_order_id uuid, p_to public.order_status, p_expected_version integer, p_idempotency_key uuid, p_reason text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_res record; v_cogs numeric;
begin
  select * into v_order from orders where id = p_order_id and organization_id = public.current_profile_org() for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not public.is_owner_admin() and v_order.owner_member_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_order.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if not ((v_order.status = 'CONFIRMED' and p_to in ('PREPARING','CANCELLED')) or (v_order.status = 'PREPARING' and p_to = 'SHIPPING') or (v_order.status = 'SHIPPING' and p_to in ('DELIVERED','RETURN_REQUESTED')) or (v_order.status = 'DELIVERED' and p_to = 'RETURN_REQUESTED')) then raise exception 'INVALID_STATE_TRANSITION'; end if;
  if p_to = 'CANCELLED' and v_order.status <> 'DRAFT' and coalesce(p_reason, '') = '' then raise exception 'VALIDATION_ERROR'; end if;
  if p_to = 'CANCELLED' then
    update inventory_reservations set status = 'RELEASED', released_at = now() where order_id = p_order_id and status = 'ACTIVE';
  elsif p_to = 'DELIVERED' then
    for v_res in select r.*, b.product_id, b.landed_unit_cost from inventory_reservations r join inventory_batches b on b.id = r.batch_id where r.order_id = p_order_id and r.status = 'ACTIVE' loop
      insert into inventory_ledger(organization_id, batch_id, product_id, order_item_id, qty_delta, reason, reference_type, reference_id, actor_id, idempotency_key)
      values (v_order.organization_id, v_res.batch_id, v_res.product_id, v_res.order_item_id, -v_res.quantity, 'FULFILL', 'orders', p_order_id, auth.uid(), gen_random_uuid());
      update inventory_reservations set status = 'CONSUMED', consumed_at = now() where id = v_res.id;
    end loop;
    update order_items oi set unit_cogs_snapshot = x.unit_cogs from (select r.order_item_id, round(sum(r.quantity * b.landed_unit_cost)::numeric / sum(r.quantity))::bigint as unit_cogs from inventory_reservations r join inventory_batches b on b.id = r.batch_id where r.order_id = p_order_id group by r.order_item_id) x where oi.id = x.order_item_id;
  end if;
  update orders set status = p_to, fulfilled_at = case when p_to = 'DELIVERED' then now() else fulfilled_at end, cancelled_at = case when p_to = 'CANCELLED' then now() else cancelled_at end, cancellation_reason = case when p_to = 'CANCELLED' then p_reason else cancellation_reason end, version = version + 1, updated_at = now() where id = p_order_id;
  if p_to = 'DELIVERED' then perform public.recalculate_commission(p_order_id); end if;
  perform public.audit_event('TRANSITION_ORDER', 'orders', p_order_id, to_jsonb(v_order), jsonb_build_object('status', p_to), p_reason);
  return p_order_id;
end;
$$;

create function public.record_payment(p_order_id uuid, p_kind public.payment_kind, p_method public.payment_method, p_amount bigint, p_reference text, p_reverses_payment_id uuid, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_id uuid; v_receipts bigint; v_refunds bigint; v_status payment_status;
begin
  select * into v_order from orders where id = p_order_id and organization_id = public.current_profile_org() for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if p_kind = 'REFUND' and not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_owner_admin() and v_order.owner_member_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  select id into v_id from payments where organization_id = v_order.organization_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  select coalesce(sum(amount) filter (where kind='RECEIPT'),0), coalesce(sum(amount) filter (where kind='REFUND'),0) into v_receipts, v_refunds from payments where order_id = p_order_id;
  if p_kind = 'REFUND' and p_amount > greatest(v_receipts - v_refunds, 0) then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
  insert into payments(organization_id, order_id, kind, method, amount, reference, reverses_payment_id, actor_id, idempotency_key) values (v_order.organization_id, p_order_id, p_kind, p_method, p_amount, p_reference, p_reverses_payment_id, auth.uid(), p_idempotency_key) returning id into v_id;
  select coalesce(sum(amount) filter (where kind='RECEIPT'),0), coalesce(sum(amount) filter (where kind='REFUND'),0) into v_receipts, v_refunds from payments where order_id = p_order_id;
  v_status := case when v_receipts <= 0 then 'UNPAID'::payment_status when v_refunds >= v_receipts then 'REFUNDED'::payment_status when v_refunds > 0 then 'PARTIALLY_REFUNDED'::payment_status when v_receipts - v_refunds >= v_order.gross_due then 'PAID'::payment_status else 'PARTIALLY_PAID'::payment_status end;
  update orders set gross_collected = greatest(v_receipts - v_refunds, 0), payment_status = v_status, version = version + 1, updated_at = now() where id = p_order_id;
  perform public.recalculate_commission(p_order_id);
  perform public.audit_event('RECORD_PAYMENT', 'payments', v_id, null, jsonb_build_object('kind', p_kind, 'amount', p_amount), p_reference);
  return v_id;
end;
$$;

create function public.upsert_order_cost(p_order_id uuid, p_cost_id uuid, p_type public.cost_type, p_payer public.cost_payer, p_amount bigint, p_note text, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_id uuid;
begin
  select * into v_order from orders where id = p_order_id and organization_id = public.current_profile_org() for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not public.is_owner_admin() and v_order.owner_member_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if p_cost_id is null then
    insert into order_costs(organization_id, order_id, type, payer, amount, note, entered_by, reconciled, approved_by) values (v_order.organization_id, p_order_id, p_type, p_payer, p_amount, p_note, auth.uid(), public.is_owner_admin(), case when public.is_owner_admin() then auth.uid() else null end) returning id into v_id;
  else
    if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
    update order_costs set type = p_type, payer = p_payer, amount = p_amount, note = p_note, reconciled = true, approved_by = auth.uid(), updated_at = now() where id = p_cost_id and organization_id = v_order.organization_id returning id into v_id;
  end if;
  perform public.recalculate_commission(p_order_id);
  perform public.audit_event('UPSERT_ORDER_COST', 'order_costs', v_id, null, jsonb_build_object('amount', p_amount, 'payer', p_payer), p_note);
  return v_id;
end;
$$;

create or replace function public.recalculate_commission(p_order_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_owner_role role; v_cogs bigint; v_costs bigint; v_refunds bigint; v_base bigint; v_member bigint; v_owner bigint; v_status commission_status; v_id uuid;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then return null; end if;
  select role into v_owner_role from profiles where id = v_order.owner_member_id;
  select coalesce(sum(qty * coalesce(unit_cogs_snapshot,0)),0) into v_cogs from order_items where order_id = p_order_id;
  select coalesce(sum(amount) filter (where payer in ('SHOP','ADVANCED_BY_MEMBER') and reconciled = true),0) into v_costs from order_costs where order_id = p_order_id;
  select coalesce(sum(amount) filter (where kind='REFUND'),0) into v_refunds from payments where order_id = p_order_id;
  -- gross_collected is already net of refunds in record_payment; do not subtract refunds twice.
  v_base := v_order.gross_collected - v_cogs - v_costs;
  v_status := case when v_order.status = 'DELIVERED' and v_order.payment_status = 'PAID' and not exists (select 1 from order_costs where order_id = p_order_id and reconciled = false) and not exists (select 1 from orders where id = p_order_id and status = 'RETURN_REQUESTED') then 'ELIGIBLE'::commission_status else 'ESTIMATED'::commission_status end;
  if v_owner_role = 'OWNER_ADMIN' then return null; end if;
  v_member := case when v_base > 0 then round(v_base * 0.4)::bigint else 0 end;
  v_owner := case when v_base > 0 then v_base - v_member else 0 end;
  insert into commission_records(organization_id, order_id, member_id, base_profit, member_amount, owner_amount, status, eligible_at)
  values (v_order.organization_id, p_order_id, v_order.owner_member_id, v_base, v_member, v_owner, v_status, case when v_status = 'ELIGIBLE' then now() else null end)
  on conflict (organization_id, order_id) do update set base_profit = excluded.base_profit, member_amount = excluded.member_amount, owner_amount = excluded.owner_amount, status = case when commission_records.status in ('APPROVED','PAID') then commission_records.status else excluded.status end, eligible_at = coalesce(commission_records.eligible_at, excluded.eligible_at), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create function public.approve_commission(p_commission_record_id uuid, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  update commission_records set status = 'APPROVED', approved_at = now(), updated_at = now() where id = p_commission_record_id and organization_id = public.current_profile_org() and status = 'ELIGIBLE';
  perform public.audit_event('APPROVE_COMMISSION', 'commission_records', p_commission_record_id, null, jsonb_build_object('status','APPROVED'), 'approve commission');
  return p_commission_record_id;
end;
$$;

create function public.create_payout(p_member_id uuid, p_period_start date, p_period_end date, p_method text, p_proof_path text, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_profile_org(); v_id uuid; v_amount bigint;
begin
  if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  select id into v_id from commission_payouts where organization_id = v_org and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  select coalesce(sum(member_amount),0) into v_amount from commission_records where organization_id = v_org and member_id = p_member_id and status = 'APPROVED' and payout_id is null and eligible_at::date between p_period_start and p_period_end;
  insert into commission_payouts(organization_id, member_id, period_start, period_end, amount, status, paid_at, method, proof_path, approved_by, idempotency_key)
  values (v_org, p_member_id, p_period_start, p_period_end, v_amount, 'PAID', now(), p_method, p_proof_path, auth.uid(), p_idempotency_key) returning id into v_id;
  update commission_records set payout_id = v_id, status = 'PAID', updated_at = now() where organization_id = v_org and member_id = p_member_id and status = 'APPROVED' and payout_id is null and eligible_at::date between p_period_start and p_period_end;
  perform public.audit_event('CREATE_PAYOUT', 'commission_payouts', v_id, null, jsonb_build_object('amount', v_amount), 'monthly payout');
  return v_id;
end;
$$;

create function public.process_return(p_order_id uuid, p_refund_amount bigint, p_reason text, p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_comm uuid;
begin
  if not public.is_owner_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_order from orders where id = p_order_id and organization_id = public.current_profile_org() for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if v_order.status not in ('RETURN_REQUESTED','DELIVERED','SHIPPING') then raise exception 'INVALID_STATE_TRANSITION'; end if;
  update orders set status = 'RETURNED', version = version + 1, updated_at = now() where id = p_order_id;
  if p_refund_amount > 0 then perform public.record_payment(p_order_id, 'REFUND', 'BANK_TRANSFER', p_refund_amount, p_reason, null, p_idempotency_key); end if;
  select id into v_comm from commission_records where order_id = p_order_id;
  if v_comm is not null then
    insert into commission_adjustments(organization_id, commission_record_id, amount_delta, reason, source_type, source_id, effective_period, created_by) values (v_order.organization_id, v_comm, -p_refund_amount, p_reason, 'orders', p_order_id, date_trunc('month', now())::date, auth.uid());
    update commission_records set status = case when status = 'PAID' then 'ADJUSTED' else 'REVERSED' end, updated_at = now() where id = v_comm;
  end if;
  perform public.audit_event('PROCESS_RETURN', 'orders', p_order_id, to_jsonb(v_order), jsonb_build_object('status','RETURNED','refund',p_refund_amount), p_reason);
  return p_order_id;
end;
$$;

create function public.release_expired_reservations() returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update inventory_reservations r set status = 'EXPIRED', released_at = now()
  from orders o
  where r.order_id = o.id and r.status = 'ACTIVE' and r.expires_at <= now() and o.status = 'CONFIRMED' and o.payment_status = 'UNPAID';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

insert into public.organizations(id, name) values ('00000000-0000-4000-8000-000000000001', 'Ca Bong Song Tra') on conflict do nothing;
insert into public.products(organization_id, sku, slug, name, label_net_weight_g, description_public, status, sort_order)
values
('00000000-0000-4000-8000-000000000001', 'CBST-300', 'ca-bong-song-tra-300g', 'Ca bong Song Tra 300g', 300, 'Quy cach 300g.', 'ACTIVE', 10),
('00000000-0000-4000-8000-000000000001', 'CBST-400', 'ca-bong-song-tra-400g', 'Ca bong Song Tra 400g', 400, 'Quy cach 400g.', 'ACTIVE', 20),
('00000000-0000-4000-8000-000000000001', 'CBST-600', 'ca-bong-song-tra-600g', 'Ca bong Song Tra 600g', 600, 'Quy cach 600g.', 'ACTIVE', 30)
on conflict (organization_id, sku) do nothing;
insert into public.product_prices(organization_id, product_id, retail_price, effective_from, reason)
select organization_id, id, case sku when 'CBST-300' then 109000 when 'CBST-400' then 139000 else 199000 end, '2026-10-09 00:00:00+00', 'P0a baseline price' from public.products
where not exists (
  select 1 from public.product_prices pp
  where pp.organization_id = products.organization_id and pp.product_id = products.id
);

-- Supabase grants EXECUTE to PUBLIC by default. Remove anonymous access from all
-- SECURITY DEFINER functions, then grant only the explicit authenticated RPC surface.
revoke execute on function public.current_profile_org() from public, anon;
revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_owner_admin() from public, anon;
revoke execute on function public.audit_event(text, text, uuid, jsonb, jsonb, text) from public, anon;
revoke execute on function public.receive_batch(uuid, text, integer, bigint, bigint, date, text, uuid) from public, anon;
revoke execute on function public.create_price_version(uuid, bigint, timestamptz, text, uuid) from public, anon;
revoke execute on function public.create_draft_order(text, text, text, text, uuid, integer, bigint, uuid) from public, anon;
revoke execute on function public.recalculate_commission(uuid) from public, anon;
revoke execute on function public.confirm_order(uuid, integer, uuid) from public, anon;
revoke execute on function public.transition_order(uuid, public.order_status, integer, uuid, text) from public, anon;
revoke execute on function public.record_payment(uuid, public.payment_kind, public.payment_method, bigint, text, uuid, uuid) from public, anon;
revoke execute on function public.upsert_order_cost(uuid, uuid, public.cost_type, public.cost_payer, bigint, text, uuid) from public, anon;
revoke execute on function public.approve_commission(uuid, uuid) from public, anon;
revoke execute on function public.create_payout(uuid, date, date, text, text, uuid) from public, anon;
revoke execute on function public.process_return(uuid, bigint, text, uuid) from public, anon;
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;

grant execute on function public.receive_batch(uuid, text, integer, bigint, bigint, date, text, uuid) to authenticated;
grant execute on function public.create_price_version(uuid, bigint, timestamptz, text, uuid) to authenticated;
grant execute on function public.create_draft_order(text, text, text, text, uuid, integer, bigint, uuid) to authenticated;
grant execute on function public.confirm_order(uuid, integer, uuid) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, integer, uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, public.payment_kind, public.payment_method, bigint, text, uuid, uuid) to authenticated;
grant execute on function public.upsert_order_cost(uuid, uuid, public.cost_type, public.cost_payer, bigint, text, uuid) to authenticated;
grant execute on function public.approve_commission(uuid, uuid) to authenticated;
grant execute on function public.create_payout(uuid, date, date, text, text, uuid) to authenticated;
grant execute on function public.process_return(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.release_expired_reservations() to service_role;
