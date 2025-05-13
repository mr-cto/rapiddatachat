# RapidDataChat

A data chat application that allows users to upload and interact with their data.

## Features

### Simplified Data Upload Flow with Global Schema Management

RapidDataChat now includes a streamlined data upload flow with global schema management:

- **Project-Based Organization**: Create projects to group related data files
- **Global Schema**: Define a unified schema across multiple uploads
- **Simplified Upload Process**: Upload CSV or XLSX files without manual activation
- **Schema Evolution**: Add new columns to your schema as your data grows
- **Column Mapping**: Map columns from different files to your global schema
- **Normalized Data Storage**: All data is stored in a normalized structure for efficient querying

For more details, see the [Data Flow Overview](docs/data-flow-overview.md).

## Local Development Setup

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v15 recommended)
- npm or yarn

### Setting up PostgreSQL

#### Option 1: Using Docker (Recommended)

1. Make sure Docker is installed and running on your machine
2. Run `docker-compose up -d` to start PostgreSQL in a Docker container
3. PostgreSQL will be available at `localhost:5432` with the following credentials:
   - Username: postgres
   - Password: postgres
   - Database: rapiddatachat

#### Option 2: Manual PostgreSQL Installation

1. Install PostgreSQL on your machine:

   - **macOS**: `brew install postgresql@15` (using Homebrew)
   - **Windows**: Download and install from [PostgreSQL website](https://www.postgresql.org/download/windows/)
   - **Linux**: `sudo apt install postgresql-15` (Ubuntu/Debian) or equivalent for your distribution

2. Start the PostgreSQL service:

   - **macOS**: `brew services start postgresql@15`
   - **Windows**: PostgreSQL should be running as a service
   - **Linux**: `sudo systemctl start postgresql`

3. Create a database and user:

   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create database and user (in the PostgreSQL shell)
   CREATE DATABASE rapiddatachat;
   CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';
   GRANT ALL PRIVILEGES ON DATABASE rapiddatachat TO postgres;

   # Exit the PostgreSQL shell
   \q
   ```

### Setting up the Application

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   - Copy `.env.example` to `.env` if it doesn't exist
   - Update the `DATABASE_URL` if needed (default should work with the setup above)
   - You can also use the setup script: `node scripts/setup-env.js`
   - For more details on environment variables, see [Environment Variables Documentation](docs/environment-variables.md)

3. Run Prisma migrations:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Using the Development Script

We've included a convenience script to start the development environment:

```bash
# Make the script executable (first time only)
chmod +x dev.sh

# Run the development script
./dev.sh
```

This script will:

1. Start PostgreSQL (if using Docker)
2. Run Prisma migrations
3. Start the Next.js development server

## Project Structure

For an overview of the project structure and how the new data upload flow is integrated, see the [Project Structure Documentation](docs/project-structure.md).

## Dependencies for Simplified Data Upload Flow

The simplified data upload flow with global schema management uses the following key dependencies:

- **react-hook-form**: For form handling and validation in project creation, schema creation, and column mapping forms
- **zod**: For schema validation of form inputs and API requests
- **uuid**: For generating unique IDs for projects, schemas, and mappings
- **csv-parser** and **xlsx**: For parsing uploaded CSV and Excel files
- **prisma**: For database operations to store projects, schemas, and normalized data

To install these dependencies:

```bash
npm install react-hook-form zod
```

Note: Other dependencies like uuid, csv-parser, xlsx, and prisma are already included in the project.

## Environment Variables

The simplified data upload flow requires several environment variables to be configured:

- **PROJECT_STORAGE_PATH**: Path to store project-related data
- **MAX_PROJECTS_PER_USER**: Maximum number of projects a user can create
- **SCHEMA_VALIDATION_LEVEL**: Level of schema validation (strict, lenient)
- **COLUMN_MAPPING_STRATEGY**: Strategy for automatic column mapping (exact, fuzzy, none)
- **ENABLE_SCHEMA_EVOLUTION**: Allow adding new columns to existing schemas

For a complete list and detailed descriptions, see the [Environment Variables Documentation](docs/environment-variables.md).

## CI/CD Pipeline

RapidDataChat includes a GitHub Actions workflow for continuous integration and deployment:

- **Lint**: Runs ESLint to check code quality
- **Test**: Runs tests with a PostgreSQL test database
- **Build**: Builds the Next.js application
- **Deploy Preview**: Deploys to a preview environment for pull requests
- **Deploy Production**: Deploys to production for pushes to the main branch

For more details on the CI/CD pipeline, see the [CI/CD Pipeline Documentation](docs/ci-cd-pipeline.md).

## Deployment

The application is designed to be deployed on Vercel with a PostgreSQL database.

When deploying to Vercel, make sure to add all the required environment variables in the Vercel dashboard under Project Settings > Environment Variables.

For detailed deployment instructions, see the [Deployment Guide](DEPLOYMENT.md).

## Contributing

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Submit a pull request with a clear description of the changes

For major features, please open an issue first to discuss what you would like to change.
