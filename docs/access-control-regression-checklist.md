# Access Control Regression Checklist

Use this checklist before production deploys and after RBAC-related changes.

## 1) Owner / Organization Admin

- Can open campaign detail page and see `Requests (N)` when there are pending requests.
- Can approve and reject pending requests; requester sees updated status.
- Can open `Access Control` and view active grants for that event.
- Can revoke any active grant and verify restricted actions are blocked for member.
- Can add/update organization members with role label and default permissions.

## 2) Member Experience

- Member can view campaigns and attendee cards.
- Member without grants sees `Take Access` on restricted actions.
- Member can submit access request with selected action + optional note.
- Member receives confirmation toast and request appears in owner inbox.
- Approved member can perform only granted actions.

## 3) Permission Boundaries

- `manage_event` grants event edit/sponsor/duplicate/delete-event actions.
- `edit_cards` grants attendee card edit only.
- `delete_cards` grants attendee card delete only.
- Revoked permission removes access immediately after reload.
- No member can use owner endpoints for events they do not own.

## 4) Notification and Audit

- Owner notification is attempted on request creation.
- Requester notification is attempted on request approval/rejection.
- `owner_notified_at` and `requester_notified_at` are populated on success.
- `notification_error` is populated when email provider fails.

## 5) Database / Security

- Run latest migrations including RLS + role template migration.
- Verify RLS is enabled on: `access_requests`, `access_grants`, `organization_members`, `organization_role_permission_templates`.
- Verify policies allow only owner/requester/member scoped access.
- Confirm there are no anonymous write paths for protected RBAC tables.

## 6) Quick Smoke Script (manual)

1. Sign in as owner and create an event.
2. Add a member with role label and default permissions.
3. Sign in as member and confirm only default-permitted actions work.
4. Try forbidden action as member and submit request from `Take Access`.
5. Sign in as owner, approve request, and verify member can now perform action.
6. Owner revokes grant from `Access Control`; member action becomes blocked again.
