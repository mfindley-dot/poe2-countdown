import os
import sys
import json
import ctypes
import ctypes.wintypes
import threading
import time
import tkinter as tk
from tkinter import ttk

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: The modern 'google-genai' SDK is not installed.")
    print("Please install it by running: pip install google-genai pillow")
    sys.exit(1)

# Global configuration
HOTKEY_ID = 1
MOD_ALT = 0x0001
MOD_SHIFT = 0x0004
MOD_CONTROL = 0x0002
# We will bind Alt + O (Alt + 0x4F) as the global appraisal overlay hotkey!
HOTKEY_KEY = 0x4F  # Virtual key code for 'O'

class GLGOverlayApp:
    def __init__(self):
        self.root = None
        self.api_key = self.load_api_key()
        if not self.api_key:
            print("Error: Gemini API Key not found in config.json or environment variables.")
            sys.exit(1)
        self.client = genai.Client(api_key=self.api_key)

    def load_api_key(self):
        # Try loading from local config.json
        try:
            config_path = os.path.join(os.path.dirname(__file__), "config.json")
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    cfg = json.load(f)
                    # Support both default keys
                    key = cfg.get("default_api_key") or cfg.get("default_gemini_key")
                    if key:
                        return key
        except Exception:
            pass
        return os.environ.get("GEMINI_API_KEY")

    def run_overlay_window(self, item_data):
        # Create borderless topmost window
        self.root = tk.Tk()
        self.root.title("GLG PoE2 Overlay Appraiser")
        self.root.attributes("-topmost", True)
        self.root.overrideredirect(True)
        self.root.config(bg='#0c0a09') # Authentic dark slate background
        
        # Enable window dragging by clicking and holding
        self.root.bind("<ButtonPress-1>", self.start_move)
        self.root.bind("<B1-Motion>", self.on_move)
        
        # Position at the center of the screen
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        width = 380
        height = 500
        x = (screen_width - width) // 2
        y = (screen_height - height) // 2
        self.root.geometry(f"{width}x{height}+{x}+{y}")

        # Determine rarity colors
        rarity = item_data.get("rarity", "Rare").lower()
        title_color = "#cbd5e1" # normal
        if rarity == "unique":
            title_color = "#af6025" # unique orange
        elif rarity == "rare":
            title_color = "#f7d05e" # rare yellow
        elif rarity == "magic":
            title_color = "#548cf7" # magic blue

        # Close button (✕)
        btn_close = tk.Button(
            self.root, text="✕", bg="#0c0a09", fg="#888279",
            activebackground="#1c1917", activeforeground="#ef4444",
            font=("Arial", 11, "bold"), bd=0, cursor="hand2",
            command=self.root.destroy
        )
        btn_close.place(x=350, y=10)

        # Content container
        main_frame = tk.Frame(self.root, bg="#0c0a09", highlightthickness=1, highlightbackground="#c5a880")
        main_frame.pack(fill="both", expand=True, padx=8, pady=8)

        # Header Title (Item Name)
        lbl_title = tk.Label(
            main_frame, text=item_data.get("name", "Unknown Item").upper(),
            fg=title_color, bg="#0c0a09", font=("Cinzel", 14, "bold"),
            wraplength=340, justify="center"
        )
        lbl_title.pack(fill="x", pady=(15, 2))

        # Base Type
        lbl_base = tk.Label(
            main_frame, text=item_data.get("base", "Gear").upper(),
            fg=title_color, bg="#0c0a09", font=("Cinzel", 10),
            wraplength=340, justify="center"
        )
        lbl_base.pack(fill="x", pady=(0, 5))

        # Rarity Badge
        lbl_badge = tk.Label(
            main_frame, text=item_data.get("rarity", "Rare").upper(),
            fg=title_color, bg="#1a1512", font=("Inter", 7, "bold"),
            bd=1, relief="solid", padx=8, pady=2
        )
        lbl_badge.pack(pady=4)

        # Divider
        divider1 = tk.Frame(main_frame, height=2, bg="#2e2a24")
        divider1.pack(fill="x", padx=20, pady=10)

        # Requirements and Level Block
        req_text = f"Requires Level {item_data.get('level', 1)}   |   Item Level: {item_data.get('ilvl', 1)}"
        lbl_req = tk.Label(
            main_frame, text=req_text, fg="#a2a1a0", bg="#0c0a09",
            font=("Inter", 8, "bold")
        )
        lbl_req.pack(pady=2)

        # Divider
        divider2 = tk.Frame(main_frame, height=1, bg="#2e2a24")
        divider2.pack(fill="x", padx=30, pady=10)

        # Affixes Frame
        affix_frame = tk.Frame(main_frame, bg="#0c0a09")
        affix_frame.pack(fill="both", expand=True, padx=20)

        is_unid = item_data.get("is_unidentified", False)
        if is_unid:
            # Unidentified warning badge
            lbl_unid = tk.Label(
                affix_frame, text="🔒 UNIDENTIFIED UNIQUE (GGG BASE RANGES)",
                fg="#ef4444", bg="#0c0a09", font=("Inter", 8, "bold")
            )
            lbl_unid.pack(pady=(0, 6))

        # List mods
        for affix in item_data.get("affixes", []):
            color = "#8892b0" # identified mod color
            font_style = ("Inter", 9)
            if is_unid:
                color = "#888279" # unidentified grey
                font_style = ("Inter", 9, "italic")
                
            lbl_aff = tk.Label(
                affix_frame, text=affix, fg=color, bg="#0c0a09",
                font=font_style, wraplength=320, justify="center"
            )
            lbl_aff.pack(pady=3)

        # Flavor text
        flavor = item_data.get("flavor", "")
        if flavor:
            lbl_flavor = tk.Label(
                main_frame, text=f'"{flavor}"', fg="#d85757", bg="#0c0a09",
                font=("Inter", 8, "italic"), wraplength=320, justify="center"
            )
            lbl_flavor.pack(pady=(5, 10))

        # Premium Valuation Footer
        footer_frame = tk.Frame(main_frame, bg="#12100e", bd=1, relief="solid", highlightthickness=0)
        footer_frame.pack(fill="x", side="bottom", padx=10, pady=10)

        lbl_val_header = tk.Label(
            footer_frame, text="LIVE APRAISAL VALUE", fg="#a2a1a0",
            bg="#12100e", font=("Inter", 7, "bold")
        )
        lbl_val_header.pack(pady=(4, 0))

        lbl_price = tk.Label(
            footer_frame, text=item_data.get("price", "0 Chaos Orbs").upper(),
            fg="#ffd700", bg="#12100e", font=("Cinzel", 12, "bold")
        )
        lbl_price.pack(pady=(2, 2))

        lbl_logs = tk.Label(
            footer_frame, text=item_data.get("culling_logs", "").upper(),
            fg="#a855f7", bg="#12100e", font=("Inter", 7),
            wraplength=320
        )
        lbl_logs.pack(pady=(0, 6))

        # Close automatically after 10 seconds to not block screen
        self.root.after(10000, self.root.destroy)
        
        # Bring to absolute front and capture focus
        self.root.lift()
        self.root.focus_force()
        self.root.mainloop()

    # Move window triggers
    def start_move(self, event):
        self.x = event.x
        self.y = event.y

    def on_move(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")

    def appraise_clipboard(self):
        try:
            # Clipboard reading via native Tkinter frame
            temp_tk = tk.Tk()
            temp_tk.withdraw()
            clipboard_text = temp_tk.clipboard_get()
            temp_tk.destroy()
        except Exception:
            print("Failed to read clipboard or clipboard empty.")
            return

        if not clipboard_text or not ("Rarity:" in clipboard_text or "Item Class:" in clipboard_text):
            print("No valid Path of Exile item copy detected in clipboard.")
            return

        print("Valid PoE item copy detected! Querying Gemini API Appraiser...")

        # Setup prompt with explicit instructions
        prompt = f"""
        Appraise the following Path of Exile item copy text. Evaluate its rarity, name, base type, level requirements, and affixes.
        Determine if it is an unidentified unique (name and base will be identical, e.g. name="Heavy Belt", base="Heavy Belt", rarity="Unique").
        
        Return a structured JSON with the exact keys matching this JSON schema:
        {{
          "name": "Item Name",
          "base": "Base Item Type",
          "rarity": "Unique/Rare/Magic/Normal",
          "level": 80,
          "ilvl": 85,
          "is_unidentified": false,
          "affixes": ["Explicit Mod 1", "Explicit Mod 2"],
          "flavor": "Flavor Text line or empty",
          "price": "Appraised Price (e.g. 150 Chaos Orbs or 1.5 Divine Orbs)",
          "culling_logs": "Live audit logs (e.g. Culled 4 duplicates, verified roll bounds)"
        }}

        If it is unidentified, set "is_unidentified": true and populate "affixes" with the official base roll range options for that item type:
        - Heavy Belt / Mageblood: ["Implicit: +(25-35) to Strength", "Leftmost (2-4) Magic Utility Flasks constantly active", "+(15-25)% to Fire Resistance", "+(15-25)% to Lightning Resistance"]
        - Leather Belt / Headhunter: ["Implicit: +(25-40) to maximum Life", "+(20-30) to Strength", "+(20-30) to Dexterity", "When you Kill a Rare Monster, you gain its Modifiers for 20 seconds"]
        - Eternal Sword / Dreamfeather: ["Implicit: +40% to Global Critical Strike Multiplier", "Adds (15-25) to (30-45) Physical Damage", "+(180-220) to Accuracy Rating", "1% increased Attack Damage per 450 Evasion Rating"]
        - Rings: ["Implicit: +(8-10)% to all Elemental Resistances", "+(30-45)% to Fire Resistance", "+(30-45)% to Cold Resistance", "+(30-45)% to Lightning Resistance", "+(40-60) to maximum Life"]

        Provide a realistic market valuation in "price" and a funny culling summary in "culling_logs".

        Item text to appraise:
        {clipboard_text}
        """

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            item_data = json.loads(response.text)
            print("Appraisal parsed successfully!")
            
            # Start overlay UI in the main thread (tkinter must run in main thread)
            self.run_overlay_window(item_data)
        except Exception as err:
            print("Gemini API appraisal failed:", err)

def listen_for_hotkey(app):
    user32 = ctypes.windll.user32
    # Register Alt+O
    if not user32.RegisterHotKey(None, HOTKEY_ID, MOD_ALT, HOTKEY_KEY):
        print("Warning: Failed to register global hotkey Alt+O. It might be in use by another app.")
        return

    print("✅ Global In-Game Overlay Active! Press Alt+O anywhere to appraise your clipboard item.")
    
    try:
        msg = ctypes.wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            if msg.message == 0x0312:  # WM_HOTKEY
                if msg.wParam == HOTKEY_ID:
                    print("Hotkey triggered! Running clipboard appraisal...")
                    # Run appraisal in a separate thread so it doesn't freeze the hotkey hook!
                    threading.Thread(target=app.appraise_clipboard, daemon=True).start()
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
    finally:
        user32.UnregisterHotKey(None, HOTKEY_ID)

if __name__ == "__main__":
    print("==================================================")
    print("🔮 GLG PoE2 STANDALONE WINDOWS OVERLAY INITIATED")
    print("==================================================")
    
    app = GLGOverlayApp()
    listen_for_hotkey(app)
