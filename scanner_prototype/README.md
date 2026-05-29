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
