// Public barrel for the vantage surface. The apps/web routes import each page +
// the layout from the dedicated subpath exports (`./layout`, `./page`, `./users`,
// `./audit`, `./emails`), but this barrel re-exports the surface's shared logic so
// `@iedora/product-vantage` resolves to its building blocks by name too.
export { PLATFORM_ADMIN, isSuperAdmin, requireSuperAdmin } from './gate'
export { logView } from './audit'
export { audit, email, manage } from './clients'
