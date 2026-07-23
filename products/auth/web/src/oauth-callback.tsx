"use client"

import { isSameIedoraOrigin } from "@iedora/brand"
import { useEffect, useState } from "react"

import { completeOAuthAction } from "./actions.ts"

/**
 * Where the auth service redirects after a provider (Google, …) sign-in. Tokens
 * arrive in the URL FRAGMENT (never sent to a server); we read them here, hand
 * them to a server action that verifies + sets the shared session cookies, scrub
 * the fragment, then full-page-navigate to `next`.
 */
export default function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const accessToken = hash.get("access_token")
    const refreshToken = hash.get("refresh_token")
    const nextRaw = new URLSearchParams(window.location.search).get("next")
    const next = nextRaw && isSameIedoraOrigin(nextRaw) ? nextRaw : "/"
    // Scrub tokens from the address bar immediately.
    window.history.replaceState(null, "", window.location.pathname)

    if (!accessToken || !refreshToken) {
      setError("Sign-in was cancelled or the link expired.")
      return
    }
    completeOAuthAction(accessToken, refreshToken).then((res) => {
      if (res.error) setError(res.error.message)
      else window.location.assign(next)
    })
  }, [])

  return (
    <div className="grid min-h-[40vh] place-items-center">
      {error ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <a href="/sign-in" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  )
}
