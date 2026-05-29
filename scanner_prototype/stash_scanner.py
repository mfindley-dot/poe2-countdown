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

# Define the exact 11 currency types matching the game database schema
class Poe2CurrencyStash(BaseModel):
    scroll: int = Field(default=0, description="Quantity of Scroll of Wisdom")
    transmute: int = Field(default=0, description="Quantity of Orb of Transmutation")
    augmentation: int = Field(default=0, description="Quantity of Orb of Augmentation")
    alchemy: int = Field(default=0, description="Quantity of Orb of Alchemy")
    regal: int = Field(default=0, description="Quantity of Regal Orb")
    chaos: int = Field(default=0, description="Quantity of Chaos Orb")
    vaal: int = Field(default=0, description="Quantity of Vaal Orb")
    annulment: int = Field(default=0, description="Quantity of Orb of Annulment")
    exalted: int = Field(default=0, description="Quantity of Exalted Orb")
    divine: int = Field(default=0, description="Quantity of Divine Orb")
    mirror: int = Field(default=0, description="Quantity of Mirror of Kalandra")

def parse_args():
    parser = argparse.ArgumentParser(description="Path of Exile 2 Gemini Vision Currency Stash Scanner")
    parser.add_argument("--file", type=str, help="Path to a local screenshot image file (e.g. stash.png)")
    parser.add_argument("--capture", action="store_true", help="Natively capture the primary display screenshot")
    parser.add_argument("--crop", type=str, help="Optional crop box coordinates as 'left,top,right,bottom' (e.g. '100,200,900,800')")
    parser.add_argument("--api-key", type=str, help="Your Gemini API Key (falls back to GEMINI_API_KEY environment variable)")
    return parser.parse_args()

def main():
    args = parse_args()
    
    # 1. Fetch Gemini API Key
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
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
                    "Match the quantities in the image to the correct currency keys based on this exact PoE2 Currency Tab visual guide:\n\n"
                    "1. Far-Left Column (Vertical stack of 4 large slots):\n"
                    "   - scroll: Top slot (Column 1, Row 1) - Blue face scroll icon (often high quantity, e.g. 3040)\n"
                    "   - transmute: Second slot down (Column 1, Row 2) - Blue circular face orb (e.g. 203)\n"
                    "   - augmentation: Third slot down (Column 1, Row 3) - Bronze/copper face orb\n"
                    "   - alchemy: Bottom slot (Column 1, Row 4) - Gold face orb\n\n"
                    "2. Middle-Left Cluster (Top row has two adjacent slots, bottom row has one):\n"
                    "   - exalted: Top-Right of this cluster - Red face skull/orb (e.g. 380)\n"
                    "   - vaal: Top-Left of this cluster - White face mask (e.g. 19)\n"
                    "   - annulment: Bottom-Middle of this cluster - White stone face mask (e.g. 4)\n\n"
                    "3. Right-Side Cluster (Grid of various slots):\n"
                    "   - divine: Gold/bronze circular coin with a serene holy face (e.g. 164)\n"
                    "   - mirror: Highly reflective silver/metallic runic mirror (e.g. 23)\n"
                    "   - chaos: Metallic double-sided face orb (e.g. 97)\n"
                    "   - regal: Shiny gold circular ring/emblem (e.g. 149)\n\n"
                    "For any currency that is not visible, missing, or has 0 quantity, you MUST return 0. Do NOT omit any keys from the response."
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
            # Define estimated chaos exchange rates matching game.js configuration
            rates = {
                "mirror": 40000.0,
                "divine": 150.0,
                "exalted": 15.0,
                "annulment": 5.0,
                "vaal": 2.0,
                "chaos": 1.0,
                "regal": 0.8,
                "alchemy": 0.5,
                "transmute": 0.2,
                "augmentation": 0.15,
                "scroll": 0.1
            }
            total_chaos = 0.0
            for key, qty in data.items():
                total_chaos += qty * rates.get(key, 0.0)
            print(f"Total Stash Net Worth: {total_chaos:.1f} Chaos Orbs (Approx {(total_chaos/150.0):.2f} Divine Orbs)")
        except Exception as e:
            print(f"Warning: Failed to parse net worth summary. Error: {e}")
            
    except Exception as e:
        print(f"\nAPI Error: Failed to generate content via Gemini API. Error: {e}")
        print("Please check your internet connection, API Key status, and prompt settings.")
        sys.exit(1)

if __name__ == "__main__":
    main()
