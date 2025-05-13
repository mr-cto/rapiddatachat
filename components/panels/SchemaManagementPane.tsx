import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaDatabase } from "react-icons/fa";
import { SchemaManager } from "../SchemaManager";
import { GlobalSchema } from "../../lib/schemaManagement";

interface SchemaManagementPaneProps {
  onSchemaChange?: (schema: GlobalSchema | null) => void;
}

const SchemaManagementPane: React.FC<SchemaManagementPaneProps> = ({
  onSchemaChange,
}) => {
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);

  if (!session?.user) {
    return (
      <div className="p-4 text-center text-gray-500">
        Please sign in to manage schemas.
      </div>
    );
  }

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-semibold flex items-center text-black dark:text-black">
            <FaDatabase className="mr-1" /> Schema Management
          </h2>
        </div>

        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-3">
        <SchemaManager
          userId={session.user.email || session.user.id || ""}
          onSchemaChange={onSchemaChange}
        />
      </div>
    </div>
  );
};

export default SchemaManagementPane;
