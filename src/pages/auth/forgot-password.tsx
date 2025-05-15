import { useState } from "react";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess(true);
      setEmail("");
    } catch (error: any) {
      setError(error.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="bg-ui-primary dark:bg-ui-primary rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-white dark:text-white">
          Reset Password
        </h1>

        {!success ? (
          <>
            <p className="text-gray-400 mb-6 text-center">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
                required
              />
              <button
                type="submit"
                className="w-full bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold py-2 rounded-lg transition"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            {error && (
              <div className="mt-4 text-center text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}
          </>
        ) : (
          <div className="text-center">
            <div className="mb-4 text-green-600 dark:text-green-400 font-medium">
              If an account exists with that email, we've sent a password reset
              link.
            </div>
            <p className="text-gray-400 mb-4">
              Please check your email inbox and spam folder.
            </p>
          </div>
        )}

        <div className="mt-6 text-center text-gray-400">
          <Link
            href="/auth/signin"
            className="text-accent-primary hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
