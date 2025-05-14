# Relationship Management System

This document outlines the design of the relationship management system for the data upload flow. The system is responsible for defining, enforcing, and maintaining relationships between data entities across the transformation process.

## Overview

The relationship management system provides capabilities to:

1. Define relationships between data entities
2. Enforce referential integrity constraints
3. Visualize relationships between entities
4. Analyze the impact of changes to entities
5. Preserve relationships during transformation processes

## Relationship Types

The system supports various types of relationships:

### 1. One-to-One (1:1)

A one-to-one relationship indicates that each record in Entity A is related to exactly one record in Entity B, and vice versa.

Example: A Person has one Passport, and a Passport belongs to one Person.

### 2. One-to-Many (1:N)

A one-to-many relationship indicates that each record in Entity A can be related to multiple records in Entity B, but each record in Entity B is related to only one record in Entity A.

Example: A Department has many Employees, but an Employee belongs to only one Department.

### 3. Many-to-Many (N:M)

A many-to-many relationship indicates that each record in Entity A can be related to multiple records in Entity B, and each record in Entity B can be related to multiple records in Entity A.

Example: A Student can enroll in multiple Courses, and a Course can have multiple Students.

### 4. Self-Referential

A self-referential relationship indicates that records within the same entity can be related to each other.

Example: An Employee can manage other Employees.

### 5. Polymorphic

A polymorphic relationship indicates that a record in Entity A can be related to records in multiple different entities.

Example: A Comment can belong to either a Post or a Video.

## Relationship Definition

Relationships are defined using a declarative approach, specifying:

1. Source entity
2. Target entity
3. Relationship type
4. Cardinality constraints
5. Referential integrity constraints
6. Cascading behavior

Example relationship definition:

```json
{
  "id": "rel_department_employees",
  "sourceEntity": "Department",
  "targetEntity": "Employee",
  "type": "oneToMany",
  "sourceField": "id",
  "targetField": "departmentId",
  "constraints": {
    "required": true,
    "unique": false
  },
  "cascading": {
    "delete": "restrict",
    "update": "cascade"
  }
}
```

## Referential Integrity

The system enforces referential integrity constraints to ensure that relationships between entities remain valid. The following constraints are supported:

### 1. Required Constraint

Ensures that a relationship must exist. For example, an Employee must belong to a Department.

### 2. Unique Constraint

Ensures that a relationship is unique. For example, a Passport can belong to only one Person.

### 3. Cascading Behavior

Defines how changes to a record should affect related records:

- **Cascade**: Changes are propagated to related records
- **Restrict**: Changes are prevented if related records exist
- **SetNull**: Related fields are set to null
- **SetDefault**: Related fields are set to their default value

## Relationship Visualization

The system provides tools to visualize relationships between entities:

### 1. Entity-Relationship Diagrams (ERD)

Graphical representation of entities and their relationships, showing cardinality and constraints.

### 2. Dependency Graphs

Directed graphs showing dependencies between entities, useful for understanding the impact of changes.

### 3. Relationship Matrix

Tabular representation of relationships between entities, showing the type and constraints of each relationship.

## Impact Analysis

The system provides capabilities to analyze the impact of changes to entities:

### 1. Change Impact Analysis

Identifies all entities and records that would be affected by a change to a specific entity or record.

### 2. Dependency Chain Analysis

Traces the chain of dependencies from a specific entity or record to identify indirect impacts.

### 3. Constraint Violation Detection

Identifies potential constraint violations that would result from a change.

## Relationship Preservation

The system ensures that relationships are preserved during transformation processes:

### 1. Relationship Mapping

Maps relationships from source schemas to target schemas during transformation.

### 2. Relationship Validation

Validates that relationships remain valid after transformation.

### 3. Relationship Recovery

Recovers relationships that may have been lost during transformation.

## Implementation

The relationship management system is implemented using the following components:

### 1. Relationship Registry

A central registry of all defined relationships, providing methods to:

- Register new relationships
- Retrieve relationships by entity
- Validate relationship definitions

### 2. Relationship Validator

A component that validates relationships against defined constraints, providing methods to:

- Validate referential integrity
- Check constraint violations
- Enforce cascading behavior

### 3. Relationship Visualizer

A component that generates visualizations of relationships, providing methods to:

- Generate entity-relationship diagrams
- Create dependency graphs
- Build relationship matrices

### 4. Impact Analyzer

A component that analyzes the impact of changes, providing methods to:

