# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for RapidDataChat, with a focus on the simplified data upload flow with global schema management.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and is configured in the `.github/workflows/ci-cd.yml` file. The pipeline automates the process of testing, building, and deploying the application to Vercel.

## Pipeline Stages

The pipeline consists of the following stages:

### 1. Lint

This stage runs ESLint to check code quality and ensure that the code follows the project's coding standards.

```yaml
lint:
  name: Lint
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: "18"
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint
```

### 2. Test

This stage runs the tests with a PostgreSQL test database. It includes a step to validate the environment variables, which is particularly important for the simplified data upload flow.

```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  needs: lint
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: rapiddatachat_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    # ... (checkout and setup steps)

    - name: Validate environment variables
      run: node scripts/validate-env.js
      env:
        # ... (environment variables)

    - name: Run Prisma migrations
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/rapiddatachat_test

    - name: Run tests
      run: npm test
      env:
        # ... (environment variables)
```

### 3. Build

This stage builds the Next.js application.

```yaml
build:
  name: Build
  runs-on: ubuntu-latest
  needs: test
  steps:
    # ... (checkout and setup steps)

    - name: Build
      run: npm run build
      env:
        # ... (environment variables)

    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: .next
```

### 4. Deploy Preview

This stage deploys the application to a preview environment for pull requests.

```yaml
deploy-preview:
  name: Deploy to Preview
  runs-on: ubuntu-latest
  needs: build
  if: github.event_name == 'pull_request'
  steps:
    # ... (checkout and setup steps)

    - name: Deploy to Vercel (Preview)
      run: vercel --token ${VERCEL_TOKEN} --confirm
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
```

### 5. Deploy Production

This stage deploys the application to production for pushes to the main branch.

```yaml
deploy-production:
  name: Deploy to Production
  runs-on: ubuntu-latest
  needs: build
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  steps:
    # ... (checkout and setup steps)

    - name: Deploy to Vercel (Production)
      run: vercel --token ${VERCEL_TOKEN} --prod --confirm
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
```

## Environment Variables

The pipeline uses the following environment variables for the simplified data upload flow:

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

These variables are set in the GitHub Actions workflow file and are also included in the Vercel deployment configuration.

## GitHub Secrets

To use the GitHub Actions workflow, you need to set up the following secrets in your GitHub repository:

1. `VERCEL_TOKEN`: Your Vercel API token
2. `VERCEL_PROJECT_ID`: Your Vercel project ID
3. `VERCEL_ORG_ID`: Your Vercel organization ID

You can find these values in your Vercel account settings or by running:

```bash
vercel whoami
vercel projects
```

## Vercel Configuration

The Vercel deployment is configured in the `vercel.json` file, which includes the following settings for the simplified data upload flow:

```json
{
  "buildEnv": {
    "PROJECT_STORAGE_PATH": "./projects",
    "MAX_PROJECTS_PER_USER": "50",
    "SCHEMA_VALIDATION_LEVEL": "strict",
    "MAX_SCHEMA_COLUMNS": "100",
    "COLUMN_MAPPING_STRATEGY": "fuzzy",
    "ENABLE_SCHEMA_EVOLUTION": "true",
    "NORMALIZATION_BATCH_SIZE": "1000",
    "ENABLE_DATA_VALIDATION": "true"
  }
}
```

## Testing the Pipeline

To test the pipeline:

1. Push a change to the `feature/data-upload-flow` branch
2. Create a pull request to the `main` branch
3. Verify that the pipeline runs successfully
4. Check the preview deployment to ensure that the simplified data upload flow works correctly
5. Merge the pull request to deploy to production

## Troubleshooting

### Common Issues

1. **Environment Variable Validation Fails**

   - Check that all required environment variables are set correctly
   - Verify that the values match the expected format
   - Run the validation script locally: `node scripts/validate-env.js`

2. **Database Migration Fails**

   - Check that the database connection string is correct
   - Verify that the database exists and is accessible
   - Run the migrations locally: `npx prisma migrate deploy`

3. **Build Fails**

   - Check the build logs for errors
   - Verify that all dependencies are installed
   - Try building locally: `npm run build`

4. **Deployment Fails**
   - Check that the Vercel secrets are set correctly
   - Verify that the Vercel project is configured correctly
   - Try deploying locally: `vercel`

### Getting Help

If you encounter issues with the CI/CD pipeline, please:

1. Check the GitHub Actions logs for detailed error messages
2. Review the Vercel deployment logs
3. Consult the project documentation
4. Contact the development team for assistance
