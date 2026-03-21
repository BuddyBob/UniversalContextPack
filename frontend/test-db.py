import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env.local")
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    load_dotenv("../.env")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)
res = supabase.table("pack_sources").select("*").order("created_at", desc=True).limit(2).execute()
print(res.data)
