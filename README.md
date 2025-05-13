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

## Deployment

The application is designed to be deployed on Vercel with a PostgreSQL database.

## Contributing

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Submit a pull request with a clear description of the changes

For major features, please open an issue first to discuss what you would like to change.
