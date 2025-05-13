# Automatic File Activation with Progress Tracking

This document describes the implementation of automatic file activation with progress tracking in the RapidDataChat application.

## Overview

File activation is the process of making a file available for querying after it has been uploaded and ingested. The automatic file activation feature ensures that files are automatically activated after upload, providing a seamless user experience.

## Implementation Details

### 1. Database Schema

The file activation progress tracking is implemented using the following database schema changes:

```sql
ALTER TABLE "files" ADD COLUMN "activation_progress" INTEGER;
ALTER TABLE "files" ADD COLUMN "activation_started_at" TIMESTAMP(3);
ALTER TABLE "files" ADD COLUMN "activation_completed_at" TIMESTAMP(3);
ALTER TABLE "files" ADD COLUMN "activation_error" TEXT;
```

These columns track:

- `activation_progress`: Progress percentage (0-100)
- `activation_started_at`: When activation started
- `activation_completed_at`: When activation completed
- `activation_error`: Error message if activation failed

### 2. Activation Progress Tracking

The file activation process is tracked using the following functions:

- `startActivation`: Initializes activation tracking
- `updateActivationProgress`: Updates progress percentage
- `completeActivation`: Finalizes activation tracking
- `getActivationProgress`: Retrieves current progress

The implementation includes a fallback mechanism using in-memory storage when the database schema changes are not yet applied. This ensures the functionality works even without the database migration.

### 3. Enhanced Error Handling

The activation process includes enhanced error handling with:

- Detailed error reporting
- Recovery mechanisms for common failure scenarios
- Error storage in the database
- Fallback mechanisms for database errors

### 4. UI Components

The UI displays activation progress using:

- Progress bar in the FileActivationButton component
- Real-time progress updates via polling
- Clear status indicators for different activation states

## API Endpoints

### 1. Activate File

```
POST /api/activate-file/:id
```

Activates a file and returns activation status and progress.

### 2. Get Activation Progress

```
GET /api/file-activation-progress/:id
```

Returns the current activation progress for a file.

## Usage

Files are automatically activated after upload. The UI shows the activation progress in real-time. If activation fails, users can retry activation using the "Retry Activation" button.

## Fallback Implementation

The implementation includes a fallback mechanism using in-memory storage when the database schema changes are not yet applied. This ensures the functionality works even without the database migration.

```javascript
// In-memory storage for activation progress (fallback until database migration is applied)
const activationProgressMap = new Map<string, {
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}>();
```

Each function first attempts to use the database, and if that fails, falls back to the in-memory storage.

## Future Improvements

1. **Database Migration**: Apply the database schema changes to enable persistent progress tracking.
2. **Real-time Updates**: Implement WebSocket or Server-Sent Events for real-time progress updates instead of polling.
3. **Batch Activation**: Optimize the activation process for batch uploads.
4. **Detailed Progress Reporting**: Add more granular progress reporting for large files.

## Troubleshooting

### User ID Mismatch Issue

We encountered an issue where the schema management service couldn't find active files for a user. The problem was a mismatch between how user IDs are stored in the database versus how they're provided by the authentication system:

- **Database**: User IDs are stored as email addresses (e.g., `t@mrcto.ai`)
- **Auth System**: User IDs are provided as numeric Google IDs (e.g., `113437558670150526135`)

**Solution**: Modified the schema management API endpoint to use the user's email instead of ID and removed development-mode fallbacks:

```javascript
// Before
const userId = session?.user?.id || (isDevelopment ? "dev@example.com" : "");

// After
const userId = session.user.email;
```

This ensures that the user ID used to query for active files matches the format stored in the database.
