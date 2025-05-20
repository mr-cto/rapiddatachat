import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { GlobalSchema } from "../schemaManagement";

// Define the shape of our context
interface GlobalSchemaContextType {
  schemaColumns: string[];
  activeSchema: GlobalSchema | null;
  isLoading: boolean;
  error: string | null;
  setActiveSchema?: (schema: GlobalSchema | null) => void;
  setSchemaColumns?: (columns: string[]) => void;
}

// Create the context with a default value
const GlobalSchemaContext = createContext<GlobalSchemaContextType>({
  schemaColumns: [],
  activeSchema: null,
  isLoading: false,
  error: null,
  setActiveSchema: undefined,
  setSchemaColumns: undefined,
});

// Props for the provider component
interface GlobalSchemaProviderProps {
  children: ReactNode;
  columns?: string[];
  activeSchema?: GlobalSchema | null;
  isLoading?: boolean;
  error?: string | null;
  projectId?: string;
}

// Provider component that will provide the schema columns
export const GlobalSchemaProvider: React.FC<GlobalSchemaProviderProps> = ({
  children,
  columns = [],
  activeSchema = null,
  isLoading = false,
  error = null,
  projectId,
}) => {
  console.log("[GlobalSchemaProvider] Initializing with:", {
    columnsLength: columns.length,
    activeSchemaName: activeSchema?.name,
    projectId,
  });
  // If columns are provided, use them directly
  // Otherwise, use the default empty array
  const [schemaColumns, setSchemaColumns] = useState<string[]>(columns);
  const [currentActiveSchema, setCurrentActiveSchema] =
    useState<GlobalSchema | null>(activeSchema);

  // Update schema columns when columns prop changes
  useEffect(() => {
    if (columns && columns.length > 0) {
      console.log(
        `[GlobalSchemaContext] Received ${columns.length} columns from props:`,
        columns
      );
      setSchemaColumns(columns);
    }
  }, [columns]);

  // Update active schema when prop changes
  useEffect(() => {
    if (activeSchema !== currentActiveSchema) {
      setCurrentActiveSchema(activeSchema);
    }
  }, [activeSchema]);

  // Extract column names from activeSchema if provided and columns is empty
  useEffect(() => {
    if (
      currentActiveSchema &&
      currentActiveSchema.columns &&
      currentActiveSchema.columns.length > 0 &&
      schemaColumns.length === 0
    ) {
      const columnNames = currentActiveSchema.columns.map((col) => col.name);
      console.log(
        `[GlobalSchemaContext] Extracted ${columnNames.length} columns from active schema:`,
        columnNames
      );
      setSchemaColumns(columnNames);
    }
  }, [currentActiveSchema, schemaColumns.length]);

  // Value to be provided by the context
  const value = {
    schemaColumns,
    activeSchema: currentActiveSchema,
    isLoading,
    error,
    setActiveSchema: setCurrentActiveSchema,
    setSchemaColumns,
  };

  // Log the value being provided by the context
  useEffect(() => {
    console.log("[GlobalSchemaContext] Providing value:", {
      schemaColumnsLength: schemaColumns.length,
      activeSchemaName: currentActiveSchema?.name,
      activeSchemaColumnsLength: currentActiveSchema?.columns?.length || 0,
    });

    if (schemaColumns.length > 0) {
      console.log("[GlobalSchemaContext] Schema columns:", schemaColumns);
    }

    if (
      currentActiveSchema &&
      currentActiveSchema.columns &&
      currentActiveSchema.columns.length > 0
    ) {
      console.log(
        "[GlobalSchemaContext] Active schema columns:",
        currentActiveSchema.columns.map((col) => col.name)
      );
    }
  }, [schemaColumns, currentActiveSchema]);

  return (
    <GlobalSchemaContext.Provider value={value}>
      {children}
    </GlobalSchemaContext.Provider>
  );
};

// Custom hook to use the context
export const useGlobalSchema = () => {
  const context = useContext(GlobalSchemaContext);
  if (context === undefined) {
    throw new Error(
      "useGlobalSchema must be used within a GlobalSchemaProvider"
    );
  }
  return context;
};
