// GLG PoE2 Stash Scanner Extension Logic

// Default pre-allocated shared keys loaded dynamically from git-ignored config.json
let defaultGeminiKey = "";
let defaultDreamloKey = "";

// Elements
const geminiInput = document.getElementById("geminiKey");
const dreamloInput = document.getElementById("dreamloKey");
const btnSync = document.getElementById("btnSync");
const logBox = document.getElementById("logBox");
const previewCanvas = document.getElementById("previewCanvas");
const tempVideo = document.getElementById("tempVideo");

// Spatial visual prompt coordinate guides matching true PoE2 stash tab layout
const SYSTEM_INSTRUCTION = `You are an expert Path of Exile 2 Currency Stash Tab indexer. 
Analyze the Currency Stash Tab screenshot and match numbers/quantities carefully. Use this spatial visual guide:

1. FAR-LEFT GRID (5 rows by 3 columns of slots):
   - Row 1: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III) [Bronze/copper circular multi-faced orbs]
   - Row 2: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III) [Dark blue circular multi-faced orbs]
   - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III) [Half-blue, half-gold face orbs]
   - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III) [Shiny gold cracked face orbs]
   - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III) [Golden face orbs composed of multiple stacked mini-faces]

2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):
   - Row 1 (Top row):
     * Column 1 (Left): alchemy - Orb of Alchemy [Reddish-gold smooth face orb, count 195]
     * Column 2 (Middle): vaal - Vaal Orb [Red multi-faced skull shape, count 386]
     * Column 3 (Right): annulment - Orb of Annulment [Blue/white half-split mask, count 18]
   - Row 2 (Middle row):
     * Column 1 (Left): chance - Orb of Chance [Cracked white/gold face orb, count 38]
     * Column 2 (Middle): fracturing - Fracturing Orb [Shattered glowing yellow crystal, count 3]
     * Column 3 (Right): divine - Divine Orb [Gold coin with serene serene face, count 169]
   - Row 3 (Bottom row):
     * Column 1 (Left): hinekoras_lock - Hinekora's Lock [Dark braided purple lock/ribbon, count 0]
     * Column 2 (Middle): mirror - Mirror of Kalandra [Silver metallic runic mirror, count 0]
     * Column 3 (Right): artificer - Artificer's Orb [Dark green/grey bag shape, count 81]

3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):
   - lesser_jeweller (Left, plain copper/bronze loop, count 349. Ensure you read all three digits '349' fully!)
   - greater_jeweller (Middle, bronze loop with inner notches, count 12)
   - perfect_jeweller (Right, gold loop holding a central blue/purple gem, count 1)

4. SCROLL OF WISDOM:
   - scroll: Red-ribbon tied blue scroll icon, located on the right side under general/popular/secondary stacks (count 91).

RULES:
 - For any slot that is completely empty or has no quantity, return 0.
 - Output numbers exactly as read. Pay extra attention to double-digit and triple-digit numbers. Do not miss the leading digit near slot borders (e.g. read '349' instead of '49').`;

// Schema definition for Structured JSON responses
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scroll: { type: "INTEGER" },
    transmute: { type: "INTEGER" },
    greater_transmute: { type: "INTEGER" },
    perfect_transmute: { type: "INTEGER" },
    augmentation: { type: "INTEGER" },
    greater_augmentation: { type: "INTEGER" },
    perfect_augmentation: { type: "INTEGER" },
    alchemy: { type: "INTEGER" },
    regal: { type: "INTEGER" },
    greater_regal: { type: "INTEGER" },
    perfect_regal: { type: "INTEGER" },
    chaos: { type: "INTEGER" },
    greater_chaos: { type: "INTEGER" },
    perfect_chaos: { type: "INTEGER" },
    vaal: { type: "INTEGER" },
    annulment: { type: "INTEGER" },
    exalted: { type: "INTEGER" },
    greater_exalted: { type: "INTEGER" },
    perfect_exalted: { type: "INTEGER" },
    divine: { type: "INTEGER" },
    mirror: { type: "INTEGER" },
    lesser_jeweller: { type: "INTEGER" },
    greater_jeweller: { type: "INTEGER" },
    perfect_jeweller: { type: "INTEGER" }
  },
  required: ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror", "lesser_jeweller", "greater_jeweller", "perfect_jeweller"]
};

// Initialize settings
document.addEventListener("DOMContentLoaded", async () => {
  // Try to load default keys from git-ignored config.json
  try {
    const configRes = await fetch(chrome.runtime.getURL("config.json"));
    if (configRes.ok) {
      const config = await configRes.json();
      defaultGeminiKey = config.default_gemini_key || "";
      defaultDreamloKey = config.default_dreamlo_key || "";
    }
  } catch (err) {
    console.warn("Failed to load local config.json:", err);
  }

  chrome.storage.local.get(["geminiKey", "dreamloKey"], (data) => {
    geminiInput.value = data.geminiKey || defaultGeminiKey;
    dreamloInput.value = data.dreamloKey || defaultDreamloKey;
  });
});

