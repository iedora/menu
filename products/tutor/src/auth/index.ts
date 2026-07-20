import { type AuthNext, createAuthNext } from "@iedora/auth-sdk-nextjs"

import { authConfig } from "./config"

// Student bootstrap (every account can book/chat immediately; tutors are promoted
// separately) is now lazy in the tutor service's `GET /api/me` — the first
// authenticated request with no profile creates the student. The web holds no DB.
export const authNext: AuthNext = createAuthNext(authConfig)
