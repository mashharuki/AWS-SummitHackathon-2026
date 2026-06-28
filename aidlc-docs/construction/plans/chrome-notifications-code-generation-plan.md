# Code Generation Plan: Chrome Notifications

## Unit Context

- Target: `pkgs/extension`
- Scope: Chrome OS notifications for task detection and successful Slack replies
- Dependencies: Existing content script detection, Side Panel judge/reply flow, Manifest V3 background service worker
- Interfaces: `NEW_SLACK_MESSAGE`, `TASK_REPLY_COMPLETED`, `GET_PENDING_TASK`
- Security: Notification text is limited to sender name and a normalized 80-character preview. Tokens, email addresses, and full Slack messages are not included.

## Execution Steps

- [x] Step 1: Inspect the existing extension architecture, tests, Chrome API mocks, and enabled AI-DLC extensions.
- [x] Step 2: Add shared message and notification settings types.
- [x] Step 3: Add the `notifications` manifest permission.
- [x] Step 4: Implement background notification creation, deduplication, pending-task session storage, Side Panel connection tracking, and notification-click window restoration.
- [x] Step 5: Update the content script to use the shared message contract.
- [x] Step 6: Add Side Panel pending-task restoration, successful-reply completion events, notification settings persistence, and denied-permission guidance.
- [x] Step 7: Extend Chrome API test mocks and add focused background/settings/panel tests.
- [x] Step 8: Run extension tests, type checking, Biome, and production build.
- [x] Step 9: Run repository-wide regression checks required by the approved plan.
- [x] Step 10: Write the code generation summary, update `aidlc-state.md`, and append final verification results to `audit.md`.

## Verification Traceability

- Detection notification is created once per task.
- Detection notification is suppressed while the Side Panel is connected.
- Completion notification is created even while the Side Panel is connected.
- Failed replies do not emit completion events.
- Settings persist in `chrome.storage.local` and gate notification categories.
- Notification clicks focus the saved Chrome window and open the Side Panel.
- Tasks detected while the panel is hidden are restored from `chrome.storage.session`.

This plan is the single source of truth for this Code Generation unit.
