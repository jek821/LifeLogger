import os

USERNAME = os.environ.get("TIMELOGGER_USER")
PASSWORD = os.environ.get("TIMELOGGER_PASS")

if not USERNAME or not PASSWORD:
    raise RuntimeError("TIMELOGGER_USER and TIMELOGGER_PASS environment variables must be set before starting the server.")
