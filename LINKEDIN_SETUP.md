# LinkedIn API Setup Guide

## Why LinkedIn Integration?

The Talent Acquisition system can automatically post job openings to LinkedIn when you publish them. This helps you reach a wider audience of potential candidates.

## Setup Instructions

### Step 1: Create a LinkedIn Developer Account

1. Go to [LinkedIn Developers](https://developer.linkedin.com/)
2. Sign in with your LinkedIn account
3. Click "Create App"
4. Fill in the required information:
   - App name: `SGC ERP Job Posting`
   - LinkedIn Page: Select your company page
   - App logo: Upload your company logo
   - Legal agreement: Accept the terms

### Step 2: Configure Your App

1. **Products & Services**
   - Go to your app dashboard
   - Click "Products" tab
   - Request access to "Share on LinkedIn"
   - Fill out the form explaining you want to post job openings

2. **Auth Settings**
   - Go to "Auth" tab
   - Add redirect URLs: `http://localhost:3000/auth/linkedin/callback`
   - Save changes

3. **App Credentials**
   - Go to "Auth" tab
   - Note down your **Client ID** and **Client Secret**

### Step 3: Get Access Token

#### Option A: Using LinkedIn OAuth (Recommended for Production)

1. **Generate Authorization URL**:
   ```
   https://www.linkedin.com/oauth/v2/authorization?
   response_type=code&
   client_id=YOUR_CLIENT_ID&
   redirect_uri=http://localhost:3000/auth/linkedin/callback&
   scope=w_member_social
   ```

2. **Get Authorization Code**:
   - Visit the URL above in your browser
   - Authorize the app
   - Copy the `code` parameter from the redirect URL

3. **Exchange Code for Access Token**:
   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=http://localhost:3000/auth/linkedin/callback"
   ```

#### Option B: Using LinkedIn Access Token Generator (For Testing)

1. Go to [LinkedIn Access Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator)
2. Select your app
3. Choose the required scopes: `w_member_social`
4. Generate the token

### Step 4: Get Organization ID

1. Go to your LinkedIn company page
2. Look at the URL: `https://www.linkedin.com/company/YOUR_ORG_ID/`
3. Copy the organization ID from the URL

### Step 5: Configure Environment Variables

1. Create a `.env` file in your server directory (if not exists)
2. Add the following variables:

```env
# LinkedIn API Configuration
LINKEDIN_ACCESS_TOKEN=your_access_token_here
LINKEDIN_ORGANIZATION_ID=your_organization_id_here

# Frontend URL (for application links)
FRONTEND_URL=http://localhost:3000
```

### Step 6: Test the Integration

1. Restart your server
2. Create a job posting
3. Publish it
4. Check if it appears on LinkedIn

## Troubleshooting

### Common Issues

1. **"LinkedIn credentials not configured"**
   - Make sure you've set the environment variables
   - Restart your server after adding them

2. **"Invalid access token"**
   - Your access token may have expired
   - Generate a new access token
   - Access tokens typically expire after 60 days

3. **"Organization not found"**
   - Verify your organization ID is correct
   - Make sure you're using the company page ID, not the personal profile ID

4. **"Permission denied"**
   - Ensure your app has the `w_member_social` scope
   - Verify you're posting to the correct organization

### Error Messages

- **401 Unauthorized**: Invalid or expired access token
- **403 Forbidden**: Insufficient permissions or wrong organization
- **429 Too Many Requests**: Rate limit exceeded (wait and try again)

## Security Notes

1. **Never commit your access token to version control**
2. **Use environment variables for sensitive data**
3. **Rotate access tokens regularly**
4. **Monitor your LinkedIn API usage**

## Alternative: Manual LinkedIn Posting

If you prefer not to set up the LinkedIn API, you can:

1. **Disable LinkedIn Integration**: The system will still work perfectly without it
2. **Manual Posting**: Copy the application link and post manually to LinkedIn
3. **Use the Application Link**: Share the unique application link on LinkedIn manually

## Support

If you encounter issues:

1. Check the LinkedIn Developer documentation
2. Verify your app permissions
3. Ensure your access token is valid
4. Check the server logs for detailed error messages

## Production Considerations

For production deployment:

1. **Use OAuth Flow**: Implement proper OAuth for user authentication
2. **Token Refresh**: Implement automatic token refresh
3. **Error Handling**: Add comprehensive error handling
4. **Rate Limiting**: Respect LinkedIn's API rate limits
5. **Monitoring**: Monitor API usage and errors

---

**Note**: LinkedIn API access requires approval from LinkedIn. The approval process may take several days to weeks. During development, you can use the manual posting approach. 