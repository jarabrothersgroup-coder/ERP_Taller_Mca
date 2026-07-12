/**
 * Ambient module declarations for optional/lazy-loaded dependencies.
 *
 * `stripe` is imported dynamically only in production (when STRIPE_SECRET_KEY
 * is set) to keep the local RAM footprint low. It is declared here so the
 * type-checker is satisfied without requiring the package to be installed
 * in every environment. Install with `npm install stripe` for full types.
 */

declare module "stripe";
