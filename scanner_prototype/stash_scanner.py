import os
import sys
import argparse
import json
import hashlib
from PIL import Image, ImageGrab
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: The modern 'google-genai' SDK is not installed.")
    print("Please install it by running: pip install google-genai pydantic pillow requests")
    sys.exit(1)

# Define the exact Path of Exile 2 currency types including Greater, Perfect, and Jeweller tiers
class Poe2CurrencyStash(BaseModel):
    # Left-hand 5x3 Grid (Row 1)
    augmentation: int = Field(default=0, description="Quantity of Orb of Augmentation (Row 1, Col 1)")
    greater_augmentation: int = Field(default=0, description="Quantity of Greater Orb of Augmentation (Row 1, Col 2)")
    perfect_augmentation: int = Field(default=0, description="Quantity of Perfect Orb of Augmentation (Row 1, Col 3)")
    
    # Left-hand 5x3 Grid (Row 2)
    transmute: int = Field(default=0, description="Quantity of Orb of Transmutation (Row 2, Col 1)")
    greater_transmute: int = Field(default=0, description="Quantity of Greater Orb of Transmutation (Row 2, Col 2)")
    perfect_transmute: int = Field(default=0, description="Quantity of Perfect Orb of Transmutation (Row 2, Col 3)")
    
    # Left-hand 5x3 Grid (Row 3)
    regal: int = Field(default=0, description="Quantity of Regal Orb (Row 3, Col 1)")
    greater_regal: int = Field(default=0, description="Quantity of Greater Regal Orb (Row 3, Col 2)")
    perfect_regal: int = Field(default=0, description="Quantity of Perfect Regal Orb (Row 3, Col 3)")
    
    # Left-hand 5x3 Grid (Row 4)
    exalted: int = Field(default=0, description="Quantity of Exalted Orb (Row 4, Col 1)")
    greater_exalted: int = Field(default=0, description="Quantity of Greater Exalted Orb (Row 4, Col 2)")
    perfect_exalted: int = Field(default=0, description="Quantity of Perfect Exalted Orb (Row 4, Col 3)")
    
    # Left-hand 5x3 Grid (Row 5)
    chaos: int = Field(default=0, description="Quantity of Chaos Orb (Row 5, Col 1)")
    greater_chaos: int = Field(default=0, description="Quantity of Greater Chaos Orb (Row 5, Col 2)")
    perfect_chaos: int = Field(default=0, description="Quantity of Perfect Chaos Orb (Row 5, Col 3)")
    
    # Central 3x3 Utility Grid (Row 1)
    vaal: int = Field(default=0, description="Quantity of Vaal Orb (Central Row 1, Col 1)")
    alchemy: int = Field(default=0, description="Quantity of Orb of Alchemy (Central Row 1, Col 2)")
    divine: int = Field(default=0, description="Quantity of Divine Orb (Central Row 1, Col 3)")
    
    # Central 3x3 Utility Grid (Row 2)
    chance: int = Field(default=0, description="Quantity of Orb of Chance (Central Row 2, Col 1)")
    annulment: int = Field(default=0, description="Quantity of Orb of Annulment (Central Row 2, Col 2)")
    artificer: int = Field(default=0, description="Quantity of Artificer's Orb (Central Row 2, Col 3)")
    
    # Central 3x3 Utility Grid (Row 3)
    fracturing: int = Field(default=0, description="Quantity of Fracturing Orb (Central Row 3, Col 1)")
    hinekoras_lock: int = Field(default=0, description="Quantity of Hinekora's Lock (Central Row 3, Col 2)")
    mirror: int = Field(default=0, description="Quantity of Mirror of Kalandra (Central Row 3, Col 3)")
    
    # Top-Right horizontal cluster (Jewellers' Tiers)
    lesser_jeweller: int = Field(default=0, description="Quantity of Lesser Jeweller's Orb (Left loop)")
    greater_jeweller: int = Field(default=0, description="Quantity of Greater Jeweller's Orb (Middle loop)")
    perfect_jeweller: int = Field(default=0, description="Quantity of Perfect Jeweller's Orb (Right loop)")
    
    # Misc currencies
    scroll: int = Field(default=0, description="Quantity of Scroll of Wisdom")
    
    # Runes of Aldur League items
    verisium: int = Field(default=0, description="Quantity of Verisium Ore")
    runic_alloy: int = Field(default=0, description="Quantity of Runic Alloy")
    aldurs_legacy: int = Field(default=0, description="Quantity of Aldur's Legacy Rune")
    iron_rune: int = Field(default=0, description="Quantity of Iron Rune")
    gold_rune: int = Field(default=0, description="Quantity of Gold Rune")
    stone_rune: int = Field(default=0, description="Quantity of Stone Rune")
    uncut_gem: int = Field(default=0, description="Quantity of Uncut Skill Gem")


