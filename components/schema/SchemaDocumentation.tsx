import React, { useState, useEffect } from "react";
import { SchemaDocumentation as SchemaDocumentationType } from "../../lib/schemaMetadataService";
import ReactMarkdown from "react-markdown";

interface SchemaDocumentationProps {
  schemaId: string;
  readOnly?: boolean;
  onDocumentationUpdated?: () => void;
}

/**
 * Component for displaying and editing schema documentation
 */
const SchemaDocumentation: React.FC<SchemaDocumentationProps> = ({
  schemaId,
  readOnly = false,
  onDocumentationUpdated,
}) => {
  const [documentation, setDocumentation] = useState<SchemaDocumentationType[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch documentation
  useEffect(() => {
    const fetchDocumentation = async () => {
      if (!schemaId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/schema-documentation?schemaId=${schemaId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch documentation");
        }

        const data = await response.json();
        setDocumentation(data.documentation || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocumentation();
  }, [schemaId]);

  /**
   * Handle editing a section
   */
  const handleEditSection = (section: SchemaDocumentationType) => {
    setEditingSection(section.section);
    setEditContent(section.content);
  };

  /**
   * Handle saving a section
   */
  const handleSaveSection = async () => {
    if (!editingSection) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/schema-documentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          section: editingSection,
          content: editContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save documentation");
      }

      // Update the documentation in the state
      setDocumentation(
        documentation.map((doc) =>
          doc.section === editingSection
            ? { ...doc, content: editContent, updatedAt: new Date() }
            : doc
        )
      );

      // Exit editing mode
      setEditingSection(null);
      setEditContent("");

      // Notify parent component
      if (onDocumentationUpdated) {
        onDocumentationUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle canceling edit
   */
  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent("");
  };

  /**
   * Handle adding a new section
   */
  const handleAddSection = async () => {
    if (!newSection || !newContent) return;

    try {
      setIsSaving(true);
      setError(null);

      // Check if the section already exists
      if (documentation.some((doc) => doc.section === newSection)) {
        setError(`Section '${newSection}' already exists`);
        return;
      }

      const response = await fetch("/api/schema-documentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          section: newSection,
          content: newContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add documentation section");
      }

      const data = await response.json();

      // Add the new section to the documentation
      setDocumentation([...documentation, data.documentation]);

      // Reset the form
      setNewSection("");
      setNewContent("");
      setIsAddingSection(false);

      // Notify parent component
      if (onDocumentationUpdated) {
        onDocumentationUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle deleting a section
   */
  const handleDeleteSection = async (section: string) => {
    // Confirm deletion
    if (
      !window.confirm(
        `Are you sure you want to delete the '${section}' section?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/schema-documentation?schemaId=${schemaId}&section=${encodeURIComponent(
          section
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete documentation section");
      }

      // Remove the section from the documentation
      setDocumentation(documentation.filter((doc) => doc.section !== section));

      // Notify parent component
      if (onDocumentationUpdated) {
        onDocumentationUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (isLoading && documentation.length === 0) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Documentation sections */}
      {documentation.length === 0 && !isAddingSection && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No documentation available.
          {!readOnly && (
            <div className="mt-2">
              <button
                onClick={() => setIsAddingSection(true)}
                className="text-accent-primary hover:text-accent-primary-hover"
              >
                Add a section
              </button>
            </div>
          )}
        </div>
      )}

      {documentation.map((doc) => (
        <div
          key={doc.section}
          className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm"
        >
          {editingSection === doc.section ? (
            // Edit mode
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  value={doc.section}
                  disabled
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm bg-gray-100 dark:bg-gray-800"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content (Markdown supported)
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSection}
                  disabled={isSaving}
                  className={`px-3 py-1 bg-accent-primary text-white rounded-md ${
                    isSaving
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-accent-primary-hover"
                  }`}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-primary dark:text-primary">
                  {doc.section}
                </h3>
                {!readOnly && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditSection(doc)}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSection(doc.section)}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{doc.content}</ReactMarkdown>
              </div>

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Last updated: {formatDate(doc.updatedAt)}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new section form */}
      {!readOnly && (
        <div>
          {isAddingSection ? (
            <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
                Add New Section
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Section Name
                </label>
                <input
                  type="text"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                  placeholder="e.g., Overview, Usage, Examples"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content (Markdown supported)
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={10}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                  placeholder="# Section Title
                  
Description of this section...

## Subsection

More details here..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsAddingSection(false)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSection}
                  disabled={isSaving || !newSection || !newContent}
                  className={`px-3 py-1 bg-accent-primary text-white rounded-md ${
                    isSaving || !newSection || !newContent
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-accent-primary-hover"
                  }`}
                >
                  {isSaving ? "Adding..." : "Add Section"}
                </button>
              </div>
            </div>
          ) : (
            documentation.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsAddingSection(true)}
                  className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
                >
                  Add Section
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default SchemaDocumentation;
