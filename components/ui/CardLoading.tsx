import React from "react";

interface CardLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

const CardLoading: React.FC<CardLoadingProps> = ({
  isLoading,
  children,
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}

      {isLoading && (
        <div className="absolute inset-0 bg-ui-primary bg-opacity-70 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 animate-fadeIn">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            <span className="mt-2 text-sm text-gray-300">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardLoading;
