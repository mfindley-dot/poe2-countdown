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
HOTKEY_ID_APPRAISE = 1
HOTKEY_ID_SYNC = 2

MOD_ALT = 0x0001
MOD_SHIFT = 0x0004
MOD_CONTROL = 0x0002

HOTKEY_KEY_APPRAISE = 0x4F  # Alt+O (Virtual key code for 'O')
HOTKEY_KEY_SYNC = 0x55      # Alt+U (Virtual key code for 'U')

# Helper to read clipboard using Windows API directly (100% thread-safe, 0% Tkinter crash risk)
def get_clipboard_text():
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    
    if not user32.OpenClipboard(None):
        return ""
    try:
        CF_UNICODETEXT = 13
        h_clip_mem = user32.GetClipboardData(CF_UNICODETEXT)
        if not h_clip_mem:
            return ""
        
        kernel32.GlobalLock.argtypes = [ctypes.wintypes.HANDLE]
        kernel32.GlobalLock.restype = ctypes.c_void_p
        kernel32.GlobalUnlock.argtypes = [ctypes.wintypes.HANDLE]
        
        p_box = kernel32.GlobalLock(h_clip_mem)
        if not p_box:
            return ""
        try:
            return ctypes.wstring_at(p_box)
        finally:
            kernel32.GlobalUnlock(h_clip_mem)
    finally:
        user32.CloseClipboard()

