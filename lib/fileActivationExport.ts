/**
 * This file provides a compatibility layer to export the activateFile function
 * from the appropriate module based on the current configuration.
 */

import { activateFile as activateFileCompat } from "./fileActivationCompat";

// Export the activateFile function from the compatibility module
export const activateFile = activateFileCompat;

// Export other functions that might be needed
export { activateAvailableFiles } from "./fileActivationCompat";
