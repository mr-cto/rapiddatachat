import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();

  // Redirect if user is already signed in
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/project");
    }
  }, [status, router]);

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check password strength
  const getPasswordStrength = (password: string) => {
    let strength = 0;

    // Length check
    if (password.length >= 8) strength += 1;

    // Contains number
    if (/\d/.test(password)) strength += 1;

    // Contains lowercase
    if (/[a-z]/.test(password)) strength += 1;

    // Contains uppercase
    if (/[A-Z]/.test(password)) strength += 1;

    // Contains special character
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    return strength;
  };

  // Get password strength message
  const getPasswordStrengthMessage = (strength: number) => {
    if (strength < 2) return "Very weak";
    if (strength < 3) return "Weak";
    if (strength < 4) return "Medium";
    if (strength < 5) return "Strong";
    return "Very strong";
  };

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Client-side validation
    if (!name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

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

    const passwordStrength = getPasswordStrength(password);
    if (passwordStrength < 3) {
      setError(
        "Password is too weak. Include uppercase, lowercase, numbers, and special characters."
      );
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
        // Handle specific error cases
        if (response.status === 409) {
          throw new Error(
            "Email already in use. Please use a different email or sign in."
          );
        } else if (response.status === 400) {
          throw new Error(
            data.message || "Invalid input. Please check your information."
          );
        } else {
          throw new Error(data.message || "Something went wrong");
        }
      }

      setSuccess(true);

      try {
        // Auto sign-in after successful registration
        const signInRes = await signIn("credentials", {
          redirect: true,
          email: email.toLowerCase(),
          password,
          callbackUrl: "/project",
        });

        // Note: The code below will only run if redirect is set to false
        if (signInRes?.error) {
          // Sign-in failed after successful registration
          setError(
            "Account created but sign-in failed. Please sign in manually."
          );
          setTimeout(() => {
            router.push("/auth/signin");
          }, 3000);
        } else {
          // Successful sign-in, redirect to projects page
          router.push("/project");
        }
      } catch (signInError) {
        // Handle sign-in error after successful registration
        setError(
          "Account created but sign-in failed. Please sign in manually."
        );
        setTimeout(() => {
          router.push("/auth/signin");
        }, 3000);
      }
    } catch (error: any) {
      setError(error.message || "Failed to create account");
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-white dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
          />
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
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-secondary text-white dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            required
          />
          <button
            type="submit"
            className="w-full bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-2 rounded-lg transition"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-lg text-center text-green-600 dark:text-green-400 font-medium">
            Account created successfully!
          </div>
        )}

        {password && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Password strength:
            <span
              className={`ml-1 font-medium ${
                getPasswordStrength(password) < 3
                  ? "text-red-500"
                  : getPasswordStrength(password) < 4
                  ? "text-yellow-500"
                  : "text-green-500"
              }`}
            >
              {getPasswordStrengthMessage(getPasswordStrength(password))}
            </span>
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
