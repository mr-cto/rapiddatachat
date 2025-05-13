#!/bin/bash

# Start PostgreSQL with Docker Compose
echo "Starting PostgreSQL with Docker Compose..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate dev --name init

# Start Next.js development server
echo "Starting Next.js development server..."
npm run dev