/**
 * test/network.ts
 * Shared outbound-request mock (msw) for the gateway tests.
 */
import { setupNetwork } from "@msw/cloudflare";

export const network = setupNetwork();
