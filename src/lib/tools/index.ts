/**
 * Tool exports - combining all productivity analysis tools
 */

// Import individual tools
import { retrieveSessionLogs } from './retrieve-logs';
import { searchLogs } from './search-logs';
import { searchProductHunt } from './search-products';

// Export individual tools
export { retrieveSessionLogs } from './retrieve-logs';
export { searchLogs } from './search-logs';
export { searchProductHunt } from './search-products';

// Export all tools as a collection for use with generateText
export const productivityTools = {
  retrieveSessionLogs,
  searchLogs,
  searchProductHunt,
};