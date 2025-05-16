import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaDatabase } from "react-icons/fa";
import { ColumnManager } from "../ColumnManager";
import { GlobalSchema } from "../../lib/schemaManagement";

interface ColumnManagementPaneProps {
  onColumnChange?: (column: GlobalSchema | null) => void;
}

const ColumnManagementPane: React.FC<ColumnManagementPaneProps> = ({
  onColumnChange,
}) => {
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { id: projectId } = router.query;

  if (!session?.user) {
    return (
      <div className="p-4 text-center text-gray-500">
        Please sign in to manage columns.
      </div>
    );
  }

  if (!projectId || typeof projectId !== "string") {
    return (
      <div className="p-4 text-center text-gray-500">
        Project ID is required to manage columns.
      </div>
    );
  }

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-semibold flex items-center text-black dark:text-black">
            <FaDatabase className="mr-1" /> Column Management
          </h2>
        </div>

        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-3">
        <ColumnManager
          userId={session.user.email || session.user.id || ""}
          projectId={projectId}
          onColumnChange={onColumnChange}
        />
      </div>
    </div>
  );
};

export default ColumnManagementPane;
