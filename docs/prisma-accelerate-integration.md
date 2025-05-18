# Prisma Accelerate Integration

This document outlines how our application integrates with Prisma Accelerate, addressing its specific limitations and optimizing database operations.

## Overview

Prisma Accelerate is a connection pooling service that improves database performance and scalability. However, it has certain limitations, particularly with transaction timeouts, that require special handling in our application.

## Key Limitations

1. **Transaction Timeout**: Prisma Accelerate limits interactive transactions to a maximum of 15 seconds (15000ms).
2. **Connection Pooling**: While Accelerate provides connection pooling, we've implemented our own additional pooling layer for better control.
3. **Error Handling**: Accelerate requires specific error handling for timeout and permission errors.

## Implementation Strategy

We've implemented a comprehensive strategy to work optimally with Prisma Accelerate:

### 1. Accelerate Detection

The `accelerateConfig.ts` module provides utilities to detect when the application is using Prisma Accelerate:

```typescript
// Check if the current environment is using Prisma Accelerate
export function isPrismaAccelerate(): boolean {
  return process.env.DATABASE_URL?.includes("prisma.io") || false;
}
```

### 2. Transaction Avoidance

When using Accelerate, we avoid transactions for operations that might exceed the 15-second limit:

```typescript
// Get Prisma Accelerate configuration
const accelerateConfig = getAccelerateConfig();

if (!accelerateConfig.useTransactions) {
  // Use non-transactional approach
  // ...
} else {
  // Use transactions with appropriate timeouts
  // ...
}
```

### 3. Optimized Timeouts

For operations that still use transactions, we set appropriate timeout values:

```typescript
{
  timeout: accelerateConfig.timeout, // 14 seconds for Accelerate (under the 15s limit)
  maxWait: accelerateConfig.maxWait, // 2 seconds for Accelerate
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
}
```

### 4. Batch Processing

For large data operations, we've implemented:

- Dynamic batch sizing based on data volume
- Fallback to individual inserts when batches fail
- Automatic batch splitting when timeouts occur

### 5. Error Handling

We've added specific error detection for Accelerate-related issues:

```typescript
const isTimeoutError =
  errorMessage.includes("maximum allowed execution time") ||
  errorMessage.includes("P6004") ||
  errorMessage.includes("Query did not produce a result") ||
  errorMessage.includes(
    "Interactive transactions running through Accelerate are limited"
  );
```

## Optimized Services

The following services have been optimized for Prisma Accelerate:

1. **BatchProcessor**: Handles large data insertions with dynamic batch sizing and fallback strategies.
2. **SchemaUpdateService**: Manages schema updates with differential processing to minimize transaction time.
3. **ColumnMappingService**: Provides efficient column mapping with transaction avoidance when necessary.
4. **CachedSchemaService**: Reduces database load through caching frequently accessed schema data.

## Configuration

The Prisma Accelerate configuration is centralized in `lib/prisma/accelerateConfig.ts`, which provides:

- Detection of Prisma Accelerate environments
- Appropriate timeout settings
- Transaction usage recommendations
- Logging of Accelerate status

## Usage with Context7

When using the Context7 MCP server with Prisma Accelerate:

1. The application automatically detects Prisma Accelerate from the DATABASE_URL.
2. Transaction timeouts are set to 14 seconds to stay under the 15-second limit.
3. For operations that might exceed this limit, transactions are avoided entirely.
4. Batch operations are automatically adjusted based on data volume.

## Monitoring

To monitor Prisma Accelerate performance:

1. Check logs for "[PrismaAccelerate]" prefixed messages
2. Monitor for timeout errors and batch splitting events
3. Watch for fallbacks to individual inserts, which may indicate transaction timeout issues

## Best Practices

When working with Prisma Accelerate:

1. Prefer non-transactional operations for large data sets
2. Keep transactions small and focused
3. Use the caching layer to reduce database load
4. Monitor for timeout errors and adjust batch sizes accordingly
5. Consider using the optimized services provided in this implementation
