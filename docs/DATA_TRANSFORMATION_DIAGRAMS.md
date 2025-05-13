# Data Transformation Architecture Diagrams

This document contains diagrams illustrating the architecture and flow of the data transformation system.

## Component Architecture

```mermaid
graph TD
    A[Raw Data Source] --> B[Data Transformation Service]
    B --> C[Mapping Engine]
    B --> D[Transformation Rule Engine]
    B --> E[Validation Framework]
    B --> F[Storage Manager]
    B --> G[Error Handler]

    C --> H[Column Mappings]
    D --> I[Transformation Rules]
    E --> J[Schema Constraints]
    F --> K[Normalized Data Storage]
    G --> L[Error Reporting]

    H --> B
    I --> B
    J --> B
    K --> B
    L --> B
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DTS as Data Transformation Service
    participant ME as Mapping Engine
    participant TRE as Transformation Rule Engine
    participant VF as Validation Framework
    participant SM as Storage Manager
    participant EH as Error Handler
    participant DB as Database

    User->>API: Initiate transformation
    API->>DTS: Transform data
    DTS->>DB: Retrieve file data
    DB-->>DTS: Raw data

    DTS->>ME: Apply mappings
    ME->>DB: Get schema columns
    DB-->>ME: Schema columns
    ME-->>DTS: Mapped data

    DTS->>TRE: Apply transformations
    TRE-->>DTS: Transformed data

    DTS->>VF: Validate data
    VF->>DB: Get schema constraints
    DB-->>VF: Schema constraints
    VF-->>DTS: Validation results

    alt Valid data
        DTS->>SM: Store valid data
        SM->>DB: Insert normalized data
        DB-->>SM: Storage confirmation
        SM-->>DTS: Storage result
    end

    alt Invalid data
        DTS->>EH: Handle invalid data
        EH->>DB: Log validation issues
        DB-->>EH: Logging confirmation
        EH-->>DTS: Error handling result
    end

    DTS-->>API: Transformation result
    API-->>User: Transformation status
```

## Database Schema

```mermaid
erDiagram
    GLOBAL_SCHEMAS ||--o{ SCHEMA_COLUMNS : contains
    GLOBAL_SCHEMAS ||--o{ NORMALIZED_DATA : defines
    FILES ||--o{ NORMALIZED_DATA : source_for
    TRANSFORMATIONS ||--o{ NORMALIZED_DATA : creates
    TRANSFORMATIONS ||--o{ TRANSFORMATION_ISSUES : has

    GLOBAL_SCHEMAS {
        string id PK
        string user_id
        string project_id
        string name
        string description
        timestamp created_at
        timestamp updated_at
        boolean is_active
        int version
    }

    SCHEMA_COLUMNS {
        string id PK
        string schema_id FK
        string name
        string type
        string description
        boolean is_required
        boolean is_primary_key
    }

    FILES {
        string id PK
        string user_id
        string project_id
        string name
        string file_path
        json column_info
        timestamp created_at
        timestamp updated_at
    }

    TRANSFORMATIONS {
        string id PK
        string schema_id FK
        string file_id FK
        string status
        int record_count
        int error_count
        int warning_count
        timestamp start_time
        timestamp end_time
        int execution_time
        timestamp created_at
        timestamp updated_at
    }

    TRANSFORMATION_ISSUES {
        string id PK
        string transformation_id FK
        int row_index
        string column_name
        string schema_column_id
        string issue_type
        string message
        string severity
        timestamp created_at
    }

    NORMALIZED_DATA {
        string id PK
        string file_id FK
        string schema_id FK
        string transformation_id FK
        json data
        timestamp created_at
        timestamp updated_at
    }
```

## Processing Flow

```mermaid
flowchart TD
    A[Start Transformation] --> B{File exists?}
    B -->|No| C[Error: File not found]
    B -->|Yes| D{Schema exists?}
    D -->|No| E[Error: Schema not found]
    D -->|Yes| F[Load file data]
    F --> G[Create batches]
    G --> H[Process next batch]
    H --> I[Apply mappings]
    I --> J[Apply transformations]
    J --> K[Validate data]
    K --> L{Valid data?}
    L -->|Yes| M[Store normalized data]
    L -->|No| N{Error handling?}
    N -->|Fail fast| O[Abort transformation]
    N -->|Continue| P[Log validation issues]
    P --> Q{More batches?}
    M --> Q
    Q -->|Yes| H
    Q -->|No| R[Update transformation metadata]
    R --> S[End transformation]
    O --> S
```

## Component Interaction

```mermaid
graph TD
    subgraph "Data Transformation Service"
        DTS[Orchestrator]
    end

    subgraph "Mapping Engine"
        ME[Column Mapper]
        MS[Mapping Store]
    end

    subgraph "Transformation Rule Engine"
        TRE[Rule Executor]
        TRS[Rule Store]
    end

    subgraph "Validation Framework"
        VF[Validator]
        VS[Validation Store]
    end

    subgraph "Storage Manager"
        SM[Data Store]
        SI[Index Manager]
    end

    subgraph "Error Handler"
        EH[Error Processor]
        EL[Error Logger]
    end

    DTS <--> ME
    DTS <--> TRE
    DTS <--> VF
    DTS <--> SM
    DTS <--> EH

    ME <--> MS
    TRE <--> TRS
    VF <--> VS
    SM <--> SI
    EH <--> EL
```

## Deployment Architecture

```mermaid
flowchart TD
    subgraph "Client"
        UI[User Interface]
    end

    subgraph "API Layer"
        API[API Endpoints]
    end

    subgraph "Application Layer"
        DTS[Data Transformation Service]
        ME[Mapping Engine]
        TRE[Transformation Rule Engine]
        VF[Validation Framework]
        SM[Storage Manager]
        EH[Error Handler]
    end

    subgraph "Data Layer"
        DB[(Database)]
        FS[File Storage]
    end

    UI <--> API
    API <--> DTS
    DTS <--> ME
    DTS <--> TRE
    DTS <--> VF
    DTS <--> SM
    DTS <--> EH

    ME <--> DB
    TRE <--> DB
    VF <--> DB
    SM <--> DB
    SM <--> FS
    EH <--> DB
```

These diagrams provide a visual representation of the data transformation architecture, showing the relationships between components, the flow of data through the system, and the database schema for storing normalized data.
