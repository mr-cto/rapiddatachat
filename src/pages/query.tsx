import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";

const QueryPage = () => {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    // Wait until authentication check is complete
    if (status !== "loading") {
      // Redirect to the new dashboard layout
      router.replace("/");
    }
  }, [router, status]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to new dashboard...</p>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to sign in if not authenticated
  if (!session || !session.user) {
    return {
      redirect: {
        destination: "/auth/signin?callbackUrl=/",
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

export default QueryPage;
