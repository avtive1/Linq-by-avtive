# Data Classification and Ownership

## Attendees Table

| Field | Class | Owner | Handling |
|---|---|---|---|
| `card_email` | A | Security | AES-256-GCM envelope encrypted at rest; deterministic HMAC lookup tag |
| `linkedin` | A | Security | AES-256-GCM envelope encrypted at rest |
| `name`, `role`, `company` | C | Product | Public card display fields |
| `event_name`, `session_date`, `session_time`, `location` | C | Product | Public event card metadata |
| `track`, `year`, `design_type`, `card_color`, `card_font` | C | Product | Presentation/configuration only |
| `photo_url`, `card_preview_url` | C | Product | Rendered publicly in card/share contexts |

## Notes

- Class A fields are decrypted only inside server-side trusted paths.
- New writes encrypt Class A fields before persistence.
- Reads perform lazy re-encryption when plaintext or old `kid` data is detected.
