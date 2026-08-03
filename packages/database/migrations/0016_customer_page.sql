-- Customer progress page — PRD §9.11. Build-plan Step 7.
--
-- This is the only surface in Apex OS that a person outside the company can
-- reach without an account. Everything here is shaped by that one fact:
--
--   · the link token is stored as a hash, never in the clear;
--   · a photo is invisible to the customer until someone says otherwise;
--   · access is logged, including access on a link that has been revoked;
--   · the tables the customer page reads carry customer wording only, so there
--     is no internal field for a later change to leak by accident.
--
-- The API is the enforcement point for the public route (it authenticates no
-- one and therefore has no role to hand to RLS); the policies below keep the
-- managed-Postgres story consistent with every other table.

begin;

-- 1. The link ----------------------------------------------------------------
--
-- One live link per job, persistent across the build (§9.11), rotatable and
-- revocable. Rotation is a revoke plus an issue rather than an update, so the
-- history of who could reach the page and when is not overwritten.

create table customer_links (
  link_id text primary key check (link_id ~ '^clink_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  -- SHA-256 of the token, never the token. A leaked backup or a screenshot of
  -- this table hands out no working links. The token is returned exactly once,
  -- at issue, and cannot be recovered afterwards — rotate instead.
  token_sha256 text not null unique check (token_sha256 ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null default now(),
  issued_by text not null references app_users(user_id),
  revoked_at timestamptz,
  revoked_by text references app_users(user_id),
  revoked_reason text check (revoked_reason is null or length(trim(revoked_reason)) > 0),
  check ((revoked_at is null) = (revoked_by is null))
);

-- Exactly one reachable link per job. Two live links would mean revoking one
-- and believing the page was closed while the other still worked.
create unique index customer_links_one_live on customer_links(job_id) where revoked_at is null;
create index customer_links_job_idx on customer_links(job_id, issued_at desc);

-- A revoked link stays revoked. Un-revoking would make the access log a lie.
create or replace function refuse_link_resurrection()
returns trigger language plpgsql as $$
begin
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'A revoked customer link cannot be reinstated; issue a new one.';
  end if;
  if new.token_sha256 <> old.token_sha256 or new.job_id <> old.job_id then
    raise exception 'A customer link cannot be repointed; issue a new one.';
  end if;
  return new;
end;
$$;
create trigger customer_links_no_resurrection
before update on customer_links
for each row execute function refuse_link_resurrection();

-- 2. The access log ----------------------------------------------------------
--
-- §9.11 requires it, and the reason it matters is narrow: a link with no login
-- can be forwarded, and the only way Apex can tell that happened is a record of
-- who fetched what and when.
--
-- What is deliberately NOT kept: a full IP address, a cookie, or anything that
-- would let this become a tracking profile of a customer's browsing. The
-- network prefix is enough to notice a link being read from three cities.
--
-- An access on an unknown token records nothing — there is no link to attach it
-- to, and a table of failed guesses against a 256-bit token is noise. An access
-- on a *revoked* token does record, because the hash still identifies the link
-- and "the old link is still being used" is a fact Apex wants.

create table customer_link_accesses (
  access_id bigint generated always as identity primary key,
  link_id text not null references customer_links(link_id),
  occurred_at timestamptz not null default now(),
  resource text not null check (resource in ('page', 'photo')),
  outcome text not null check (outcome in ('served', 'refused-revoked')),
  -- IPv4 /24 or IPv6 /48, as text. Coarse on purpose.
  ip_prefix text check (ip_prefix is null or length(ip_prefix) <= 64),
  user_agent text check (user_agent is null or length(user_agent) <= 300)
);

create index customer_link_accesses_link_idx on customer_link_accesses(link_id, occurred_at desc);

create or replace function refuse_access_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'customer_link_accesses is append-only';
end;
$$;
create trigger customer_link_accesses_no_update
before update on customer_link_accesses
for each row execute function refuse_access_log_mutation();
create trigger customer_link_accesses_no_delete
before delete on customer_link_accesses
for each row execute function refuse_access_log_mutation();

-- 3. Photo visibility --------------------------------------------------------
--
-- Evidence is gate proof first. It is photographed to show a footing depth or a
-- bond beam, and its internal caption may name a subcontractor or quote a
-- checklist item — both of which §9.11 says the customer must not see.
--
-- So: invisible by default, made visible by a named person at a recorded time,
-- and shown with a caption written for the customer or with no caption at all.
-- The internal `caption` column is never read by the customer projection.

alter table evidence_records
  add column customer_visible boolean not null default false,
  add column customer_caption text check (customer_caption is null or (length(trim(customer_caption)) > 0 and length(customer_caption) <= 300)),
  add column visibility_set_at timestamptz,
  add column visibility_set_by text references app_users(user_id);

-- Only a photograph can be published. A PDF inspection report or a measurement
-- record is not a progress photo and must not become one by a toggle.
alter table evidence_records
  add constraint evidence_customer_visible_is_photo
  check (customer_visible = false or kind = 'photo');

-- A caption without a published photo is a draft nobody asked for; and a
-- published photo must record who published it.
alter table evidence_records
  add constraint evidence_visibility_is_attributed
  check (
    customer_visible = false
    or (visibility_set_at is not null and visibility_set_by is not null)
  );

create index evidence_customer_visible_idx
  on evidence_records(job_id, captured_at desc) where customer_visible;

-- 4. Decisions the customer owes Apex ----------------------------------------
--
-- §9.11 requires the page to display decisions required from the customer. No
-- existing entity holds one: an action card is internal wording aimed at the
-- owner, and a gate requirement is a checklist item.
--
-- This table is customer-facing by construction — there is no internal/external
-- pair of fields to get the wrong way round. A decision is raised by staff and
-- answered by a human conversation (§9.11's call/text route), which a staff
-- member then records here. v1 does not let an anonymous link holder submit a
-- binding selection; that is a trust decision nobody has made yet.

create table customer_decisions (
  decision_id text primary key check (decision_id ~ '^decision_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  -- Every field below is shown to the customer verbatim.
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  detail text not null check (length(trim(detail)) > 0 and length(detail) <= 2000),
  -- What waits on it, in the customer's terms. Not a cost and not a crew name.
  consequence text not null check (length(trim(consequence)) > 0 and length(consequence) <= 500),
  needed_by date,
  status text not null default 'open' check (status in ('open', 'answered', 'withdrawn')),
  answer_note text check (answer_note is null or (length(trim(answer_note)) > 0 and length(answer_note) <= 2000)),
  resolved_at timestamptz,
  resolved_by text references app_users(user_id),
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  check ((status = 'open') = (resolved_at is null)),
  check ((resolved_at is null) = (resolved_by is null))
);

create index customer_decisions_job_idx on customer_decisions(job_id, status, needed_by);

-- 5. Row-level security ------------------------------------------------------
--
-- No policy grants the `customer` role anything here. The customer reaches this
-- data over the tokenized route, which authenticates nobody and so has no role
-- to present; letting a signed-in customer read `customer_links` would hand
-- them the ability to enumerate their own tokens for no gain.

alter table customer_links enable row level security;
alter table customer_link_accesses enable row level security;
alter table customer_decisions enable row level security;

create policy customer_links_staff_read on customer_links
for select using (is_staff());
-- Issuing and revoking a link is an office act, not a field one. A link is how
-- the company speaks to a customer.
create policy customer_links_office_write on customer_links
for all using (current_app_role() in ('admin', 'office'))
with check (current_app_role() in ('admin', 'office'));

create policy customer_accesses_staff_read on customer_link_accesses
for select using (is_staff());
create policy customer_accesses_insert on customer_link_accesses
for insert with check (true);

create policy customer_decisions_staff_read on customer_decisions
for select using (is_staff());
create policy customer_decisions_staff_write on customer_decisions
for all using (current_app_role() in ('admin', 'office', 'superintendent'))
with check (current_app_role() in ('admin', 'office', 'superintendent'));

commit;
