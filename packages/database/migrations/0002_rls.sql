begin;

create or replace function current_claims()
returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function current_app_role()
returns text language sql stable as $$
  select coalesce(current_claims()->>'app_role', current_claims()->>'role', '')
$$;

create or replace function current_auth_user_id()
returns uuid language sql stable as $$
  select nullif(current_claims()->>'sub', '')::uuid
$$;

create or replace function current_app_user_id()
returns text language sql stable security definer set search_path = public as $$
  select user_id from app_users where auth_user_id = current_auth_user_id() and active limit 1
$$;

create or replace function is_staff()
returns boolean language sql stable as $$
  select current_app_role() in ('admin', 'office', 'field')
$$;

create or replace function can_access_job(target_job_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from job_customer_access
    where job_id = target_job_id and auth_user_id = current_auth_user_id()
  )
$$;

alter table app_users enable row level security;
alter table leads enable row level security;
alter table jobs enable row level security;
alter table job_customer_access enable row level security;
alter table takeoff_revisions enable row level security;
alter table gate_definitions enable row level security;
alter table gate_requirements enable row level security;
alter table gate_instances enable row level security;
alter table evidence_records enable row level security;
alter table requirement_evaluations enable row level security;
alter table events enable row level security;
alter table draw_eligibility enable row level security;
alter table customer_milestone_projections enable row level security;
alter table integration_links enable row level security;

create policy app_users_read_self_or_admin on app_users
for select using (auth_user_id = current_auth_user_id() or current_app_role() = 'admin');
create policy app_users_admin_write on app_users
for all using (current_app_role() = 'admin') with check (current_app_role() = 'admin');

create policy leads_staff_read on leads
for select using (is_staff());
create policy leads_office_write on leads
for all using (current_app_role() in ('admin', 'office')) with check (current_app_role() in ('admin', 'office'));

create policy jobs_authorized_read on jobs
for select using (can_access_job(job_id));
create policy jobs_office_write on jobs
for all using (current_app_role() in ('admin', 'office')) with check (current_app_role() in ('admin', 'office'));

create policy job_customer_access_staff_read on job_customer_access
for select using (is_staff());
create policy job_customer_access_admin_write on job_customer_access
for all using (current_app_role() = 'admin') with check (current_app_role() = 'admin');

create policy takeoff_staff_read on takeoff_revisions
for select using (is_staff());
create policy takeoff_office_write on takeoff_revisions
for all using (current_app_role() in ('admin', 'office')) with check (current_app_role() in ('admin', 'office'));

create policy gate_definition_staff_read on gate_definitions
for select using (is_staff());
create policy gate_definition_admin_write on gate_definitions
for all using (current_app_role() = 'admin') with check (current_app_role() = 'admin');
create policy gate_requirement_staff_read on gate_requirements
for select using (is_staff());
create policy gate_requirement_admin_write on gate_requirements
for all using (current_app_role() = 'admin') with check (current_app_role() = 'admin');

create policy gate_instance_staff_read on gate_instances
for select using (is_staff());
create policy gate_instance_staff_insert on gate_instances
for insert with check (current_app_role() in ('admin', 'office', 'field'));
create policy gate_instance_field_update on gate_instances
for update using (current_app_role() in ('admin', 'field')) with check (current_app_role() in ('admin', 'field'));

create policy evidence_staff_read on evidence_records
for select using (is_staff());
create policy evidence_field_insert on evidence_records
for insert with check (current_app_role() in ('admin', 'office', 'field'));

create policy evaluation_staff_read on requirement_evaluations
for select using (is_staff());
create policy evaluation_field_insert on requirement_evaluations
for insert with check (current_app_role() in ('admin', 'field'));

create policy events_staff_read on events
for select using (is_staff());
create policy events_staff_insert on events
for insert with check (current_app_role() in ('admin', 'office', 'field'));

create policy draw_staff_read on draw_eligibility
for select using (is_staff());
create policy draw_office_write on draw_eligibility
for all using (current_app_role() in ('admin', 'office')) with check (current_app_role() in ('admin', 'office'));

create policy customer_projection_authorized_read on customer_milestone_projections
for select using (can_access_job(job_id));
create policy customer_projection_staff_insert on customer_milestone_projections
for insert with check (current_app_role() in ('admin', 'office', 'field'));

create policy integration_staff_read on integration_links
for select using (is_staff());
create policy integration_office_write on integration_links
for all using (current_app_role() in ('admin', 'office')) with check (current_app_role() in ('admin', 'office'));

commit;
