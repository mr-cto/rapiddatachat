import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Get token from URL query parameter
    if (router.isReady) {
      const { token } = router.query;
      if (token && typeof token === "string") {
        setToken(token);
      } else {
        setError("Invalid or missing reset token");
      }
    }
  }, [router.isReady, router.query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess(true);

      // Clear form
      setPassword("");
      setConfirmPassword("");

      // Redirect to sign in page after 3 seconds
      setTimeout(() => {
        router.push("/auth/signin");
      }, 3000);
    } catch (error: any) {
      setError(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="bg-ui-primary dark:bg-ui-primary rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-white dark:text-white">
          Reset Your Password
        </h1>

        {!token && !success ? (
          <div className="text-center text-red-600 dark:text-red-400">
            Invalid or missing reset token. Please check your reset link.
          </div>
        ) : success ? (
          <div className="text-center">
            <div className="mb-4 text-green-600 dark:text-green-400 font-medium">
              Your password has been reset successfully!
            </div>
            <p className="text-gray-400 mb-4">
              You will be redirected to the sign in page shortly.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 mb-6 text-center">
              Please enter your new password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New Password"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
                required
              />
              <button
                type="submit"
                className="w-full bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold py-2 rounded-lg transition"
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            {error && (
              <div className="mt-4 text-center text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}
          </>
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
