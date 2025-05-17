# Data Flow

This document describes the data flow within the RapidDataChat application, focusing on how data moves through the system from upload to querying.

## Overview

RapidDataChat processes data through several stages:

1. **File Upload**: Users upload data files (CSV, Excel)
2. **File Processing**: Files are parsed and stored
3. **Schema Management**: Global schemas are created and managed
4. **Column Mapping**: File columns are mapped to schema columns
5. **Data Querying**: Users query data using natural language
6. **Result Presentation**: Query results are displayed to users

## File Upload Flow

```mermaid
flowchart TD
    A[User] -->|Uploads file| B[Frontend]
    B -->|POST /api/upload| C[Upload API]
    C -->|Store file| D[File Storage]
    C -->|Create metadata| E[Database]
    C -->|Process file| F[File Ingestion Service]
    F -->|Parse file| G[File Parser]
    G -->|Extract headers| H[Column Extraction]
    G -->|Extract data| I[Data Storage]
    I -->|Store rows| E
    H -->|Store columns| E
    F -->|Update status| E
    E -->|File info| B
    B -->|Display file| A
```

### Detailed Steps

1. User selects a file through the FileUpload component
2. Frontend validates the file and sends it to the Upload API
3. Upload API:
   - Stores the file in the file storage system
   - Creates a file metadata record in the database
   - Initiates asynchronous file processing
4. File Ingestion Service:
   - Parses the file based on its format (CSV, Excel)
   - Extracts headers (columns) and data rows
   - Stores the data in the database
   - Updates the file status (pending → processing → active)
5. Frontend displays the file in the FileList component
6. FileList component fetches column information for the file

## Schema Management Flow

```mermaid
flowchart TD
    A[User] -->|Creates schema| B[ColumnManager]
    B -->|POST /api/schema-management| C[Schema API]
    C -->|Create schema| D[Schema Service]
    D -->|Store schema| E[Database]
    E -->|Schema info| C
    C -->|Schema info| B
    B -->|Display schema| A

    A -->|Edits schema| B
    B -->|PUT /api/schema-management| C
    C -->|Update schema| D
    D -->|Update records| E
    E -->|Updated info| C
    C -->|Updated info| B
    B -->|Display updated schema| A

    A -->|Sets active schema| B
    B -->|PUT /api/schema-management| C
    C -->|Set active| D
    D -->|Update status| E
    E -->|Confirmation| C
    C -->|Confirmation| B
    B -->|Show active schema| A
```

### Detailed Steps

1. User creates a schema through the ColumnManager component:
   - From file columns or custom column definitions
2. ColumnManager sends the schema data to the Schema Management API
3. Schema Management API:
   - Validates the schema data
   - Calls the Schema Service to create the schema
4. Schema Service:
   - Creates a schema record in the database
   - Creates schema column records
   - Sets the schema as active if requested
5. Frontend displays the created schema
6. User can edit the schema or set it as active

## Column Mapping Flow

```mermaid
flowchart TD
    A[User] -->|Maps columns| B[ColumnMappingInterface]
    B -->|GET /api/column-mapping| C[Column Mapping API]
    C -->|Get file columns| D[File Synopsis API]
    C -->|Get schema columns| E[Schema Service]
    D -->|File columns| C
    E -->|Schema columns| C
    C -->|Columns & suggestions| B
    B -->|Display mapping options| A

    A -->|Confirms mappings| B
    B -->|POST /api/column-mapping| C
    C -->|Check for new columns| E
    E -->|Add new columns if needed| F[Database]
    C -->|Save mappings| F
    F -->|Confirmation| C
    C -->|Mapping result| B
    B -->|Show success| A
```

### Detailed Steps

1. User selects a file and navigates to the column mapping interface
2. ColumnMappingInterface fetches:
   - File columns from the File Synopsis API
   - Schema columns from the Schema Service
   - Existing mappings if any
3. ColumnMappingInterface displays:
   - File columns
   - Schema columns
   - Suggested mappings based on column similarity
4. User creates or adjusts mappings
5. User confirms the mappings
6. Column Mapping API:
   - Checks for new columns to add to the schema
   - Updates the schema if needed
   - Saves the mappings
7. Frontend displays a success message

## Query Execution Flow

```mermaid
flowchart TD
    A[User] -->|Enters query| B[ChatInputPane]
    B -->|POST /api/nl-to-sql| C[NL-to-SQL API]
    C -->|Parse query| D[Query Parser]
    D -->|Generate SQL| E[SQL Generator]
    E -->|SQL query| F[Query Executor]
    F -->|Execute query| G[Database]
    G -->|Raw results| F
    F -->|Format results| C
    C -->|Formatted results| B
    B -->|Display results| H[QueryResultsPane]
    H -->|Show results| A

    A -->|Adjusts filters/sorting| H
    H -->|POST /api/nl-to-sql| C
    C -->|Modified query| F
    F -->|Execute query| G
    G -->|Raw results| F
    F -->|Format results| C
    C -->|Formatted results| H
    H -->|Show updated results| A
```

