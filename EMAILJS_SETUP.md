# EmailJS Setup Guide for Bug Report Feature

This guide will help you set up EmailJS to enable the bug report functionality in CAIP.app.

## Step 1: Create an EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click "Sign Up" and create a free account
3. Verify your email address

## Step 2: Add an Email Service

1. Once logged in, go to **Email Services** in the left sidebar
2. Click **Add New Service**
3. Choose your email provider (Gmail is recommended)
4. For Gmail:
   - Click on **Gmail**
   - Click **Connect Account**
   - Sign in with your Gmail account (jayleathen@gmail.com)
   - Allow EmailJS to send emails on your behalf
5. Note down the **Service ID** (you'll need this later)

## Step 3: Create an Email Template

1. Go to **Email Templates** in the left sidebar
2. Click **Create New Template**
3. Replace the default template with this bug report template:

```
Subject: CAIP.app Bug Report

BUG REPORT FROM CAIP.APP
========================

Bug Description:
{{bug_description}}

Contact Information:
Name: {{user_name}}
Email: {{user_email}}

Diagnostic Data:
----------------
Browser: {{browser}}
Platform: {{platform}}
Language: {{language}}
Screen Resolution: {{screen_resolution}}
Window Size: {{window_size}}
URL: {{url}}
Timestamp: {{timestamp}}
```

4. In the **Settings** tab:
   - Set **To Email**: `jayleathen@gmail.com, jason.gomez@nhs.net`
   - Set **From Name**: `CAIP.app Bug Reporter`
   - Set **Reply To**: `{{user_email}}`
5. Click **Save**
6. Note down the **Template ID**

## Step 4: Get Your Public Key

1. Go to **Account** in the left sidebar
2. Find your **Public Key** (it looks like a random string)
3. Copy this key

## Step 5: Update the Code

Open `src/components/modals/BugReportModal.jsx` and replace the placeholder values at the top of the file:

```javascript
// Replace these with your actual EmailJS credentials
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';      // From Step 2
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';    // From Step 3
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';      // From Step 4
```

For example:
```javascript
const EMAILJS_SERVICE_ID = 'service_abc123';
const EMAILJS_TEMPLATE_ID = 'template_xyz789';
const EMAILJS_PUBLIC_KEY = 'user_aBc123XyZ';
```

## Step 6: Test the Bug Report Feature

1. Save the file
2. Open your app in the browser
3. Click the "Report Bug" button in the header
4. Fill out the form and submit
5. Check both email addresses to confirm the bug report was received

## EmailJS Free Tier Limits

- 200 emails per month (free tier)
- If you need more, you can upgrade to a paid plan

## Troubleshooting

### Emails not being received
- Check your spam folder
- Verify all three credentials (Service ID, Template ID, Public Key) are correct
- Make sure the email service is connected and active in EmailJS dashboard
- Check the browser console for error messages

### "Failed to send" error
- Verify your EmailJS account is active and verified
- Check that you haven't exceeded the monthly limit
- Ensure the template variables match exactly (case-sensitive)

### Gmail blocking emails
- Make sure you've authorized EmailJS in your Google account security settings
- Check Google account activity for any blocked sign-in attempts

## Support

If you continue to have issues:
- Check EmailJS documentation: https://www.emailjs.com/docs/
- Contact EmailJS support through their dashboard
- Verify your email service settings in the EmailJS dashboard

## Security Note

The EmailJS Public Key is safe to expose in client-side code - it's designed to be public. However, keep your Service ID and Template ID reasonably private to prevent abuse.
