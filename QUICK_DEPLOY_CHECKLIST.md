# Quick Production Deployment Checklist

## Phase 1: Infrastructure Setup (Day 1)

### 1. Domain & DNS
- [ ] Purchase domain (e.g., ucpv6.com)
- [ ] Configure DNS in Cloudflare
- [ ] Set A record: `app` → Vercel IP
- [ ] Set A record: `api` → Railway IP
- [ ] Enable Cloudflare proxy

### 2. Hosting Platforms
- [ ] **Frontend**: Deploy to Vercel
  - Connect GitHub repository
  - Set build command: `cd frontend && npm run build`
  - Set output directory: `frontend/.next`
  - Add custom domain: `app.yourdomain.com`

- [ ] **Backend**: Deploy to Railway
  - Connect GitHub repository
  - Set start command: `python -m uvicorn simple_backend:app --host 0.0.0.0 --port $PORT`
  - Add custom domain: `api.yourdomain.com`

### 3. Production Databases
- [ ] Create production Supabase project
- [ ] Run `supabase_complete_schema.sql`
- [ ] Enable RLS policies
- [ ] Create production R2 bucket

## Phase 2: Configuration (Day 2)

### 4. Environment Variables
Copy from `env.production.template` and configure:

**Vercel Environment Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Railway Environment Variables:**
```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
```

### 5. SSL & Security
- [ ] Enable HTTPS on both domains
- [ ] Configure CORS origins
- [ ] Set up rate limiting
- [ ] Enable Cloudflare security rules

## Phase 3: Payment System (Day 3)

### 6. Stripe Live Mode
- [ ] Switch to Stripe live mode
- [ ] Update webhook endpoints:
  - `https://api.yourdomain.com/stripe/webhook`
- [ ] Test payment flow
- [ ] Configure subscription products

## Phase 4: Monitoring (Day 4)

### 7. Error Tracking
- [ ] Set up Sentry for error monitoring
- [ ] Configure alerts for critical errors
- [ ] Set up uptime monitoring

### 8. Analytics
- [ ] Configure Google Analytics
- [ ] Set up conversion tracking
- [ ] Monitor performance metrics

## Final Checklist

### Pre-Launch
- [ ] Test all user flows
- [ ] Verify payment processing
- [ ] Check error handling
- [ ] Test file uploads
- [ ] Validate email notifications

### Launch Day
- [ ] Monitor error rates
- [ ] Watch payment processing
- [ ] Check user registrations
- [ ] Monitor API response times

### Post-Launch (Week 1)
- [ ] Daily error monitoring
- [ ] Performance optimization
- [ ] User feedback collection
- [ ] Scale resources if needed

## Emergency Contacts & Rollback

### Quick Rollback Plan
1. **Frontend**: Revert deployment in Vercel
2. **Backend**: Roll back to previous Railway deployment
3. **Database**: Restore from Supabase backup

### Key Metrics to Monitor
- API response time: < 2s
- Error rate: < 1%
- Payment success rate: > 98%
- Uptime: > 99.9%

## Cost Estimates (Monthly)
- Vercel Pro: $20
- Railway: ~$10-50 (based on usage)
- Supabase Pro: $25
- Cloudflare R2: ~$5-15
- Domain: ~$10-15/year
- **Total**: ~$70-110/month

---

**Next Steps**: Start with Phase 1 and work through systematically. Each phase builds on the previous one.