### Detailed Steps

1. User enters a natural language query in the ChatInputPane
2. ChatInputPane sends the query to the NL-to-SQL API
3. NL-to-SQL API:
   - Parses the natural language query
   - Generates an SQL query
   - Executes the query against the database
   - Formats the results
4. Frontend displays the results in the QueryResultsPane
5. User can adjust filters, sorting, or pagination
6. These adjustments trigger new queries with modified parameters

## Data Transformation Flow

```mermaid
flowchart TD
    A[File Data] -->|Column mapping| B[Transformation Engine]
    B -->|Apply transformations| C[Normalized Data]
    D[Schema Definition] -->|Column definitions| B
    E[Transformation Rules] -->|Rule application| B
    C -->|Query execution| F[Query Results]
    F -->|Display| G[User Interface]
```

### Detailed Steps

1. When a query is executed, the system:
   - Retrieves the relevant file data
   - Applies column mappings to normalize the data according to the schema
   - Applies any transformation rules defined in the mappings
   - Executes the query against the normalized data
   - Returns the results

## Data Storage Model

```mermaid
erDiagram
    User ||--o{ Project : owns
    Project ||--o{ File : contains
    Project ||--o{ GlobalSchema : has
    File ||--o{ FileData : contains
    GlobalSchema ||--o{ SchemaColumn : has
    File ||--o{ ColumnMapping : maps
    GlobalSchema ||--o{ ColumnMapping : maps
    SchemaColumn ||--o{ ColumnMapping : references
    User ||--o{ Query : executes
    Project ||--o{ Query : contains
```

### Key Entities and Relationships

1. **User** owns multiple Projects
2. **Project** contains Files, GlobalSchemas, and Queries
3. **File** contains FileData and has ColumnMappings
4. **GlobalSchema** has SchemaColumns and ColumnMappings
5. **ColumnMapping** connects File columns to SchemaColumns
6. **Query** is executed by a User within a Project

## Data Lifecycle

```mermaid
stateDiagram-v2
    [*] --> FileUploaded: User uploads file
    FileUploaded --> FileParsed: System parses file
    FileParsed --> ColumnsExtracted: System extracts columns
    ColumnsExtracted --> ColumnsMapped: User maps columns
    ColumnsMapped --> DataNormalized: System normalizes data
    DataNormalized --> DataQueried: User queries data
    DataQueried --> ResultsDisplayed: System displays results
    ResultsDisplayed --> DataQueried: User refines query
```

### Lifecycle Stages

1. **FileUploaded**: File is uploaded to the system
2. **FileParsed**: File is parsed into headers and data rows
3. **ColumnsExtracted**: Columns are extracted from the file
4. **ColumnsMapped**: Columns are mapped to a global schema
5. **DataNormalized**: Data is normalized according to the schema
6. **DataQueried**: User queries the normalized data
7. **ResultsDisplayed**: Query results are displayed to the user

## Cross-Cutting Concerns

### Authentication and Authorization

```mermaid
flowchart TD
    A[User Request] -->|NextAuth.js| B[Authentication]
    B -->|Session validation| C[Authorization]
    C -->|Resource access check| D[Resource Access]
    D -->|Allowed| E[API Execution]
    D -->|Denied| F[Access Denied]
```

All data flows in the system are subject to authentication and authorization checks:

- User authentication is handled by NextAuth.js
- Session validation occurs on each API request
- Resource access is checked based on user ownership
- API execution only proceeds if access is allowed

### Error Handling

```mermaid
flowchart TD
    A[API Request] -->|Try| B[API Execution]
    B -->|Success| C[Success Response]
    B -->|Error| D[Error Handler]
    D -->|Log error| E[Error Logging]
    D -->|Format error| F[Error Response]
```

Error handling is implemented throughout the data flow:

- API endpoints use try-catch blocks
- Errors are logged for debugging
- User-friendly error messages are returned
- Frontend displays appropriate error messages

### Caching

```mermaid
flowchart TD
    A[Data Request] -->|Check cache| B{Cache hit?}
    B -->|Yes| C[Return cached data]
    B -->|No| D[Fetch from database]
    D -->|Store in cache| E[Cache data]
    E -->|Return data| F[Return fresh data]
```

Caching is implemented for performance optimization:

- File synopsis data is cached to reduce database load
- Query results can be cached for repeated queries
- UI state is cached in localStorage for persistence

## Conclusion

The data flow in RapidDataChat follows a logical progression from file upload through processing, schema management, column mapping, and finally to querying and result presentation. Each stage involves specific components and services that work together to provide a seamless user experience.

Understanding this data flow is essential for maintaining and extending the application, as it provides a clear picture of how data moves through the system and how different components interact.
