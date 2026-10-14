# Mashwar — Order Chat, Voice Notes & Accessible Communication

**Status:** Product/security specification. No live messaging, recording, transcription, or push integration is implied by this document.

## 1. Product objective

Let customers and delivery captains coordinate an active order even when one party has difficulty reading or typing. Support text and short recorded voice notes in the same order conversation. The feature must be usable from the Flutter app and the customer web app, with the same conversation and authorization rules.

## 2. Conversation model

- One authorized conversation per order by default; participants are the customer, assigned captain, and explicitly authorized operations/support staff.
- Before assignment, the customer may message support, but must not receive a direct chat channel to an arbitrary captain.
- A reassignment closes the previous captain's ability to send new messages; historical access follows a documented support/audit policy.
- Suggested message fields: `id`, `order_id`, `conversation_id`, `sender_user_id`, `message_type` (`text` or `voice_note`), `text_body`, `attachment_id`, `duration_ms`, `created_at`, `edited_at` (if edits are permitted), `deleted_at` (soft-delete/moderation only), `client_message_id`, and delivery/read timestamps where justified.
- Suggested durable entities: `order_conversations`, `conversation_participants`, `conversation_messages`, `private_message_attachments`, and `message_delivery_events`. Reconcile with the existing data model before adding migrations.

## 3. Voice recording UX

- Mobile: press-and-hold or tap-to-record with a clear recording timer, stop/cancel controls, and a preview/playback step before sending.
- Web: use `MediaRecorder` only after an explicit microphone permission action; show a clear denied/unavailable state and allow text as fallback.
- Show waveform/duration only when derived from the actual recorded file; do not render fake recording progress.
- Support playback speed and replay if feasible, plus accessible labels and large controls.
- Apply configurable duration/file-size limits, supported MIME/codec validation, upload progress, retry, and cancellation. Exact limits are operational decisions.
- Do not auto-record, auto-send, or request microphone permission on page load.
- Speech-to-text, text-to-speech, live voice calls, and AI transcription are separate features requiring explicit product/privacy/cost decisions; they are not implied by voice notes.

## 4. Message delivery and reliability

- Persist each message before reporting it as sent. Use client-generated idempotency IDs to avoid duplicate sends on retries.
- The server verifies that the actor is an active conversation participant and is authorized for the order at send and read time.
- Provide pending/sent/failed states; retry failed sends safely.
- Use a realtime provider adapter (for example Supabase Realtime or an authenticated WebSocket service) only after the durable database and authorization rules are ready. A polling fallback may be used during early rollout, with bounded intervals and rate limits.
- Do not treat push notifications as message storage. Push should contain no sensitive message body or exact address; it only notifies the user to open the authorized conversation.
- Support offline drafts and queueing only if local storage is appropriately protected and the UI distinguishes queued from server-confirmed messages.

## 5. Privacy, security and moderation

- Private audio lives in a private object-storage bucket, never a public URL. The API issues short-lived download URLs after checking the current user's conversation membership and order access.
- Validate file signature/MIME, size and duration on the server; use generated storage keys, malware scanning where available, and content-type-safe delivery.
- Never put raw audio, private URLs, tokens, national IDs, or full message bodies into routine logs or analytics.
- RLS/API authorization must prevent reading or sending messages across unrelated orders. Client-supplied `orderId`, `senderId`, role or participant list is not proof of access.
- Define audio retention/deletion, support staff access, user reporting/blocking, and lawful request procedures before production rollout.
- Do not expose private phone numbers by default. If a call action is later added, use an approved privacy-preserving relay or explicitly approved fallback.
- Apply rate limits, attachment quotas, abusive-message reporting, audit events for privileged access, and safeguards against spam/harassment.

## 6. Proposed API contracts

- `GET /api/v1/orders/:orderId/conversation` — authorized participants only.
- `GET /api/v1/orders/:orderId/messages?cursor=` — cursor pagination; verifies order access.
- `POST /api/v1/orders/:orderId/messages` — text message with `clientMessageId` idempotency key.
- `POST /api/v1/orders/:orderId/voice-notes/upload-intent` — validates participant and returns a narrowly scoped short-lived upload target.
- `POST /api/v1/orders/:orderId/voice-notes/complete` — validates uploaded object, duration, size, and message metadata before making it available.
- `POST /api/v1/orders/:orderId/messages/:messageId/read` — optional read receipt, only if privacy/UX decision approves it.
- `GET /api/v1/messages/:messageId/audio` — authenticated redirect/stream or short-lived URL after authorization.
- Realtime subscription channel authorization is derived from verified identity and persisted membership, not a client-selected channel name.

## 7. Acceptance tests

- Customer A cannot read/send in Customer B's order conversation.
- An unassigned or previously assigned captain cannot access a conversation outside their allowed lifecycle.
- Forged sender ID, order ID, MIME type, duration, or storage path is rejected.
- Audio bucket objects are not publicly readable; unauthorized users cannot obtain signed URLs.
- Duplicate client message IDs do not create duplicate messages.
- Failed upload/send is shown honestly and can be retried without duplication.
- Microphone denial/unavailable browser still supports text and order status.
- Voice notes work with Arabic UI and screen readers/large controls; no recording starts without user action.
