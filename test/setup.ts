import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { network } from "./network";

beforeAll(() => network.enable());

// A request no test mocked fails as a network error instead of reaching the real service.
// Handlers a test adds later take precedence over this one.
beforeEach(() => {
  network.use(
    http.all("*", ({ request }) => {
      console.error(`[test] unmocked request: ${request.method} ${request.url}`);
      return HttpResponse.error();
    }),
  );
});

afterEach(() => network.resetHandlers());
afterAll(() => network.disable());
