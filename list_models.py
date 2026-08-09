import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
try:
    import toml
    with open(".streamlit/secrets.toml", "r") as f:
        secrets = toml.load(f)
        api_key = secrets.get("GEMINI_API_KEY")
except Exception:
    api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

try:
    for m in client.models.list():
        if "flash" in m.name.lower():
            print(f"Model Name: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
