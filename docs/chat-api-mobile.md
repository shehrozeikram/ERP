# Chat API Documentation (Web + Mobile Shared)

This document lists the **implemented** chat APIs and socket events currently used by the web app, so mobile can use the same backend.

Base API URL:
- Dev: `http://localhost:5001/api`
- Production: `<your-domain>/api`

Auth:
- All chat endpoints require `Authorization: Bearer <JWT>`
- Chat routes are mounted at:
  - `/api/chat`
  - `/api/chat/admin` (admin-only moderation)

Socket:
- Socket.IO path: `/socket-notifications`
- Auth: token in socket auth payload (`auth: { token }`) or bearer header
- Transports: `websocket`, `polling`

---

## 1) REST Endpoints (User Chat)

### 1. Directory / User Picker
`GET /api/chat/directory`

Query params:
- `search` (optional, string)
- `limit` (optional, default 25, max 50)

Response:
- `data.users[]`: `{ id, firstName, lastName, fullName, email, department, position, employeeId, profileImage }`

---

### 2. Presence for Multiple Users
`GET /api/chat/presence`

Query params:
- `ids` (required): comma-separated user ids

Example:
- `/api/chat/presence?ids=<id1>,<id2>,<id3>`

Response:
- `data.online`: map of userId to boolean

---

### 3. Unread Summary
`GET /api/chat/unread-summary`

Response:
- `data.totalUnread` (number)

---

### 4. List Conversations
`GET /api/chat/conversations`

Response:
- `data.conversations[]`:
  - `id`
  - `kind` (`direct` | `group`)
  - `title`
  - `displayTitle`
  - `participantCount`
  - `otherUser` (for direct): user lite object
  - `lastMessageAt`
  - `lastMessageSnippet`
  - `lastMessageSender`
  - `unreadCount`
  - `lastReadMessageId`
  - `readAt`
  - `pinnedMessage` (optional)

---

### 5. Open/Create Direct Conversation
`POST /api/chat/conversations/open`

Body:
```json
{
  "otherUserId": "<userId>"
}
```

Response:
- `data.conversation`: `{ id, otherUser, participants[] }`

Notes:
- If conversation already exists, it returns existing one.
- Prevents self-chat.

---

### 6. Get Conversation Details
`GET /api/chat/conversations/:conversationId`

Response:
- `data`:
  - `id`, `kind`, `title`
  - `otherUser` (for direct)
  - `participants[]`
  - `peerReadMessageCreatedAt`
  - `peerReadAt` (currently null in response)
  - `pinnedMessage` (optional)

---

### 7. List Messages (Paginated)
`GET /api/chat/conversations/:conversationId/messages`

Query params:
- `before` (optional messageId anchor)
- `limit` (optional, default 40, max 80)

Response:
- `data.messages[]` (oldest to newest for returned page)
- `data.hasMore` (bool)
- `data.nextBefore` (use as `before` to fetch older)

Message shape:
- `id, conversation, sender, body`
- `isDeletedForEveryone`
- `clientMessageId`
- `replyTo`
- `attachments[]`
- `editedAt, deletedAt, deliveredAt`
- `reactions[]`
- `starredBy[]`
- `isStarred`
- `mentions[]`
- `linkPreviews[]`
- `createdAt, updatedAt`

---

### 8. Search Messages in a Conversation
`GET /api/chat/conversations/:conversationId/search?q=<text>`

Response:
- `data.messages[]` (max 50)

---

### 9. Export Conversation
`GET /api/chat/conversations/:conversationId/export`

Response:
- Plain text file (`chat-export.txt`)
- Content type: `text/plain`

---

### 10. Mark Conversation Read
`POST /api/chat/conversations/:conversationId/read`

Body:
```json
{
  "lastMessageId": "<optional messageId>"
}
```

Behavior:
- If `lastMessageId` not provided, backend marks latest message as read.

Response:
- `data`: `{ conversationId, userId, lastMessageId, readAt }`

