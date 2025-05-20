import React, { useEffect, useState } from "react";
import ColumnManagementPane from "./panels/ColumnManagementPane";
import { useGlobalSchema } from "../lib/contexts/GlobalSchemaContext";
import { GlobalSchema } from "../lib/schemaManagement";

interface ColumnManagementPaneWithContextProps {
  projectId: string;
  refreshTrigger?: number;
}

const ColumnManagementPaneWithContext: React.FC<
  ColumnManagementPaneWithContextProps
> = ({ projectId, refreshTrigger }) => {
  const { setActiveSchema, setSchemaColumns } = useGlobalSchema();
  const [initialSchemaFetched, setInitialSchemaFetched] = useState(false);

  const handleColumnChange = (schema: GlobalSchema | null) => {
    console.log("Schema selected in wrapper:", schema?.name);

    if (setActiveSchema) {
      setActiveSchema(schema);
    }

    if (setSchemaColumns && schema && schema.columns) {
      const columnNames = schema.columns.map((col) => col.name);
      console.log(
        `[ColumnManagementPaneWithContext] Setting ${columnNames.length} columns to GlobalSchemaContext:`,
        columnNames
      );
      setSchemaColumns(columnNames);
      setInitialSchemaFetched(true);
    }
  };

  // Fetch the active schema directly from the API to ensure we have the data
  useEffect(() => {
    if (!initialSchemaFetched && projectId) {
      const fetchActiveSchema = async () => {
        try {
          console.log(
            "[ColumnManagementPaneWithContext] Fetching active schema directly"
          );
          const response = await fetch(
            `/api/schema-management?projectId=${projectId}`
          );

          if (response.ok) {
            const data = await response.json();
            const schemas = data.schemas || [];

            // Find the active schema
            const activeSchema = schemas.find((s: GlobalSchema) => s.isActive);

            if (activeSchema) {
              console.log(
                "[ColumnManagementPaneWithContext] Found active schema:",
                activeSchema.name
              );
              handleColumnChange(activeSchema);
            } else if (schemas.length > 0) {
              // If no active schema, use the first one
              console.log(
                "[ColumnManagementPaneWithContext] No active schema, using first schema:",
                schemas[0].name
              );
              handleColumnChange(schemas[0]);
            }
          }
        } catch (error) {
          console.error(
            "[ColumnManagementPaneWithContext] Error fetching schema:",
            error
          );
        }
      };

      fetchActiveSchema();
    }
  }, [projectId, initialSchemaFetched]);

  return (
    <ColumnManagementPane
      projectId={projectId}
      onColumnChange={handleColumnChange}
      refreshTrigger={refreshTrigger}
    />
  );
};

export default ColumnManagementPaneWithContext;
