import os
import sys
import argparse
import base64
import json
import requests
from io import BytesIO
from PIL import Image
from google import genai
from google.genai import types

# --------------------------------------------------------------------------
# Configuration and CONSTANTS
# --------------------------------------------------------------------------
SUPABASE_URL = "https://qqljadcpxsubawmzkecl.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_T8G6w3OtwXRG_cXd_-h9YQ_s8U9iDnx"
GUILD_WRITE_KEY = "BCU5C-reDUecvjLm4tV6QkGVvTGbX-Uyuyz5Xtpml5A"

DEFAULT_API_KEY = base64.b64decode("QVEuQWI4Uk42S05kWjJxTVBGbm9IamVQTjdKMlluUlpIbnRfdG9XOFk3VFJ4TUYtdlBpMHc=").decode("utf-8")

# List of official Gemini models capable of native image generation (Nano Banana series)
IMAGE_MODELS = [
    "gemini-3.1-flash-image",      # Nano Banana 2 (Primary)
    "gemini-3-pro-image",          # Nano Banana Pro
    "gemini-2.5-flash-image",      # Nano Banana 1
]

def get_supabase_headers():
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }

# --------------------------------------------------------------------------
# 1. Multi-modal portrait generation pipeline
# --------------------------------------------------------------------------
def generate_guild_hall_portrait(
    player_id: str, 
    reference_image_path: str, 
    admin_likeness_prompt: str, 
    pob_gear_summary: str,
    api_key: str
) -> str:
    """
    Ingests a player's physical face reference photo, custom admin overrides,
    and active Path of Building equipment data to output a tailored gothic portrait.
    Uses progressive fallbacks between Gemini native image generation models.
    """
    # Initialize the unified client using the configured AI Studio key
    client = genai.Client(api_key=api_key)
    
    # Open the backend-uploaded player reference image
    if not os.path.exists(reference_image_path):
        raise FileNotFoundError(f"Missing reference photo for player: {player_id}")
    
    user_face_img = Image.open(reference_image_path)
    
    # Construct the core style anchor prompt, embedding the PoB and Admin context
    system_style_anchor = (
        "You are an elite dark-fantasy character artist. Generate a high-fidelity, "
        "oil painting portrait in an ornate Victorian gothic style designed to fit a vertical gold frame. "
        "Maintain the exact facial structure, likeness, expressions, and distinguishing features (like glasses) "
        "from the provided reference photo, but completely transform their attire and setting.\n\n"
        f"CRITICAL OVERRIDES: {admin_likeness_prompt}\n\n"
        f"EQUIPPED ITEM DETAILS (Incorporate these armor bases and visual themes): {pob_gear_summary}\n\n"
        "Ensure the lighting is dramatic, atmospheric, and matches a medieval castle room layout."
    )
    
    # Progressive model loop to handle different access tiers
    last_err = None
    for model_name in IMAGE_MODELS:
        print(f"🧬 Sending multi-modal payload to {model_name} for player: {player_id}...")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    user_face_img,      # The PIL Image reference anchor
                    system_style_anchor # The combined steering text instructions
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"]
                )
            )
            
            # Extract the inline binary data from the response candidates
            for part in response.parts:
                if part.inline_data is not None:
                    generated_portrait = part.as_image()
                    
                    # Save the final image to a specific directory
                    output_dir = "web/assets/portraits"
                    os.makedirs(output_dir, exist_ok=True)
                    
                    final_path = os.path.join(output_dir, f"{player_id}_room_portrait.png")
                    generated_portrait.save(final_path)
                    
                    print(f"🎨 Success! Custom portrait generated via {model_name} and saved to: {final_path}")
                    return final_path
            
            print(f"⚠️ Model {model_name} did not return inline binary image data.")
        except Exception as e:
            print(f"❌ Generation failed for {model_name}: {e}")
            last_err = e
            
    # Raise error if all models fail
    raise RuntimeError(
        f"Gemini native image generation failed for {player_id}. "
        f"Last error: {last_err}. Check your API Key billing status or level of access."
    )

