import { useRouter } from "next/router";
import Link from "next/link";

export default function ErrorPage() {
  const router = useRouter();
  const { error } = router.query;

  const errorMessages: Record<string, string> = {
    default: "An error occurred during authentication.",
    configuration: "There is a problem with the server configuration.",
    accessdenied: "You do not have access to this resource.",
    verification:
      "The verification link may have expired or has already been used.",
  };

  const errorMessage =
    error && typeof error === "string" && error in errorMessages
      ? errorMessages[error]
      : errorMessages.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="bg-ui-primary dark:bg-ui-primary rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center text-red-600 dark:text-red-400">
          Authentication Error
        </h1>
        <p className="text-secondary dark:text-secondary mb-6 text-center">
          {errorMessage}
        </p>
        <div className="flex justify-center">
          <Link href="/auth/signin">
            <span className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-lg transition">
              Back to Sign In
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
