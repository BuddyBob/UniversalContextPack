import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env.local")
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
if not url:
    load_dotenv(".env")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")

key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

pack_res = supabase.table("packs").select("*").limit(1).execute()
if pack_res.data:
    pack = pack_res.data[0]
    pack_id = pack["pack_id"]
    user_id = pack["user_id"]
    
    res = supabase.rpc("get_pack_details_v2", {
        "user_uuid": user_id,
        "target_pack_id": pack_id
    }).execute()
    
    print(json.dumps(res.data, indent=2))
