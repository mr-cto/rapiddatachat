"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Landing() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </main>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-900">
      <div className="bg-white/90 rounded-2xl shadow-2xl p-12 w-full max-w-xl text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          RapidDataChat
        </h1>
        <p className="text-lg text-gray-700 mb-8">
          Chat with your data, upload files, and get instant insights. Secure,
          fast, and built for modern teams.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block px-8 py-3 bg-blue-700 hover:bg-blue-800 text-white text-lg font-semibold rounded-lg shadow transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
