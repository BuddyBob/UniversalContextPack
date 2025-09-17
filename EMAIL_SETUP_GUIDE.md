# Email Notification Setup Guide

This guide explains how to set up email notifications for Universal Context Pack completion.

## Current Status
- ✅ Email notification system implemented
- ✅ Triggers for large jobs (6+ chunks) 
- ✅ Links to `/packs` page instead of individual results
- ⚠️  Requires SMTP configuration to send actual emails

## Quick Setup (Gmail Example)

### 1. Generate App Password (Recommended)
1. Go to Google Account settings
2. Enable 2-Factor Authentication 
3. Generate an "App Password" for "Mail"
4. Copy the 16-character password

### 2. Configure Railway Environment Variables
Add these to Railway Environment Variables:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM=Universal Context Pack <noreply@context-pack.com>
```

### 3. Test Configuration
Deploy the changes and trigger a large job (6+ chunks) to test email delivery.

## Alternative Email Services

### SendGrid (Recommended for Production)
```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=Universal Context Pack <noreply@yourdomain.com>
```

### AWS SES
```
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-aws-access-key-id
EMAIL_PASSWORD=your-aws-secret-access-key
EMAIL_FROM=Universal Context Pack <noreply@yourdomain.com>
```

### Mailgun
```
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@yourdomain.com
EMAIL_PASSWORD=your-mailgun-password
EMAIL_FROM=Universal Context Pack <noreply@yourdomain.com>
```

## Email Content
The system sends completion emails with:
- ✅ Success notification
- 🔗 Direct link to `/packs` page
- 📊 Job statistics (chunks processed, job ID)
- 🎯 Professional, enterprise-style formatting

## Fallback Behavior
If SMTP is not configured:
- ✅ Emails are logged to console (visible in Railway logs)
- ✅ System continues to function normally
- ✅ Frontend still gets completion notifications
- ❌ Users don't receive actual email notifications

## Testing Email Delivery
1. Set up SMTP configuration in Railway
2. Create a test job with 6+ chunks
3. Monitor Railway logs for email delivery confirmation
4. Check the recipient inbox

## Troubleshooting
- **"Failed to send email via SMTP"**: Check credentials and network connectivity
- **"SMTP not configured"**: Add missing environment variables
- **Gmail authentication error**: Use App Password instead of regular password
- **SendGrid errors**: Verify API key and sender authentication

## Production Recommendations
1. Use a dedicated email service (SendGrid, AWS SES, Mailgun)
2. Set up proper SPF/DKIM records for your domain
3. Use a custom FROM domain (noreply@yourdomain.com)
4. Monitor email delivery rates and bounce rates
5. Set up email templates for better formatting