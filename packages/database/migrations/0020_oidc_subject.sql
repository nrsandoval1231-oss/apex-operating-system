-- Real identity: map an OIDC subject to an Apex user — deployment slice 4.
--
-- The pilot issued its own HS256 tokens, so a token's `sub` *was* the canonical
-- `user_<ULID>` and its `app_role` claim *was* the role. Neither survives a real
-- identity provider:
--
--   · An IdP subject is opaque and provider-shaped — `auth0|68f3…`,
--     `user_2abc…` — and is not a uuid, so `auth_user_id` cannot hold it.
--   · A role claim would put Apex's authorization model inside the identity
--     provider, where adding a superintendent becomes an IdP configuration
--     change and a mis-set claim becomes a privilege escalation.
--
-- THE RULE THIS COLUMN EXISTS TO ENFORCE: the token proves *who*; this database
-- decides *what they may do*. Verification maps `sub` to a row here and reads
-- `role` from that row. A token claiming `admin` gets whatever the row says,
-- which is the only way round that is safe.
--
-- Nullable because the pilot's existing users have no OIDC identity yet, and a
-- user with no subject simply cannot authenticate that way.

begin;

alter table app_users add column oidc_subject text
  check (oidc_subject is null or length(trim(oidc_subject)) between 1 and 255);

-- One Apex user per external identity. Without this, two rows could claim the
-- same subject and which one authenticated would depend on row order.
create unique index app_users_oidc_subject_key on app_users(oidc_subject)
  where oidc_subject is not null;

comment on column app_users.oidc_subject is
  'The `sub` claim from the identity provider. Set when a staff member is provisioned; '
  'null for users who predate OIDC. Roles are never read from a token — only from this table.';

commit;
