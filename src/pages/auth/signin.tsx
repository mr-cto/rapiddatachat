import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import { useRouter } from "next/router";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle URL error parameters
  useEffect(() => {
    // Check for error in URL query parameters
    const { error: errorType } = router.query;

    if (errorType) {
      switch (errorType) {
        case "CredentialsSignin":
          setError("Invalid email or password");
          break;
        case "OAuthAccountNotLinked":
          setError("Email already used with a different provider");
          break;
        case "OAuthSignin":
        case "OAuthCallback":
          setError("Error signing in with social provider");
          break;
        case "SessionRequired":
          setError("You must be signed in to access this page");
          break;
        default:
          setError("An error occurred during sign in");
          break;
      }
    }
  }, [router.query]);

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/project",
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else if (res?.url) {
        // Manually redirect on success
        router.push(res.url);
      }
    } catch (err) {
      setError("Network error. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/project" });
    } catch (err) {
      setError("Failed to connect to Google. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="bg-ui-primary dark:bg-ui-primary rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-white dark:text-white">
          Sign In
        </h1>
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-2 rounded-lg mb-4 transition"
          disabled={loading}
        >
          <FcGoogle className="w-5 h-5" />
          Sign in with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-ui-primary text-gray-400">
              Or with email
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-white dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-white dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />

          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-accent-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-accent-secondary-hover text-white hover:cursor-pointer font-semibold py-2 rounded-lg transition"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Email"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-gray-400">
          Don't have an account?{" "}
          <Link
            href="/auth/signup"
            className="text-accent-primary hover:underline"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
