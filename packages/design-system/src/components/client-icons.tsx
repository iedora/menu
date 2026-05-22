import type { SVGProps } from "react";

/**
 * Client-context icons — browsers and operating systems — used by admin
 * surfaces to label session rows, scan histograms, and any other place
 * that needs to identify a client device by its vendor mark.
 *
 * Each glyph is a self-contained SVG with its own gradient defs so the
 * set can be tree-shaken or extended without leaking ids across the
 * page. Resolution helpers (`BrowserIcon`, `OsIcon`) dispatch on a
 * loosely-matched name string ("Chrome", "macOS", …) so callers can
 * pass parsed user-agent labels straight through.
 */

// ── Browsers ─────────────────────────────────────────────────────────

function ChromeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx={12} cy={12} r={10} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={0.5} />
      <path d="M12 2A10 10 0 0 0 3.54 7l3.77 6.5A4 4 0 0 1 12 8h8.66A10 10 0 0 0 12 2z" fill="#EA4335" />
      <path d="M3.54 7a10 10 0 0 0 8.46 15l3.77-6.5A4 4 0 0 1 8.54 14l-5-7z" fill="#34A853" />
      <path d="M12 22a10 10 0 0 0 8.46-15H12a4 4 0 0 1-3.46 6.5l3.46 6.5z" fill="#FBBC05" />
      <circle cx={12} cy={12} r={4} fill="#4285F4" stroke="#FFFFFF" strokeWidth={1.5} />
    </svg>
  );
}

function SafariIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-safari" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#41C5FA" />
          <stop offset="100%" stopColor="#0575E6" />
        </linearGradient>
      </defs>
      <circle cx={12} cy={12} r={10} fill="url(#ds-safari)" />
      <circle cx={12} cy={12} r={8.5} stroke="#FFFFFF" strokeWidth={0.75} strokeDasharray="1,2" />
      <polygon points="12,4.5 14,12 12,13.5" fill="#FF3B30" />
      <polygon points="12,19.5 10,12 12,10.5" fill="#E5E5EA" />
      <polygon points="12,10.5 14,12 12,13.5" fill="#D1D1D6" />
      <polygon points="12,13.5 10,12 12,10.5" fill="#FFFFFF" />
      <circle cx={12} cy={12} r={1.5} fill="#FFFFFF" />
    </svg>
  );
}

function FirefoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-firefox-globe" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#2D60FF" />
          <stop offset="100%" stopColor="#0B1C66" />
        </linearGradient>
        <linearGradient id="ds-firefox-fox" x1="2" y1="22" x2="22" y2="2">
          <stop offset="0%" stopColor="#FF1E00" />
          <stop offset="60%" stopColor="#FF9000" />
          <stop offset="100%" stopColor="#FFD200" />
        </linearGradient>
      </defs>
      <circle cx={12} cy={12} r={10} fill="url(#ds-firefox-globe)" />
      <path d="M20.5 10c.3-1.5-.2-3-1.2-4-1 .8-2.3.8-3.3.3C15 5.3 14 3.5 12 3c1 .8 1.5 2 1.5 3s-.8 2.2-2 2c-1-.2-2-1-2.5.2-.5 1.2.5 2.5 1.5 3 .8.4 1 1 .5 1.5s-1.5.5-2.2-.2c-1-.9-2.5-1.2-3.3-.3-.8 1-.8 2.5-.2 3.5.5 1 1.5 1.8 2.5 2 1.2.2 2.5-.2 3.2-1.2.5.8.3 2-.3 2.7-.8.9-2.2.9-3.2.4-.8-.4-1.2 0-1 1A10 10 0 0 0 21 12c0-.7-.2-1.4-.5-2z" fill="url(#ds-firefox-fox)" />
    </svg>
  );
}

function EdgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-edge" x1="2" y1="22" x2="22" y2="2">
          <stop offset="0%" stopColor="#005B9A" />
          <stop offset="40%" stopColor="#00A1E6" />
          <stop offset="80%" stopColor="#00CBB8" />
          <stop offset="100%" stopColor="#76E52F" />
        </linearGradient>
      </defs>
      <path d="M12 2A10 10 0 0 0 2 12c0 4.2 2.6 7.8 6.3 9.3 2.4.9 5 .2 6.7-1.5.5-.5.9-1 1.2-1.6.4-.8.8-1.7 1-2.7.2-1 .2-2-.1-3a3 3 0 0 0-3-3H7a5 5 0 0 1 8-4.5c.3.3.6.6.8.9.4.6.8 1.3 1 2 .2.7.3 1.5.3 2.2 0 .8-.1 1.6-.3 2.4l.2.1a7 7 0 0 0 .5-6.6c-.3-1-.9-2-1.7-2.8C16.8 3.5 14.5 2 12 2z" fill="url(#ds-edge)" />
    </svg>
  );
}

function OperaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-opera" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#FF3030" />
          <stop offset="100%" stopColor="#9E0000" />
        </linearGradient>
      </defs>
      <circle cx={12} cy={12} r={10} fill="url(#ds-opera)" />
      <ellipse cx={12} cy={12} rx={4.5} ry={7.5} fill="#FFFFFF" />
      <ellipse cx={12} cy={12} rx={2.5} ry={5.5} fill="url(#ds-opera)" />
    </svg>
  );
}

function GenericBrowserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-generic-browser" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4A90E2" />
          <stop offset="100%" stopColor="#357ABD" />
        </linearGradient>
      </defs>
      <circle cx={12} cy={12} r={10} fill="url(#ds-generic-browser)" />
      <circle cx={12} cy={12} r={9.25} stroke="#FFFFFF" strokeWidth={0.75} opacity={0.5} />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#FFFFFF" strokeWidth={0.75} opacity={0.5} />
      <ellipse cx={12} cy={12} rx={3.5} ry={9.5} stroke="#FFFFFF" strokeWidth={0.75} opacity={0.5} />
    </svg>
  );
}

// ── Operating systems ────────────────────────────────────────────────

function AppleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-apple" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#555555" />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>
      </defs>
      <path d="M12 19c-1.38 0-2.5-.83-3.62-.83-1.13 0-2 .83-3.38.83A4.7 4.7 0 0 1 1 14.17a6.6 6.6 0 0 1 3.5-5.83c1.38-.83 2.62-.33 3.5-.33.88 0 2.25-.58 3.5-.42a4.42 4.42 0 0 1 3.5 2.25 4.3 4.3 0 0 0-2.62 3.83c0 2.38 2 3.21 2.05 3.25a4.7 4.7 0 0 1-3.43 2.08M13.25 7a3.83 3.83 0 0 1-2.5-3.33 3.63 3.63 0 0 1 2.67-3.17c.05 1 .38 2.25-1 3.25" fill="url(#ds-apple)" />
    </svg>
  );
}

function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M1.5 12.2h9.5v-9.5L1.5 4.2v8z" fill="#00ADEF" />
      <path d="M12.5 12.2H22.5V2.5L12.5 1v11.2z" fill="#00ADEF" />
      <path d="M1.5 13.8v8l9.5-1.5v-6.5H1.5z" fill="#00ADEF" />
      <path d="M12.5 13.8v6.5l10 1.5v-8H12.5z" fill="#00ADEF" />
    </svg>
  );
}

function LinuxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ds-tux-beak" x1="10" y1="8" x2="14" y2="12">
          <stop offset="0%" stopColor="#FFA600" />
          <stop offset="100%" stopColor="#FF6200" />
        </linearGradient>
      </defs>
      <path d="M12 2c-3.5 0-6 2.5-6 6.5 0 2 1 3.5 1.5 5S6.5 16 6.5 18c0 2.5 2 4 5.5 4s5.5-1.5 5.5-4c0-2-1-3.5-1-5s1.5-3 1.5-5c0-4-2.5-6.5-6-6.5z" fill="#1C1917" />
      <path d="M12 5.5c-2 0-3.5 1.5-3.5 4.5 0 1.8.8 3.2 1.5 4.5.7 1.3-.2 1.5-.2 2.5 0 1.5 1 2.5 2.2 2.5s2.2-1 2.2-2.5c0-1-.9-1.2-.2-2.5.7-1.3 1.5-2.7 1.5-4.5 0-3-1.5-4.5-3.5-4.5z" fill="#FFFFFF" />
      <circle cx={10} cy={8.5} r={1} fill="#000000" />
      <circle cx={14} cy={8.5} r={1} fill="#000000" />
      <path d="M11 9.5c.5.5 1.5.5 2 0l.5 1c-.3.5-.8.8-1.5.8s-1.2-.3-1.5-.8l.5-1z" fill="url(#ds-tux-beak)" />
      <path d="M6 21c0-1 1-1.5 2-1.5s1.5.5 2 .5M18 21c0-1-1-1.5-2-1.5s-1.5.5-2 .5" stroke="url(#ds-tux-beak)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function AndroidIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M17 11.5a5 5 0 0 0-10 0v1.5h10v-1.5z" fill="#3DDC84" />
      <path d="M6 14.5h12v4.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4.5z" fill="#3DDC84" />
      <path d="M8.5 5.5L7 3M15.5 5.5l1.5-2.5" stroke="#3DDC84" strokeWidth={1.25} strokeLinecap="round" />
      <circle cx={10} cy={10.5} r={0.75} fill="#FFFFFF" />
      <circle cx={14} cy={10.5} r={0.75} fill="#FFFFFF" />
      <rect x={3.5} y={12} width={1.5} height={5.5} rx={0.75} fill="#3DDC84" />
      <rect x={19} y={12} width={1.5} height={5.5} rx={0.75} fill="#3DDC84" />
    </svg>
  );
}

function GenericDeviceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="ds-generic-device" x1="3" y1="4" x2="21" y2="16">
          <stop offset="0%" stopColor="#7F8C8D" />
          <stop offset="100%" stopColor="#2C3E50" />
        </linearGradient>
      </defs>
      <rect x={3} y={4} width={18} height={12} rx={2} fill="url(#ds-generic-device)" stroke="none" />
      <rect x={3} y={4} width={18} height={12} rx={2} stroke="currentColor" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  );
}

// ── Resolvers ────────────────────────────────────────────────────────

type IconBoxProps = { name: string; className?: string };

/**
 * Resolves a browser name (`"Chrome"`, `"Safari"`, …) to the matching
 * vendor icon. Falls back to a generic globe when nothing matches so
 * histograms keep their alignment.
 */
export function BrowserIcon({ name, className }: IconBoxProps) {
  const n = name.toLowerCase();
  if (n.includes("chrome")) return <ChromeIcon className={className} />;
  if (n.includes("safari")) return <SafariIcon className={className} />;
  if (n.includes("firefox")) return <FirefoxIcon className={className} />;
  if (n.includes("edge")) return <EdgeIcon className={className} />;
  if (n.includes("opera")) return <OperaIcon className={className} />;
  return <GenericBrowserIcon className={className} />;
}

/**
 * Resolves an OS name (`"macOS"`, `"iOS"`, `"Windows"`, …) to the matching
 * platform mark. Apple covers both macOS and iOS; everything unknown
 * gets the generic device glyph.
 */
export function OsIcon({ name, className }: IconBoxProps) {
  const n = name.toLowerCase();
  if (n.includes("macos") || n.includes("mac os x") || n === "mac") {
    return <AppleIcon className={className} />;
  }
  if (n.includes("ios") || n.includes("iphone") || n.includes("ipad")) {
    return <AppleIcon className={className} />;
  }
  if (n.includes("windows")) return <WindowsIcon className={className} />;
  if (n.includes("linux")) return <LinuxIcon className={className} />;
  if (n.includes("android")) return <AndroidIcon className={className} />;
  return <GenericDeviceIcon className={className} />;
}