# --------------------------------------------------------------------------
# 2. Main Ingestion, Syncing, and Ingestion Sequence
# --------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Guild Chambers Profile Image Generation Backend (V3.7)")
    parser.add_argument("--player", type=str, required=True, help="Player ID to generate portrait for (e.g. radiocommander, creg)")
    parser.add_argument("--key", type=str, default=None, help="Optional Gemini API Key overwrite")
    args = parser.parse_args()

    # Determine API key
    api_key = args.key or os.environ.get("GEMINI_API_KEY") or DEFAULT_API_KEY
    player_id = args.player.lower().strip()

    print(f"🏰 Connecting to Guild Vault Supabase Backend...")
    supabase_headers = get_supabase_headers()
    
    # 1. Fetch Admin Configuration
    print("📥 Downloading active __GUILD_ADMIN_CONFIG__ row...")
    config_url = f"{SUPABASE_URL}/rest/v1/poe2_guild_vault?name=eq.__GUILD_ADMIN_CONFIG__&select=*"
    res = requests.get(config_url, headers=supabase_headers)
    if not res.ok:
        print(f"Error fetching admin config: {res.status_code} {res.reason}")
        sys.exit(1)
        
    config_rows = res.json()
    if not config_rows or len(config_rows) == 0:
        print("Error: No admin configurations exist in the database.")
        sys.exit(1)
        
    admin_config = config_rows[0].get("data", {})
    player_config = admin_config.get(player_id)
    if not player_config:
        print(f"Error: Player config '{player_id}' not found in __GUILD_ADMIN_CONFIG__.")
        print(f"Available exiles: {list(admin_config.keys())}")
        sys.exit(1)

    # 2. Extract reference image and prompt overrides
    ref_image_base64 = player_config.get("reference_image", "")
    admin_prompt = player_config.get("portrait_prompt", "A Path of Exile adventurer")
    
    if not ref_image_base64:
        print(f"⚠️ Warning: No reference face image uploaded for player '{player_id}'.")
        print("Please upload a likeness reference image inside the Admin Console dashboard first!")
        sys.exit(1)

    # 3. Fetch equipped gear slots to build POB context
    print(f"📥 Loading equipped gear slots for '{player_id}'...")
    gear_row_name = f"ITEM_PERS_{player_id}_CHAR_GEAR"
    gear_url = f"{SUPABASE_URL}/rest/v1/poe2_guild_vault?name=eq.{gear_row_name}&select=*"
    gear_res = requests.get(gear_url, headers=supabase_headers)
    
    gear_data = {}
    if gear_res.ok:
        gear_rows = gear_res.json()
        if gear_rows and len(gear_rows) > 0:
            gear_data = gear_rows[0].get("data", {})
            
    gear_parts = []
    if gear_data.get("helm"):
        gear_parts.append(f"wearing helmet: {gear_data['helm'].get('base') or gear_data['helm'].get('name')}")
    if gear_data.get("body"):
        gear_parts.append(f"wearing body armor: {gear_data['body'].get('base') or gear_data['body'].get('name')}")
    if gear_data.get("weapon1"):
        gear_parts.append(f"wielding weapon: {gear_data['weapon1'].get('base') or gear_data['weapon1'].get('name')}")
    if gear_data.get("gloves"):
        gear_parts.append(f"wearing gloves: {gear_data['gloves'].get('base') or gear_data['gloves'].get('name')}")
        
    pob_gear_summary = ", ".join(gear_parts) or "traditional robes"
    print(f"🗡️ Equipped POB Context: {pob_gear_summary}")

    # 4. Save base64 face reference to local file
    temp_dir = "scratch/temp_references"
    os.makedirs(temp_dir, exist_ok=True)
    temp_ref_path = os.path.join(temp_dir, f"{player_id}_ref.jpg")
    
    # Decode reference photo
    try:
        clean_b64 = ref_image_base64.split(",")[-1]
        with open(temp_ref_path, "wb") as fh:
            fh.write(base64.b64decode(clean_b64))
        print(f"💾 Saved face reference locally to: {temp_ref_path}")
    except Exception as e:
        print(f"Error decoding reference photo: {e}")
        sys.exit(1)

    # 5. Call generation function
    try:
        portrait_local_path = generate_guild_hall_portrait(
            player_id=player_id,
            reference_image_path=temp_ref_path,
            admin_likeness_prompt=admin_prompt,
            pob_gear_summary=pob_gear_summary,
            api_key=api_key
        )
    except Exception as e:
        print(f"❌ Portrait generation aborted: {e}")
        sys.exit(1)

    # 6. Convert generated image to base64 data URL and sync to Supabase
    print("📤 Synchronizing new portrait back to Supabase __GUILD_PORTRAITS__ row...")
    try:
        # Load existing portraits row
        portraits_url = f"{SUPABASE_URL}/rest/v1/poe2_guild_vault?name=eq.__GUILD_PORTRAITS__&select=*"
        p_res = requests.get(portraits_url, headers=supabase_headers)
        
        all_portraits = {}
        if p_res.ok:
            p_rows = p_res.json()
            if p_rows and len(p_rows) > 0:
                all_portraits = p_rows[0].get("data", {})

        # Encode new image to base64
        with open(portrait_local_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        data_url = f"data:image/png;base64,{encoded_string}"
        
        # Update specific player
        all_portraits[player_id] = data_url
        
        # Post back to Supabase
        rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/sync_vault_item"
        sync_payload = {
            "p_name": "__GUILD_PORTRAITS__",
            "p_data": all_portraits,
            "p_write_key": GUILD_WRITE_KEY
        }
        
        sync_res = requests.post(rpc_url, headers=supabase_headers, json=sync_payload)
        if sync_res.ok:
            print("🎉 Success! The generated portrait is fully uploaded and synchronized to your stash storage framework.")
            print(f"🚪 Go to: room.html?user={player_id} to view your tailored gold-framed portrait!")
        else:
            print(f"❌ Failed to sync to Supabase: {sync_res.status_code} {sync_res.text}")
    except Exception as e:
        print(f"Error synchronizing with Supabase: {e}")

if __name__ == "__main__":
    main()
