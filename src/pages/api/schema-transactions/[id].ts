import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { SchemaTransactionService } from "../../../../lib/schemaTransactionService";
import { GlobalSchemaService } from "../../../../lib/globalSchemaService";
import { authOptions } from "../../../../lib/authOptions";

/**
 * API handler for operations on a specific schema transaction
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
    // Get the transaction ID from the URL
    const { id: transactionId } = req.query;

    if (!transactionId || typeof transactionId !== "string") {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleGetTransaction(
          req,
          res,
          transactionId,
          schemaTransactionService
        );

      case "POST":
        return await handleTransactionOperation(
          req,
          res,
          transactionId,
          userId,
          schemaTransactionService
        );

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in schema-transactions/[id] API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET requests for a specific transaction
 */
async function handleGetTransaction(
  req: NextApiRequest,
  res: NextApiResponse,
  transactionId: string,
  schemaTransactionService: SchemaTransactionService
) {
  const transaction = await schemaTransactionService.getTransaction(
    transactionId
  );

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.status(200).json({ transaction });
}

/**
 * Handle POST requests for transaction operations
 */
async function handleTransactionOperation(
  req: NextApiRequest,
  res: NextApiResponse,
  transactionId: string,
  userId: string,
  schemaTransactionService: SchemaTransactionService
) {
  const { operation, type, target, params } = req.body;

  if (!operation) {
    return res.status(400).json({ error: "Operation is required" });
  }

  // Get the transaction
  const transaction = await schemaTransactionService.getTransaction(
    transactionId
  );

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  // Check if the user owns the transaction
  if (transaction.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Handle different operations
  switch (operation) {
    case "add_operation":
      if (!type || !target) {
        return res.status(400).json({
          error: "Operation type and target are required",
        });
      }

      const updatedTransaction = await schemaTransactionService.addOperation(
        transactionId,
        {
          type: type as
            | "add_column"
            | "remove_column"
            | "modify_column"
            | "update_schema",
          target,
          params: params || {},
        }
      );

      return res.status(200).json({ transaction: updatedTransaction });

    case "commit":
      const commitResult = await schemaTransactionService.commitTransaction(
        transactionId
      );

      return res.status(200).json(commitResult);

    case "rollback":
      const rollbackResult = await schemaTransactionService.rollbackTransaction(
        transactionId
      );

      return res.status(200).json(rollbackResult);

    default:
      return res.status(400).json({ error: "Invalid operation" });
  }
}
