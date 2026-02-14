/**
 * Toast notification – Used within content scripts
 */

export function showToast(message: string, type: "success" | "error" | "info" = "info"): void {
  // Remove existing toast
  const existing = document.getElementById("sidemagic-toast");
  if (existing) existing.remove();

  const colors = {
    success: { bg: "#166534", border: "#22c55e" },
    error: { bg: "#991b1b", border: "#ef4444" },
    info: { bg: "#1e3a5f", border: "#3b82f6" },
  };

  const { bg, border } = colors[type];

  const toast = document.createElement("div");
  toast.id = "sidemagic-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    background: ${bg};
    border: 1px solid ${border};
    color: #fff;
    padding: 10px 18px;
    border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    opacity: 0;
    transform: translateY(8px);
    transition: all 0.25s ease;
    pointer-events: none;
  `;

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
