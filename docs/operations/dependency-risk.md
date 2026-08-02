# Dependency Risk Register

## Neon Auth beta dependency chain

`@neondatabase/auth@0.4.2-beta` is the latest published Neon Auth version as of the last dependency audit. It embeds a vulnerable `better-auth` release and is the source of the remaining critical `npm audit` finding.

Do not use `npm audit fix --force` for this issue: npm cannot provide a compatible target and forcing it would replace the managed Neon Auth integration without an authentication migration.

Required remediation is an upstream Neon Auth release that upgrades its Better Auth dependency, or a planned replacement of Neon Auth. Until then, keep the affected dependency under review, avoid enabling unused OAuth, OIDC-provider, MCP, magic-link, or email-OTP features, and retain the application-level origin checks and session protections already in place.
