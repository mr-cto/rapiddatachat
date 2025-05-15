// import React, { useState, useEffect } from "react";
// import "../../styles/animations.css";
// import { useSession } from "next-auth/react";
// import { QueryInterface } from "../QueryInterface";
// import { NLToSQLQuery } from "../NLToSQLQuery";
// import { ShareQueryResults } from "../ShareQueryResults";
// import { DataTable } from "../DataTable";

// interface Query {
//   id: string;
//   text: string;
//   createdAt: string;
//   userId: string;
// }

// interface ChatPaneProps {
//   selectedQuery?: Query;
//   selectedFileId?: string;
// }

// const ChatPane: React.FC<ChatPaneProps> = ({
//   selectedQuery,
//   selectedFileId,
// }) => {
//   const { data: session } = useSession();
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [result, setResult] = useState<{
//     sqlQuery: string;
//     explanation: string;
//     results: Record<string, unknown>[];
//     executionTime?: number;
//     totalRows?: number;
//     totalPages?: number;
//     currentPage?: number;
//   } | null>(null);
//   const [currentQuery, setCurrentQuery] = useState<string>("");

//   // Use the selected query if provided
//   useEffect(() => {
//     if (selectedQuery && selectedQuery.text !== currentQuery) {
//       setCurrentQuery(selectedQuery.text);
//       handleSubmit(selectedQuery.text);
//     }
//   }, [selectedQuery]);

//   // Handle query submission
//   const handleSubmit = async (
//     query: string,
//     options?: { pageSize?: number }
//   ) => {
//     if (!query.trim()) return;

//     setIsLoading(true);
//     setError(null);
//     setCurrentQuery(query);

//     try {
//       const queryOptions = {
//         page: 1,
//         pageSize: options?.pageSize || 100,
//         fileId: selectedFileId, // Pass the selected file ID for context
//       };

//       const response = await fetch("/api/nl-to-sql", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           query,
//           ...queryOptions,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to process query");
//       }

//       if (data.error) {
//         setError(data.error);
//       } else {
//         setResult({
//           sqlQuery: data.sqlQuery,
//           explanation: data.explanation,
//           results: data.results,
//           executionTime: data.executionTime,
//           totalRows: data.totalRows,
//           totalPages: data.totalPages,
//           currentPage: data.currentPage,
//         });
//       }
//     } catch (err) {
//       setError(
//         err instanceof Error ? err.message : "An unknown error occurred"
//       );
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Handle page change
//   const handlePageChange = (page: number) => {
//     if (!currentQuery) return;

//     setIsLoading(true);

//     setTimeout(async () => {
//       try {
//         const queryOptions = {
//           page,
//           pageSize: 100,
//           fileId: selectedFileId,
//         };

//         const response = await fetch("/api/nl-to-sql", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             query: currentQuery,
//             ...queryOptions,
//           }),
//         });

//         const data = await response.json();

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to process query");
//         }

//         if (data.error) {
//           setError(data.error);
//         } else {
//           setResult({
//             sqlQuery: data.sqlQuery,
//             explanation: data.explanation,
//             results: data.results,
//             executionTime: data.executionTime,
//             totalRows: data.totalRows,
//             totalPages: data.totalPages,
//             currentPage: data.currentPage,
//           });
//         }
//       } catch (err) {
//         setError(
//           err instanceof Error ? err.message : "An unknown error occurred"
//         );
//       } finally {
//         setIsLoading(false);
//       }
//     }, 100);
//   };

//   // Handle sort change
//   const handleSortChange = (column: string, direction: "asc" | "desc") => {
//     if (!currentQuery) return;

//     setIsLoading(true);

//     setTimeout(async () => {
//       try {
//         const queryOptions = {
//           page: 1,
//           pageSize: 100,
//           sortColumn: column,
//           sortDirection: direction,
//           fileId: selectedFileId,
//         };

//         const response = await fetch("/api/nl-to-sql", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             query: currentQuery,
//             ...queryOptions,
//           }),
//         });

//         const data = await response.json();

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to process query");
//         }

//         if (data.error) {
//           setError(data.error);
//         } else {
//           setResult({
//             sqlQuery: data.sqlQuery,
//             explanation: data.explanation,
//             results: data.results,
//             executionTime: data.executionTime,
//             totalRows: data.totalRows,
//             totalPages: data.totalPages,
//             currentPage: data.currentPage || 1,
//           });
//         }
//       } catch (err) {
//         setError(
//           err instanceof Error ? err.message : "An unknown error occurred"
//         );
//       } finally {
//         setIsLoading(false);
//       }
//     }, 100);
//   };

//   // Handle applying filters
//   const handleApplyFilters = (filters: Record<string, unknown>) => {
//     if (!currentQuery) return;

//     setIsLoading(true);

//     setTimeout(async () => {
//       try {
//         const queryOptions = {
//           page: 1,
//           pageSize: 100,
//           filters,
//           fileId: selectedFileId,
//         };

//         const response = await fetch("/api/nl-to-sql", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             query: currentQuery,
//             ...queryOptions,
//           }),
//         });

//         const data = await response.json();

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to process query");
//         }

//         if (data.error) {
//           setError(data.error);
//         } else {
//           setResult({
//             sqlQuery: data.sqlQuery,
//             explanation: data.explanation,
//             results: data.results,
//             executionTime: data.executionTime,
//             totalRows: data.totalRows,
//             totalPages: data.totalPages,
//             currentPage: data.currentPage || 1,
//           });
//         }
//       } catch (err) {
//         setError(
//           err instanceof Error ? err.message : "An unknown error occurred"
//         );
//       } finally {
//         setIsLoading(false);
//       }
//     }, 100);
//   };

//   // This component now manages state and delegates rendering to the new components
//   // It's kept for backward compatibility and to maintain the existing state management logic

//   return (
//     <div className="flex flex-col h-full w-full bg-gray-900 text-white p-4 rounded-lg">
//       {/* Child components would be rendered here */}
//       <NLToSQLQuery onSubmit={handleSubmit} isLoading={isLoading} />

//       {error && (
//         <div className="text-red-400 mt-4 p-3 bg-gray-800 rounded-md">
//           <p>Error: {error}</p>
//         </div>
//       )}

//       {result && (
//         <div className="mt-4">
//           <div className="bg-gray-800 p-4 rounded-md mb-4">
//             <h3 className="text-lg font-medium mb-2">SQL Query</h3>
//             <pre className="bg-gray-700 p-3 rounded-md overflow-x-auto">
//               <code>{result.sqlQuery}</code>
//             </pre>
//             <p className="mt-2">{result.explanation}</p>
//           </div>

//           <div className="mt-4">
//             <DataTable
//               data={result.results}
//               onPageChange={handlePageChange}
//               onSortChange={handleSortChange}
//               totalRows={result.totalRows}
//               totalPages={result.totalPages}
//               currentPage={result.currentPage}
//             />
//           </div>

//           {session && (
//             <div className="mt-4">
//               <ShareQueryResults
//                 naturalLanguageQuery={currentQuery}
//                 sqlQuery={result.sqlQuery}
//                 results={result.results}
//               />
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatPane;