---

### 11. Send Message
`POST /api/chat/conversations/:conversationId/messages`

Body (supported):
```json
{
  "body": "Hello",
  "clientMessageId": "uuid-or-client-key",
  "replyToMessageId": "<optional>",
  "attachments": [
    {
      "url": "/uploads/chat-files/xxx.ext",
      "filename": "doc.pdf",
      "mimeType": "application/pdf",
      "size": 12345
    }
  ],
  "mentions": [
    {
      "userId": "<participantUserId>",
      "label": "Ali Khan"
    }
  ]
}
```

Rules:
- Message body max length: `16000`
- Attachments max: `5`
- Attachment URL must start with `/uploads/chat-files/`
- Mentions accepted only for conversation participants
- If same `clientMessageId` already exists in conversation, returns duplicate response

Response:
- `201` success with `data.message`
- duplicate case returns `200` with `data.duplicate = true`

---

### 12. Edit Message
`PATCH /api/chat/messages/:messageId`

Body:
```json
{
  "body": "Updated text"
}
```

Rules:
- Only sender can edit
- Cannot edit deleted-for-everyone messages
- Edit window: 48 hours from creation
- Max body: 16000

Response:
- `data.message`

---

### 13. Delete Message
`DELETE /api/chat/messages/:messageId?scope=<forEveryone|for_me|forme>`

Scopes:
- `forEveryone`: sender only
- `for_me` / `forme`: hide only for current user

Response:
- `data`: `{ messageId, scope }`

---

### 14. Toggle Reaction
`POST /api/chat/messages/:messageId/reactions`

Body:
```json
{
  "emoji": "👍"
}
```

Behavior:
- Toggles same emoji reaction for that user

Response:
- `data`: `{ conversationId, messageId, reactions[] }`

---

### 15. Toggle Star
`POST /api/chat/messages/:messageId/star`

Response:
- `data`: `{ conversationId, messageId, starredBy[], starred }`

---

### 16. Pin / Unpin Message
`POST /api/chat/conversations/:conversationId/pin`

Pin body:
```json
{
  "messageId": "<messageId>"
}
```

Unpin body:
```json
{
  "messageId": null
}
```

Response:
- Pin: `data.pinnedMessageId`
- Unpin: `data.pinnedMessage = null`

---

### 17. Create Group
`POST /api/chat/groups`

Body:
```json
{
  "title": "HR Team",
  "memberIds": ["<user1>", "<user2>"]
}
```

Rules:
- Creator auto-included
- Title required
- At least one other member
- All users must be active

Response:
- `data.conversation`: `{ id, kind, title, participants[] }`

---

### 18. Add/Remove Group Members
`POST /api/chat/groups/:conversationId/members`

Body:
```json
{
  "addUserIds": ["<idA>", "<idB>"],
  "removeUserIds": ["<idC>"]
}
```

Rules:
- Group only
- Admins only
- Group must keep at least 2 members

Response:
- `data.participantCount`

---

### 19. Upload Attachment
`POST /api/chat/conversations/:conversationId/upload`

Content-Type:
- `multipart/form-data`
- field name: `file`

Limits:
- Max file size: 15 MB

Response:
```json
{
  "success": true,
  "data": {
    "url": "/uploads/chat-files/<storedName>",
    "filename": "<originalFilename>",
    "mimeType": "<mime>",
    "size": 12345
  }
}
```

Use returned object in send message `attachments[]`.

---

## 2) Admin / Moderation Endpoints

All below require role: `super_admin`, `admin`, or `developer`.

### A. List Conversations (Admin)
`GET /api/chat/admin/conversations?limit=40`

### B. Search Messages Globally
`GET /api/chat/admin/messages?q=<text>&limit=40`

### C. Force Delete Message (Permanent)
`DELETE /api/chat/admin/messages/:messageId/force`

### D. Force Delete Conversation (Permanent)
`DELETE /api/chat/admin/conversations/:conversationId/force`

