"use client"

import { Button } from "@iedora/ui/components/ui/button"

import { OAUTH_PROVIDERS, oauthAuthorizeUrl } from "./oauth-client.ts"

// Human label per provider id. Unknown ids fall back to a title-cased id.
const LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
}

function label(id: string): string {
  return LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

/** OAuth sign-in buttons + an "or" divider. Renders nothing when no providers are
 *  configured, so the email/password form stands alone. */
export function OAuthButtons({ next }: { next: string }) {
  if (OAUTH_PROVIDERS.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {OAUTH_PROVIDERS.map((id) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => window.location.assign(oauthAuthorizeUrl(id, next))}
          >
            Continue with {label(id)}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
