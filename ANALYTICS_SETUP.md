# Analytics Setup Guide for Universal Context Pack

## Overview
This guide helps you set up website analytics to track user behavior, conversions, and performance metrics for your UCP platform.

## Google Analytics 4 Setup (Recommended)

### Step 1: Create Google Analytics Account
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click "Get started for free"
3. Set up your account and property
4. Choose "Web" as your platform

### Step 2: Get Your Tracking ID
1. In your GA4 property, go to Admin > Data Streams
2. Click on your web stream
3. Copy the "Measurement ID" (format: G-XXXXXXXXXX)

### Step 3: Add to Environment Variables
1. Copy `.env.analytics.example` to `.env.local`
2. Add your tracking ID:
   ```
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   ```

### Step 4: Deploy Changes
1. Commit and push your changes
2. Deploy to Vercel (or your hosting platform)
3. Add the environment variable to your production deployment

## What Gets Tracked

### User Journey Events
- Landing page views
- Export guide interactions
- Process page visits
- Sign in/out events

### File Processing Events
- File uploads (with file size)
- Extraction start/completion
- Analysis start/completion (with cost)
- Download events (UCP, pack, chunks)

### Error Tracking
- Processing errors
- Authentication issues
- Payment failures

## Viewing Your Analytics

### Real-time Data
- Visit your GA4 dashboard
- Go to Reports > Realtime
- See current active users and events

### Historical Data
- Reports > Engagement > Events
- Filter by custom events like 'file_upload', 'analysis_complete'
- Create custom reports for UCP-specific metrics

### Key Metrics to Monitor
1. **Conversion Funnel**:
   - Landing page views → Process page visits
   - File uploads → Successful extractions
   - Extractions → Analysis completions

2. **User Engagement**:
   - Session duration
   - Pages per session
   - Bounce rate

3. **Feature Usage**:
   - File upload success rate
   - Average file sizes processed
   - Download completion rates

## Custom Dashboard (Optional)

A basic analytics dashboard is available at `/analytics` on your site. This shows:
- Total pageviews
- Unique visitors
- Conversion rates
- Top pages

To enhance this dashboard:
1. Connect to Google Analytics Reporting API
2. Add real-time data fetching
3. Include UCP-specific metrics

## Advanced Tracking (Optional)

### Server-side Analytics
Add analytics tracking to your FastAPI backend:

```python
# Add to simple_backend.py
import analytics

# Track server events
@app.post("/api/extract/{job_id}")
async def extract_file(job_id: str, ...):
    analytics.track('file_extraction_started', {
        'job_id': job_id,
        'file_size': file.size
    })
    # ... rest of function
```

### User Cohort Analysis
Track user behavior over time:
- First-time vs returning users
- Feature adoption rates
- User lifetime value

### A/B Testing
Use GA4 experiments to test:
- Landing page variations
- Pricing page layouts
- Process flow improvements

## Privacy Compliance

### GDPR/CCPA Considerations
- Add cookie consent banner if required
- Provide opt-out mechanisms
- Include privacy policy updates

### Data Retention
- Configure GA4 data retention settings
- Set up data deletion schedules
- Document data usage policies

## Troubleshooting

### Common Issues
1. **No data showing**: Check tracking ID format and deployment
2. **Events not firing**: Verify environment variables in production
3. **Duplicate tracking**: Ensure tracking code only loads once

### Debug Mode
Enable GA4 debug mode in development:
```javascript
gtag('config', 'GA_TRACKING_ID', {
  debug_mode: true
});
```

## Alternative Analytics Solutions

### Plausible (Privacy-focused)
```bash
# Add to your site
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/plausible.js"></script>
```

### Mixpanel (Event-focused)
- Better for tracking specific user actions
- More detailed funnel analysis
- Advanced segmentation

### Vercel Analytics (Simple)
```bash
npm install @vercel/analytics
```

Then add to layout.tsx:
```javascript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## Next Steps

1. Set up Google Analytics 4 with the steps above
2. Deploy with your tracking ID
3. Monitor for 24-48 hours to see initial data
4. Create custom reports for UCP-specific metrics
5. Set up conversion goals and funnels

Your analytics will help you understand:
- How many users visit your site
- Which features they use most
- Where they drop off in the process
- How to optimize for better conversions