- Identify affected entities and records
- Trace dependency chains
- Detect constraint violations

### 5. Relationship Mapper

A component that maps relationships during transformation, providing methods to:

- Map relationships between schemas
- Validate transformed relationships
- Recover lost relationships

## Database Schema

The relationship management system uses the following database tables:

### 1. Relationship Definitions

```sql
CREATE TABLE relationship_definitions (
  id TEXT PRIMARY KEY,
  source_entity TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  type TEXT NOT NULL,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  constraints JSONB,
  cascading JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

### 2. Relationship Instances

```sql
CREATE TABLE relationship_instances (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  target_record_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (definition_id) REFERENCES relationship_definitions(id)
)
```

### 3. Relationship Validations

```sql
CREATE TABLE relationship_validations (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES relationship_instances(id)
)
```

## API

The relationship management system provides the following API endpoints:

### 1. Relationship Definitions

- `GET /api/relationships`: Get all relationship definitions
- `GET /api/relationships/:id`: Get a specific relationship definition
- `POST /api/relationships`: Create a new relationship definition
- `PUT /api/relationships/:id`: Update a relationship definition
- `DELETE /api/relationships/:id`: Delete a relationship definition

### 2. Relationship Instances

- `GET /api/relationship-instances`: Get all relationship instances
- `GET /api/relationship-instances/:id`: Get a specific relationship instance
- `POST /api/relationship-instances`: Create a new relationship instance
- `PUT /api/relationship-instances/:id`: Update a relationship instance
- `DELETE /api/relationship-instances/:id`: Delete a relationship instance

### 3. Relationship Validations

- `GET /api/relationship-validations`: Get all relationship validations
- `GET /api/relationship-validations/:id`: Get a specific relationship validation
- `POST /api/relationship-validations`: Create a new relationship validation

### 4. Relationship Visualization

- `GET /api/relationships/visualize/erd`: Generate an entity-relationship diagram
- `GET /api/relationships/visualize/dependency-graph`: Generate a dependency graph
- `GET /api/relationships/visualize/matrix`: Generate a relationship matrix

### 5. Impact Analysis

- `POST /api/relationships/analyze/impact`: Analyze the impact of a change
- `POST /api/relationships/analyze/dependency-chain`: Analyze a dependency chain
- `POST /api/relationships/analyze/constraint-violations`: Detect constraint violations

## Usage Examples

### 1. Define a Relationship

```javascript
const relationshipService = new RelationshipService();

const relationship = {
  id: "rel_department_employees",
  sourceEntity: "Department",
  targetEntity: "Employee",
  type: "oneToMany",
  sourceField: "id",
  targetField: "departmentId",
  constraints: {
    required: true,
    unique: false,
  },
  cascading: {
    delete: "restrict",
    update: "cascade",
  },
};

await relationshipService.defineRelationship(relationship);
```

### 2. Create a Relationship Instance

```javascript
const relationshipService = new RelationshipService();

const instance = {
  definitionId: "rel_department_employees",
  sourceRecordId: "dept_123",
  targetRecordId: "emp_456",
};

await relationshipService.createRelationshipInstance(instance);
```

### 3. Validate Relationships

```javascript
const relationshipService = new RelationshipService();

const validationResults = await relationshipService.validateRelationships(
  "Employee"
);

for (const result of validationResults) {
  console.log(`Relationship ${result.id}: ${result.status}`);
  if (result.status === "invalid") {
    console.log(`Error: ${result.message}`);
  }
}
```

### 4. Analyze Impact

```javascript
const relationshipService = new RelationshipService();

const impact = await relationshipService.analyzeImpact({
  entity: "Department",
  recordId: "dept_123",
  action: "delete",
});

console.log(
  `Impact: ${impact.affectedRecords.length} records would be affected`
);
for (const record of impact.affectedRecords) {
  console.log(`${record.entity} ${record.id} would be ${record.impact}`);
}
```

### 5. Visualize Relationships

```javascript
const relationshipService = new RelationshipService();

const erd = await relationshipService.generateERD();
const dependencyGraph = await relationshipService.generateDependencyGraph(
  "Employee"
);
const matrix = await relationshipService.generateRelationshipMatrix();

// Render visualizations
```

## Conclusion

The relationship management system provides a comprehensive solution for defining, enforcing, and maintaining relationships between data entities. It ensures data integrity, provides powerful visualization and analysis tools, and preserves relationships during transformation processes.
