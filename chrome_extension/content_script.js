// Same-origin GGG Stash API proxy to bypass Manifest V3 cross-origin cookie blocks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchStash") {
    console.log("[GLG Scanner] Forwarding same-origin fetch request for GGG Stash API:", request.url);
    
    fetch(request.url)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`GGG API returned status ${res.status}: ${text}`);
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
