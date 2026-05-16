# Notion Personas — Technical Spec

## Overview

Notion Personas is a multi-agent system that creates AI-powered digital twins of workspace members. Agents are grounded in each person's actual Notion content and can autonomously review documents, leave comments, and debate each other in Notion's native comment threads.

The MVP is built around **Notion Workers** and **Notion webhooks**. Instead of running a long-lived orchestrator process, each comment event triggers a short-lived Worker invocation. The debate loop is represented as persisted state in a Notion database, so the system can stop reliably, recover from retries, and process agent turns one at a time.

---

## Core Concepts

**Persona** — An AI agent representing a real person or role. Defined by a system prompt, a set of tags such as `engineering` or `sales`, and a Data Frame of source content.

**Data Frame** — The context used to ground a persona. Composed of full-text content from Notion pages the user has authored or contributed to. Fetched at agent runtime via the Notion API.

**Worker** — A Notion-hosted TypeScript serverless function. The Worker receives `comment.created` webhook events, executes bounded agent turns, writes comments, and updates run state.

**Persona Run** — A persisted debate/session record for a page or comment thread. Stores status, turn count, active queue, processed comments, lock state, and stop conditions.

**Queued Turn Loop** — The iterative comment cycle. Each Worker invocation processes at most one bounded agent turn, then persists state. New comments trigger subsequent Worker invocations until the run completes, no agent acts, or the max turn count is reached.

---

## Architecture

```jsx
Notion Comment (@handle or @tag)
        ↓
Notion comment.created Webhook
        ↓
Notion Worker invocation
        ↓
1. Fetch webhook event metadata
2. Fetch page/comment context from Notion API
3. Find or create Persona Run state
4. Check stop conditions and idempotency
5. Acquire run lock
6. Select next queued agent
7. Load persona + Data Frame + document + comments
8. Call Claude API → decide action
9. Execute action via Notion API
10. Update Persona Run state
11. Release lock
        ↓
If a new comment is created, Notion emits another comment.created webhook
        ↓
Next Worker invocation processes the next queued turn
```

---

## Components

### 1. Persona Database (Notion DB)

A Notion database where each row defines one agent.

| Property | Type | Description |
| --- | --- | --- |
| Name | Title | Display name, e.g. `Mike Bot` |
| Handle | Text | @-mention handle, e.g. `mike-bot` |
| Role | Text | Short role description, e.g. `Senior Engineer` |
| Tags | Multi-select | Group tags, e.g. `engineering`, `sales`, `leadership` |
| System Prompt | Text | Persona voice and behavior instructions |
| Source Pages | Relation | Notion pages used to build this persona's Data Frame |
| Owner User ID | Text | Notion user ID for auto-discovery of authored pages |
| Enabled | Checkbox | Whether the persona can currently participate |

### 2. Persona Runs Database (Notion DB)

A Notion database where each row represents one active or completed debate run.

| Property | Type | Description |
| --- | --- | --- |
| Run ID | Title | Stable unique ID for the run |
| Page ID | Text | Target Notion page being discussed |
| Root Comment ID | Text | Initial comment that started the run, if available |
| Discussion ID | Text | Thread/discussion ID when the run is scoped to a comment thread |
| Status | Select | `active`, `cooling_down`, `complete`, or `failed` |
| Turn Count | Number | Total agent turns attempted in this run |
| Max Turns | Number | Default `20`; hard cap to prevent infinite loops |
| Current Round | Number | Round number for grouped agent participation |
| Agent Queue | Text | Serialized ordered handles for agents still pending this round |
| Agents Acted This Round | Text | Serialized handles that already had a turn this round |
| Processed Comment IDs | Text | Serialized IDs used for idempotency |
| Last Actor | Text | Handle of the last persona that acted |
| Last Event Time | Date | Timestamp of the most recent processed webhook event |
| Lock Until | Date | Short lock expiry used to avoid concurrent Worker races |
| Failure Reason | Text | Error summary if the run fails |

### 3. Notion Worker — Webhook Handler and Agent Runner

A single shared Notion Worker written in TypeScript. It receives Notion webhook events and executes one bounded agent turn per invocation.

**Capability:** `worker.webhook("onCommentCreated", ...)`

**Inputs:** Notion webhook event batch containing `comment.created` signals.

**Steps:**

1. Validate and normalize each webhook event
2. Fetch latest page/comment data from Notion, because webhook payloads are only change signals
3. Parse comment text for registered `@handles` and `@tags`
4. Find or create the relevant Persona Run
5. Stop immediately if the run is inactive, over the max turn count, locked by another invocation, or the comment was already processed
6. Acquire a short lock on the Persona Run
7. Select the next agent from `Agent Queue`
8. Load persona row from Persona DB
9. Fetch full content of linked Source Pages to build the Data Frame
10. Fetch target document content
11. Fetch all open comments and discussion structure available through the API
12. Call Claude API with persona system prompt + Data Frame + doc + comments + run state
13. Parse structured action response
14. Execute allowed action via Notion API
15. Increment turn count, update queue/round state, record processed comment IDs, and release lock

**Output:** persisted state update and optionally a Notion comment.

### 4. Claude API — Agent Reasoning

Each agent turn makes one Claude API call.

**Context window, in order:**

1. Persona system prompt: role, voice, behavior
2. Data Frame: full text of source pages
3. Target document: full page content
4. Comment thread: open comments and threading structure
5. Run state: current round, turn count, last actor, remaining queue
6. Instruction: choose one allowed action or no action

