-- LOCAL ONLY. The CLI loads this after local reset. Never apply this seed to a
-- hosted database; hosted environment/release configuration is an owner action.
insert into private.activity_runtime(singleton,environment,release_id)
values(true,'local','stabilization-local-fixtures')
on conflict(singleton) do update set environment=excluded.environment,release_id=excluded.release_id;
