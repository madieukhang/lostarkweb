// Runtime type wiring that `wrangler types` would otherwise generate: the Worker entry module,
// so `exports.default` from "cloudflare:workers" is typed, and the env shape, so `env` from
// "cloudflare:workers" carries this Worker's bindings.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  type WebEnv = import("./env").Env;
  interface Env extends WebEnv {}
}
