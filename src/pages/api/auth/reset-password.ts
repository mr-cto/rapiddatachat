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
    const { token, password } = req.body;

    // Validate required fields
    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    // Validate password strength
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    // Reset password
    const success = await userService.resetPassword(token, password);

    if (!success) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
