/**
 * Utility functions for transaction processing and formatting.
 * @module utils
 */

/**
 * Parse a string amount (e.g., '1,234.56 USDC') to a float.
 * @param {string} str
 * @returns {number}
 */
export function parseAmount(str) {
  if (!str) return 0;
  // Remove currency suffix and commas, then parse
  return parseFloat(str.replace(/[^0-9.]/g, ''));
}

// Add more utility functions as needed and export them here. 