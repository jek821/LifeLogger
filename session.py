# Session management is handled in main.py via the sessions table.
# This module is kept for compatibility but is no longer used directly.
from main import create_session, validate_session, clear_session

__all__ = ["create_session", "validate_session", "clear_session"]
