# Project Overview

RapidDataChat is a web application that allows users to upload, analyze, and query data files using natural language. The application provides an intuitive interface for managing data files, creating schemas, and generating insights through conversational queries.

## Core Features

- **File Management**: Upload, view, and manage data files (CSV, Excel)
- **Schema Management**: Create and manage global schemas for data normalization
- **Column Mapping**: Map columns from uploaded files to global schemas
- **Natural Language Queries**: Query data using conversational language
- **Data Visualization**: View and interact with query results
- **Project Organization**: Organize files and schemas into projects

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Prisma ORM with underlying database
- **Data Processing**: DuckDB for data querying and analysis
- **Authentication**: NextAuth.js for user authentication

## Project Structure

The project follows a typical Next.js structure with some additional organization:

```
rapiddatachat/
├── components/         # React components
│   ├── layouts/        # Layout components
│   ├── panels/         # Panel components for dashboard
│   ├── schema/         # Schema-related components
│   └── ui/             # UI components (buttons, inputs, etc.)
├── lib/                # Utility functions and services
│   ├── project/        # Project-related services
│   └── user/           # User-related services
├── prisma/             # Prisma schema and migrations
├── public/             # Static assets
├── src/                # Source code
│   ├── app/            # App router components (Next.js 13+)
│   ├── middleware/     # Next.js middleware
│   └── pages/          # Pages and API routes
│       ├── api/        # API endpoints
│       ├── auth/       # Authentication pages
│       ├── file/       # File-related pages
│       └── project/    # Project-related pages
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

## Key Workflows

1. **User Authentication**: Sign up, sign in, and manage user sessions
2. **Project Management**: Create, view, and manage projects
3. **File Upload**: Upload data files and extract column information
4. **Schema Creation**: Create global schemas from file columns or custom definitions
5. **Column Mapping**: Map file columns to schema columns
6. **Data Querying**: Query data using natural language and view results

For more detailed information about specific components and workflows, refer to the dedicated documentation pages.
