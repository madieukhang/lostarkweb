// Names the Worker entry module for the runtime types, so `exports.default` from
// "cloudflare:workers" is typed. `wrangler types` would generate the same declaration.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
}
