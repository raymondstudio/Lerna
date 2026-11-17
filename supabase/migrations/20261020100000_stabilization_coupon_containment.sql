-- Historical percentage/fixed vouchers do not encode a plan entitlement. Their
-- old public read policy exposed campaign inventory to every signed-in account.
-- Keep administration readable while checkout/redemption is held pending an
-- explicit, transactional entitlement contract.
drop policy if exists coupons_select_all on public.coupon_codes;
drop policy if exists stabilization_coupon_admin_read on public.coupon_codes;
create policy stabilization_coupon_admin_read on public.coupon_codes
  for select to authenticated using (public.is_admin((select auth.uid())));
