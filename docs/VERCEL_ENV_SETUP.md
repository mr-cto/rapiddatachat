# Vercel Environment Variables Setup Guide

This guide provides detailed instructions for setting up environment variables in Vercel for the RapidDataChat application.

## Environment Variables Overview

Environment variables are essential for the proper functioning of RapidDataChat. They contain configuration settings and sensitive information that should not be committed to the repository.

## Setting Up Environment Variables in Vercel

### Method 1: Using the Vercel Dashboard

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your RapidDataChat project
3. Go to the "Settings" tab
4. Click on "Environment Variables" in the left sidebar
5. Add each environment variable:
   - Click "Add New"
   - Enter the variable name and value
   - Select the environments where it should be available (Production, Preview, Development)
   - Click "Save"

### Method 2: Using the Vercel CLI

1. Create a `.env` file based on the `.env.example` template
2. Use the Vercel CLI to add all variables at once:

```bash
vercel env import .env
```

3. Or add variables individually:

```bash
vercel env add DATABASE_URL
```

## Required Environment Variables

Below is a list of all required environment variables for RapidDataChat:

### Database Configuration

| Variable     | Description                  | Example                                         | Required |
| ------------ | ---------------------------- | ----------------------------------------------- | -------- |
| DATABASE_URL | PostgreSQL connection string | `postgresql://user:password@host:port/database` | Yes      |

### Authentication

| Variable        | Description                   | Example                                 | Required |
| --------------- | ----------------------------- | --------------------------------------- | -------- |
| NEXTAUTH_URL    | Full URL of your deployed app | `https://your-app.vercel.app`           | Yes      |
| NEXTAUTH_SECRET | Secret for NextAuth.js        | Generate with `openssl rand -base64 32` | Yes      |

### OAuth Providers (Optional)

| Variable             | Description                | Example                                     | Required |
| -------------------- | -------------------------- | ------------------------------------------- | -------- |
| GOOGLE_CLIENT_ID     | Google OAuth client ID     | `your-client-id.apps.googleusercontent.com` | No       |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | `your-client-secret`                        | No       |
| GITHUB_CLIENT_ID     | GitHub OAuth client ID     | `your-github-client-id`                     | No       |
| GITHUB_CLIENT_SECRET | GitHub OAuth client secret | `your-github-client-secret`                 | No       |

### OpenAI API (for NL to SQL)

| Variable       | Description         | Example  | Required |
| -------------- | ------------------- | -------- | -------- |
| OPENAI_API_KEY | Your OpenAI API key | `sk-...` | Yes      |
| OPENAI_MODEL   | OpenAI model to use | `gpt-4`  | Yes      |

### File Storage

| Variable         | Description                | Example         | Required |
| ---------------- | -------------------------- | --------------- | -------- |
| STORAGE_PROVIDER | Storage provider for files | `local` or `s3` | Yes      |

### AWS S3 Configuration (if using S3)

| Variable              | Description           | Example               | Required if using S3 |
| --------------------- | --------------------- | --------------------- | -------------------- |
| AWS_ACCESS_KEY_ID     | AWS access key ID     | `AKIA...`             | Yes                  |
| AWS_SECRET_ACCESS_KEY | AWS secret access key | `your-secret-key`     | Yes                  |
| AWS_REGION            | AWS region            | `us-east-1`           | Yes                  |
| S3_BUCKET_NAME        | S3 bucket name        | `rapiddatachat-files` | Yes                  |

### Performance Monitoring

| Variable                      | Description                   | Example | Required |
| ----------------------------- | ----------------------------- | ------- | -------- |
| ENABLE_PERFORMANCE_MONITORING | Enable performance monitoring | `true`  | No       |

### Logging

| Variable               | Description            | Example | Required |
| ---------------------- | ---------------------- | ------- | -------- |
| LOG_LEVEL              | Logging level          | `info`  | No       |
| ENABLE_FILE_LOGGING    | Enable file logging    | `true`  | No       |
| ENABLE_CONSOLE_LOGGING | Enable console logging | `true`  | No       |

### Debug Mode

| Variable   | Description       | Example | Required |
| ---------- | ----------------- | ------- | -------- |
| DEBUG_MODE | Enable debug mode | `false` | No       |

## Environment-Specific Variables

You may want to set different values for different environments:

### Production

- Set `NODE_ENV` to `production`
- Use production database credentials
- Disable debug mode

### Preview/Staging

- Use staging database credentials
- Enable performance monitoring

### Development

- Set `NODE_ENV` to `development`
- Use development database credentials
- Enable debug mode

## Verifying Environment Variables

After setting up your environment variables, you can verify them:

1. Deploy your application
2. Go to the "Deployments" tab in your Vercel project
3. Click on the latest deployment
4. Check the build logs for any environment-related errors

## Updating Environment Variables

To update environment variables:

1. Go to the "Settings" > "Environment Variables" in your Vercel project
2. Find the variable you want to update
3. Click "Edit" and make your changes
4. Click "Save"
5. Redeploy your application for the changes to take effect

## Troubleshooting

### Missing Environment Variables

If your application is not working correctly, check:

1. That all required variables are set
2. That the variables are set for the correct environments
3. That there are no typos in variable names or values

### Database Connection Issues

If you're having trouble connecting to the database:

1. Verify your `DATABASE_URL` is correct
2. Ensure your database is accessible from Vercel's servers
3. Check that your database user has the necessary permissions

### Authentication Problems

If authentication is not working:

1. Verify `NEXTAUTH_URL` matches your deployment URL
2. Ensure `NEXTAUTH_SECRET` is set
3. Check OAuth provider credentials if using social login

## Security Best Practices

1. Never commit environment variables to your repository
2. Regularly rotate secrets and API keys
3. Use different values for different environments
4. Limit access to your Vercel project settings

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [NextAuth.js Environment Variables](https://next-auth.js.org/configuration/options#environment-variables)
- [Prisma Environment Variables](https://www.prisma.io/docs/concepts/components/prisma-client/environment-variables)
