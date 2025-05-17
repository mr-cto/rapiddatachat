# API Reference

This document provides a reference for the API endpoints in the RapidDataChat application.

## Authentication

Most API endpoints require authentication. The application uses NextAuth.js for authentication, and API routes check for a valid session before processing requests.

## File Management APIs

### Upload File

**Endpoint**: `POST /api/upload`

**Description**: Uploads a file to the system.

**Request**:

- Content-Type: `multipart/form-data`
- Body:
  - `file`: The file to upload (CSV or Excel)
  - `projectId`: (Optional) The project to associate the file with

**Response**:

```json
{
  "success": true,
  "files": [
    {
      "id": "string",
      "name": "string",
      "size": "number",
      "status": "string",
      "format": "string",
      "projectId": "string"
    }
  ],
  "message": "string",
  "dbOperationsSkipped": "boolean"
}
```

**Error Responses**:

- 400: Bad Request (invalid file format, missing file)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to upload to the project)
- 500: Internal Server Error

### Get Files

**Endpoint**: `GET /api/files`

**Description**: Gets a list of files, optionally filtered by project.

**Query Parameters**:

- `projectId`: (Optional) Filter files by project

**Response**:

```json
{
  "files": [
    {
      "id": "string",
      "filename": "string",
      "uploadedAt": "string",
      "ingestedAt": "string",
      "sizeBytes": "number",
      "format": "string",
      "status": "string",
      "metadata": "object",
      "_count": {
        "fileErrors": "number"
      }
    }
  ]
}
```

**Error Responses**:

- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Get File Synopsis

**Endpoint**: `GET /api/file-synopsis/:id`

**Description**: Gets detailed information about a file, including its columns.

**Path Parameters**:

- `id`: The ID of the file

**Response**:

```json
{
  "fileId": "string",
  "filename": "string",
  "rows": "number",
  "columnCount": "number",
  "columns": [
    {
      "name": "string",
      "type": "string"
    }
  ],
  "format": "string",
  "uploadedAt": "string",
  "ingestedAt": "string",
  "dbOperationsSkipped": "boolean"
}
```

**Error Responses**:

- 400: Bad Request (missing file ID)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to access the file)
- 404: Not Found (file not found)
- 500: Internal Server Error

### Delete File

**Endpoint**: `DELETE /api/files`

**Description**: Deletes a file.

**Query Parameters**:

- `id`: The ID of the file to delete

**Response**:

```json
{
  "success": "boolean",
  "message": "string"
}
```

**Error Responses**:

- 400: Bad Request (missing file ID)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to delete the file)
- 404: Not Found (file not found)
- 500: Internal Server Error

## Schema Management APIs

### Get Schemas

**Endpoint**: `GET /api/schema-management`

**Description**: Gets a list of schemas for a project.

**Query Parameters**:

- `projectId`: The ID of the project

**Response**:

```json
{
  "schemas": [
    {
      "id": "string",
      "userId": "string",
      "projectId": "string",
      "name": "string",
      "description": "string",
      "columns": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "description": "string",
          "isRequired": "boolean"
        }
      ],
      "createdAt": "string",
      "updatedAt": "string",
      "isActive": "boolean",
      "version": "number"
    }
  ]
}
```

**Error Responses**:

- 400: Bad Request (missing project ID)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Create Schema

**Endpoint**: `POST /api/schema-management`

**Description**: Creates a new schema.

**Request**:

- Content-Type: `application/json`
- Body:
  - For creating from files:
    ```json
    {
      "action": "create_from_files",
      "name": "string",
      "description": "string",
      "userId": "string",
      "projectId": "string"
    }
    ```
  - For creating with custom columns:
    ```json
    {
      "action": "create_with_columns",
      "name": "string",
      "description": "string",
      "columns": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "description": "string",
          "isRequired": "boolean"
        }
      ],
      "userId": "string",
      "projectId": "string"
    }
    ```

**Response**:

