import React from "react";
import { NLToSQLQuery } from "../NLToSQLQuery";

interface ChatInputPaneProps {
  onSubmit: (query: string, options?: { pageSize?: number }) => Promise<void>;
  isLoading: boolean;
  selectedFileId?: string;
}

const ChatInputPane: React.FC<ChatInputPaneProps> = ({
  onSubmit,
  isLoading,
  selectedFileId,
}) => {
  return (
    <div className="bg-ui-primary p-2 border-t border-ui-border">
      {/* Query Input */}
      <NLToSQLQuery
        onSubmit={onSubmit}
        isLoading={isLoading}
        selectedFileId={selectedFileId}
      />
    </div>
  );
};

export default ChatInputPane;
