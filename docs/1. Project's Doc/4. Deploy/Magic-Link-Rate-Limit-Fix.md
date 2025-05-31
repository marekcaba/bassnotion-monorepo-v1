# Magic Link Rate Limit Fix

## 🚨 Issue: "Email Rate Limit Exceeded" with Magic Links

If you're seeing "Error - email rate limit exceeded" when clicking the "Create Account" button in magic link login, this is due to Supabase's default email rate limiting.

## 🔍 Root Cause

**Supabase Default Email Limits:**
- **Only 2 emails per hour** without custom SMTP
- Applies to ALL email operations: magic links, signup confirmations, password resets
- Shared across all users and operations

**Current Configuration:**
```toml
[auth.rate_limit]
email_sent = 2  # Only 2 emails per hour!
```

## ✅ Solutions (Ordered by Priority)

### **Option 1: Configure Custom SMTP (Recommended)**

**Benefits:**
- Removes rate limiting completely
- Production-ready email delivery
- Better deliverability and branding
- Detailed analytics

**Quick Setup with Resend (Recommended):**

1. **Sign up for Resend**: https://resend.com (Free tier: 3,000 emails/month)

2. **Get SMTP credentials**:
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: Your API key

3. **Configure in Supabase Dashboard**:
   - Go to Authentication → Settings → SMTP Settings
   - Enable Custom SMTP
   - Enter Resend credentials
   - Set sender email (e.g., `auth@yourdomain.com`)

4. **Update Rate Limits**:
   - Go to Authentication → Rate Limits
   - Increase "Email sent" to reasonable limit (e.g., 100/hour)

**Alternative SMTP Providers:**
- **AWS SES**: Most cost-effective for high volume
- **SendGrid**: Popular choice with good free tier
- **Postmark**: Excellent deliverability
- **Mailgun**: Flexible pricing

### **Option 2: Increase Default Rate Limits (Temporary Fix)**

If you can't set up SMTP immediately, increase the limits:

```toml
[auth.rate_limit]
# Increase from 2 to 10 emails per hour
email_sent = 10
```

**How to update:**
1. Edit `apps/backend/supabase/config.toml`
2. Change `email_sent = 2` to `email_sent = 10`
3. Apply migration: `supabase db reset`
4. Redeploy backend

**⚠️ Limitations:**
- Still limited (10/hour vs unlimited with SMTP)
- Only works for team members' emails
- Not suitable for production

### **Option 3: Use OAuth Instead (Alternative)**

For production, consider prioritizing OAuth over magic links:

```typescript
// Encourage Google OAuth in your login component
<Button onClick={signInWithGoogle} className="w-full">
  <GoogleIcon /> Continue with Google
</Button>

// Make magic link secondary
<Button variant="outline" size="sm">
  Use Email Instead
</Button>
```

## 🔧 Implementation Guide

### **Step 1: Set Up Resend SMTP**

1. **Create Resend account**: https://resend.com
2. **Verify your domain** (optional but recommended)
3. **Get API key** from dashboard

### **Step 2: Configure in Production Supabase**

1. **Go to your production Supabase project**
2. **Authentication → Settings → SMTP Settings**
3. **Enable Custom SMTP** and enter:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Your Resend API Key]
   Sender Name: BassNotion
   Sender Email: auth@bassnotion.com
   ```

### **Step 3: Update Rate Limits**

1. **Authentication → Rate Limits**
2. **Set "Email sent" to 100** (or higher based on needs)
3. **Save changes**

### **Step 4: Test Magic Link Flow**

1. **Clear browser cache**
2. **Try magic link with new email**
3. **Verify email delivery and rate limit resolution**

## 🧪 Testing Rate Limits

### **Check Current Usage**
```sql
-- Check recent email attempts in Supabase logs
SELECT * FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '1 hour'
AND event_type = 'email_change_request'
ORDER BY created_at DESC;
```

### **Monitor Rate Limit Status**
```typescript
// In your frontend, handle rate limit errors gracefully
try {
  await authService.signInWithMagicLink(email, isNewUser);
} catch (error) {
  if (error.message.includes('rate limit')) {
    toast({
      title: 'Too many requests',
      description: 'Please try again in an hour, or use Google sign-in instead.',
      variant: 'destructive',
    });
  }
}
```

## 🚨 Emergency Workaround

If you need immediate access:

1. **Use Google OAuth**: No rate limits
2. **Wait 1 hour**: Rate limits reset hourly
3. **Use different email**: Test with team member emails (they're pre-authorized)

## 📋 Production Checklist

**Before deploying magic links:**
- [ ] Custom SMTP configured and tested
- [ ] Rate limits set appropriately (100+ emails/hour)
- [ ] Domain verified with email provider
- [ ] DKIM/SPF records configured
- [ ] Fallback OAuth options available
- [ ] Error handling for rate limits implemented
- [ ] Email templates customized

## 🔍 Monitoring & Maintenance

**Regular Tasks:**
- Monitor email delivery rates
- Check sender reputation
- Review rate limit usage
- Update SMTP credentials as needed

**Warning Signs:**
- Increased bounce rates
- Emails going to spam
- Rate limit errors in logs
- User complaints about missing emails

---

_Created: May 30, 2025_
_Critical fix for magic link rate limiting issues_ 