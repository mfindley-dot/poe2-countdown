# 🛡️ PoE2 Gemini Vision Stash Scanner Prototype

A standalone, local Python utility that uses **Gemini 2.5 Multimodal Vision** with **Structured Outputs** to scan your Path of Exile 2 currency stash tab in a single screenshot, instantly extracting all item counts into a clean JSON database payload.

---

## 🚀 Quick Setup

1. **Install Dependencies**:
   Ensure you have Python 3.8+ installed, then install the modern Google GenAI library and Pillow image handling:
   ```bash
   pip install google-genai pydantic pillow
   ```

2. **Set your Gemini API Key**:
   Set your API key in your terminal environment variables:
   *   **Windows (PowerShell)**:
       ```powershell
       $env:GEMINI_API_KEY="AIzaSyYourKeyHere..."
       ```
   *   **Linux/macOS (Terminal)**:
       ```bash
       export GEMINI_API_KEY="AIzaSyYourKeyHere..."
       ```

---

## 🧪 How to Test and Verify

### Phase 1: Test with a Local Screenshot File (Recommended First Step)
1. Open Path of Exile 2, navigate to your **Currency Stash Tab**, and take a standard screenshot (e.g. using `Win + Shift + S` or the `PrintScreen` key).
2. Save this screenshot as `stash.png` directly inside the `scanner_prototype/` folder.
3. Run the script in **File Mode**:
   ```bash
   python stash_scanner.py --file stash.png
   ```
4. **Inspect Debug Image**: The script will write a cropped preview of what was sent to `debug/scan_input_debug.png` so you can visually verify the image bounds.
5. **Watch the Magic**: Gemini will analyze the image, match currency counts to the structured schema, and print pure JSON directly to your terminal:
   ```json
   {
     "scroll": 140,
     "transmute": 42,
     "augmentation": 80,
     "alchemy": 25,
     "regal": 8,
     "chaos": 112,
     "vaal": 14,
     "annulment": 3,
     "exalted": 4,
     "divine": 2,
     "mirror": 0
   }
   ```

---

### Phase 2: Live Monitor Capture Mode
1. Open Path of Exile 2 in **Borderless Windowed Mode** with your Currency Stash Tab open.
2. Run the script in **Screen Mode**:
   ```bash
   python stash_scanner.py --capture
   ```
3. The script captures your primary monitor, submits the frame to Gemini, and prints the active stash quantities immediately!

---

## 🖥️ Ultrawide & 4K Bounding Box Crop Traps
If you are playing on a high-resolution display (4K / 1440p) or a 21:9 / 32:9 ultrawide monitor, uploading the massive raw screenshot takes unnecessary bandwidth and increases latency.

You can specify a localized **Crop Box** coordinate parameter `--crop left,top,right,bottom` to crop out empty game terrain and only submit the stash tab itself:

*   **Example (1080p Crop Box)**:
    ```bash
    python stash_scanner.py --capture --crop 150,120,1100,900
    ```
*   **Example (4K Crop Box)**:
    ```bash
    python stash_scanner.py --capture --crop 300,240,2200,1800
    ```

Check `debug/scan_input_debug.png` after running a cropped scan to visually adjust the coordinates until your Currency Stash Tab fits perfectly inside the box!

---

## 🔒 Security Notice
*   **Never share your API Key**: The script is configured to read the key from the environment variable (`GEMINI_API_KEY`) so you never have to hardcode or commit keys to git repositories.

---

## 🔮 GLG PoE2 Standalone Windows Overlay (`glg_stash_overlay.py`)

We have created an incredibly premium, lightweight, standalone **in-game transparent overlay** (`glg_stash_overlay.py`) that operates exactly like Overwolf's desktop overlays (like Awakened PoE Trade) but with **zero installation overhead and zero background memory bloat**!

### 🌟 Features:
1. **Global Keyboard Hook**: Runs in the background of your Windows OS, listening globally for **`Alt + O`** using native Windows API RegisterHotKey triggers.
2. **One-Press Borderless Appraisal**:
   - Hover your cursor over any item in your game stash or inventory and press **`Ctrl + C`** (standard Path of Exile item copy).
   - Press **`Alt + O`** directly from inside the game (no Alt-Tabbing required!).
3. **Immersive Gothic Transparent Card**: The script fetches your clipboard, appraises it via the Gemini API, and instantly spawns a beautiful, borderless, transparent, "always-on-top" floating card right on top of your Path of Exile 2 game client!
4. **Authentic PoE Aesthetics**: Color-codes headers by rarity (Unique orange, Rare yellow, Magic blue), lists implicit/explicit modifiers, renders locked warning badges for unidentified items, and displays live Divine/Chaos appraisals with culling audit logs!
5. **Auto-Dismiss Timer**: The overlay automatically closes after 10 seconds (or you can click **`✕`** or drag it anywhere on screen by clicking and holding) to keep your combat space clean!

### 🚀 How to Run the Overlay:
1. Ensure you have installed the modern Google GenAI library:
   ```bash
   pip install google-genai pillow
   ```
2. Run the script:
   ```bash
   python scanner_prototype/glg_stash_overlay.py
   ```
3. **Watch the output**: You will see confirmation `✅ Global In-Game Overlay Active! Press Alt+O anywhere to appraise your clipboard item.`
4. **Play and Trade**: Keep this script running in the background while you play Path of Exile 2 in Borderless Windowed mode!

