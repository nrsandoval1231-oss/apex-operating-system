begin;

-- Apex lead intake system of record.
-- Private backend only: no anonymous policies are granted.
create table if not exists lead_intake (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null unique
    check (lead_id ~ '^apex_[0-9]+_[0-9a-z]{4}$'),
  vertical text not null
    check (vertical in ('Designer Pools', 'Concrete Coating', 'Design & Renovation', 'Pool Service')),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  consent_sms boolean not null,
  consent_text text not null default '',
  source text not null default 'direct',
  medium text not null default 'none',
  campaign text not null default '',
  landing_page text not null default '',
  referrer text not null default '',
  fbclid text not null default '',
  gclid text not null default '',
  page_submitted text not null default '',
  device text not null default '',
  submitted_at timestamptz,
  engine_received_at timestamptz not null default now(),
  dedupe_status text not null default 'new'
    check (dedupe_status in ('new', 'duplicate')),
  routed_to text not null default '',
  sms_from_name text not null default '',
  review_target text not null default '',
  response_sent_at timestamptz,
  response_channel text not null default '',
  crm_record_id text not null default '',
  job_status text not null default 'lead',
  raw_payload jsonb not null
    check (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_intake_quarantine (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null default '',
  vertical text not null default '',
  quarantine_reason text not null,
  raw_payload jsonb not null
    check (jsonb_typeof(raw_payload) = 'object'),
  engine_received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lead_intake_vertical_created_idx
  on lead_intake (vertical, created_at desc);
create index if not exists lead_intake_email_idx
  on lead_intake (email)
  where email <> '';
create index if not exists lead_intake_phone_idx
  on lead_intake (phone)
  where phone <> '';
create index if not exists lead_intake_quarantine_created_idx
  on lead_intake_quarantine (created_at desc);

create or replace function update_lead_intake_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lead_intake_updated_at on lead_intake;
create trigger lead_intake_updated_at
before update on lead_intake
for each row execute function update_lead_intake_updated_at();

alter table lead_intake enable row level security;
alter table lead_intake_quarantine enable row level security;

commit;
