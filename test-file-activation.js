const { activateFile } = require("./lib/fileActivationCompat.js");

async function testActivateFile() {
  try {
    console.log("Testing activateFile function...");

    // Test with a sample file ID and user ID
    const fileId = "1ef6c2a0-a3ff-4a9d-bb49-2353a56021b9";
    const userId = "t@mrcto.ai";

    console.log(`Activating file ${fileId} for user ${userId}...`);
    const result = await activateFile(fileId, userId);

    console.log("Result:", result);
  } catch (error) {
    console.error("Error testing activateFile:", error);
  }
}

testActivateFile();
