# @iedora/ai

Provider-agnostic AI surface. **Only** owns vendor wiring (base URL, env
var, model id). Schemas, prompts, ports and use-cases live in the
consuming product — this package has zero domain knowledge.

## Usage

```ts
import { createKimiClient } from '@iedora/ai/kimi'
import { generateObject } from 'ai'

const kimi = createKimiClient()        // reads MOONSHOT_API_KEY
const model = kimi.model({ kind: 'vision' })

const { object } = await generateObject({
  model,
  schema: MyZodSchema,                 // owned by the product
  system: MY_SYSTEM_PROMPT,            // owned by the product
  messages: [/* … */],
})
```

For text-only flows: `kimi.model({ kind: 'text' })` (defaults to
`kimi-k2.6`). Override any id via `kimi.model({ model: 'foo' })`.

## Providers

| Provider | Env var            | `kind` presets                                                                |
| -------- | ------------------ | ----------------------------------------------------------------------------- |
| Kimi     | `MOONSHOT_API_KEY` | `text` → `kimi-k2.6`, `vision` → `moonshot-v1-32k-vision-preview`             |
| DeepSeek | `DEEPSEEK_API_KEY` | `flash` → `deepseek-v4-flash`, `pro` → `deepseek-v4-pro` (text-only for now)  |

### DeepSeek vision caveat

DeepSeek V4 advertises multimodal, but combining `image_url` content
parts with `generateObject` (json_object response_format) currently
400s with `unknown variant 'image_url'` — see
[vercel/ai#9179](https://github.com/vercel/ai/issues/9179). Route image
input through Kimi vision until upstream lands a fix.

## Adding a provider

1. New file `src/<vendor>.ts` exporting `create<Vendor>Client()`.
2. Mirror the shape: return `{ model(opts), raw }`.
3. Add a `./vendor` entry to `exports` in `package.json`.
4. Re-export from `src/index.ts`.

No registry, no auto-discovery — consumers pick at the import site.
