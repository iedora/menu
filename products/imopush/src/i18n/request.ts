import { getRequestConfig } from 'next-intl/server'

type Messages = Record<string, unknown>

function mergeCatalogs(base: Messages, partial: Messages): Messages {
  const out: Messages = { ...base }
  for (const [key, value] of Object.entries(partial)) {
    const baseVal = base[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[key] = mergeCatalogs(baseVal as Messages, value as Messages)
    } else {
      out[key] = value
    }
  }
  return out
}

export default getRequestConfig(async () => {
  const base: Messages = (await import(`./messages/en.json`)).default
  let messages: Messages = base
  const locale = 'pt'

  try {
    const partial: Messages = (await import(`./messages/${locale}.json`)).default
    messages = mergeCatalogs(base, partial)
  } catch {
    // No catalog file — keep English fallback.
  }

  return { locale, messages }
})
