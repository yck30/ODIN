import os
from dotenv import load_dotenv

# Try to load local .env if present (for local non-streamlit testing)
load_dotenv()

# We will read from Streamlit secrets in the app, but for raw python scripts, this works.
GEMINI_MODEL = "gemini-1.5-flash"

def get_api_key():
    import streamlit as st
    try:
        # First try Streamlit secrets
        return st.secrets["GEMINI_API_KEY"]
    except Exception:
        # Fallback to environment variable
        return os.environ.get("GEMINI_API_KEY")
