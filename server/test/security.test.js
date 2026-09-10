import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { securityHeaders } from "../src/security.js";

for (const [origin, localHttp] of [
  ["http://localhost:3000", true],
  ["http://127.0.0.1:3000", true],
  ["http://[::1]:3000", true],
  ["https://antlysis-loyalty.axelyn.com", false],
  ["https://localhost:3000", false],
  ["http://example.com", false]
]) {
  test(`security headers support configured origin ${origin}`, async (t) => {
    const app = express();
    app.use(securityHeaders(origin));
    app.get("/", (_req, res) => res.send("ok"));
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await once(server, "listening");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    await response.text();
    const csp = response.headers.get("content-security-policy");
    assert.equal(csp.includes("upgrade-insecure-requests"), !localHttp);
    assert.equal(response.headers.has("strict-transport-security"), !localHttp);
    assert.ok(csp.includes("script-src 'self'"));
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
}
