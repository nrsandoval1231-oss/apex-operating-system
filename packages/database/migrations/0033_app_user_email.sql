-- Map a Cloudflare Access email to an Apex user.
--
-- Access proves the browser completed the one-time PIN for an address on the
-- application policy. This column is how that address becomes a person in Apex.
-- The role is read from this row and never from a token claim.
--
-- Nullable so a deployment that still has the single-email fallback
-- (APEX_ACCESS_EMAIL + APEX_ACCESS_USER_ID) keeps working until each staff
-- row is given an address. Multiple nulls are allowed. A stored address is
-- unique and already lower-cased; the application lower-cases the claim
-- before it looks a row up.

begin;

alter table app_users add column email text
  check (
    email is null
    or (
      email = lower(email)
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

create unique index app_users_email_key on app_users (email) where email is not null;

comment on column app_users.email is
  'Lower-cased mailbox that Cloudflare Access verified. Null until the person is provisioned. '
  'The token does not choose the role; this row does.';

commit;
