/**
 * Credit Configuration
 * ====================
 * Centralized configuration for credit system in frontend.
 * Change values here to update credits across the entire frontend.
 */

// Default credits for new users
// Change this value to update credits display across the frontend
export const DEFAULT_NEW_USER_CREDITS = 10;

// Credit costs (for future use)
export const CREDIT_COSTS = {
  analysisPerChunk: 1,
  extraction: 0, // Free
  chunking: 0,   // Free
} as const;

// Helper functions
export const getNewUserCredits = (): number => {
  return DEFAULT_NEW_USER_CREDITS;
};

export const getCreditCost = (operation: keyof typeof CREDIT_COSTS): number => {
  return CREDIT_COSTS[operation];
};

// Validation
if (DEFAULT_NEW_USER_CREDITS <= 0) {
  throw new Error('Default credits must be positive');
}

if (!Number.isInteger(DEFAULT_NEW_USER_CREDITS)) {
  throw new Error('Default credits must be an integer');
}