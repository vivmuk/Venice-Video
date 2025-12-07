# Railway Deployment Setup

## Environment Variables

To deploy this application to Railway, you need to set the following environment variable:

### Required Environment Variable

**`VENICE_API_TOKEN`**
- **Description**: Your Venice AI API token
- **How to get it**: Sign up at venice.ai and get your API token from your account dashboard
- **How to set it on Railway**:
  1. Go to your Railway project dashboard
  2. Click on your service
  3. Go to the "Variables" tab
  4. Click "New Variable"
  5. Enter:
     - **Name**: `VENICE_API_TOKEN`
     - **Value**: Your actual API token (e.g., `lnWNeSg0pA_rQUooNpbfpPDBaj2vJnWol5WqKWrIEF`)
  6. Click "Add"
  7. Railway will automatically redeploy with the new variable

### Optional Environment Variables

**`PORT`**
- Railway automatically sets this, so you don't need to configure it manually
- The server will use whatever port Railway assigns

## Deployment Steps

1. **Push your code to GitHub** (if not already done)
2. **Connect to Railway**:
   - Go to railway.app
   - Create a new project or select existing one
   - Click "New" → "GitHub Repo"
   - Select your repository
3. **Set Environment Variable**:
   - Follow the steps above to add `VENICE_API_TOKEN`
4. **Deploy**:
   - Railway will automatically detect `package.json` and deploy
   - The server will start automatically
5. **Verify**:
   - Check Railway logs for:
     - "Server is running on port XXXX"
     - "Venice API token is configured"
   - If you see a warning, check that the environment variable is set correctly

## Security Notes

- The API token is stored securely on the server
- It is never exposed to the client-side code
- All API calls go through server-side proxy endpoints
- Users don't need to enter the API token

## Troubleshooting

**"API token not configured" error**:
- Check that `VENICE_API_TOKEN` is set in Railway variables
- Make sure there are no extra spaces in the variable name or value
- Redeploy after adding the variable

**Models not loading**:
- Check Railway logs for API errors
- Verify the API token is valid
- Check that the token has proper permissions

