// Vantage surface route — delegates to the @iedora/product-vantage package.
// The gated console layout + its metadata live in the product; this thin route
// file wires them into apps/web's app router (mirrors app/house/page.tsx).
export { default, metadata } from '@iedora/product-vantage/layout'
