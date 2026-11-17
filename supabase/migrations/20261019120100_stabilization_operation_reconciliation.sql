-- A crashed worker's uncertain operation remains charged. Never release it or
-- declare success merely because time passed. Bounded maintenance records unknown.
create function public.reconcile_stale_operations(p_batch_size int default 100) returns int
language plpgsql security definer set search_path = '' as $$
declare operation record; n int := 0;
begin
  if p_batch_size is null or p_batch_size not between 1 and 500 then raise exception 'Invalid reconciliation bound'; end if;
  for operation in select id from private.operation_reservations where state='pending' and created_at<now()-interval '15 minutes' order by created_at,id limit p_batch_size for update skip locked loop
    perform public.finish_operation(operation.id,'unknown','{}');
    n := n+1;
  end loop;
  -- Demo counters are only needed for the current UTC day; this bounded delete
  -- cannot grow with historical traffic in a single invocation.
  with expired as (select window_start from private.demo_budget where window_start<date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' order by window_start limit 500)
    delete from private.demo_budget b using expired e where b.window_start=e.window_start;
  return n;
end $$;
revoke all on function public.reconcile_stale_operations(int) from public,anon,authenticated;
grant execute on function public.reconcile_stale_operations(int) to service_role;