---

## 3) Realtime Socket Events

Socket connection:
- URL base: same host as API (without `/api`)
- path: `/socket-notifications`
- auth token required

### Client -> Server

#### `chat:typing`
Payload:
```json
{
  "conversationId": "<conversationId>",
  "typing": true
}
```

---

### Server -> Client

#### `notification:connected`
```json
{ "ok": true, "userId": "<myUserId>" }
```

#### `presence:changed`
```json
{ "userId": "<userId>", "online": true }
```

#### `chat:typing`
```json
{ "conversationId": "<id>", "userId": "<otherUserId>", "typing": true }
```

#### `chat:message`
```json
{ "conversationId": "<id>", "message": { ...messageObject } }
```

#### `chat:message:updated`
```json
{ "conversationId": "<id>", "message": { ...messageObject } }
```

#### `chat:message:deleted`
```json
{
  "conversationId": "<id>",
  "messageId": "<messageId>",
  "scope": "forEveryone|for_me|forme",
  "byUserId": "<userId>"
}
```

#### `chat:read`
```json
{
  "conversationId": "<id>",
  "userId": "<readerId>",
  "lastMessageId": "<messageId|null>",
  "readAt": "<ISO>"
}
```

#### `chat:reaction`
```json
{
  "conversationId": "<id>",
  "messageId": "<messageId>",
  "reactions": [{ "user": "<id>", "emoji": "👍" }]
}
```

#### `chat:star`
```json
{
  "conversationId": "<id>",
  "messageId": "<messageId>",
  "starredBy": ["<id1>", "<id2>"],
  "starred": true
}
```

#### `chat:pin`
Pin:
```json
{ "conversationId": "<id>", "pinnedMessageId": "<messageId>" }
```
Unpin:
```json
{ "conversationId": "<id>", "pinnedMessage": null }
```

#### `chat:conversation:updated`
```json
{ "conversationId": "<id>" }
```

#### `notification:new`
- General notification stream (used by app notification center)

---

## 4) File / Media URL Notes

Chat attachments are saved under:
- `/uploads/chat-files/<filename>`

Static serving:
- `/uploads/...` is publicly served by backend static middleware.

For mobile:
- Build full URL as: `<API_ORIGIN><attachment.url>`
  - Example: `https://your-domain.com/uploads/chat-files/chat-...pdf`

---

## 5) Mobile Integration Flow (Recommended)

1. Login -> store JWT.
2. Connect socket with JWT on app/chat screen init.
3. Load conversations: `GET /chat/conversations`.
4. Open thread:
   - `GET /chat/conversations/:id`
   - `GET /chat/conversations/:id/messages`
   - `POST /chat/conversations/:id/read`
5. Send:
   - Optional upload file -> `/upload`
   - Send message -> `/messages`
6. Listen for realtime events listed above.
7. For pagination, pass `before=nextBefore`.
8. For unread badge, call `/chat/unread-summary` and/or track `chat:message` events.

---

## 6) Important Constraints / Validation

- Message body max 16000 chars
- Edit window 48h
- Upload size max 15MB
- Max 5 attachments per message payload
- `clientMessageId` used for idempotency (avoid duplicate sends)
- Group member updates are admin-only for that group

---

## 7) Quick Endpoint Checklist

Core:
- `GET /chat/directory`
- `GET /chat/presence`
- `GET /chat/unread-summary`
- `GET /chat/conversations`
- `POST /chat/conversations/open`
- `GET /chat/conversations/:id`
- `GET /chat/conversations/:id/messages`
- `GET /chat/conversations/:id/search`
- `GET /chat/conversations/:id/export`
- `POST /chat/conversations/:id/read`
- `POST /chat/conversations/:id/messages`
- `PATCH /chat/messages/:id`
- `DELETE /chat/messages/:id`
- `POST /chat/messages/:id/reactions`
- `POST /chat/messages/:id/star`
- `POST /chat/conversations/:id/pin`
- `POST /chat/groups`
- `POST /chat/groups/:id/members`
- `POST /chat/conversations/:id/upload`