**Output format:**

```json
{
  "action": "create_comment" | "reply_to_comment" | "update_own_comment" | "delete_own_comment" | "no_action",
  "target_comment_id": "<id if updating or deleting>",
  "discussion_id": "<id if replying to an existing thread>",
  "content": "<comment text if creating, replying, or updating>",
  "should_continue": true
}
```

---

## Agent Action Space

| Action | Description |
| --- | --- |
| `create_comment` | Post a new top-level comment on the document |
| `reply_to_comment` | Reply to a specific existing discussion thread |
| `update_own_comment` | Update a previous comment created by the connection/persona |
| `delete_own_comment` | Delete a previous comment created by the connection/persona |
| `no_action` | Agent has nothing to add this turn |

**API constraints:** The public Notion API can add top-level page comments, reply to existing discussion threads, read open comments, update comments, and delete comments created by the connection. It cannot start a new inline discussion thread or retrieve resolved comments. The MVP should not depend on resolving comment threads unless Notion Workers or Custom Agents expose additional capabilities.

---

## Triggering

**@handle mention** — `@mike-bot` targets one specific persona by handle.

**@tag mention** — `@engineering` targets all enabled personas with that tag.

**Trigger detection:** Notion emits a `comment.created` webhook. The Worker fetches the comment/page context and parses comment text for registered handles and tags.

**Self-trigger handling:** Comments created by the Worker will also trigger `comment.created` webhooks. The Worker must inspect run state and comment authorship to decide whether the event should continue the queued debate or be ignored.

---

## Queued Turn Loop

The MVP uses round-based sequential execution instead of true parallel execution.

**Example:**

```
Human comment mentions @engineering
→ Worker creates run with queue [eng1, eng2, eng3]
→ Worker processes eng1, posts comment
→ Notion emits comment.created
→ Worker sees active run, processes eng2
→ Notion emits comment.created
→ Worker processes eng3
→ Round complete
→ Worker evaluates whether another round is needed
→ Stop if no agent should act or max turns reached
```

This is intentionally linear. Sequential turns are easier to debug, avoid stale-context races, reduce duplicate comments, and make the max-turn cap enforceable.

A later version can support two-phase rounds:

1. Each agent generates a proposed action from the same snapshot
2. Proposals are stored in run state
3. A coordinator publishes approved actions in deterministic order

---

## Stop Conditions

A Worker invocation must stop without posting a comment when any of these are true:

- Persona Run `Status` is not `active`
- `Turn Count >= Max Turns`
- Webhook/comment ID already appears in `Processed Comment IDs`
- The event is from the Worker itself and there is no active queue continuation
- The run has a non-expired `Lock Until` from another invocation
- No matching enabled persona exists for the mention or tag
- Current agent returns `no_action` and no remaining agents need to act
- The run is in `cooling_down` after completion or failure

When `Turn Count >= Max Turns`, the Worker marks the run `complete` and posts no further comments.

When all agents in a round return `no_action`, the Worker marks the run `complete`.

When the Worker encounters a recoverable API or model error, it records the failure and may leave the run `active` for retry. When the error is unrecoverable, it marks the run `failed` with a `Failure Reason`.

---

## Locking and Idempotency

Webhook delivery and Worker retries can cause duplicate invocations. The Worker must be idempotent.

**Locking approach:**

- Before processing a turn, set `Lock Until` to a timestamp shortly in the future
- If another invocation sees a future `Lock Until`, it exits
- After processing, clear or expire the lock
- If the Worker crashes, the lock naturally expires

**Idempotency approach:**

- Store processed webhook delivery IDs and/or comment IDs
- Check processed IDs before calling Claude or writing comments
- Increment `Turn Count` only as part of the same state update that records the attempted turn
- Keep a stable mapping from an incoming event to the selected agent turn

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Agent execution | Notion Workers (TypeScript) |
| Event trigger | Notion `comment.created` webhooks |
| State machine | Persona Runs Notion database |
| AI reasoning | Claude API (claude-sonnet-4-6) |
| Workspace I/O | Notion SDK / Notion API |
| Persona storage | Persona Notion database |

---

## Data Flow — RAG

1. Each persona has a list of Source Pages in the Persona DB
2. At agent runtime, the Worker fetches full page content for all linked pages via the Notion API
3. Content is concatenated and inserted into the Claude prompt as the Data Frame
4. No vector DB needed for MVP — full text should fit in Claude's context window for typical page counts
5. If context grows too large, later versions can add summarization, ranking, or a vector store

---

## MVP Implementation Notes

1. Build one Notion Worker with a `comment.created` webhook capability
2. Create Persona DB and Persona Runs DB
3. Implement persona/tag resolution
4. Implement run creation, locking, idempotency, and max-turn stopping
5. Implement sequential queue processing
6. Implement Claude action selection with structured JSON validation
7. Implement Notion comment writes and replies to existing discussions
8. Add logs for every run state transition and agent action

---

## Open Questions

- Auto-discovery: should the system automatically find pages authored by a user via `created_by` in addition to manually linked Source Pages?
- Run scoping: should a run be scoped to the whole page, a root comment, or a specific discussion thread?
- Cooldown: after a run completes, how long should the same page/thread ignore new Worker-authored comments?
- Agent awareness: should an agent know which other agents are active in the run, or only see raw comment thread content and run metadata?
- Parallelism: when the sequential MVP works, should the system add two-phase rounds for a more simultaneous feel?
