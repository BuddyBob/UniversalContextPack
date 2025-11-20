# Deployment Checklist for Unlimited Plan Fix

## Pre-Deployment Verification

- [ ] Enhanced backend code with comprehensive webhook debugging
- [ ] Database migration script ready (`fix_unlimited_function.sql`)
- [ ] Debug endpoints added for testing
- [ ] Webhook event handlers improved

## Deployment Steps (Execute in Order)

### 1. Deploy Database Changes First

```sql
-- In Supabase SQL Editor, run:
-- This updates constraints, functions, and permissions
```

- [ ] Run `fix_unlimited_function.sql` in Supabase SQL Editor
- [ ] Verify functions created: `grant_unlimited_access`, `get_user_payment_status`
- [ ] Test the functions with a known user ID

### 2. Deploy Backend Changes

- [ ] Deploy enhanced `simple_backend.py` with improved webhook handlers
- [ ] Verify all debug endpoints are accessible:
  - `/api/debug/test-unlimited-webhook`
  - `/api/debug/simulate-checkout`
  - `/api/debug/webhook-events`

### 3. Test the System

- [ ] Test webhook simulation with debug endpoint
- [ ] Verify unlimited access granting works
- [ ] Check database function fallback mechanism

### 4. Production Verification

- [ ] Monitor webhook logs for proper event handling
- [ ] Test with small real purchase (if possible)
- [ ] Verify user receives unlimited access immediately

## Quick Test Commands

### Test Unlimited Access Grant

```bash
curl -X POST "https://your-domain.com/api/debug/test-unlimited-webhook" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_ID_HERE"}'
```

### Test Checkout Simulation

```bash
curl -X POST "https://your-domain.com/api/debug/simulate-checkout" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unlimited": true}'
```

### Check Recent Webhook Events

```bash
curl -X GET "https://your-domain.com/api/debug/webhook-events" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rollback Plan

If issues occur:

1. Database functions are backwards compatible
2. Enhanced webhook handlers are additive (won't break existing flow)
3. Debug endpoints can be disabled if needed
4. Fallback mechanisms ensure reliability

## Expected Improvements

- ✅ Better webhook event logging with unique IDs
- ✅ Multiple event handlers (checkout.session.completed, payment_intent.succeeded)
- ✅ Enhanced error handling and fallback mechanisms
- ✅ Debug endpoints for testing and troubleshooting
- ✅ Improved database functions with better error handling
- ✅ Default credits updated from 2 to 4

## Success Metrics

- Users purchasing unlimited plans immediately receive access
- Webhook events are properly logged and processed
- Debug endpoints provide clear visibility into the payment flow
- Database functions handle edge cases gracefully

## Manual User Fix (If Needed)

If a user still needs unlimited access manually:

```sql
-- In Supabase SQL Editor:
SELECT public.grant_unlimited_access('USER_UUID_HERE'::UUID, 4.99, 'manual_fix');

-- Verify:
SELECT payment_plan, credits_balance, subscription_status
FROM user_profiles
WHERE id = 'USER_UUID_HERE'::UUID;
```