Admin:
- `GET /chat/admin/conversations`
- `GET /chat/admin/messages`
- `DELETE /chat/admin/messages/:id/force`
- `DELETE /chat/admin/conversations/:id/force`

---

## 8) Error Catalog (Mobile Handling Guide)

The API generally returns:
```json
{
  "success": false,
  "message": "Human readable reason"
}
```

### Common HTTP codes

- `400 Bad Request`
  - Input/validation issue (missing fields, invalid ids, too long body, invalid scope, etc.)
  - Mobile action: show toast/snackbar with message; do not retry automatically.

- `401 Unauthorized`
  - Missing/expired token
  - Mobile action: refresh token flow (if you have one), else force login.

- `403 Forbidden`
  - User not allowed (not participant, not sender, not group admin, no admin role)
  - Mobile action: show permission message; reload conversation list if needed.

- `404 Not Found`
  - Message/conversation/user not found
  - Mobile action: remove stale local item and refresh corresponding list/thread.

- `413/500` (or multer/file errors)
  - Usually file upload/infra error
  - Mobile action: show "upload failed", allow retry with smaller file.

### High-value chat error messages to handle explicitly

- `"otherUserId is required"`
- `"Cannot chat with yourself"`
- `"Conversation not found"`
- `"Forbidden"`
- `"Message body or attachment is required"`
- `"Message too long"`
- `"Invalid message for this conversation"`
- `"You can only edit your own messages"`
- `"Cannot edit deleted message"`
- `"Edit window expired"`
- `"Only sender can delete for everyone"`
- `"emoji is required"`
- `"Invalid messageId"`
- `"Not a group conversation"`
- `"Admins only"`
- `"Group must keep at least 2 members"`
- `"file is required"`

### Recommended mobile UX mapping

- Validation errors -> inline field error where possible.
- Permission errors -> passive alert + reload to sync.
- Not found errors -> remove local cached object + refresh.
- Network errors/timeouts -> retry button + offline banner.

---

## 9) Socket Reconnection & Resync Strategy

Use this flow whenever socket disconnects/reconnects, app resumes, or network switches:

1. Reconnect socket with same JWT.
2. On reconnect success:
   - fetch `GET /chat/conversations`
   - if thread open, fetch:
     - `GET /chat/conversations/:id`
     - `GET /chat/conversations/:id/messages`
3. Re-emit read state for active thread:
   - `POST /chat/conversations/:id/read` (with latest visible message id if available)
4. Reset typing indicator UI on disconnect/reconnect.
5. Re-subscribe local listeners for all socket events.

### Backoff recommendation

- Attempt 1: immediate
- Attempt 2: 1s
- Attempt 3: 2s
- Attempt 4: 5s
- Then every 10s until online

### Duplicate event safety

- Always upsert messages by `message.id`.
- Use `clientMessageId` for optimistic sends/idempotency.
- Ignore incoming message if same `id` already exists locally.

### App lifecycle notes

- On foreground resume: run lightweight resync (`/conversations` + active thread meta/messages).
- On token refresh/login change: disconnect old socket and create a new authenticated socket.

---

## 10) Versioning / Change Log Section

Recommended process for web + mobile parity:

- Keep this file as source of truth.
- Every backend chat change must update:
  1. endpoint/event details in this doc
  2. `Last Updated` and `Version` below
  3. short changelog entry

### Metadata

- Version: `1.0.0`
- Last Updated: `2026-05-09`
- Owner: `Backend team (Chat module)`

### Changelog

- `1.0.0` (2026-05-09)
  - Initial consolidated mobile handoff for chat:
    - all user chat REST APIs
    - admin moderation APIs
    - socket event contract
    - payload/constraints
    - error catalog + reconnection strategy

