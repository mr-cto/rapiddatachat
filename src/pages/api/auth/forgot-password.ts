import type { NextApiRequest, NextApiResponse } from "next";
import { userService } from "../../../../lib/user/userService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Generate reset token
    const resetToken = await userService.generatePasswordResetToken(email);

    // If no user found with this email, still return success for security reasons
    if (!resetToken) {
      return res.status(200).json({
        message:
          "If an account exists with that email, a reset link has been sent",
      });
    }

    // In a real application, you would send an email with the reset link
    // For this example, we'll just log it to the console
    const resetLink = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/auth/reset-password?token=${resetToken}`;
    console.log(`Password reset link for ${email}: ${resetLink}`);

    // TODO: Send actual email with reset link
    // Example: await sendEmail(email, "Password Reset", `Click here to reset your password: ${resetLink}`);

    return res.status(200).json({
      message:
        "If an account exists with that email, a reset link has been sent",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
