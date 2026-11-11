-- Phase 1 (R5, D8): run the parity check every day at 06:15 UTC, as well as
-- after each publish. Results are in public.admin_parity_runs and on the
-- admin console. Plain Postgres (tests, CI) has no pg_cron, so this is a
-- no-op there.
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'strategy-parity-daily';
    perform cron.schedule('strategy-parity-daily', '15 6 * * *', $$select public.run_parity_check('daily')$$);
  else
    raise notice 'pg_cron not available; daily parity check not scheduled';
  end if;
end
$outer$;
