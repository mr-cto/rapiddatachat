import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../../../lib/database";
import { PrismaClient } from "@prisma/client";
import formidable, { File as FormidableFile } from "formidable";
import fs from "fs";
import {
  UPLOADS_DIR,
  ensureDirectoriesExist,
  generateUniqueFilename,
  uploadToCloudStorage,
  isVercelEnvironment,
} from "../../../lib/fileUtils";
import { ProjectService } from "../../../lib/project/projectService";
// Removed import for fileActivationSimple

// Disable the default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Ensure directories exist
ensureDirectoriesExist();

// Define allowed MIME types
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("=== API UPLOAD HANDLER START ===");
  console.log(`Request method: ${req.method}`);
  console.log(
    `Request headers:`,
    JSON.stringify({
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
      host: req.headers["host"],
      // Don't log authorization headers for security
    })
  );

  // Only allow POST requests
  if (req.method !== "POST") {
    console.log(`Method not allowed: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check authentication
  console.log("Checking authentication...");
  const session = await getServerSession(req, res, authOptions);
  console.log(`Session exists: ${!!session}`);
  console.log(`Session user exists: ${!!session?.user}`);

  // In development, allow requests without authentication for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  console.log(
    `Environment: ${process.env.NODE_ENV}, isDevelopment: ${isDevelopment}`
  );

  if ((!session || !session.user) && !isDevelopment) {
    console.log("Authentication failed: Unauthorized");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Use a default user email for development
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");
  console.log(`User email: ${userEmail}`);

  try {
    const userId = userEmail || "unknown";
    console.log(`User ID: ${userId}`);
    console.log("Initializing formidable...");
    console.log(
      `Upload directory: ${
        isVercelEnvironment ? "Vercel Blob Storage" : UPLOADS_DIR
      }`
    );

    // Configure formidable
    const formOptions: formidable.Options = {
      maxFiles: 5,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
      uploadDir: UPLOADS_DIR, // Use the UPLOADS_DIR which is now /tmp/uploads in Vercel
      filter: (part) => {
        // Only accept CSV and Excel files
        if (part.mimetype) {
          return ALLOWED_MIME_TYPES.includes(part.mimetype);
        }
        return false;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formOptions.filename = (name, ext, _) => {
      return generateUniqueFilename(name + ext);
    };

    const form = formidable(formOptions);

    // Parse the form data
    console.log("Parsing form data...");
    const [fields, files] = await form.parse(req);
    console.log(`Form fields: ${JSON.stringify(fields)}`);
    console.log(`Files received: ${files.file ? files.file.length : 0}`);

    // Check if files were uploaded
    if (!files.file || files.file.length === 0) {
      console.log("Error: No files uploaded");
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Get the project ID from the form data or query parameters
    let projectId = Array.isArray(fields.projectId)
      ? fields.projectId[0]
      : fields.projectId;

    // If projectId is not in form data, check query parameters
    if (!projectId && req.query.projectId) {
      projectId = Array.isArray(req.query.projectId)
        ? req.query.projectId[0]
        : req.query.projectId;
    }

    console.log(
      `Project ID: ${projectId || "none"} (source: ${
        projectId ? (fields.projectId ? "form data" : "query params") : "none"
      })`
    );

    // If projectId is provided, check if the project exists and belongs to the user
    if (projectId) {
      console.log(`Validating project ID: ${projectId}`);
      const projectService = new ProjectService();
      const project = await projectService.getProjectById(projectId);
      console.log(`Project found: ${!!project}`);

      if (!project) {
        console.log(`Error: Project not found with ID ${projectId}`);
        return res.status(404).json({ error: "Project not found" });
      }

      console.log(`Project user ID: ${project.userId}`);
      console.log(`Current user ID: ${userId}`);
      console.log(`Project belongs to user: ${project.userId === userId}`);

      if (project.userId !== userId) {
        console.log(
          `Error: Forbidden - Project ${projectId} belongs to user ${project.userId}, not ${userId}`
        );
        return res.status(403).json({ error: "Forbidden" });
      }
      console.log("Project validation successful");
    }

    // Process each file
    console.log("Processing uploaded files...");
    const fileResults = await Promise.all(
      files.file.map(async (file: FormidableFile) => {
        const fileId = uuidv4();
        const sourceId = uuidv4();
        const originalFilename = file.originalFilename || "unknown";
        const format = originalFilename.split(".").pop() || "";
        console.log(`Processing file: ${originalFilename}, ID: ${fileId}`);

        // Handle file storage based on environment
        let filePath = file.filepath;

        try {
          if (isVercelEnvironment) {
            console.log(
              `Processing file in Vercel environment: ${file.filepath}`
            );

            // Check if file exists
            if (!fs.existsSync(file.filepath)) {
              console.error(`File does not exist at path: ${file.filepath}`);
              throw new Error(`File not found at ${file.filepath}`);
            }

            // Read the file content
            console.log(`Reading file content from: ${file.filepath}`);
            const fileContent = fs.readFileSync(file.filepath);
            console.log(
              `File content read successfully, size: ${fileContent.length} bytes`
            );

            // Generate a unique filename
            const uniqueFilename = generateUniqueFilename(originalFilename);
            console.log(`Generated unique filename: ${uniqueFilename}`);

            // Upload to cloud storage or /tmp
            filePath = await uploadToCloudStorage(fileContent, uniqueFilename);
            console.log(`File stored at: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`Error processing file in Vercel:`, fileError);
          console.log(
            `File error details: ${
              fileError instanceof Error ? fileError.message : "Unknown"
            }`
          );
          console.log(
            `File error stack: ${
              fileError instanceof Error ? fileError.stack : "No stack trace"
            }`
          );

          // Continue with the original filepath
          console.log(`Continuing with original filepath: ${file.filepath}`);
        }

        console.log(`File path: ${filePath}`);
        console.log(`File size: ${file.size} bytes, format: ${format}`);
        // Get mime type but don't use it yet - will be used in future features
        // const mimeType = getMimeTypeFromExtension(originalFilename) || "";

        let dbOperationSuccess = true;

        try {
          // Store file metadata in the database
          console.log(
            `Storing file metadata in database for file ID: ${fileId}`
          );
          await executeQuery(`
            INSERT INTO files (
              id, user_id, filename, status, uploaded_at, size_bytes, format, filepath
            ) VALUES (
              '${fileId}',
              '${userId}',
              '${originalFilename.replace(/'/g, "''")}',
              'pending',
              CURRENT_TIMESTAMP,
              ${file.size},
              '${format}',
              '${filePath.replace(/'/g, "''")}'
            )
          `);

          // Store source information
          await executeQuery(`
            INSERT INTO sources (
              id, user_id, name, created_at, file_id
            ) VALUES (
              '${sourceId}',
              '${userId}',
              '${originalFilename.replace(/'/g, "''")}',
              CURRENT_TIMESTAMP,
              '${fileId}'
            )
          `);

          // If projectId is provided, associate the file with the project
          if (projectId) {
            console.log(`Associating file ${fileId} with project ${projectId}`);

            // Update the file's projectId field directly
            const prismaClient = new PrismaClient();
            await prismaClient.file.update({
              where: { id: fileId },
              data: { projectId },
            });
            console.log(`Updated file's projectId field to ${projectId}`);

            // Also add to the project_files join table
            const projectService = new ProjectService();
            await projectService.addFileToProject(projectId, fileId);
            console.log(
              `File successfully associated with project in join table`
            );
          }
        } catch (dbError) {
          // Check if this is a DuckDB server environment error
          if (
            dbError instanceof Error &&
            (dbError.message.includes(
              "DuckDB is only available in browser environments"
            ) ||
              dbError.message.includes("Worker is not defined") ||
              dbError.message ===
                "DuckDB is not available in server environments")
          ) {
            console.warn(
              "DuckDB operations skipped (server environment): Continuing with file upload without database operations"
            );
            console.warn(
              "Please make sure PostgreSQL is running. See README.md for setup instructions."
            );
          } else {
            console.error("DuckDB operations failed:", dbError);
          }
          dbOperationSuccess = false;
        }

        // Return file information
        console.log(`File processing complete for ${fileId}`);
        return {
          id: fileId,
          name: originalFilename,
          size: file.size,
          status: "pending",
          format,
          path: filePath,
          dbOperationSuccess,
          projectId: projectId || null,
        };
      })
    );

    // Check if any database operations failed
    const anyDbOperationFailed = fileResults.some(
      (file: any) => !file.dbOperationSuccess
    );
    console.log(`Any database operations failed: ${anyDbOperationFailed}`);

    // Return success response with file information
    const response = {
      success: true,
      files: fileResults.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        status: file.status,
        format: file.format,
        projectId: file.projectId,
      })),
      message: anyDbOperationFailed
        ? "Files uploaded successfully, but database operations were skipped. The application may have limited functionality."
        : "Files uploaded successfully. Ingestion process started.",
      dbOperationsSkipped: anyDbOperationFailed,
    };

    console.log(`Sending success response: ${JSON.stringify(response)}`);
    // Send the response
    res.status(200).json(response);

    // Process files asynchronously
    console.log("Starting asynchronous file processing...");
    processFilesAsync(fileResults, req.headers.cookie || "", userId);

    // Note: Files uploaded to Vercel Blob will be automatically deleted after successful ingestion

    console.log("=== API UPLOAD HANDLER COMPLETE ===");
    return;
  } catch (error) {
    console.error("File upload error:", error);
    console.log(
      `Error type: ${
        error instanceof Error ? error.constructor.name : "Unknown"
      }`
    );
    console.log(
      `Error message: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    console.log(
      `Error stack: ${error instanceof Error ? error.stack : "No stack trace"}`
    );
    return res.status(500).json({
      error: "Failed to upload files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Process files asynchronously (ingest and auto-activate)
 * @param files Array of file information
 * @param cookie Cookie header for authentication
 * @param userIdFromUpload User ID from the upload context
 */
async function processFilesAsync(
  files: Array<{
    id: string;
    name: string;
    size: number;
    status: string;
    format: string;
    path: string;
    dbOperationSuccess: boolean;
    projectId: string | null;
  }>,
  cookie: string,
  userIdFromUpload: string
): Promise<void> {
  console.log("=== ASYNC FILE PROCESSING START ===");
  console.log(`Processing ${files.length} files asynchronously`);
  console.log(`User ID: ${userIdFromUpload}`);
  console.log(`Cookie present: ${!!cookie}`);

  // Process each file
  for (const file of files) {
    try {
      console.log(`Processing file ${file.id} (${file.name})`);
      console.log(`File path: ${file.path}`);
      console.log(`Project ID: ${file.projectId || "none"}`);

      // Wait a short delay to ensure the file is saved to disk
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(`Starting ingestion for file ${file.id}`);
      console.log(
        `Ingestion URL: ${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/api/ingest-file`
      );

      // Call the ingest-file API endpoint
      console.log(
        `Ingestion request payload: ${JSON.stringify({
          fileId: file.id,
          projectId: file.projectId,
        })}`
      );

      const ingestResponse = await fetch(
        `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/api/ingest-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Pass the session cookie for authentication
            Cookie: cookie,
          },
          body: JSON.stringify({
            fileId: file.id,
            projectId: file.projectId,
          }),
        }
      );

      console.log(`Ingestion response status: ${ingestResponse.status}`);
      console.log(
        `Ingestion response status text: ${ingestResponse.statusText}`
      );

      if (!ingestResponse.ok) {
        console.log(`Ingestion failed for file ${file.id}`);
        try {
          // Try to parse as JSON first
          const contentType = ingestResponse.headers.get("content-type");
          console.log(`Response content type: ${contentType}`);

          if (contentType && contentType.includes("application/json")) {
            const errorData = await ingestResponse.json();
            console.error(`Error ingesting file ${file.id}:`, errorData);
            console.log(`JSON error details: ${JSON.stringify(errorData)}`);
          } else {
            // If not JSON, get the text response
            const errorText = await ingestResponse.text();
            console.error(
              `Error ingesting file ${file.id}: Non-JSON response:`,
              errorText.substring(0, 200) +
                (errorText.length > 200 ? "..." : "")
            );
            console.log(`Full error text: ${errorText}`);
          }
        } catch (parseError) {
          console.error(
            `Error parsing error response for file ${file.id}:`,
            parseError
          );
          console.log(
            `Parse error details: ${
              parseError instanceof Error ? parseError.message : "Unknown"
            }`
          );
        }
        continue;
      }

      console.log(`Successfully ingested file ${file.id}`);

      // After successful ingestion, automatically activate the file
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`Attempting to auto-activate file ${file.id}`);

      try {
        // Auto-activate the file directly
        const activationQuery = `UPDATE files SET status = 'active' WHERE id = '${file.id}'`;
        console.log(`Executing activation query: ${activationQuery}`);

        await executeQuery(activationQuery);
        console.log(`Successfully auto-activated file ${file.id}`);
      } catch (activationError) {
        console.error(
          `Error auto-activating file ${file.id}:`,
          activationError
        );
        console.log(
          `Activation error details: ${
            activationError instanceof Error
              ? activationError.message
              : "Unknown"
          }`
        );
        console.log(
          `Activation error stack: ${
            activationError instanceof Error
              ? activationError.stack
              : "No stack trace"
          }`
        );
      }
    } catch (error) {
      console.error(`Error processing file ${file.id}:`, error);
      console.log(
        `Processing error details: ${
          error instanceof Error ? error.message : "Unknown"
        }`
      );
      console.log(
        `Processing error stack: ${
          error instanceof Error ? error.stack : "No stack trace"
        }`
      );
    }
  }
  console.log("=== ASYNC FILE PROCESSING COMPLETE ===");
}
