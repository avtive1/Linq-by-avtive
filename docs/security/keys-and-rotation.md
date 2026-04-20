# Key Management and Rotation

## Environment Keys (Current)

- `SECURITY_KEKS_JSON`: JSON object of base64 32-byte KEKs keyed by `kid`.
- `SECURITY_ACTIVE_KEK_ID`: active KEK for new envelope encryption.
- `SECURITY_HMAC_KEY`: base64 key for deterministic lookup tags.
- `ATTENDEE_TOKEN_KEYS_JSON`: array of token keypairs `{ kid, privateKeyPem, publicKeyPem }`.
- `ATTENDEE_TOKEN_ACTIVE_KID`: active token signing key.

## Rotation Procedure

1. Add new key material to key list (`kek_vN` / `atk_vN`).
2. Set active key id env to new key.
3. Deploy app.
4. Run `scripts/reencrypt-attendees.ts` for bulk migration.
5. Keep previous keys enabled for decrypt/verify during grace period.
6. Remove old keys only after telemetry confirms migration completion.

## Cadence

- Token signing keys: 60-90 days.
- KEKs: 90-180 days.
- HMAC key: only when needed (requires recomputation of lookup tags).
