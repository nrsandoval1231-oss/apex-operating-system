-- The daily owner brief — PRD §9.14.
--
-- One brief per day, frozen once generated. That is the whole difference
-- between the brief and the Today feed: the feed is live and answers "what is
-- true now"; the brief is a morning snapshot and answers "what changed since
-- yesterday". A brief that rewrote itself through the day could not answer the
-- second question, so the payload is stored rather than recomputed on read.

begin;

create table daily_briefs (
  brief_id text primary key check (brief_id ~ '^brief_[0-9A-HJKMNP-TV-Z]{26}$'),
  -- One per day, enforced rather than assumed.
  brief_date date not null unique,
  generated_at timestamptz not null default now(),
  -- The rendered brief exactly as it was delivered. Kept whole so a brief read
  -- next month says what it said that morning.
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  -- Card identities on this brief, so the next day can diff against it without
  -- reparsing the payload. Card ids are derived from state rather than minted,
  -- which is what makes this comparison meaningful at all.
  card_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index daily_briefs_date_idx on daily_briefs(brief_date desc);

-- A delivered brief is a record of what someone was told on a given morning.
-- Editing one would rewrite that.
create or replace function refuse_brief_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'daily_briefs is append-only; a delivered brief records what was said that morning';
end;
$$;
create trigger daily_briefs_no_update
before update on daily_briefs
for each row execute function refuse_brief_mutation();
create trigger daily_briefs_no_delete
before delete on daily_briefs
for each row execute function refuse_brief_mutation();

alter table daily_briefs enable row level security;

create policy daily_briefs_staff_read on daily_briefs
for select using (is_staff());
create policy daily_briefs_staff_insert on daily_briefs
for insert with check (current_app_role() in ('admin', 'office', 'superintendent'));

commit;