class GLGOverlayUI:
    def __init__(self, item_data):
        self.item_data = item_data
        self.root = None
        self.x = 0
        self.y = 0

    def run(self):
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
        rarity = self.item_data.get("rarity", "Rare").lower()
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
            main_frame, text=self.item_data.get("name", "Unknown Item").upper(),
            fg=title_color, bg="#0c0a09", font=("Cinzel", 14, "bold"),
            wraplength=340, justify="center"
        )
        lbl_title.pack(fill="x", pady=(15, 2))

        # Base Type
        lbl_base = tk.Label(
            main_frame, text=self.item_data.get("base", "Gear").upper(),
            fg=title_color, bg="#0c0a09", font=("Cinzel", 10),
            wraplength=340, justify="center"
        )
        lbl_base.pack(fill="x", pady=(0, 5))

        # Rarity Badge
        lbl_badge = tk.Label(
            main_frame, text=self.item_data.get("rarity", "Rare").upper(),
            fg=title_color, bg="#1a1512", font=("Inter", 7, "bold"),
            bd=1, relief="solid", padx=8, pady=2
        )
        lbl_badge.pack(pady=4)

        # Divider
        divider1 = tk.Frame(main_frame, height=2, bg="#2e2a24")
        divider1.pack(fill="x", padx=20, pady=10)

        # Requirements and Level Block
        req_text = f"Requires Level {self.item_data.get('level', 1)}   |   Item Level: {self.item_data.get('ilvl', 1)}"
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

        is_unid = self.item_data.get("is_unidentified", False)
        if is_unid:
            lbl_unid = tk.Label(
                affix_frame, text="🔒 UNIDENTIFIED UNIQUE (GGG BASE RANGES)",
                fg="#ef4444", bg="#0c0a09", font=("Inter", 8, "bold")
            )
            lbl_unid.pack(pady=(0, 6))

        # List mods
        for affix in self.item_data.get("affixes", []):
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
        flavor = self.item_data.get("flavor", "")
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
            footer_frame, text="LIVE APPRAISAL VALUE", fg="#a2a1a0",
            bg="#12100e", font=("Inter", 7, "bold")
        )
        lbl_val_header.pack(pady=(4, 0))

        lbl_price = tk.Label(
            footer_frame, text=self.item_data.get("price", "0 Chaos Orbs").upper(),
            fg="#ffd700", bg="#12100e", font=("Cinzel", 12, "bold")
        )
        lbl_price.pack(pady=(2, 2))

        lbl_logs = tk.Label(
            footer_frame, text=self.item_data.get("culling_logs", "").upper(),
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

def run_gui_process(item_data):
    ui = GLGOverlayUI(item_data)
    ui.run()

def launch_overlay_process(item_data):
    import multiprocessing
    p = multiprocessing.Process(target=run_gui_process, args=(item_data,))
    p.daemon = True
    p.start()

class GLGOverlayApp:
    def __init__(self):
        self.api_key = self.load_api_key()
        if not self.api_key:
            print("Error: Gemini API Key not found in config.json or environment variables.")
            sys.exit(1)
        self.client = genai.Client(api_key=self.api_key)

    def load_api_key(self):
        try:
            config_path = os.path.join(os.path.dirname(__file__), "config.json")
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    cfg = json.load(f)
                    key = cfg.get("default_api_key") or cfg.get("default_gemini_key")
                    if key:
                        return key
        except Exception:
            pass
        return os.environ.get("GEMINI_API_KEY")

    def simulate_ctrl_c(self):
        user32 = ctypes.windll.user32
        VK_CONTROL = 0x11
        VK_C = 0x43
        KEYEVENTF_KEYUP = 0x0002
        
        # Press Ctrl
        user32.keybd_event(VK_CONTROL, 0, 0, 0)
        # Press C
        user32.keybd_event(VK_C, 0, 0, 0)
        time.sleep(0.06)
        # Release C
        user32.keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0)
        # Release Ctrl
        user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.12) # Let Windows complete the copy to clipboard

    def appraise_clipboard(self):
        print("Alt+O Pressed! Simulating Ctrl+C and running appraisal...")
        self.simulate_ctrl_c()
        
        clipboard_text = get_clipboard_text()
        if not clipboard_text:
            print("Failed to read clipboard or clipboard empty.")
            return

        if not ("Rarity:" in clipboard_text or "Item Class:" in clipboard_text):
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
            
            # Start overlay UI in separate safe process!
            launch_overlay_process(item_data)
        except Exception as err:
            print("Gemini API appraisal failed:", err)

    def capture_and_sync_stash(self):
        print("Alt+U Pressed! Capturing PoE2 game client window...")
        
        # Aspect Ratio / Bounding Box Multiplier (0.5 for 16:9. Tweak to 0.35 for 21:9 or 0.25 for 32:9)
        CROP_PERCENT = 0.5
        
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, "Path of Exile 2")
        if not hwnd:
            hwnd = user32.FindWindowW(None, "Path of Exile")
            
        if not hwnd:
            print("Path of Exile 2 client window not found! Falling back to full primary screen capture...")
            try:
                from PIL import ImageGrab
                img = ImageGrab.grab()
            except Exception as e:
                print("Failed to capture screen:", e)
                return
        else:
            # Restore window if minimized
            if user32.IsIconic(hwnd):
                user32.ShowWindow(hwnd, 9) # SW_RESTORE
                time.sleep(0.2)
                
            # Bring window to foreground
            user32.SetForegroundWindow(hwnd)
            time.sleep(0.2)
            
            # Get window bounds
            class RECT(ctypes.Structure):
                _fields_ = [("left", ctypes.c_int),
                            ("top", ctypes.c_int),
                            ("right", ctypes.c_int),
                            ("bottom", ctypes.c_int)]
            rect = RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            
            left, top, right, bottom = rect.left, rect.top, rect.right, rect.bottom
            width = right - left
            height = bottom - top
            
            # Crop the left stash panel width
            crop_right = left + int(width * CROP_PERCENT)
            print(f"Detected game window: ({left}, {top}, {right}, {bottom}) at {width}x{height} resolution.")
            print(f"Grabbing left {CROP_PERCENT * 100}% width aspect-crop: ({left}, {top}, {crop_right}, {bottom})")
            
            try:
                from PIL import ImageGrab
                img = ImageGrab.grab(bbox=(left, top, crop_right, bottom))
            except Exception as e:
                print("Failed to grab cropped window rect, falling back to full screen:", e)
                try:
                    img = ImageGrab.grab()
                except Exception as e2:
                    print("Grab fallback failed:", e2)
                    return

        print("Scanning Currency Stash Tab via Gemini Vision OCR...")

        prompt = """
        Analyze this Path of Exile 2 Currency Stash Tab screenshot and match numbers/quantities carefully. 
        
        CRITICAL CHECK: If this image is NOT a screenshot of the actual Path of Exile 2 game client (for example, if it is a web browser page showing a countdown website, your Windows desktop background, or another application window), you MUST return a standard JSON with all currency quantities set to 0, and set the "price" key to "STASH NOT DETECTED" and the "culling_logs" key to "Verify in-game Stash Tab is active on primary screen."
        
        If it IS a valid Path of Exile 2 Currency Stash Tab, extract the exact quantities of all visible Path of Exile 2 currency items using this spatial visual guide:
        
        1. FAR-LEFT GRID (5 rows by 3 columns of slots):
           - Row 1: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III)
           - Row 2: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III)
           - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III)
           - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III)
           - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III)
        2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):
           - Row 1 (Top row): Column 1 (Left) is alchemy | Column 2 (Middle) is vaal | Column 3 (Right) is annulment
           - Row 2 (Middle row): Column 1 (Left) is chance | Column 2 (Middle) is fracturing | Column 3 (Right) is divine
           - Row 3 (Bottom row): Column 1 (Left) is hinekoras_lock | Column 2 (Middle) is mirror | Column 3 (Right) is artificer
        3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):
           - lesser_jeweller (Left, plain loop) | greater_jeweller (Middle) | perfect_jeweller (Right, with gem)
        4. SCROLL OF WISDOM:
           - scroll (Red-tied blue scroll icon on the right side)
        5. BOTTOM DUMP/LEAGUE SLOTS (located at the very bottom of the Currency Stash tab, there is a grid of slots under the main grids):
           - Identify active items from the Runes of Aldur League:
             * verisium: Verisium Ore (stacks of blue crystals/shards)
             * runic_alloy: Runic Alloy (stacks of blue metallic bars)
             * aldurs_legacy: Aldur's Legacy Rune (rare golden rune with intricate glyph)
             * iron_rune: Iron Rune (round dark grey rune with an iron symbol)
             * gold_rune: Gold Rune (round gold rune with a gold symbol)
             * stone_rune: Stone Rune (round grey stone rune with a stone symbol)
             * uncut_gem: Uncut Skill Gem (blue/green/red glowing crystal gems)

        Return a standard JSON matching this schema:
        {
          "scroll": 0, "transmute": 0, "greater_transmute": 0, "perfect_transmute": 0,
          "augmentation": 0, "greater_augmentation": 0, "perfect_augmentation": 0,
          "alchemy": 0, "regal": 0, "greater_regal": 0, "perfect_regal": 0,
          "chaos": 0, "greater_chaos": 0, "perfect_chaos": 0, "vaal": 0,
          "annulment": 0, "exalted": 0, "greater_exalted": 0, "perfect_exalted": 0,
          "divine": 0, "mirror": 0, "chance": 0, "fracturing": 0, "artificer": 0, "hinekoras_lock": 0,
          "verisium": 0, "runic_alloy": 0, "aldurs_legacy": 0, "iron_rune": 0, "gold_rune": 0, "stone_rune": 0, "uncut_gem": 0
        }
        For any completely empty slot, return 0. Extra attention to double/triple digit counts!
        """

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[img, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            data = json.loads(response.text)
            print("Stash tab OCR scan completed!")
            
            # Check visual validation safeguard
            if data.get("price") == "STASH NOT DETECTED" or data.get("culling_logs") == "Verify in-game Stash Tab is active on primary screen.":
                fail_data = {
                    "name": "Stash Not Detected!",
                    "base": "Vision OCR Sync",
                    "rarity": "Normal",
                    "level": 0,
                    "ilvl": 0,
                    "is_unidentified": False,
                    "affixes": [
                        "The scanner captured a window or screen",
                        "that does not look like Path of Exile 2.",
                        "",
                        "Please bring the PoE 2 game client into full focus",
                        "on your primary screen (Borderless Windowed) and",
                        "make sure your Currency Stash Tab is open!"
                    ],
                    "flavor": "Verify in-game Stash Tab is active on primary screen.",
                    "price": "NOT DETECTED",
                    "culling_logs": "Visual audit halted"
                }
                launch_overlay_process(fail_data)
                return
            
            # Map values down to the 18 core and league currencies
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
            
            # Calculate total net worth in Chaos
            rates = {
                "mirror": 40000.0, "divine": 150.0, "exalted": 15.0, "chaos": 1.0,
                "regal": 0.8, "vaal": 2.0, "alchemy": 0.5, "annulment": 5.0,
                "transmute": 0.2, "augmentation": 0.15, "scroll": 0.05
            }
            total_chaos = sum([qty * rates.get(k, 0.0) for k, qty in core_data.items() if k in rates])
            
            # Squeeze into a pipe-separated string
            core_keys = ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror"]
            pipe_str = "|".join([str(core_data.get(k, 0)) for k in core_keys])
            total_score = int(total_chaos * 10)
            
            # Fetch Supabase configuration (default fallbacks)
            supabase_url = "https://qqljadcpxsubawmzkecl.supabase.co"
            supabase_key = "sb_publishable_T8G6w3OtwXRG_cXd_-h9YQ_s8U9iDnx"
            guild_write_key = "BCU5C-reDUecvjLm4tV6QkGVvTGbX-Uyuyz5Xtpml5A"
            
            config_path = os.path.join(os.path.dirname(__file__), "config.json")
            if os.path.exists(config_path):
                try:
                    with open(config_path, 'r') as f:
                        cfg = json.load(f)
                        supabase_url = cfg.get("default_supabase_url") or supabase_url
                        supabase_key = cfg.get("default_supabase_anon_key") or supabase_key
                        guild_write_key = cfg.get("default_guild_write_key") or guild_write_key
                except:
                    pass
            
            # Construct push request using urllib
            import urllib.request
            import urllib.parse
            
            payload = {
                "p_name": "__GUILD_VAULT__",
                "p_data": {
                    **core_data,
                    "sync_version": "1.0"
                },
                "p_write_key": guild_write_key
            }
            
            req_data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                f"{supabase_url}/rest/v1/rpc/sync_vault_item",
                data=req_data,
                headers={
                    'User-Agent': 'Mozilla/5.0',
                    'apikey': supabase_key,
                    'Authorization': f'Bearer {supabase_key}',
                    'Content-Type': 'application/json'
                },
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=12) as response_http:
                html = response_http.read().decode('utf-8')
                print("Vault successfully synced online!")
                
                # Pop up a gorgeous sync success overlay!
                sync_result = {
                    "name": "Sync Successful!",
                    "base": "Online Guild Stash",
                    "rarity": "Unique",
                    "level": len(core_keys),
                    "ilvl": 100,
                    "is_unidentified": False,
                    "affixes": [
                        f"Mirror of Kalandra: {core_data['mirror']}x",
                        f"Divine Orb: {core_data['divine']}x",
                        f"Exalted Orb: {core_data['exalted']}x",
                        f"Chaos Orb: {core_data['chaos']}x",
                        f"Verisium Ore: {core_data['verisium']}x",
                        f"Runic Alloy: {core_data['runic_alloy']}x"
                    ],
                    "flavor": "The coffers are full, the ledger is balanced.",
                    "price": f"{total_chaos:.1f} Chaos Orbs",
                    "culling_logs": f"Approx {(total_chaos/150.0):.2f} Divine Orbs synced!"
                }
                launch_overlay_process(sync_result)
                
        except Exception as err:
            print("Stash scan or sync failed:", err)
            # Show a failure card!
            fail_data = {
                "name": "Sync Failed!",
                "base": "OCR Capture Connection",
                "rarity": "Normal",
                "level": 0,
                "ilvl": 0,
                "is_unidentified": False,
                "affixes": [
                    "Failed to capture and extract items.",
                    "Verify Borderless Windowed mode is enabled,",
                    "ensure the Stash Tab is open, and check your",
                    "Gemini API key connection status."
                ],
                "flavor": "",
                "price": "ERROR",
                "culling_logs": str(err)[:45]
            }
            launch_overlay_process(fail_data)

