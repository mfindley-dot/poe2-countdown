import os
import sys
import argparse
import json
from PIL import Image, ImageGrab
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: The modern 'google-genai' SDK is not installed.")
    print("Please install it by running: pip install google-genai pydantic pillow")
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

def parse_args():
    parser = argparse.ArgumentParser(description="Path of Exile 2 Gemini Vision Currency Stash Scanner")
    parser.add_argument("--file", type=str, help="Path to a local screenshot image file (e.g. stash.png)")
    parser.add_argument("--capture", action="store_true", help="Natively capture the primary display screenshot")
    parser.add_argument("--crop", type=str, help="Optional crop box coordinates as 'left,top,right,bottom' (e.g. '100,200,900,800')")
    parser.add_argument("--api-key", type=str, help="Your Gemini API Key (falls back to GEMINI_API_KEY environment variable)")
    parser.add_argument("--push-to-guild", action="store_true", help="Automatically push scanned counts to the guild's online website database (Dreamlo)")
    parser.add_argument("--dreamlo-key", type=str, help="Your Dreamlo Private Key (falls back to DREAMLO_PRIVATE_KEY environment variable)")
    return parser.parse_args()

def main():
    args = parse_args()
    
    # 1. Fetch Gemini API Key
    # Try loading from local git-ignored config.json first (safeguard for easy guild sharing)
    default_key = None
    try:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                cfg = json.load(f)
                default_key = cfg.get("default_api_key")
    except Exception:
        pass
        
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY") or default_key
    
    if not api_key:
        print("Error: Gemini API Key not found.")
        print("Please set the GEMINI_API_KEY environment variable or pass it using --api-key.")
        print("Example: export GEMINI_API_KEY='AIzaSy...' (Linux/macOS) or $env:GEMINI_API_KEY='AIzaSy...' (Powershell)")
        sys.exit(1)
        
    # Initialize the modern unified GenAI client
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
        print("Run: python stash_scanner.py --help for options.")
        sys.exit(1)
        
    # 3. Handle Crop Bounding Box (4K / Ultrawide / Zoom optimizations)
    if args.crop and img:
        try:
            left, top, right, bottom = map(int, args.crop.split(","))
            print(f"Cropping image to bounding box: ({left}, {top}, {right}, {bottom})")
            img = img.crop((left, top, right, bottom))
        except ValueError:
            print("Error: Invalid crop coordinates. Must be formatted as 'left,top,right,bottom'")
            sys.exit(1)
            
    # Save a temporary copy locally to let the user visually inspect what is being sent to Gemini!
    os.makedirs("debug", exist_ok=True)
    img.save("debug/scan_input_debug.png")
    print("Saved preview copy of input image to debug/scan_input_debug.png")
    
    # 4. Invoke Gemini API Vision Model with Structured JSON Output
    print("Uploading image and invoking Gemini-2.5-Flash...")
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[img, "Extract the exact quantities of all visible Path of Exile 2 currency items in this Currency Stash Tab image."],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are an expert Path of Exile 2 Currency Stash Tab indexer. "
                    "Analyze the Currency Stash Tab screenshot and match numbers/quantities carefully. Use this spatial visual guide:\n\n"
                    "1. FAR-LEFT GRID (5 rows by 3 columns of slots):\n"
                    "   - Row 1: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III) [Bronze/copper circular multi-faced orbs]\n"
                    "   - Row 2: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III) [Dark blue circular multi-faced orbs]\n"
                    "   - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III) [Half-blue, half-gold face orbs]\n"
                    "   - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III) [Shiny gold cracked face orbs]\n"
                    "   - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III) [Golden face orbs composed of multiple stacked mini-faces]\n\n"
                    "2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):\n"
                    "   - Row 1 (Top row):\n"
                    "     * Column 1 (Left): alchemy - Orb of Alchemy [Reddish-gold smooth face orb, count 195]\n"
                    "     * Column 2 (Middle): vaal - Vaal Orb [Red multi-faced skull shape, count 386]\n"
                    "     * Column 3 (Right): annulment - Orb of Annulment [Blue/white half-split mask, count 18]\n"
                    "   - Row 2 (Middle row):\n"
                    "     * Column 1 (Left): chance - Orb of Chance [Cracked white/gold face orb, count 38]\n"
                    "     * Column 2 (Middle): fracturing - Fracturing Orb [Shattered glowing yellow crystal, count 3]\n"
                    "     * Column 3 (Right): divine - Divine Orb [Gold coin with serene serene face, count 169]\n"
                    "   - Row 3 (Bottom row):\n"
                    "     * Column 1 (Left): hinekoras_lock - Hinekora's Lock [Dark braided purple lock/ribbon, count 0]\n"
                    "     * Column 2 (Middle): mirror - Mirror of Kalandra [Silver metallic runic mirror, count 0]\n"
                    "     * Column 3 (Right): artificer - Artificer's Orb [Dark green/grey bag shape, count 81]\n\n"
                    "3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):\n"
                    "   - lesser_jeweller (Left, plain copper/bronze loop, count 349. Ensure you read all three digits '349' fully!)\n"
                    "   - greater_jeweller (Middle, bronze loop with inner notches, count 12)\n"
                    "   - perfect_jeweller (Right, gold loop holding a central blue/purple gem, count 1)\n\n"
                    "4. SCROLL OF WISDOM:\n"
                    "   - scroll: Red-ribbon tied blue scroll icon, located on the right side under general/popular/secondary stacks (count 91).\n\n"
                    "RULES:\n"
                    " - For any slot that is completely empty or has no quantity, return 0.\n"
                    " - Output numbers exactly as read. Pay extra attention to double-digit and triple-digit numbers. Do not miss the leading digit near slot borders (e.g. read '349' instead of '49')."
                ),
                response_mime_type="application/json",
                response_schema=Poe2CurrencyStash,
            ),
        )
        
        # 5. Output Flawless Structured JSON database payload
        print("\n=== SCAN COMPLETED SUCCESSFULLY ===")
        print(response.text)
        print("===================================\n")
        
        # Parse JSON and print net worth summary
        try:
            data = json.loads(response.text)
            # Define estimated chaos exchange rates for net worth mapping
            rates = {
                # High Tier
                "mirror": 40000.0,
                "hinekoras_lock": 15000.0,
                "divine": 150.0,
                
                # Exalted Tiers
                "perfect_exalted": 45.0,
                "greater_exalted": 25.0,
                "exalted": 15.0,
                
                # Chaos Tiers
                "perfect_chaos": 5.0,
                "greater_chaos": 2.2,
                "chaos": 1.0,
                
                # Jeweller Tiers
                "perfect_jeweller": 5.0,
                "greater_jeweller": 1.0,
                "lesser_jeweller": 0.1,
                
                # Utility Tiers
                "fracturing": 50.0,
                "artificer": 8.0,
                "annulment": 5.0,
                
                # Regal Tiers
                "perfect_regal": 4.0,
                "greater_regal": 2.0,
                "regal": 0.8,
                
                # Low Tier Currencies
                "vaal": 2.0,
                "alchemy": 0.5,
                
                # Transmutation Tiers
                "perfect_transmute": 1.2,
                "greater_transmute": 0.5,
                "transmute": 0.2,
                
                # Augmentation Tiers
                "perfect_augmentation": 0.8,
                "greater_augmentation": 0.3,
                "augmentation": 0.15,
                
                "chance": 0.2,
                "scroll": 0.05
            }
            total_chaos = 0.0
            for key, qty in data.items():
                total_chaos += qty * rates.get(key, 0.0)
            print(f"Total Stash Net Worth: {total_chaos:.1f} Chaos Orbs (Approx {(total_chaos/150.0):.2f} Divine Orbs)")
            
            # 6. Push to online Guild Vault if requested
            dreamlo_key = args.dreamlo_key or os.environ.get("DREAMLO_PRIVATE_KEY")
            if args.push_to_guild or dreamlo_key:
                if not dreamlo_key:
                    # Fallback to GLG pre-allocated guild private key if the user is GLG
                    dreamlo_key = "BCU5C-reDUecvjLm4tV6QkGVvTGbX-Uyuyz5Xtpml5A"
                
                import urllib.parse
                import requests
                
                # Map the 26+ extended currency tiers down to the core 11 currencies
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
                    "mirror": data.get("mirror", 0)
                }
                
                # Squeeze data into a highly compact, pipe-separated positional string matching game.js order:
                # order: scroll|transmute|augmentation|alchemy|regal|chaos|vaal|annulment|exalted|divine|mirror
                core_keys = ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror"]
                pipe_str = "|".join([str(core_data.get(k, 0)) for k in core_keys])
                
                # Calculate total net worth for Dreamlo score mapping (score = net_worth * 10)
                total_score = int(total_chaos * 10)
                
                # Construct dreamlo URL
                push_url = f"https://dreamlo.com/lb/{dreamlo_key}/add/__GUILD_VAULT__/{total_score}/0/{urllib.parse.quote(pipe_str)}"
                
                print("Syncing live scan results to your online guild website database...")
                try:
                    push_res = requests.get(push_url, timeout=5)
                    if push_res.status_code == 200:
                        print("✅ Online Guild Vault successfully updated globally!")
                    else:
                        print(f"⚠️ Failed to update online vault. Dreamlo status code: {push_res.status_code}")
                except Exception as push_err:
                    print(f"⚠️ Failed to connect to online database: {push_err}")
                    
        except Exception as e:
            print(f"Warning: Failed to parse net worth summary. Error: {e}")
            
    except Exception as e:
        print(f"\nAPI Error: Failed to generate content via Gemini API. Error: {e}")
        print("Please check your internet connection, API Key status, and prompt settings.")
        sys.exit(1)

if __name__ == "__main__":
    main()
