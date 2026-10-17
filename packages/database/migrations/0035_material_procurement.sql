begin;

create table material_procurement (
  line_id text primary key,
  job_id text not null references jobs(job_id),
  revision_id text not null references takeoff_revisions(revision_id),
  quantity_code text not null,
  required_quantity numeric not null check (required_quantity >= 0 and required_quantity < 'Infinity'::numeric),
  unit text not null,
  ordered_quantity numeric check (ordered_quantity is null or (ordered_quantity >= 0 and ordered_quantity < 'Infinity'::numeric)),
  vendor text,
  order_reference text,
  needed_by date,
  expected_on date,
  received_quantity numeric not null default 0 check (received_quantity >= 0 and received_quantity < 'Infinity'::numeric),
  revision integer not null default 1 check (revision > 0),
  updated_by text not null references app_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text not null unique check (length(idempotency_key) >= 8),
  unique(job_id, revision_id, quantity_code),
  check (ordered_quantity is null or received_quantity <= ordered_quantity),
  check ((ordered_quantity is null and vendor is null and order_reference is null and expected_on is null)
      or (ordered_quantity is not null and vendor is not null and order_reference is not null)),
  check (ordered_quantity is not null or received_quantity = 0)
);

alter table material_procurement add constraint material_procurement_code_unit check (
  (quantity_code = 'shell.gunite-ordered-volume' and unit = 'cy')
  or (quantity_code = 'shell.reinforcing-steel-weight' and unit = 'lb')
  or (quantity_code = 'finishes.tile-ordered-area' and unit = 'sf')
  or (quantity_code = 'finishes.coping-ordered-length' and unit = 'lf')
);

create function protect_material_procurement_source() returns trigger language plpgsql as $$
begin
  if new.job_id is distinct from old.job_id
     or new.revision_id is distinct from old.revision_id
     or new.quantity_code is distinct from old.quantity_code
     or new.required_quantity is distinct from old.required_quantity
     or new.unit is distinct from old.unit
     or new.line_id is distinct from old.line_id
     or new.created_at is distinct from old.created_at
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'Approved takeoff source fields on a material line are immutable.';
  end if;
  return new;
end;
$$;
create trigger protect_material_procurement_source_trigger before update on material_procurement
for each row execute function protect_material_procurement_source();

create table material_procurement_history (
  history_id bigint generated always as identity primary key,
  line_id text not null references material_procurement(line_id),
  revision integer not null,
  action text not null check (action in ('created','updated','receipt')),
  snapshot jsonb not null,
  actor_id text not null references app_users(user_id),
  idempotency_key text not null unique,
  recorded_at timestamptz not null default now()
);

create index material_procurement_job on material_procurement(job_id, needed_by, expected_on);
commit;
