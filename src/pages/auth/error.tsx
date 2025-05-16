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
    CredentialsSignin: "Invalid email or password. Please try again.",
    OAuthAccountNotLinked:
      "This email is already associated with a different sign-in method.",
    OAuthSignin: "Error signing in with social provider. Please try again.",
    OAuthCallback:
      "Error processing the authentication callback. Please try again.",
    SessionRequired: "You must be signed in to access this page.",
    Callback: "Error processing the authentication callback. Please try again.",
    OAuthCreateAccount:
      "Error creating account with social provider. Please try again.",
    EmailCreateAccount: "Error creating account with email. Please try again.",
    EmailSignin: "Error signing in with email. Please try again.",
    AccountNotLinked:
      "This account is not linked to any user. Please sign up first.",
  };

  // Get error message with fallback to default
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

        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg mb-6">
          <p className="text-red-700 dark:text-red-400 text-center">
            {errorMessage}
          </p>
          {error === "OAuthAccountNotLinked" && (
            <p className="text-sm mt-2 text-red-600 dark:text-red-300 text-center">
              Try signing in with the method you used previously.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/auth/signin">
            <span className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-lg transition text-center block">
              Back to Sign In
            </span>
          </Link>

          {(error === "CredentialsSignin" || error === "EmailSignin") && (
            <Link href="/auth/forgot-password">
              <span className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition text-center block">
                Forgot Password?
              </span>
            </Link>
          )}

          {error === "AccountNotLinked" && (
            <Link href="/auth/signup">
              <span className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition text-center block">
                Create Account
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
