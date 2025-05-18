import { hash, compare } from "bcryptjs";
import crypto from "crypto";

// Mock user storage (in-memory for development)
interface MockUser {
  id: string;
  name?: string;
  email: string;
  password: string;
  emailVerified?: Date;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
}

export interface UserCreateInput {
  name?: string;
  email: string;
  password: string;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  password?: string;
}

class UserService {
  private users: MockUser[] = [];

  constructor() {
    // Add a test user
    this.createUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
  }

  /**
   * Create a new user
   * @param data User data
   * @returns Created user (without password)
   */
  async createUser(data: UserCreateInput) {
    try {
      // Validate input data
      if (!data.email || typeof data.email !== "string") {
        throw new Error("Valid email is required");
      }

      if (!data.password || typeof data.password !== "string") {
        throw new Error("Valid password is required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error("Invalid email format");
      }

      // Check if user already exists
      const existingUser = this.users.find(
        (user) => user.email.toLowerCase() === data.email.toLowerCase()
      );
      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      // Validate password strength
      if (data.password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      // Hash the password
      const hashedPassword = await hash(data.password, 12);

      // Create the user
      const user: MockUser = {
        id: crypto.randomUUID(),
        name: data.name?.trim() || undefined,
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.push(user);

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Find a user by email
   * @param email User email
   * @returns User or null if not found
   */
  async findUserByEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    return (
      this.users.find((user) => user.email === normalizedEmail) || null
    );
  }

  /**
   * Find a user by ID
   * @param id User ID
   * @returns User or null if not found
   */
  async findUserById(id: string) {
    return this.users.find((user) => user.id === id) || null;
  }

  /**
   * Validate user credentials
   * @param email User email
   * @param password User password
   * @returns User if credentials are valid, null otherwise
   */
  async validateCredentials(email: string, password: string) {
    try {
      // Validate inputs
      if (!email || typeof email !== "string") {
        throw new Error("Invalid email format");
      }

      if (!password || typeof password !== "string") {
        throw new Error("Invalid password format");
      }

      const user = await this.findUserByEmail(email);
      if (!user) {
        // Use a generic error message to avoid revealing which part of the credentials is incorrect
        // This helps prevent user enumeration attacks
        console.log(`Login attempt failed: User with email ${email} not found`);
        return null;
      }

      const isValid = await compare(password, user.password);
      if (!isValid) {
        console.log(`Login attempt failed: Invalid password for user ${email}`);
        return null;
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error("Error validating credentials:", error);
      return null;
    }
  }

  /**
   * Generate a password reset token
   * @param email User email
   * @returns Reset token or null if user not found
   */
  async generatePasswordResetToken(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;

    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set token expiration (1 hour from now)
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1);

    // Save token to user
    user.resetToken = resetToken;
    user.resetTokenExpires = resetTokenExpires;
    user.updatedAt = new Date();

    return resetToken;
  }

  /**
   * Reset password using token
   * @param token Reset token
   * @param newPassword New password
   * @returns True if password was reset, false otherwise
   */
  async resetPassword(token: string, newPassword: string) {
    // Find user with this token
    const user = this.users.find(
      (u) =>
        u.resetToken === token &&
        u.resetTokenExpires &&
        u.resetTokenExpires > new Date()
    );

    if (!user) return false;

    // Hash the new password
    const hashedPassword = await hash(newPassword, 12);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    user.updatedAt = new Date();

    return true;
  }
}

export const userService = new UserService();
