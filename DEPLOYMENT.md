# Deployment Guide for RapidDataChat

This guide provides instructions for deploying RapidDataChat to Vercel.

## Prerequisites

Before deploying, ensure you have:

1. A Vercel account (https://vercel.com)
2. Access to the RapidDataChat repository
3. Required environment variables (see `.env.example`)
4. A PostgreSQL database (e.g., Vercel Postgres, Supabase, or another provider)

## Deployment Steps

### 1. Fork or Clone the Repository

If you don't already have the code in your own repository, fork or clone it:

```bash
git clone https://github.com/yourusername/rapiddatachat.git
cd rapiddatachat
```

### 2. Install Vercel CLI (Optional)

For command-line deployment, install the Vercel CLI:

```bash
npm install -g vercel
```

### 3. Deploy to Vercel

The simplest way to deploy RapidDataChat is using the Vercel CLI, which provides an interactive experience that guides you through the deployment process.

#### Prerequisites

1. Install Vercel CLI globally:

```bash
npm install -g vercel
```

2. Log in to your Vercel account:

```bash
vercel login
```

#### Deployment Steps

1. Navigate to your project directory:

```bash
cd rapiddatachat
```

2. Deploy to preview environment (for testing):

```bash
vercel
```

3. Follow the interactive prompts:

   - Confirm the project settings
   - Set up required environment variables
   - Confirm deployment

4. Once you've verified the preview deployment works correctly, deploy to production:

```bash
vercel --prod
```

#### Alternative: Using the Vercel Dashboard

If you prefer a GUI approach:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: `rapiddatachat` (if the repo has multiple projects)
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Add environment variables (see Environment Variables section below)
6. Click "Deploy"

### 4. Environment Variables

Set the following environment variables in your Vercel project settings:

#### Core Environment Variables

| Variable         | Description                   | Example                                         |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| DATABASE_URL     | PostgreSQL connection string  | `postgresql://user:password@host:port/database` |
| NEXTAUTH_URL     | Full URL of your deployed app | `https://your-app.vercel.app`                   |
| NEXTAUTH_SECRET  | Secret for NextAuth.js        | Generate with `openssl rand -base64 32`         |
| OPENAI_API_KEY   | Your OpenAI API key           | `sk-...`                                        |
| OPENAI_MODEL     | OpenAI model to use           | `gpt-4`                                         |
| STORAGE_PROVIDER | Storage provider for files    | `local` or `s3`                                 |
| LOG_LEVEL        | Logging level                 | `info`                                          |

#### Simplified Data Upload Flow Variables

| Variable                 | Description                                       | Default Value |
| ------------------------ | ------------------------------------------------- | ------------- |
| PROJECT_STORAGE_PATH     | Path to store project-related data                | `./projects`  |
| MAX_PROJECTS_PER_USER    | Maximum number of projects a user can create      | `50`          |
| SCHEMA_VALIDATION_LEVEL  | Level of schema validation (strict, lenient)      | `strict`      |
| MAX_SCHEMA_COLUMNS       | Maximum number of columns allowed in a schema     | `100`         |
| COLUMN_MAPPING_STRATEGY  | Strategy for column mapping (exact, fuzzy, none)  | `fuzzy`       |
| ENABLE_SCHEMA_EVOLUTION  | Allow adding new columns to existing schemas      | `true`        |
| NORMALIZATION_BATCH_SIZE | Number of records to process in a batch           | `1000`        |
| ENABLE_DATA_VALIDATION   | Validate data against schema during normalization | `true`        |

For more details on these environment variables, see the [Environment Variables Documentation](docs/environment-variables.md).

If using S3 for storage, also set:

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- S3_BUCKET_NAME

### 5. Database Setup

1. Create a PostgreSQL database (Vercel Postgres, Supabase, etc.)
2. Set the `DATABASE_URL` environment variable to your database connection string
3. Run database migrations:

```bash
npx prisma migrate deploy
```

### 6. Verify Deployment

1. Visit your deployed application URL
2. Verify that you can:
   - Sign in
   - Create a project
   - Upload files to the project
   - Create and manage global schemas
   - Map columns from different files to the global schema
   - Query data using the normalized view

## CI/CD Pipeline

RapidDataChat includes a GitHub Actions workflow for continuous integration and deployment.

### GitHub Actions Workflow

The workflow is defined in `.github/workflows/ci-cd.yml` and includes the following stages:

1. **Lint**: Runs ESLint to check code quality
2. **Test**: Runs tests with a PostgreSQL test database
3. **Build**: Builds the Next.js application
4. **Deploy Preview**: Deploys to a preview environment for pull requests
5. **Deploy Production**: Deploys to production for pushes to the main branch

### Setting Up GitHub Actions

To use the GitHub Actions workflow, you need to set up the following secrets in your GitHub repository:

1. `VERCEL_TOKEN`: Your Vercel API token
2. `VERCEL_PROJECT_ID`: Your Vercel project ID
3. `VERCEL_ORG_ID`: Your Vercel organization ID

You can find these values in your Vercel account settings or by running:

```bash
vercel whoami
vercel projects
```

## Troubleshooting

### Build Errors

- Check build logs in Vercel dashboard
- Ensure all dependencies are correctly installed
- Verify environment variables are set correctly

### Database Connection Issues

- Check that your `DATABASE_URL` is correct
- Ensure your database is accessible from Vercel's servers
- Verify that migrations have been applied

### File Upload Problems

- If using S3, check S3 bucket permissions
- Verify AWS credentials are correct
- For local storage, ensure the storage directory is writable

### Schema Management Issues

- Check that `PROJECT_STORAGE_PATH` is writable
- Verify that `SCHEMA_VALIDATION_LEVEL` and `COLUMN_MAPPING_STRATEGY` are set correctly
- Check database logs for any errors related to schema operations

## Monitoring and Maintenance

### Logs

Access logs through the Vercel dashboard under your project's "Logs" tab.

### Updates

To update your deployment:

1. Push changes to your repository
2. Vercel will automatically rebuild and deploy

### Custom Domains

To add a custom domain:

1. Go to your project in the Vercel dashboard
2. Click "Domains"
3. Add your domain and follow the verification steps

## Performance Optimization

For optimal performance:

1. Enable Vercel Edge Caching for static assets
2. Configure `Cache-Control` headers for API responses
3. Use Vercel Analytics to monitor performance
4. Consider setting `NORMALIZATION_BATCH_SIZE` to a value that balances processing speed and memory usage

## Security Considerations

1. Keep environment variables secure
2. Regularly update dependencies
3. Enable Vercel's security headers
4. Set up authentication properly
5. Consider setting `MAX_PROJECTS_PER_USER` and `MAX_SCHEMA_COLUMNS` to prevent abuse

## Support

For issues with the deployment, please:

1. Check the Vercel documentation: https://vercel.com/docs
2. Review the RapidDataChat documentation
3. Contact the development team for application-specific issues
