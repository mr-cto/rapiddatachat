import React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";

interface HeaderProps {
  showBackButton?: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({
  showBackButton = false,
  title = "RapidDataChat",
}) => {
  const { data: session } = useSession();
  const router = useRouter();

  // Handle sign out
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
      <div className="flex items-center space-x-6">
        <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
          {title}
        </h1>
        {showBackButton && (
          <button
            onClick={() => router.push("/project")}
            className="flex items-center px-3 py-1.5 bg-ui-secondary hover:bg-ui-tertiary text-gray-300 rounded-md text-sm transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Projects
          </button>
        )}
      </div>
      <div className="flex items-center space-x-4">
        {session?.user && (
          <>
            <div className="flex items-center">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={36}
                  height={36}
                  className="rounded-full border-2 border-indigo-100"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center text-white shadow-sm">
                  {session.user.name?.charAt(0) ||
                    session.user.email?.charAt(0) ||
                    "U"}
                </div>
              )}
              <span className="ml-2 text-sm font-medium text-gray-300">
                {session.user.name || session.user.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-md text-sm transition-colors"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
