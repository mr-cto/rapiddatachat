import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { SchemaTransactionService } from "../../../../lib/schemaTransactionService";
import { GlobalSchemaService } from "../../../../lib/globalSchemaService";

/**
 * API handler for schema transaction operations
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

  // Use user email for compatibility with existing data
  // If email is not available, fall back to the user ID
  const userId = session.user.email || session.user.id || "";
  const schemaTransactionService = new SchemaTransactionService();
  const globalSchemaService = new GlobalSchemaService();

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetTransactions(req, res, schemaTransactionService);

      case "POST":
        return await handleBeginTransaction(
          req,
          res,
          userId,
          schemaTransactionService,
          globalSchemaService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-transactions API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for schema transactions
 */
async function handleGetTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
  schemaTransactionService: SchemaTransactionService
) {
  const { schemaId } = req.query;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  const transactions = await schemaTransactionService.getTransactionsForSchema(
    schemaId as string
  );

  return res.status(200).json({ transactions });
}

/**
 * Handle POST requests for beginning a transaction
 */
async function handleBeginTransaction(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  schemaTransactionService: SchemaTransactionService,
  globalSchemaService: GlobalSchemaService
) {
  const { schemaId, options } = req.body;

  if (!schemaId) {
    return res.status(400).json({ error: "Schema ID is required" });
  }

  // Check if the schema exists
  const schema = await globalSchemaService.getGlobalSchemaById(schemaId);

  if (!schema) {
    return res.status(404).json({ error: "Schema not found" });
  }

  // Check if the user owns the schema
  if (schema.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Begin the transaction
  const transaction = await schemaTransactionService.beginTransaction(
    schemaId,
    userId,
    options
  );

  return res.status(201).json({ transaction });
}