def listen_for_hotkey(app):
    user32 = ctypes.windll.user32
    
    # Register Alt+O for Appraisal
    if not user32.RegisterHotKey(None, HOTKEY_ID_APPRAISE, MOD_ALT, HOTKEY_KEY_APPRAISE):
        print("Warning: Failed to register global hotkey Alt+O. It might be in use by another app.")
        return

    # Register Alt+U for Stash Sync
    if not user32.RegisterHotKey(None, HOTKEY_ID_SYNC, MOD_ALT, HOTKEY_KEY_SYNC):
        print("Warning: Failed to register global hotkey Alt+U. It might be in use by another app.")
        user32.UnregisterHotKey(None, HOTKEY_ID_APPRAISE)
        return

    print("==================================================")
    print("✅ Standalone In-Game Overlay active!")
    print("--------------------------------------------------")
    print("➡️ Press Alt+O (hovered item) to appraise instantly!")
    print("➡️ Press Alt+U (stash tab open) to sync online!")
    print("==================================================")
    
    try:
        msg = ctypes.wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            if msg.message == 0x0312:  # WM_HOTKEY
                if msg.wParam == HOTKEY_ID_APPRAISE:
                    threading.Thread(target=app.appraise_clipboard, daemon=True).start()
                elif msg.wParam == HOTKEY_ID_SYNC:
                    threading.Thread(target=app.capture_and_sync_stash, daemon=True).start()
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
    finally:
        user32.UnregisterHotKey(None, HOTKEY_ID_APPRAISE)
        user32.UnregisterHotKey(None, HOTKEY_ID_SYNC)

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    
    # Initialize process-level DPI awareness for High-DPI / 4K monitor compatibility
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2) # PROCESS_PER_MONITOR_DPI_AWARE
        print("DPI Awareness set: PROCESS_PER_MONITOR_DPI_AWARE")
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
            print("DPI Awareness set: PROCESS_DPI_AWARE")
        except Exception:
            print("Failed to initialize process DPI awareness. Bounding boxes may be logical only.")
            pass
    
    print("==================================================")
    print("🔮 GLG PoE2 STANDALONE WINDOWS OVERLAY INITIATED")
    print("==================================================")
    
    app = GLGOverlayApp()
    listen_for_hotkey(app)
