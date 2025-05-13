import React, { useState } from "react";

interface ShareQueryResultsProps {
  queryId?: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  results: Record<string, unknown>[];
  columnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
}

/**
 * ShareQueryResults component for sharing query results
 * @param props Component props
 * @returns JSX.Element
 */
export const ShareQueryResults: React.FC<ShareQueryResultsProps> = ({
  queryId,
  naturalLanguageQuery,
  sqlQuery,
  results,
  columnMerges = [],
}) => {
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate a shareable link for the query results
   */
  const generateShareLink = async () => {
    setIsGeneratingLink(true);
    setError(null);
    setCopied(false);

    try {
      // Call the share-query API endpoint
      const response = await fetch("/api/share-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queryId,
          naturalLanguageQuery,
          sqlQuery,
          results,
          columnMerges,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to share query");
      }

      setShareLink(data.shareUrl);
    } catch (error) {
      console.error("Error generating share link:", error);
      setError("Failed to generate share link. Please try again.");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  /**
   * Copy the share link to the clipboard
   */
  const copyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);

      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      setError("Failed to copy link. Please try manually.");
    }
  };

  return (
    <div className="mt-4">
      {!shareLink ? (
        <button
          onClick={generateShareLink}
          disabled={isGeneratingLink || results.length === 0}
          className={`flex items-center px-4 py-2 rounded-md text-white font-medium ${
            isGeneratingLink || results.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 transition-all"
          }`}
        >
          {isGeneratingLink ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              Generating Link...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                ></path>
              </svg>
              Share Results
            </>
          )}
        </button>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 animate-fadeIn">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Share Link Generated
          </h4>
          <div className="flex items-center">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            This link allows anyone to view these query results without
            requiring authentication.
          </p>
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
};
