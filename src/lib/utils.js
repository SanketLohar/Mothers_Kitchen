import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Capitalizes each word in a string (Title / Proper Case).
 * e.g., "wakad" -> "Wakad", "pune" -> "Pune", "green valley" -> "Green Valley"
 */
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)[a-z]/g, (match) => match.toUpperCase());
}

/**
 * Formats a date or timestamp into a human-readable relative time string.
 * e.g., "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", or "12 Oct 2026"
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return "Recently";
  let d = dateInput;
  if (typeof dateInput.toDate === "function") {
    d = dateInput.toDate();
  } else if (dateInput.seconds) {
    d = new Date(dateInput.seconds * 1000);
  } else if (typeof dateInput === "string" || typeof dateInput === "number") {
    d = new Date(dateInput);
  }

  if (!(d instanceof Date) || isNaN(d.getTime())) return "Recently";

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}
