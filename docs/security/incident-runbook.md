# Security Incident Runbook

## Trigger Conditions

- Repeated decrypt failures by `kid`
- Unexpected token verification failures or replay spikes
- Suspected key disclosure or unauthorized secret access

## Immediate Actions

1. Freeze risky operations (token issuance, sensitive updates).
2. Rotate active token key (`ATTENDEE_TOKEN_ACTIVE_KID`) and keep previous verify-only.
3. Rotate active KEK (`SECURITY_ACTIVE_KEK_ID`) and start lazy/bulk re-encryption.
4. Force sign-out for impacted sessions if compromise is user-facing.

## Investigation Checklist

- Confirm blast radius (`which kid`, `which fields`, `which rows`, time window).
- Review security logs and infrastructure audit logs.
- Validate no plaintext/key material was emitted in app logs.

## Recovery

- Run re-encryption migration for affected rows.
- Validate decrypt parity in staging-like snapshot.
- Monitor error rates for 24-48 hours.

## Postmortem

- Document root cause, timelines, and controls to prevent recurrence.
- Update rotation cadence, alert thresholds, and key access policy.
