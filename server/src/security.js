import helmet from "helmet";

export function securityHeaders(clientOrigin) {
  const origin = new URL(clientOrigin);
  // Local Docker also runs with NODE_ENV=production, so use the configured
  // browser origin instead. Never derive this exception from request headers.
  const localHttp = origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);

  return helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: {
      directives: { "upgrade-insecure-requests": localHttp ? null : [] }
    },
    strictTransportSecurity: localHttp ? false : undefined
  });
}
