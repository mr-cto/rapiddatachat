import {
  PrismaClient,
  RelationshipDefinition,
  RelationshipInstance,
  RelationshipValidation,
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

/**
 * Relationship types
 */
export enum RelationshipType {
  ONE_TO_ONE = "oneToOne",
  ONE_TO_MANY = "oneToMany",
  MANY_TO_ONE = "manyToOne",
  MANY_TO_MANY = "manyToMany",
  SELF_REFERENTIAL = "selfReferential",
  POLYMORPHIC = "polymorphic",
}

/**
 * Cascading actions
 */
export enum CascadingAction {
  CASCADE = "cascade",
  RESTRICT = "restrict",
  SET_NULL = "setNull",
  SET_DEFAULT = "setDefault",
}

/**
 * Relationship constraints
 */
export interface RelationshipConstraints {
  required?: boolean;
  unique?: boolean;
  minItems?: number;
  maxItems?: number;
  validationRules?: any[];
}

/**
 * Cascading behavior
 */
export interface CascadingBehavior {
  delete?: CascadingAction;
  update?: CascadingAction;
}

/**
 * Relationship definition input
 */
export interface RelationshipDefinitionInput {
  id?: string;
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  sourceField: string;
  targetField: string;
  constraints?: RelationshipConstraints;
  cascading?: CascadingBehavior;
  projectId: string;
}

/**
 * Relationship instance input
 */
export interface RelationshipInstanceInput {
  id?: string;
  definitionId: string;
  sourceRecordId: string;
  targetRecordId: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  id: string;
  instanceId: string;
  status: "valid" | "invalid";
  message?: string;
}

/**
 * Impact analysis input
 */
export interface ImpactAnalysisInput {
  entity: string;
  recordId: string;
  action: "delete" | "update";
  projectId: string;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  affectedRecords: {
    entity: string;
    id: string;
    impact: "delete" | "update" | "restrict";
  }[];
  constraintViolations: {
    entity: string;
    id: string;
    constraint: string;
    message: string;
  }[];
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  includeFields?: boolean;
  includeConstraints?: boolean;
  format?: "svg" | "png" | "json";
}

/**
 * Relationship service
 */
export class RelationshipService {
  private prisma: PrismaClient;

  /**
   * Constructor
   */
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Define a relationship
   * @param input Relationship definition input
   * @returns Promise<RelationshipDefinition> Created relationship definition
   */
  async defineRelationship(
    input: RelationshipDefinitionInput
  ): Promise<RelationshipDefinition> {
    try {
      // Generate ID if not provided
      const id = input.id || `rel_${uuidv4()}`;

      // Create relationship definition
      const definition = await this.prisma.relationshipDefinition.create({
        data: {
          id,
          sourceEntity: input.sourceEntity,
          targetEntity: input.targetEntity,
          type: input.type,
          sourceField: input.sourceField,
          targetField: input.targetField,
          constraints: input.constraints
            ? JSON.stringify(input.constraints)
            : null,
          cascading: input.cascading ? JSON.stringify(input.cascading) : null,
          projectId: input.projectId,
        },
      });

      return definition;
    } catch (error) {
      console.error(
        "[RelationshipService] Error defining relationship:",
        error
      );
      throw error;
    }
  }

  /**
   * Get relationship definitions
   * @param projectId Project ID
   * @param sourceEntity Optional source entity
   * @param targetEntity Optional target entity
   * @returns Promise<RelationshipDefinition[]> Relationship definitions
   */
  async getRelationshipDefinitions(
    projectId: string,
    sourceEntity?: string,
    targetEntity?: string
  ): Promise<RelationshipDefinition[]> {
    try {
      // Build filter
      const filter: any = {
        projectId,
      };

      if (sourceEntity) {
        filter.sourceEntity = sourceEntity;
      }

      if (targetEntity) {
        filter.targetEntity = targetEntity;
      }

      // Get relationship definitions
      const definitions = await this.prisma.relationshipDefinition.findMany({
        where: filter,
      });

      return definitions;
    } catch (error) {
      console.error(
        "[RelationshipService] Error getting relationship definitions:",
        error
      );
      throw error;
    }
  }

  /**
   * Get relationship definition by ID
   * @param id Relationship definition ID
   * @returns Promise<RelationshipDefinition | null> Relationship definition or null if not found
   */
  async getRelationshipDefinitionById(
    id: string
  ): Promise<RelationshipDefinition | null> {
    try {
      // Get relationship definition
      const definition = await this.prisma.relationshipDefinition.findUnique({
        where: {
          id,
        },
      });

      return definition;
    } catch (error) {
      console.error(
        "[RelationshipService] Error getting relationship definition by ID:",
        error
      );
      throw error;
    }
  }

  /**
   * Update relationship definition
   * @param id Relationship definition ID
   * @param input Relationship definition input
   * @returns Promise<RelationshipDefinition> Updated relationship definition
   */
  async updateRelationshipDefinition(
    id: string,
    input: Partial<RelationshipDefinitionInput>
  ): Promise<RelationshipDefinition> {
    try {
      // Build update data
      const data: any = {};

      if (input.sourceEntity) {
        data.sourceEntity = input.sourceEntity;
      }

      if (input.targetEntity) {
        data.targetEntity = input.targetEntity;
      }

      if (input.type) {
        data.type = input.type;
      }

      if (input.sourceField) {
        data.sourceField = input.sourceField;
      }

      if (input.targetField) {
        data.targetField = input.targetField;
      }

      if (input.constraints) {
        data.constraints = JSON.stringify(input.constraints);
      }

      if (input.cascading) {
        data.cascading = JSON.stringify(input.cascading);
      }

      // Update relationship definition
      const definition = await this.prisma.relationshipDefinition.update({
        where: {
          id,
        },
        data,
      });

      return definition;
    } catch (error) {
      console.error(
        "[RelationshipService] Error updating relationship definition:",
        error
      );
      throw error;
    }
  }

  /**
   * Delete relationship definition
   * @param id Relationship definition ID
   * @returns Promise<RelationshipDefinition> Deleted relationship definition
   */
  async deleteRelationshipDefinition(
    id: string
  ): Promise<RelationshipDefinition> {
    try {
      // Delete relationship definition
      const definition = await this.prisma.relationshipDefinition.delete({
        where: {
          id,
        },
      });

      return definition;
    } catch (error) {
      console.error(
        "[RelationshipService] Error deleting relationship definition:",
        error
      );
      throw error;
    }
  }

  /**
   * Create relationship instance
   * @param input Relationship instance input
   * @returns Promise<RelationshipInstance> Created relationship instance
   */
  async createRelationshipInstance(
    input: RelationshipInstanceInput
  ): Promise<RelationshipInstance> {
    try {
      // Generate ID if not provided
      const id = input.id || `rel_inst_${uuidv4()}`;

      // Create relationship instance
      const instance = await this.prisma.relationshipInstance.create({
        data: {
          id,
          definitionId: input.definitionId,
          sourceRecordId: input.sourceRecordId,
          targetRecordId: input.targetRecordId,
        },
      });

      // Validate the relationship instance
      await this.validateRelationshipInstance(instance.id);

      return instance;
    } catch (error) {
      console.error(
        "[RelationshipService] Error creating relationship instance:",
        error
      );
      throw error;
    }
  }

  /**
   * Get relationship instances
   * @param definitionId Optional relationship definition ID
   * @param sourceRecordId Optional source record ID
   * @param targetRecordId Optional target record ID
   * @returns Promise<RelationshipInstance[]> Relationship instances
   */
  async getRelationshipInstances(
    definitionId?: string,
    sourceRecordId?: string,
    targetRecordId?: string
  ): Promise<RelationshipInstance[]> {
    try {
      // Build filter
      const filter: any = {};

      if (definitionId) {
        filter.definitionId = definitionId;
      }

      if (sourceRecordId) {
        filter.sourceRecordId = sourceRecordId;
      }

      if (targetRecordId) {
        filter.targetRecordId = targetRecordId;
      }

      // Get relationship instances
      const instances = await this.prisma.relationshipInstance.findMany({
        where: filter,
      });

      return instances;
    } catch (error) {
      console.error(
        "[RelationshipService] Error getting relationship instances:",
        error
      );
      throw error;
    }
  }

  /**
   * Get relationship instance by ID
   * @param id Relationship instance ID
   * @returns Promise<RelationshipInstance | null> Relationship instance or null if not found
   */
  async getRelationshipInstanceById(
    id: string
  ): Promise<RelationshipInstance | null> {
    try {
      // Get relationship instance
      const instance = await this.prisma.relationshipInstance.findUnique({
        where: {
          id,
        },
      });

      return instance;
    } catch (error) {
      console.error(
        "[RelationshipService] Error getting relationship instance by ID:",
        error
      );
      throw error;
    }
  }

  /**
   * Update relationship instance
   * @param id Relationship instance ID
   * @param input Relationship instance input
   * @returns Promise<RelationshipInstance> Updated relationship instance
   */
  async updateRelationshipInstance(
    id: string,
    input: Partial<RelationshipInstanceInput>
  ): Promise<RelationshipInstance> {
    try {
      // Build update data
      const data: any = {};

      if (input.definitionId) {
        data.definitionId = input.definitionId;
      }

      if (input.sourceRecordId) {
        data.sourceRecordId = input.sourceRecordId;
      }

      if (input.targetRecordId) {
        data.targetRecordId = input.targetRecordId;
      }

      // Update relationship instance
      const instance = await this.prisma.relationshipInstance.update({
        where: {
          id,
        },
        data,
      });

      // Validate the relationship instance
      await this.validateRelationshipInstance(instance.id);

      return instance;
    } catch (error) {
      console.error(
        "[RelationshipService] Error updating relationship instance:",
        error
      );
      throw error;
    }
  }

  /**
   * Delete relationship instance
   * @param id Relationship instance ID
   * @returns Promise<RelationshipInstance> Deleted relationship instance
   */
  async deleteRelationshipInstance(id: string): Promise<RelationshipInstance> {
    try {
      // Delete relationship instance
      const instance = await this.prisma.relationshipInstance.delete({
        where: {
          id,
        },
      });

      return instance;
    } catch (error) {
      console.error(
        "[RelationshipService] Error deleting relationship instance:",
        error
      );
      throw error;
    }
  }

  /**
   * Validate relationship instance
   * @param instanceId Relationship instance ID
   * @returns Promise<ValidationResult> Validation result
   */
  async validateRelationshipInstance(
    instanceId: string
  ): Promise<ValidationResult> {
    try {
      // Get relationship instance
      const instance = await this.prisma.relationshipInstance.findUnique({
        where: {
          id: instanceId,
        },
        include: {
          definition: true,
        },
      });

      if (!instance) {
        throw new Error(`Relationship instance ${instanceId} not found`);
      }

      // Get constraints
      const constraints = instance.definition.constraints
        ? JSON.parse(instance.definition.constraints as string)
        : {};

      // Validate constraints
      let isValid = true;
      let message = "";

      // Check required constraint
      if (constraints.required) {
        // For required relationships, both source and target records must exist
        // This would require checking the actual records, which depends on the entity type
        // For now, we'll just check that the IDs are not empty
        if (!instance.sourceRecordId || !instance.targetRecordId) {
          isValid = false;
          message = "Source or target record ID is empty";
        }
      }

      // Check unique constraint
      if (constraints.unique && isValid) {
        // For unique relationships, there should be only one instance with the same source or target record ID
        // depending on the relationship type
        const definition = instance.definition;
        const type = definition.type;

        if (
          type === RelationshipType.ONE_TO_ONE ||
          type === RelationshipType.ONE_TO_MANY
        ) {
          // Check uniqueness of source record
          const sourceInstances =
            await this.prisma.relationshipInstance.findMany({
              where: {
                definitionId: instance.definitionId,
                sourceRecordId: instance.sourceRecordId,
                id: {
                  not: instance.id,
                },
              },
            });

          if (sourceInstances.length > 0) {
            isValid = false;
            message = `Source record ${instance.sourceRecordId} is already used in another relationship`;
          }
        }

        if (
          (type === RelationshipType.ONE_TO_ONE ||
            type === RelationshipType.MANY_TO_ONE) &&
          isValid
        ) {
          // Check uniqueness of target record
          const targetInstances =
            await this.prisma.relationshipInstance.findMany({
              where: {
                definitionId: instance.definitionId,
                targetRecordId: instance.targetRecordId,
                id: {
                  not: instance.id,
                },
              },
            });

          if (targetInstances.length > 0) {
            isValid = false;
            message = `Target record ${instance.targetRecordId} is already used in another relationship`;
          }
        }
      }

      // Create validation result
      const validationId = `validation_${uuidv4()}`;
      const validationResult = await this.prisma.relationshipValidation.create({
        data: {
          id: validationId,
          instanceId: instance.id,
          status: isValid ? "valid" : "invalid",
          message: isValid ? null : message,
        },
      });

      return {
        id: validationResult.id,
        instanceId: validationResult.instanceId,
        status: isValid ? "valid" : "invalid",
        message: isValid ? undefined : message,
      };
    } catch (error) {
      console.error(
        "[RelationshipService] Error validating relationship instance:",
        error
      );
      throw error;
    }
  }

  /**
   * Validate relationships
   * @param entity Entity name
   * @param projectId Project ID
   * @returns Promise<ValidationResult[]> Validation results
   */
  async validateRelationships(
    entity: string,
    projectId: string
  ): Promise<ValidationResult[]> {
    try {
      // Get relationship definitions for the entity
      const definitions = await this.prisma.relationshipDefinition.findMany({
        where: {
          OR: [
            {
              sourceEntity: entity,
            },
            {
              targetEntity: entity,
            },
          ],
          projectId,
        },
      });

      // Get relationship instances for the definitions
      const definitionIds = definitions.map((definition) => definition.id);
      const instances = await this.prisma.relationshipInstance.findMany({
        where: {
          definitionId: {
            in: definitionIds,
          },
        },
      });

      // Validate each instance
      const validationResults: ValidationResult[] = [];
      for (const instance of instances) {
        const validationResult = await this.validateRelationshipInstance(
          instance.id
        );
        validationResults.push(validationResult);
      }

      return validationResults;
    } catch (error) {
      console.error(
        "[RelationshipService] Error validating relationships:",
        error
      );
      throw error;
    }
  }

  /**
   * Analyze impact
   * @param input Impact analysis input
   * @returns Promise<ImpactAnalysisResult> Impact analysis result
   */
  async analyzeImpact(
    input: ImpactAnalysisInput
  ): Promise<ImpactAnalysisResult> {
    try {
      const { entity, recordId, action, projectId } = input;
      const affectedRecords: ImpactAnalysisResult["affectedRecords"] = [];
      const constraintViolations: ImpactAnalysisResult["constraintViolations"] =
        [];

      // Get relationship definitions where the entity is the source
      const sourceDefinitions =
        await this.prisma.relationshipDefinition.findMany({
          where: {
            sourceEntity: entity,
            projectId,
          },
        });

      // Get relationship definitions where the entity is the target
      const targetDefinitions =
        await this.prisma.relationshipDefinition.findMany({
          where: {
            targetEntity: entity,
            projectId,
          },
        });

      // Analyze impact on source relationships
      for (const definition of sourceDefinitions) {
        // Get instances where the entity is the source
        const instances = await this.prisma.relationshipInstance.findMany({
          where: {
            definitionId: definition.id,
            sourceRecordId: recordId,
          },
        });

        // Get cascading behavior
        const cascading = definition.cascading
          ? JSON.parse(definition.cascading as string)
          : {};

        // Determine impact based on action and cascading behavior
        for (const instance of instances) {
          if (action === "delete") {
            const deleteAction = cascading.delete || CascadingAction.RESTRICT;

            if (deleteAction === CascadingAction.CASCADE) {
              // Cascade delete to target record
              affectedRecords.push({
                entity: definition.targetEntity,
                id: instance.targetRecordId,
                impact: "delete",
              });
            } else if (deleteAction === CascadingAction.RESTRICT) {
              // Restrict delete if target record exists
              constraintViolations.push({
                entity: definition.targetEntity,
                id: instance.targetRecordId,
                constraint: "restrict",
                message: `Cannot delete ${entity} ${recordId} because it is referenced by ${definition.targetEntity} ${instance.targetRecordId}`,
              });
            } else if (deleteAction === CascadingAction.SET_NULL) {
              // Set target field to null
              affectedRecords.push({
                entity: definition.targetEntity,
                id: instance.targetRecordId,
                impact: "update",
              });
            } else if (deleteAction === CascadingAction.SET_DEFAULT) {
              // Set target field to default value
              affectedRecords.push({
                entity: definition.targetEntity,
                id: instance.targetRecordId,
                impact: "update",
              });
            }
          } else if (action === "update") {
            const updateAction = cascading.update || CascadingAction.RESTRICT;

            if (updateAction === CascadingAction.CASCADE) {
              // Cascade update to target record
              affectedRecords.push({
                entity: definition.targetEntity,
                id: instance.targetRecordId,
                impact: "update",
              });
            }
          }
        }
      }

      // Analyze impact on target relationships
      for (const definition of targetDefinitions) {
        // Get instances where the entity is the target
        const instances = await this.prisma.relationshipInstance.findMany({
          where: {
            definitionId: definition.id,
            targetRecordId: recordId,
          },
        });

        // Get constraints
        const constraints = definition.constraints
          ? JSON.parse(definition.constraints as string)
          : {};

        // Determine impact based on action and constraints
        for (const instance of instances) {
          if (action === "delete" && constraints.required) {
            // Violation of required constraint
            constraintViolations.push({
              entity: definition.sourceEntity,
              id: instance.sourceRecordId,
              constraint: "required",
              message: `Cannot delete ${entity} ${recordId} because it is required by ${definition.sourceEntity} ${instance.sourceRecordId}`,
            });
          }
        }
      }

      return {
        affectedRecords,
        constraintViolations,
      };
    } catch (error) {
      console.error("[RelationshipService] Error analyzing impact:", error);
      throw error;
    }
  }

  /**
   * Generate entity-relationship diagram
   * @param projectId Project ID
   * @param options Visualization options
   * @returns Promise<string> Entity-relationship diagram
   */
  async generateERD(
    projectId: string,
    options: VisualizationOptions = {}
  ): Promise<string> {
    try {
      // Get relationship definitions
      const definitions = await this.prisma.relationshipDefinition.findMany({
        where: {
          projectId,
        },
      });

      // Build ERD
      const entities = new Set<string>();
      const relationships: any[] = [];

      // Add entities
      for (const definition of definitions) {
        entities.add(definition.sourceEntity);
        entities.add(definition.targetEntity);
      }

      // Add relationships
      for (const definition of definitions) {
        const constraints = definition.constraints
          ? JSON.parse(definition.constraints as string)
          : {};

        relationships.push({
          id: definition.id,
          source: definition.sourceEntity,
          target: definition.targetEntity,
          type: definition.type,
          sourceField: options.includeFields
            ? definition.sourceField
            : undefined,
          targetField: options.includeFields
            ? definition.targetField
            : undefined,
          required: options.includeConstraints
            ? constraints.required
            : undefined,
          unique: options.includeConstraints ? constraints.unique : undefined,
        });
      }

      // Generate diagram
      // This is a placeholder for actual diagram generation
      // In a real implementation, this would use a library like Mermaid or D3.js
      const diagram = JSON.stringify(
        {
          entities: Array.from(entities),
          relationships,
        },
        null,
        2
      );

      return diagram;
    } catch (error) {
      console.error("[RelationshipService] Error generating ERD:", error);
      throw error;
    }
  }

  /**
   * Generate dependency graph
   * @param entity Entity name
   * @param projectId Project ID
   * @param options Visualization options
   * @returns Promise<string> Dependency graph
   */
  async generateDependencyGraph(
    entity: string,
    projectId: string,
    options: VisualizationOptions = {}
  ): Promise<string> {
    try {
      // Get relationship definitions for the entity
      const definitions = await this.prisma.relationshipDefinition.findMany({
        where: {
          OR: [
            {
              sourceEntity: entity,
            },
            {
              targetEntity: entity,
            },
          ],
          projectId,
        },
      });

      // Build dependency graph
      const nodes = new Set<string>();
      const edges: any[] = [];

      // Add nodes
      nodes.add(entity);
      for (const definition of definitions) {
        if (definition.sourceEntity === entity) {
          nodes.add(definition.targetEntity);
        } else {
          nodes.add(definition.sourceEntity);
        }
      }

      // Add edges
      for (const definition of definitions) {
        const constraints = definition.constraints
          ? JSON.parse(definition.constraints as string)
          : {};

        if (definition.sourceEntity === entity) {
          edges.push({
            source: entity,
            target: definition.targetEntity,
            type: definition.type,
            sourceField: options.includeFields
              ? definition.sourceField
              : undefined,
            targetField: options.includeFields
              ? definition.targetField
              : undefined,
            required: options.includeConstraints
              ? constraints.required
              : undefined,
            unique: options.includeConstraints ? constraints.unique : undefined,
          });
        } else {
          edges.push({
            source: definition.sourceEntity,
            target: entity,
            type: definition.type,
            sourceField: options.includeFields
              ? definition.sourceField
              : undefined,
            targetField: options.includeFields
              ? definition.targetField
              : undefined,
            required: options.includeConstraints
              ? constraints.required
              : undefined,
            unique: options.includeConstraints ? constraints.unique : undefined,
          });
        }
      }

      // Generate graph
      // This is a placeholder for actual graph generation
      // In a real implementation, this would use a library like D3.js or Cytoscape
      const graph = JSON.stringify(
        {
          nodes: Array.from(nodes),
          edges,
        },
        null,
        2
      );

      return graph;
    } catch (error) {
      console.error(
        "[RelationshipService] Error generating dependency graph:",
        error
      );
      throw error;
    }
  }

  /**
   * Generate relationship matrix
   * @param projectId Project ID
   * @param options Visualization options
   * @returns Promise<string> Relationship matrix
   */
  async generateRelationshipMatrix(
    projectId: string,
    options: VisualizationOptions = {}
  ): Promise<string> {
    try {
      // Get relationship definitions
      const definitions = await this.prisma.relationshipDefinition.findMany({
        where: {
          projectId,
        },
      });

      // Build matrix
      const entities = new Set<string>();
      const matrix: any = {};

      // Add entities
      for (const definition of definitions) {
        entities.add(definition.sourceEntity);
        entities.add(definition.targetEntity);
      }

      // Initialize matrix
      for (const source of entities) {
        matrix[source] = {};
        for (const target of entities) {
          matrix[source][target] = [];
        }
      }

      // Add relationships to matrix
      for (const definition of definitions) {
        const constraints = definition.constraints
          ? JSON.parse(definition.constraints as string)
          : {};

        matrix[definition.sourceEntity][definition.targetEntity].push({
          id: definition.id,
          type: definition.type,
          sourceField: options.includeFields
            ? definition.sourceField
            : undefined,
          targetField: options.includeFields
            ? definition.targetField
            : undefined,
          required: options.includeConstraints
            ? constraints.required
            : undefined,
          unique: options.includeConstraints ? constraints.unique : undefined,
        });
      }

      // Generate matrix
      // This is a placeholder for actual matrix generation
      // In a real implementation, this would use a library like D3.js or a table renderer
      const matrixJson = JSON.stringify(
        {
          entities: Array.from(entities),
          matrix,
        },
        null,
        2
      );

      return matrixJson;
    } catch (error) {
      console.error(
        "[RelationshipService] Error generating relationship matrix:",
        error
      );
      throw error;
    }
  }
}
