import React, { useState } from "react";
import { Button } from "../ui";
import { FaLightbulb, FaSearch, FaRandom } from "react-icons/fa";

interface ImprovedChatInputPaneProps {
  onSubmit: (query: string, options?: { pageSize?: number }) => Promise<void>;
  isLoading: boolean;
  selectedFileId?: string;
}

const ImprovedChatInputPane: React.FC<ImprovedChatInputPaneProps> = ({
  onSubmit,
  isLoading,
  selectedFileId,
}) => {
  const [query, setQuery] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  // Example queries for common data operations
  const exampleQueries = [
    "Show me the top 10 rows sorted by date",
    "Count the number of unique values in the email column",
    "Find all records where the amount is greater than 1000",
    "Calculate the average age grouped by department",
    "Show me the distribution of values in the status column",
    "Find records with missing values in any column",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query, { pageSize: 100 });
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setShowExamples(false);
  };

  const handleRandomExample = () => {
    const randomIndex = Math.floor(Math.random() * exampleQueries.length);
    setQuery(exampleQueries[randomIndex]);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center">
          <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              className="w-full p-4 pr-24 text-base border border-ui-border bg-ui-secondary text-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
              disabled={isLoading}
            />
            {!isLoading && query.length === 0 && (
              <button
                type="button"
                onClick={() => setShowExamples(!showExamples)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-accent-primary"
                title="Show example queries"
              >
                <FaLightbulb size={18} />
              </button>
            )}
            {!isLoading && query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-accent-primary"
                title="Clear query"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            variant={isLoading || !query.trim() ? "secondary" : "primary"}
            size="lg"
            className="rounded-l-none"
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </div>
            ) : (
              <div className="flex items-center">
                <FaSearch className="mr-2" />
                Ask
              </div>
            )}
          </Button>
        </div>

        {/* File selection indicator */}
        {selectedFileId && (
          <div className="mt-2 text-xs text-gray-400">
            Querying selected file. Clear file selection in the sidebar to query
            all data.
          </div>
        )}

        {/* Example queries */}
        {showExamples && (
          <div className="absolute z-10 mt-2 w-full bg-ui-primary border border-ui-border rounded-md shadow-lg p-3 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-300">
                Example Queries
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleRandomExample}
                  className="text-xs flex items-center text-accent-primary hover:text-accent-primary-hover"
                >
                  <FaRandom className="mr-1" /> Random
                </button>
                <button
                  type="button"
                  onClick={() => setShowExamples(false)}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="text-left p-2 text-sm text-accent-primary hover:bg-ui-secondary rounded-md transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ImprovedChatInputPane;
