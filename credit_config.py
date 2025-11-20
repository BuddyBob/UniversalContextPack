"""
Credit Configuration
====================
Centralized configuration for credit system.
Change values here to update credits across the entire application.
"""

# Default credits for new users
# Change this value to update credits for all new registrations
DEFAULT_NEW_USER_CREDITS = 10

# Credit costs (for future use)
CREDIT_COSTS = {
    "analysis_per_chunk": 1,
    "extraction": 0,  # Free
    "chunking": 0,    # Free
}

# Validation
assert DEFAULT_NEW_USER_CREDITS > 0, "Default credits must be positive"
assert isinstance(DEFAULT_NEW_USER_CREDITS, int), "Default credits must be an integer"

def get_new_user_credits():
    """Get the default credits for new users."""
    return DEFAULT_NEW_USER_CREDITS

def get_credit_cost(operation: str):
    """Get the credit cost for a specific operation."""
    return CREDIT_COSTS.get(operation, 0)