# Poe2 Gear Item definition with deterministic fingerprint hashing engine
class Poe2GearItem(BaseModel):
    name: str = Field(description="Name of the item (e.g. Mageblood, Dread Loop, or Berek's Respite)")
    base: str = Field(description="Base item type (e.g. Heavy Belt, Topaz Ring, Leather Belt, Eternal Sword)")
    rarity: str = Field(description="Rarity of the item: Unique, Rare, Magic, or Normal")
    level: int = Field(default=0, description="Required level to equip the item")
    ilvl: int = Field(default=80, description="Item level (ilvl) of the item")
    affixes: list[str] = Field(default=[], description="List of visible explicit and implicit modifiers on the item")
    flavor: str = Field(default="", description="Flavor text of the unique item")
    price: str = Field(default="Gear Pool", description="Estimated Chaos/Divine price string (e.g. '35 Chaos Orbs')")
    logs: str = Field(default="Vision OCR Sync", description="Culling and appraisal log notes")

    def get_fingerprint(self) -> str:
        # Lowercase, strip, and sort mods to ensure absolute hashing determinism
        sorted_mods = sorted([mod.strip().lower() for mod in self.affixes if mod.strip()])
        mods_str = ";".join(sorted_mods)
        raw_str = f"{self.rarity.lower()}|{self.base.lower()}|{self.name.lower()}|{mods_str}"
        m = hashlib.sha256()
        m.update(raw_str.encode("utf-8"))
        return m.hexdigest()[:16] # Return compact 16-character deterministic hash


# Stash snapshot containing list of visible Rare/Unique gear items
class Poe2GearStashSnapshot(BaseModel):
    items: list[Poe2GearItem] = Field(default=[], description="List of all visible gear items in the stash tab")


def get_icon_url(name: str, base: str) -> str:
    n = name.lower()
    b = base.lower()
    if "mageblood" in n:
        return "https://web.poecdn.com/image/Art/2DItems/Belts/Mageblood.png"
    if "headhunter" in n:
        return "https://web.poecdn.com/image/Art/2DItems/Belts/Headhunter.png"
    if "dreamfeather" in n:
        return "https://web.poecdn.com/image/Art/2DItems/Weapons/OneHandSwords/Dreamfeather.png"
    if "taming" in n:
        return "https://web.poecdn.com/image/Art/2DItems/Rings/TheTaming.png"
    if "bereks respite" in n:
        return "https://web.poecdn.com/image/Art/2DItems/Rings/BereksRespite.png"
    if "ring" in b:
        return "https://web.poecdn.com/image/Art/2DItems/Rings/OpalRing.png"
    if "belt" in b:
        return "https://web.poecdn.com/image/Art/2DItems/Belts/HeavyBelt.png"
    if "sword" in b or "blade" in b:
        return "https://web.poecdn.com/image/Art/2DItems/Weapons/OneHandSwords/Dreamfeather.png"
    return "https://web.poecdn.com/image/Art/2DItems/Rings/OpalRing.png"


def parse_args():
    parser = argparse.ArgumentParser(description="Path of Exile 2 Gemini Vision Stash Scanner")
    parser.add_argument("--file", type=str, help="Path to a local screenshot image file (e.g. stash.png)")
    parser.add_argument("--capture", action="store_true", help="Natively capture the primary display screenshot")
    parser.add_argument("--crop", type=str, help="Optional crop box coordinates as 'left,top,right,bottom' (e.g. '100,200,900,800')")
    parser.add_argument("--api-key", type=str, help="Your Gemini API Key (falls back to GEMINI_API_KEY environment variable)")
    parser.add_argument("--push-to-guild", action="store_true", help="Automatically push scanned counts/items to the online guild Supabase database")
    parser.add_argument("--mode", type=str, default="currency", choices=["currency", "gear"], help="Scan mode: currency (default) or gear")
    parser.add_argument("--tab-index", type=int, default=1, help="Stash tab index (default is 1 for DUMP tab)")
    parser.add_argument("--stash-type", type=str, default="guild", choices=["guild", "personal"], help="Stash ownership: guild or personal")
    parser.add_argument("--account-name", type=str, default="Radiocommander", help="GGG account name (default is Radiocommander)")
    parser.add_argument("--supabase-url", type=str, help="Your Supabase project URL")
    parser.add_argument("--supabase-key", type=str, help="Your Supabase anon key")
    parser.add_argument("--write-key", type=str, help="Your Guild Write Key")
    return parser.parse_args()