```json
{
  "id": "string",
  "userId": "string",
  "projectId": "string",
  "name": "string",
  "description": "string",
  "columns": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "description": "string",
      "isRequired": "boolean"
    }
  ],
  "createdAt": "string",
  "updatedAt": "string",
  "isActive": "boolean",
  "version": "number"
}
```

**Error Responses**:

- 400: Bad Request (missing required fields)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Update Schema

**Endpoint**: `PUT /api/schema-management`

**Description**: Updates an existing schema.

**Request**:

- Content-Type: `application/json`
- Body:
  - For updating the full schema:
    ```json
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "columns": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "description": "string",
          "isRequired": "boolean"
        }
      ]
    }
    ```
  - For setting a schema as active:
    ```json
    {
      "id": "string",
      "isActive": true
    }
    ```

**Response**:

```json
{
  "schema": {
    "id": "string",
    "userId": "string",
    "projectId": "string",
    "name": "string",
    "description": "string",
    "columns": [
      {
        "id": "string",
        "name": "string",
        "type": "string",
        "description": "string",
        "isRequired": "boolean"
      }
    ],
    "createdAt": "string",
    "updatedAt": "string",
    "isActive": "boolean",
    "version": "number"
  }
}
```

**Error Responses**:

- 400: Bad Request (missing schema ID)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Delete Schema

**Endpoint**: `DELETE /api/schema-management`

**Description**: Deletes a schema.

**Query Parameters**:

- `id`: The ID of the schema to delete

**Response**:

```json
{
  "success": "boolean"
}
```

**Error Responses**:

- 400: Bad Request (missing schema ID)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

## Column Mapping APIs

### Get Column Mapping

**Endpoint**: `GET /api/column-mapping`

**Description**: Gets column mapping information for a file and schema.

**Query Parameters**:

- `fileId`: The ID of the file
- `schemaId`: The ID of the schema

**Response**:

```json
{
  "fileColumns": [
    {
      "name": "string",
      "originalName": "string",
      "type": "string",
      "description": "string",
      "index": "number",
      "sampleValues": ["string"]
    }
  ],
  "schemaColumns": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "description": "string",
      "isRequired": "boolean",
      "isPrimaryKey": "boolean"
    }
  ],
  "mappings": [
    {
      "fileColumnName": "string",
      "schemaColumnId": "string",
      "transformation": "string"
    }
  ],
  "suggestions": {
    "fileColumnName": "schemaColumnId"
  }
}
```

**Error Responses**:

- 400: Bad Request (missing file ID or schema ID)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Save Column Mappings

**Endpoint**: `POST /api/column-mapping`

**Description**: Saves column mappings for a file and schema.

**Request**:

- Content-Type: `application/json`
- Body:
  ```json
  {
    "fileId": "string",
    "schemaId": "string",
    "action": "save-mappings",
    "mappings": [
      {
        "fileColumnName": "string",
        "schemaColumnId": "string",
        "transformation": "string"
      }
    ],
    "transformationRules": {
      "fileColumnName": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "params": "object"
        }
      ]
    }
  }
  ```

**Response**:

```json
{
  "success": "boolean",
  "message": "string"
}
```

**Error Responses**:

- 400: Bad Request (missing required fields)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Auto-Map Columns

**Endpoint**: `POST /api/column-mapping`

**Description**: Automatically maps columns between a file and schema.

**Request**:

- Content-Type: `application/json`
- Body:
  ```json
  {
    "fileId": "string",
    "schemaId": "string",
    "action": "auto-map"
  }
  ```

**Response**:

```json
{
  "mappings": [
    {
      "fileColumnName": "string",
      "schemaColumnId": "string"
    }
  ],
  "suggestions": {
    "fileColumnName": "schemaColumnId"
  }
}
```

**Error Responses**:

- 400: Bad Request (missing required fields)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

## Query APIs

### Natural Language to SQL

**Endpoint**: `POST /api/nl-to-sql`

**Description**: Converts a natural language query to SQL and executes it.

**Request**:

