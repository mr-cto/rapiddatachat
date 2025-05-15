import { useState } from "react";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { useRouter } from "next/router";
import Link from "next/link";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess(true);

      // Auto sign-in after successful registration
      await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      // Redirect to projects page
      router.push("/project");
    } catch (error: any) {
      setError(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/project" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="bg-ui-primary dark:bg-ui-primary rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-white dark:text-white">
          Create Account
        </h1>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-2 rounded-lg mb-4 transition"
          disabled={loading}
        >
          <FcGoogle className="w-5 h-5" />
          Sign up with Google
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

        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-black dark:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />
          <button
            type="submit"
            className="w-full bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold py-2 rounded-lg transition"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 text-center text-green-600 dark:text-green-400 font-medium">
            Account created successfully!
          </div>
        )}

        <div className="mt-6 text-center text-gray-400">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="text-accent-primary hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
