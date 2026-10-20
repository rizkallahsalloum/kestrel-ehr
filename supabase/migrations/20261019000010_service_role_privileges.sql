-- 0010 service_role: no privileges on Kestrel objects in public or private.
-- Projects differ in what Supabase grants service_role by default, so the state is
-- set explicitly. The app never uses service_role; the seed uses the secret key only
-- for the Auth admin API, and scripts and tests load data as postgres.

revoke all on all tables in schema public from service_role;
revoke all on all sequences in schema public from service_role;
revoke all on all functions in schema public from service_role;

revoke all on all tables in schema private from service_role;
revoke all on all sequences in schema private from service_role;
revoke all on all functions in schema private from service_role;
revoke all on schema private from service_role;

alter default privileges in schema public revoke all on tables from service_role;
alter default privileges in schema public revoke all on sequences from service_role;
alter default privileges in schema public revoke all on functions from service_role;

alter default privileges in schema private revoke all on tables from service_role;
alter default privileges in schema private revoke all on sequences from service_role;
alter default privileges in schema private revoke all on functions from service_role;
