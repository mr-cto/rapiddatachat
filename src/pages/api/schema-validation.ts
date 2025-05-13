import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  GlobalSchemaService,
  GlobalSchema,
} from "../../../lib/globalSchemaService";

/**
 * API handler for schema validation
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);

  // Require authentication for all requests
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get schema from request body
    const schema = req.body.schema as GlobalSchema;

    if (!schema) {
      return res.status(400).json({ error: "Schema is required" });
    }

    // Validate the schema
    const schemaService = new GlobalSchemaService();
    const validationResult = schemaService.validateSchema(schema);

    return res.status(200).json(validationResult);
  } catch (error) {
    console.error("Error in schema-validation API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
