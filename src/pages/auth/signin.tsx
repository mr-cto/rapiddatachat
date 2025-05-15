import { useState } from "react";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      redirect: true,
      email,
      password,
      callbackUrl: "/project",
    });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    // NextAuth redirect callback will handle redirection
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/project" });
    // NextAuth redirect callback will handle redirection
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
        <form onSubmit={handleEmailSignIn} className="space-y-4">
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
          <button
            type="submit"
            className="w-full bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold py-2 rounded-lg transition"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Email"}
          </button>
        </form>
        {error && (
          <div className="mt-4 text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
