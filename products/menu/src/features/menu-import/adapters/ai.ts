/**
 * Active AI provider for menu-import. One line, on purpose: swapping
 * provider is a single-file change here. The vendor model + auth lives
 * in `@iedora/ai`; the adapter glues that to the menu-import
 * port and prompts in `ai-shared.ts`.
 *
 * Consumers (server actions, use-cases) depend on `ImageAnalysisPort`,
 * never on the concrete adapter — `actions.ts` always imports
 * `menuAnalysisAdapter` from this file.
 */
import 'server-only'
import { createKimiAdapter } from './ai-kimi'

export const menuAnalysisAdapter = createKimiAdapter()
