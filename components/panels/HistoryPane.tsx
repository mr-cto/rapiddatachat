import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaHistory, FaSearch, FaSpinner } from "react-icons/fa";

interface Query {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
}

interface HistoryItem {
  id: string;
  query?: string;
  naturalLanguageQuery?: string;
  queryText?: string;
  timestamp?: string;
  userId?: string;
}

interface HistoryPaneProps {
  onSelect: (query: Query) => void;
  selectedQueryId?: string;
  projectId?: string; // Add projectId prop
}

const HistoryPane: React.FC<HistoryPaneProps> = ({
  onSelect,
  selectedQueryId,
  projectId,
}) => {
  const { data: session } = useSession();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch query history
  useEffect(() => {
    const fetchQueries = async () => {
      if (!session?.user) return;

      try {
        setLoading(true);
        // Add projectId to the query if available
        const url = projectId
          ? `/api/query-history?projectId=${projectId}`
          : "/api/query-history";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch query history");
        }

        const data = await response.json();
        // Map the history data to the expected Query format
        const formattedQueries = (data.history || []).map(
          (query: HistoryItem) => ({
            id: query.id,
            text:
              query.query ||
              query.naturalLanguageQuery ||
              query.queryText ||
              "",
            createdAt: query.timestamp || new Date().toISOString(),
            userId: query.userId || "",
          })
        );
        setQueries(formattedQueries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching query history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQueries();
  }, [session, projectId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Filter queries based on search term
  const filteredQueries = queries.filter((query) =>
    query.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group queries by date
  const groupQueriesByDate = () => {
    const groups: { [key: string]: Query[] } = {};

    filteredQueries.forEach((query) => {
      const date = new Date(query.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(query);
    });

    return groups;
  };

  const queryGroups = groupQueriesByDate();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center mb-4 text-black dark:text-black">
          <FaHistory className="mr-2" /> Query History
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(50vh-80px)]">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <FaSpinner className="animate-spin text-blue-500 mr-2" />
            <span>Loading history...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-red-500">{error}</div>
        ) : filteredQueries.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm ? "No matching queries found" : "No query history yet"}
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(queryGroups).map(([date, queries]) => (
              <div key={date} className="py-2">
                <div className="px-4 py-1 bg-gray-50 text-xs font-medium text-gray-500">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <ul>
                  {queries.map((query) => (
                    <li
                      key={query.id}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                        selectedQueryId === query.id
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : ""
                      }`}
                      onClick={() => onSelect(query)}
                    >
                      <div className="text-sm font-medium text-gray-800 line-clamp-2">
                        {query.text}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(query.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPane;
