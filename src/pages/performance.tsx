import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import { PerformanceMonitoring } from "../../components/PerformanceMonitoring";

interface PerformancePageProps {
  user: {
    email: string;
    name?: string;
  };
}

/**
 * Performance monitoring page
 * @param props Component props
 * @returns JSX.Element
 */
export default function PerformancePage({ user }: PerformancePageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-black">
            Performance Monitoring
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor query execution performance and optimize for better user
            experience
          </p>
          {user && (
            <p className="mt-1 text-sm text-gray-500">
              Logged in as: {user.name || user.email}
            </p>
          )}
        </div>

        <PerformanceMonitoring />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to sign in if not authenticated
  if (!session || !session.user) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: {
        email: session.user.email || "",
        name: session.user.name || "",
      },
    },
  };
};
