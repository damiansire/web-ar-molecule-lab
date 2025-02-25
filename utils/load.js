export function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.onload = () => {
      const scriptName = url.substring(url.lastIndexOf("/") + 1);
      const event = new CustomEvent("scriptLoaded", {
        detail: {
          scriptName: scriptName,
        },
      });
      document.dispatchEvent(event);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script from ${url}`));
    document.head.appendChild(script);
  });
}