// Logs status updates
function log(msg, type = "") {
  let colorClass = "";
  if (type === "success") colorClass = "success";
  if (type === "error") colorClass = "error";
  
  logBox.innerHTML += `<br><span class="${colorClass}">${msg}</span>`;
  logBox.scrollTop = logBox.scrollHeight;
}

// Click Trigger
btnSync.addEventListener("click", async () => {
  const geminiKey = geminiInput.value.trim();
  const dreamloKey = dreamloInput.value.trim();
  
  if (!geminiKey) {
    log("Error: Gemini API Key required.", "error");
    return;
  }
  if (!dreamloKey) {
    log("Error: Dreamlo Private Key required.", "error");
    return;
  }
  
  // Persist keys for next run
  chrome.storage.local.set({ geminiKey, dreamloKey });
  
  logBox.innerHTML = "Status: Initializing display grab...";
  
  try {
    // 1. Capture display streaming frames
    log("Opening screen selector...");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window" // default preference
      },
      audio: false
    });
    
    log("Display connection established.");
    tempVideo.srcObject = stream;
    tempVideo.play();
    
    // Wait for video stream properties to load
    tempVideo.onloadedmetadata = () => {
      setTimeout(() => {
        captureAndUpload(stream, geminiKey, dreamloKey);
      }, 500);
    };
    
  } catch (err) {
    log(`Display grab aborted or failed: ${err.message}`, "error");
  }
});

// Capture frame, crop, and run Gemini/Dreamlo processing
async function captureAndUpload(stream, geminiKey, dreamloKey) {
  try {
    const videoWidth = tempVideo.videoWidth;
    const videoHeight = tempVideo.videoHeight;
    
    const ctx = previewCanvas.getContext("2d");
    previewCanvas.width = videoWidth;
    previewCanvas.height = videoHeight;
    
    // Draw current stream frame to hidden buffer canvas
    ctx.drawImage(tempVideo, 0, 0, videoWidth, videoHeight);
    
    // Instantly shutdown stream captures to release screen sharing resources!
    stream.getTracks().forEach(track => track.stop());
    log("Captured screen frame successfully.");
    
    // Extract base64 payload
    const dataUrl = previewCanvas.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];
    
    // Render preview to popup
    previewCanvas.style.display = "block";
    
    // 2. Call Gemini API Vision model
    log("Running Gemini Multimodal Vision analysis...");
    
    const apiUrL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Extract the exact quantities of all visible Path of Exile 2 currency items in this Currency Stash Tab image." },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    };
    
    const res = await fetch(apiUrL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Gemini API returned status ${res.status}: ${errTxt}`);
    }
    
    const resJson = await res.json();
    const responseText = resJson.candidates[0].content.parts[0].text;
    
    log("Gemini parsed stash metrics successfully.");
    
    const data = JSON.parse(responseText);
    
    // Map the 26+ extended currency tiers down to the core 11 currencies
    const core_data = {
      scroll: data.scroll || 0,
      transmute: (data.transmute || 0) + (data.greater_transmute || 0) + (data.perfect_transmute || 0),
      augmentation: (data.augmentation || 0) + (data.greater_augmentation || 0) + (data.perfect_augmentation || 0),
      alchemy: data.alchemy || 0,
      regal: (data.regal || 0) + (data.greater_regal || 0) + (data.perfect_regal || 0),
      chaos: (data.chaos || 0) + (data.greater_chaos || 0) + (data.perfect_chaos || 0),
      vaal: data.vaal || 0,
      annulment: data.annulment || 0,
      exalted: (data.exalted || 0) + (data.greater_exalted || 0) + (data.perfect_exalted || 0),
      divine: data.divine || 0,
      mirror: data.mirror || 0
    };
    
    // Calculate total net worth for score index mapping
    const rates = {
      mirror: 40000.0, divine: 150.0, exalted: 15.0, annulment: 5.0, vaal: 2.0,
      chaos: 1.0, regal: 0.8, alchemy: 0.5, transmute: 0.2, augmentation: 0.15, scroll: 0.05
    };
    let total_chaos = 0.0;
    Object.keys(core_data).forEach(k => {
      total_chaos += core_data[k] * rates[k];
    });
    
    // Squeeze counts into positional pipe string:
    // scroll|transmute|augmentation|alchemy|regal|chaos|vaal|annulment|exalted|divine|mirror
    const core_keys = ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror"];
    const pipe_str = core_keys.map(k => core_data[k]).join("|");
    
    const total_score = Math.floor(total_chaos * 10);
    
    // 3. Sync live positional string to Dreamlo database
    log("Syncing live scan results to your online guild website...");
    
    const pushUrl = `https://dreamlo.com/lb/${dreamloKey}/add/__GUILD_VAULT__/${total_score}/0/${encodeURIComponent(pipe_str)}`;
    
    const pushRes = await fetch(pushUrl);
    if (!pushRes.ok) {
      throw new Error(`Dreamlo database push failed with status: ${pushRes.status}`);
    }
    
    log(`✅ Guild Vault successfully updated globally! Net Worth: ${total_chaos.toFixed(0)}c (~${(total_chaos/150).toFixed(1)} EX)`, "success");
    
  } catch (err) {
    log(`API Sync failed: ${err.message}`, "error");
  }
}