- Content-Type: `application/json`
- Body:
  ```json
  {
    "query": "string",
    "page": "number",
    "pageSize": "number",
    "fileId": "string",
    "projectId": "string",
    "sortColumn": "string",
    "sortDirection": "asc|desc",
    "filters": "object"
  }
  ```

**Response**:

```json
{
  "sqlQuery": "string",
  "explanation": "string",
  "results": ["object"],
  "executionTime": "number",
  "totalRows": "number",
  "totalPages": "number",
  "currentPage": "number",
  "columnMerges": [
    {
      "id": "string",
      "mergeName": "string",
      "columnList": ["string"],
      "delimiter": "string"
    }
  ]
}
```

**Error Responses**:

- 400: Bad Request (missing query)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Query History

**Endpoint**: `GET /api/query-history`

**Description**: Gets the query history for a user or project.

**Query Parameters**:

- `projectId`: (Optional) Filter queries by project

**Response**:

```json
{
  "queries": [
    {
      "id": "string",
      "text": "string",
      "createdAt": "string",
      "userId": "string"
    }
  ]
}
```

**Error Responses**:

- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

## Project APIs

### Get Projects

**Endpoint**: `GET /api/projects`

**Description**: Gets a list of projects for the current user.

**Response**:

```json
{
  "projects": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "_count": {
        "files": "number",
        "schemas": "number"
      }
    }
  ]
}
```

**Error Responses**:

- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Get Project

**Endpoint**: `GET /api/projects/:id`

**Description**: Gets detailed information about a project.

**Path Parameters**:

- `id`: The ID of the project

**Response**:

```json
{
  "project": {
    "id": "string",
    "name": "string",
    "description": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "files": [
      {
        "id": "string",
        "filename": "string",
        "status": "string"
      }
    ],
    "schemas": [
      {
        "id": "string",
        "name": "string",
        "isActive": "boolean"
      }
    ]
  }
}
```

**Error Responses**:

- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to access the project)
- 404: Not Found (project not found)
- 500: Internal Server Error

### Create Project

**Endpoint**: `POST /api/projects`

**Description**: Creates a new project.

**Request**:

- Content-Type: `application/json`
- Body:
  ```json
  {
    "name": "string",
    "description": "string"
  }
  ```

**Response**:

```json
{
  "project": {
    "id": "string",
    "name": "string",
    "description": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Responses**:

- 400: Bad Request (missing name)
- 401: Unauthorized (not authenticated)
- 500: Internal Server Error

### Update Project

**Endpoint**: `PUT /api/projects/:id`

**Description**: Updates an existing project.

**Path Parameters**:

- `id`: The ID of the project

**Request**:

- Content-Type: `application/json`
- Body:
  ```json
  {
    "name": "string",
    "description": "string"
  }
  ```

**Response**:

```json
{
  "project": {
    "id": "string",
    "name": "string",
    "description": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Responses**:

- 400: Bad Request (missing required fields)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to update the project)
- 404: Not Found (project not found)
- 500: Internal Server Error

### Delete Project

**Endpoint**: `DELETE /api/projects/:id`

**Description**: Deletes a project.

**Path Parameters**:

- `id`: The ID of the project

**Response**:

```json
{
  "success": "boolean"
}
```

**Error Responses**:

- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized to delete the project)
- 404: Not Found (project not found)
- 500: Internal Server Error

## Error Handling

All API endpoints follow a consistent error handling pattern:

1. **Client Errors** (4xx):

   - 400: Bad Request - Missing or invalid parameters
   - 401: Unauthorized - Not authenticated
   - 403: Forbidden - Not authorized to access the resource
   - 404: Not Found - Resource not found
   - 405: Method Not Allowed - Invalid HTTP method

2. **Server Errors** (5xx):
   - 500: Internal Server Error - Unexpected server error

Error responses have a consistent format:

```json
{
  "error": "string",
  "details": "string"
}
```

## Rate Limiting

The API does not currently implement rate limiting, but it may be added in the future to prevent abuse.

## Versioning

The API does not currently use explicit versioning in the URL path. Future API changes will be backward compatible where possible.
