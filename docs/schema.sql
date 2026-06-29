-- ==============================================================================
-- TEAM EXPENSE TRACKER - DATABASE SCHEMA
-- ==============================================================================

-- ==========================================
-- 1. CORE TABLES
-- ==========================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('admin', 'member', 'viewer')) default 'member',
  created_at timestamp with time zone default now(),
  unique (org_id, user_id)
);

create table org_wallets (
  org_id uuid primary key references organizations(id) on delete cascade,
  balance numeric not null default 0.00,
  updated_at timestamp with time zone default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  submitted_by uuid references auth.users(id) not null,
  amount numeric not null check (amount > 0),
  description text not null,
  category text not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default now()
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  expense_id uuid references expenses(id) on delete set null,
  amount numeric not null,
  balance_after numeric not null,
  type text not null check (type in ('credit', 'debit')),
  created_at timestamp with time zone default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamp with time zone default now()
);

create table processed_webhooks (
  idempotency_key text primary key,
  org_id uuid references organizations(id) on delete cascade not null,
  amount numeric not null,
  processed_at timestamp with time zone default now()
);


-- ==========================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table org_wallets enable row level security;
alter table expenses enable row level security;
alter table wallet_transactions enable row level security;
alter table audit_log enable row level security;
alter table processed_webhooks enable row level security;


-- ==========================================
-- 3. HELPER FUNCTIONS
-- ==========================================

-- Bypasses RLS internally to prevent infinite recursion during policy evaluation
create or replace function my_role_in_org(org uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from org_members
  where org_id = org and user_id = auth.uid()
  limit 1;
$$;


-- ==========================================
-- 4. SECURITY POLICIES
-- ==========================================

-- Organizations & Members
create policy "Organizations: read own org" on organizations for select using ( my_role_in_org(id) is not null );
create policy "Members: read own org" on org_members for select using ( my_role_in_org(org_id) is not null );

-- Wallets & Transactions
create policy "Wallets: read by members" on org_wallets for select using ( my_role_in_org(org_id) is not null );
create policy "Transactions: read by members" on wallet_transactions for select using ( my_role_in_org(org_id) is not null );

-- Expenses
create policy "Expenses: read by members" on expenses for select using ( my_role_in_org(org_id) is not null );
create policy "Expenses: insert by members" on expenses for insert with check ( my_role_in_org(org_id) is not null );
create policy "Expenses: update by admins" on expenses for update using ( my_role_in_org(org_id) = 'admin' );

-- Audit Log (Strict Admin Read-Only)
create policy "Audit: admin read own org" on audit_log for select using ( my_role_in_org(org_id) = 'admin' );
-- (Note: No API INSERT policy exists for audit_log. It is strictly populated by the database trigger.)


-- ==========================================
-- 5. BUSINESS LOGIC & RPCs
-- ==========================================

-- Securely provisions a new organization, admin member, and starting wallet
create or replace function create_new_org(org_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  insert into organizations (name) values (org_name) returning id into v_org_id;
  insert into org_members (org_id, user_id, role) values (v_org_id, auth.uid(), 'admin');
  insert into org_wallets (org_id, balance) values (v_org_id, 1000.00);
  return v_org_id;
end;
$$;

-- Atomic expense approval with Row-Level Locking (FOR UPDATE) to prevent race conditions
create or replace function approve_expense(e_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_amount numeric;
  v_status text;
  v_wallet_balance numeric;
  v_role text;
begin
  select org_id, amount, status into v_org_id, v_amount, v_status from expenses where id = e_id;
  
  if v_status != 'pending' then raise exception 'Expense has already been processed.'; end if;

  select role into v_role from org_members where org_id = v_org_id and user_id = auth.uid();
  if v_role != 'admin' then raise exception 'Unauthorized: Only admins can approve expenses.'; end if;

  -- Lock the wallet row to prevent concurrent modifications
  select balance into v_wallet_balance from org_wallets where org_id = v_org_id for update;
  if v_wallet_balance < v_amount then raise exception 'Insufficient funds in the organization wallet.'; end if;

  -- Execute updates
  update org_wallets set balance = balance - v_amount where org_id = v_org_id;
  
  insert into wallet_transactions (org_id, expense_id, amount, balance_after, type)
  values (v_org_id, e_id, -v_amount, v_wallet_balance - v_amount, 'debit');

  update expenses set status = 'approved' where id = e_id;
end;
$$;

-- Used by the Webhook Edge Function to safely credit wallets
create or replace function add_funds_to_wallet(target_org_id uuid, fund_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update org_wallets set balance = balance + fund_amount where org_id = target_org_id;
end;
$$;


-- ==========================================
-- 6. AUDIT LOG TRIGGER
-- ==========================================

-- Automatically records state changes regardless of application logic
create or replace function audit_log_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_log (
    org_id,
    actor_id,
    action,
    table_name,
    record_id,
    before_data,
    after_data
  )
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    case when TG_OP != 'INSERT' then to_jsonb(old) end,
    case when TG_OP != 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists expenses_audit on expenses;
create trigger expenses_audit
  after insert or update or delete on expenses
  for each row execute function audit_log_trigger();