begin;

-- Gunite/shotcrete is shot in one construction day. Existing imported or pilot
-- bookings are normalized at migration time so the operational calendar and
-- conflict engine cannot continue treating a pour as a multi-day activity.
update scheduled_visits
set ends_on = starts_on,
    updated_at = now()
where phase_key = 'gunite'
  and ends_on <> starts_on;

commit;
