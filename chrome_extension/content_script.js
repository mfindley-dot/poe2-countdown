// Same-origin GGG Stash API proxy to bypass Manifest V3 cross-origin cookie blocks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchStash") {
    console.log("[GLG Scanner] Forwarding same-origin fetch request for GGG Stash API:", request.url);
    
    fetch(request.url)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          let cleanMsg = text.length > 150 ? text.substring(0, 150) + "..." : text;
          if (text.includes("Permission Denied")) {
            cleanMsg = "Permission Denied (403). Make sure your GGG Account Name uses a hyphen instead of a hashtag (e.g. Radiocommander-0376).";
          }
          throw new Error(cleanMsg);
        }
        return res.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("[GLG Scanner] Stash fetch failed:", err);
        sendResponse({ success: false, error: err.message });
      });
      
    return true; // Keep the message channel open for asynchronous sendResponse
  }
});
