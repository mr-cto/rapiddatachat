import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaDatabase, FaColumns } from "react-icons/fa";
import { ColumnManager } from "../ColumnManager";
import { GlobalSchema } from "../../lib/schemaManagement";
import { Badge } from "../ui/Badge";

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
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400 bg-ui-secondary rounded-md">
        <FaDatabase className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Please sign in to manage columns</p>
        <p className="text-sm mt-2">
          You need to be authenticated to access column management features
        </p>
      </div>
    );
  }

  if (!projectId || typeof projectId !== "string") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400 bg-ui-secondary rounded-md">
        <FaDatabase className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Project ID is required</p>
        <p className="text-sm mt-2">
          A valid project must be selected to manage columns
        </p>
      </div>
    );
  }

  return (
    <div className="h-[50vh] flex flex-col bg-ui-primary">
      <div className="p-4 border-b border-ui-border bg-ui-secondary">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FaColumns className="text-accent-primary" />
            <h2 className="text-md font-semibold text-gray-200">
              Column Management
            </h2>
            <Badge variant="primary" size="sm">
              Data Structure
            </Badge>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-md">
            <p className="text-red-400 text-sm flex items-center">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-4 bg-ui-primary">
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