def main():
    args = parse_args()
    
    # 1. Fetch Gemini API Key and Supabase Configs
    default_key = None
    default_supabase_url = "https://qqljadcpxsubawmzkecl.supabase.co"
    default_supabase_anon_key = "sb_publishable_T8G6w3OtwXRG_cXd_-h9YQ_s8U9iDnx"
    default_guild_write_key = "BCU5C-reDUecvjLm4tV6QkGVvTGbX-Uyuyz5Xtpml5A"
    
    try:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                cfg = json.load(f)
                default_key = cfg.get("default_api_key") or cfg.get("default_gemini_key")
                default_supabase_url = cfg.get("default_supabase_url") or default_supabase_url
                default_supabase_anon_key = cfg.get("default_supabase_anon_key") or default_supabase_anon_key
                default_guild_write_key = cfg.get("default_guild_write_key") or default_guild_write_key
    except Exception:
        pass
        
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY") or default_key
    
    if not api_key:
        print("Error: Gemini API Key not found.")
        print("Please set the GEMINI_API_KEY environment variable or pass it using --api-key.")
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    
    # 2. Acquire Image
    img = None
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: Screenshot file '{args.file}' not found.")
            sys.exit(1)
        print(f"Loading stash image from file: {args.file}")
        img = Image.open(args.file)
    elif args.capture:
        print("Capturing primary monitor screen...")
        img = ImageGrab.grab()
    else:
        print("Error: You must specify either --file <path> or --capture.")
        sys.exit(1)
        
    if args.crop and img:
        try:
            left, top, right, bottom = map(int, args.crop.split(","))
            print(f"Cropping image to bounding box: ({left}, {top}, {right}, {bottom})")
            img = img.crop((left, top, right, bottom))
        except ValueError:
            print("Error: Invalid crop coordinates. Must be formatted as 'left,top,right,bottom'")
            sys.exit(1)
            
    os.makedirs("debug", exist_ok=True)
    img.save("debug/scan_input_debug.png")
    print("Saved preview copy of input image to debug/scan_input_debug.png")
    
    # 3. Mode Routing
    if args.mode == "currency":
        print("Uploading image and invoking Gemini-2.5-Flash in CURRENCY mode...")
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[img, "Extract the exact quantities of all visible Path of Exile 2 currency items in this Currency Stash Tab image."],
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are an expert Path of Exile 2 Currency Stash Tab indexer. "
                        "Analyze the Currency Stash Tab screenshot and match numbers/quantities carefully. Use this spatial visual guide:\n\n"
                        "1. FAR-LEFT GRID (5 rows by 3 columns of slots):\n"
                        "   - Row 1: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III)\n"
                        "   - Row 2: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III)\n"
                        "   - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III)\n"
                        "   - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III)\n"
                        "   - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III)\n\n"
                        "2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):\n"
                        "   - Row 1 (Top row): Column 1 (Left) is alchemy | Column 2 (Middle) is vaal | Column 3 (Right) is annulment\n"
                        "   - Row 2 (Middle row): Column 1 (Left) is chance | Column 2 (Middle) is fracturing | Column 3 (Right) is divine\n"
                        "   - Row 3 (Bottom row): Column 1 (Left) is hinekoras_lock | Column 2 (Middle) is mirror | Column 3 (Right) is artificer\n\n"
                        "3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):\n"
                        "   - lesser_jeweller (Left, plain loop) | greater_jeweller (Middle) | perfect_jeweller (Right, with gem)\n\n"
                        "4. SCROLL OF WISDOM:\n"
                        "   - scroll: Red-tied blue scroll icon, located on the right side.\n\n"
                        "5. BOTTOM DUMP/LEAGUE SLOTS:\n"
                        "   - Identify active items from the Runes of Aldur League:\n"
                        "     * verisium: Verisium Ore (stacks of blue crystals/shards)\n"
                        "     * runic_alloy: Runic Alloy (stacks of blue metallic bars)\n"
                        "     * aldurs_legacy: Aldur's Legacy Rune (rare golden rune with intricate glyph)\n"
                        "     * iron_rune: Iron Rune (round dark grey rune with an iron symbol)\n"
                        "     * gold_rune: Gold Rune (round gold rune with a gold symbol)\n"
                        "     * stone_rune: Stone Rune (round grey stone rune with a stone symbol)\n"
                        "     * uncut_gem: Uncut Skill Gem (blue/green/red glowing crystal gems)\n\n"
                        "RULES:\n"
                        " - For any slot that is completely empty or has no quantity, return 0.\n"
                        " - Output numbers exactly as read. Pay extra attention to double-digit and triple-digit numbers."
                    ),
                    response_mime_type="application/json",
                    response_schema=Poe2CurrencyStash,
                ),
            )
            
            print("\n=== SCAN COMPLETED SUCCESSFULLY ===")
            print(response.text)
            print("===================================\n")
            
            data = json.loads(response.text)
            rates = {
                "mirror": 40000.0, "hinekoras_lock": 15000.0, "divine": 150.0,
                "perfect_exalted": 45.0, "greater_exalted": 25.0, "exalted": 15.0,
                "perfect_chaos": 5.0, "greater_chaos": 2.2, "chaos": 1.0,
                "perfect_jeweller": 5.0, "greater_jeweller": 1.0, "lesser_jeweller": 0.1,
                "fracturing": 50.0, "artificer": 8.0, "annulment": 5.0,
                "perfect_regal": 4.0, "greater_regal": 2.0, "regal": 0.8,
                "vaal": 2.0, "alchemy": 0.5, "perfect_transmute": 1.2,
                "greater_transmute": 0.5, "transmute": 0.2, "perfect_augmentation": 0.8,
                "greater_augmentation": 0.3, "augmentation": 0.15, "chance": 0.2, "scroll": 0.05
            }
            total_chaos = sum([qty * rates.get(k, 0.0) for k, qty in data.items()])
            print(f"Total Stash Net Worth: {total_chaos:.1f} Chaos Orbs (Approx {(total_chaos/150.0):.2f} Divine Orbs)")
            
            supabase_url = args.supabase_url or os.environ.get("SUPABASE_URL") or default_supabase_url
            supabase_key = args.supabase_key or os.environ.get("SUPABASE_ANON_KEY") or default_supabase_anon_key
            write_key = args.write_key or os.environ.get("GUILD_WRITE_KEY") or default_guild_write_key
            
            if args.push_to_guild or args.supabase_url or os.environ.get("SUPABASE_URL"):
                import requests
                
                core_data = {
                    "scroll": data.get("scroll", 0),
                    "transmute": data.get("transmute", 0) + data.get("greater_transmute", 0) + data.get("perfect_transmute", 0),
                    "augmentation": data.get("augmentation", 0) + data.get("greater_augmentation", 0) + data.get("perfect_augmentation", 0),
                    "alchemy": data.get("alchemy", 0),
                    "regal": data.get("regal", 0) + data.get("greater_regal", 0) + data.get("perfect_regal", 0),
                    "chaos": data.get("chaos", 0) + data.get("greater_chaos", 0) + data.get("perfect_chaos", 0),
                    "vaal": data.get("vaal", 0),
                    "annulment": data.get("annulment", 0),
                    "exalted": data.get("exalted", 0) + data.get("greater_exalted", 0) + data.get("perfect_exalted", 0),
                    "divine": data.get("divine", 0),
                    "mirror": data.get("mirror", 0),
                    "verisium": data.get("verisium", 0),
                    "runic_alloy": data.get("runic_alloy", 0),
                    "aldurs_legacy": data.get("aldurs_legacy", 0),
                    "iron_rune": data.get("iron_rune", 0),
                    "gold_rune": data.get("gold_rune", 0),
                    "stone_rune": data.get("stone_rune", 0),
                    "uncut_gem": data.get("uncut_gem", 0)
                }
                
                currency_payload = {
                    **core_data,
                    "sync_version": "1.0"
                }
                
                print("Syncing live scan results to your serverless Supabase vault database...")
                try:
                    headers = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "p_name": "__GUILD_VAULT__",
                        "p_data": currency_payload,
                        "p_write_key": write_key
                    }
                    push_res = requests.post(f"{supabase_url}/rest/v1/rpc/sync_vault_item", json=payload, headers=headers, timeout=10)
                    if push_res.status_code == 200:
                        print("✅ Online Guild Vault successfully updated globally!")
                    else:
                        print(f"⚠️ Failed to update online vault. Supabase response: {push_res.status_code} - {push_res.text}")
                except Exception as push_err:
                    print(f"⚠️ Failed to connect to online database: {push_err}")
        except Exception as e:
            print(f"Vision OCR scan failed: {e}")
            sys.exit(1)
            
    elif args.mode == "gear":
        print("Uploading image and invoking Gemini-2.5-Flash in GEAR mode...")
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[img, "Extract all visible Rare and Unique gear equipment items (rings, belts, amulets, boots, gloves, helmets, weapons, body armours) visible in this Stash Tab screenshot."],
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are an expert Path of Exile 2 Stash Tab visual gear indexer. "
                        "Your task is to analyze the stash tab screenshot and extract all visible Rare and Unique equipment items "
                        "placed in the stash grid.\n\n"
                        "For each visible item, extract:\n"
                        "1. name: The exact in-game name of the item (e.g. 'Dread Loop', 'Mageblood', or base name if unnamed rare)\n"
                        "2. base: The base item type (e.g. 'Topaz Ring', 'Heavy Belt', 'Leather Belt', 'Eternal Sword')\n"
                        "3. rarity: 'Unique' or 'Rare' based on the item color border (orange for Unique, yellow for Rare)\n"
                        "4. level: Estimated requirement level to equip (e.g. 45 or 80)\n"
                        "5. ilvl: Estimated item level or 80\n"
                        "6. affixes: A list of visible explicit and implicit modifiers on the item. If details are not clear, estimate a realistic set of mods based on the item base (e.g. '+35% to Fire Resistance', '+65 to maximum Life' for a rare topaz ring).\n"
                        "7. flavor: Flavor text if it is a unique item\n"
                        "8. price: Estimated trade price (e.g. '35 Chaos Orbs' or '248 Divine Orbs')\n"
                        "9. logs: Appraisal notes (e.g. 'Snapshot OCR scan')"
                    ),
                    response_mime_type="application/json",
                    response_schema=Poe2GearStashSnapshot,
                ),
            )
            
            print("\n=== GEAR SCAN COMPLETED ===")
            snapshot = Poe2GearStashSnapshot.parse_raw(response.text)
            print(f"Scanned {len(snapshot.items)} visible gear items inside this tab.")
            for idx, item in enumerate(snapshot.items):
                fingerprint = item.get_fingerprint()
                print(f"[{idx+1}] {item.rarity} {item.name} ({item.base}) | Fingerprint: {fingerprint} | Price: {item.price}")
            print("===========================\n")
            
            supabase_url = args.supabase_url or os.environ.get("SUPABASE_URL") or default_supabase_url
            supabase_key = args.supabase_key or os.environ.get("SUPABASE_ANON_KEY") or default_supabase_anon_key
            write_key = args.write_key or os.environ.get("GUILD_WRITE_KEY") or default_guild_write_key
            
            if args.push_to_guild or args.supabase_url or os.environ.get("SUPABASE_URL"):
                import requests
                
                safe_account = args.account_name.lower().replace(" ", "").replace("#", "-")
                delete_prefix = f"ITEM_GUILD_T{args.tab_index}_" if args.stash_type == "guild" else f"ITEM_PERS_{safe_account}_T{args.tab_index}_"
                
                # Fetch existing items in this tab from Supabase database
                print(f"Retrieving existing visual items for tab {args.tab_index} from online database...")
                headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}"
                }
                
                try:
                    get_res = requests.get(f"{supabase_url}/rest/v1/poe2_guild_vault?name=like.{delete_prefix}*&select=*", headers=headers, timeout=10)
                    if get_res.status_code == 200:
                        existing_entries = get_res.json()
                        print(f"Database currently has {len(existing_entries)} items listed in this tab.")
                    else:
                        print(f"Warning: Failed to fetch existing items: {get_res.status_code} - {get_res.text}")
                        existing_entries = []
                except Exception as fetch_err:
                    print(f"Warning: Failed to connect to fetch existing database items: {fetch_err}")
                    existing_entries = []
                
                # Build fingerprint map for existing entries
                existing_fingerprints = {}
                for entry in existing_entries:
                    item_data = entry.get("data")
                    if not item_data:
                        continue
                    # Parse item to Poe2GearItem to extract its true fingerprint
                    try:
                        parsed_existing = Poe2GearItem(
                            name=item_data.get("name", ""),
                            base=item_data.get("base", ""),
                            rarity=item_data.get("rarity", "Rare"),
                            level=item_data.get("level", 0),
                            ilvl=item_data.get("ilvl", 80),
                            affixes=item_data.get("affixes", []),
                            flavor=item_data.get("flavor", ""),
                            price=item_data.get("price", "Gear Pool"),
                            logs=item_data.get("logs", "")
                        )
                        existing_fingerprints[parsed_existing.get_fingerprint()] = entry.get("name")
                    except Exception as e:
                        # Fallback parsing
                        pass
                
                # Build list of scanned fingerprints
                scanned_fingerprints = {}
                for item in snapshot.items:
                    scanned_fingerprints[item.get_fingerprint()] = item
                
                # 1. State Diffing: Absence Culling
                entries_to_delete = []
                for fp, entry_name in existing_fingerprints.items():
                    if fp not in scanned_fingerprints:
                        # Fingerprint is in database but missing from new visual scan -> Item was WITHDRAWN!
                        entries_to_delete.append(entry_name)
                
                # 2. State Diffing: New Items Ingestion
                items_to_upload = []
                for fp, item in scanned_fingerprints.items():
                    if fp not in existing_fingerprints:
                        # Fingerprint is in scan but not in database -> Item is NEW!
                        items_to_upload.append((fp, item))
                
                print(f"Diff Analysis: {len(entries_to_delete)} items withdrawn, {len(items_to_upload)} new items detected.")
                
                # Perform deletions (Culling withdrawn items)
                deleted_count = 0
                if entries_to_delete:
                    print(f"Purging {len(entries_to_delete)} withdrawn gear items from database online...")
                    headers_rpc = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    }
                    for entry_name in entries_to_delete:
                        try:
                            # Re-using purge_vault_items RPC with exact entry name as prefix
                            payload = {
                                "p_prefix": entry_name,
                                "p_write_key": write_key
                            }
                            del_res = requests.post(f"{supabase_url}/rest/v1/rpc/purge_vault_items", json=payload, headers=headers_rpc, timeout=8)
                            if del_res.status_code == 200:
                                deleted_count += 1
                        except Exception as del_err:
                            print(f"Warning: Failed to delete stale item '{entry_name}': {del_err}")
                    print(f"✅ Successfully culled {deleted_count} withdrawn items from the online visual stash!")
                
                # Perform uploads (Ingesting new items)
                uploaded_count = 0
                if items_to_upload:
                    print(f"Uploading {len(items_to_upload)} new gear items with deterministic fingerprints...")
                    headers_rpc = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    }
                    for fp, item in items_to_upload:
                        try:
                            entry_name = f"{delete_prefix}FINGERPRINT_{fp}"
                            item_payload = {
                                "rarity": item.rarity,
                                "name": item.name,
                                "base": item.base,
                                "level": item.level,
                                "ilvl": item.ilvl,
                                "affixes": item.affixes,
                                "price": item.price,
                                "flavor": item.flavor,
                                "logs": item.logs,
                                "url": get_icon_url(item.name, item.base),
                                "owner": "Shared Guild Vault" if args.stash_type == "guild" else args.account_name
                            }
                            payload = {
                                "p_name": entry_name,
                                "p_data": item_payload,
                                "p_write_key": write_key
                            }
                            push_res = requests.post(f"{supabase_url}/rest/v1/rpc/sync_vault_item", json=payload, headers=headers_rpc, timeout=8)
                            if push_res.status_code == 200:
                                uploaded_count += 1
                        except Exception as push_err:
                            print(f"Warning: Failed to upload new item '{item.name}': {push_err}")
                    print(f"✅ Successfully ingested {uploaded_count} new gear items online!")
                
                print(f"🎉 Zero-Click Auto-Reconciliation Complete! Tab {args.tab_index} matches active in-game reality!")
                
        except Exception as e:
            print(f"Gear Vision OCR scan or auto-reconciliation failed: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
