# Notion Personas - Technical Spec

## Overview

Notion Personas is a Notion-native multi-agent system that creates AI-powered digital twins of workspace members. Personas are grounded in each person's actual Notion content and can review documents, leave comments, and simulate debate in Notion comment threads.

The MVP uses a single hand-crafted **Notwin** in Notion, supported by Notion databases and Notion Worker tools. Notwin handles reasoning, persona selection, context selection, persona cloning, and comment drafting. The Worker handles deterministic operations such as database setup, indexing, run-state updates, locking, idempotency, and schema maintenance.

---

## Core Concepts

**Persona** - A simulated person or role. Defined by a handle, display name, tags, role, system prompt, source pages, and enabled status.

**Persona Registry** - A Notion database containing all personas. It is the source of truth for handles, tags, prompts, and source pages.

**Source Docs / Docs Index** - A Notion database of documents the system can use as grounding material. Each row includes attribution metadata, summary, key quotes, and indexing fields.

**Persona Run** - A persisted review/debate session for a page or comment thread. Stores status, selected personas, context docs, turn count, queue, processed comments, and stop conditions.

**Notwin** - The single Notion Agent used by humans. It acts as Manager, Commentor, and Cloner depending on the task.

**Notion Worker** - A Notion-hosted TypeScript backend used by the Notwin for deterministic tools: indexing docs, updating databases, enforcing run state, and maintaining schemas.

---

## Agent Roles

These are conceptual roles. For MVP, they can all be implemented as capabilities of one Notion Agent called **Notwin**.

### 1. Manager

Responsible for orchestration.

**Inputs:**

- Triggering comment
- Persona Registry
- Source Docs / Docs Index
- Persona Runs

**Responsibilities:**

1. Parse managed `@handles` and `@tags`
2. Resolve matching enabled personas from the Persona Registry
3. Select relevant context docs from the Docs Index
4. Create or update the Persona Run
5. Manage the queue, turn count, and stop conditions
6. Hand a persona + context bundle to Commentor

### 2. Commentor

Responsible for creating the actual persona comments.

**Inputs from Manager:**

- Persona prompt
- Persona metadata
- Target document
- Selected full context docs
- Comment thread
- Run state

**Responsibilities:**

1. Role-play one selected persona
2. Write one grounded comment or reply
3. Return `no_action` if there is nothing useful to add
4. Keep comments tied to the selected docs and the persona prompt

### 3. Cloner

Responsible for creating or refreshing persona definitions.

**Inputs:**

- Docs Index
- Recent docs owned or contributed by a person
- Summaries
- Key quotes
- Full content where useful
- Existing Persona Registry row, if any

**Responsibilities:**

1. Infer role and tags
2. Draft or update a persona system prompt
3. Choose source pages
4. Extract voice/style traits
5. Mark generated personas as `Draft` or `Needs Review` before enabling

### 4. Indexer

Responsible for maintaining document metadata. This should be mostly Worker/tool-driven rather than freeform agent behavior.

**Responsibilities:**

1. Sync source databases into the Docs Index
2. Add missing schema fields such as Owner, Contributors, Summary, and Key Quotes
3. Fill attribution metadata
4. Generate or refresh summaries and key quotes
5. Detect stale rows

---

## Architecture

```text
User comment in Notion:
@Notwin @engineering review this
        |
        v
Notwin wakes up in Notion
        |
        v
Manager mode:
1. Reads Persona Registry
2. Resolves @engineering to enabled personas
3. Reads Docs Index metadata
4. Selects relevant context docs
5. Creates/updates Persona Run via Worker tools
        |
        v
Commentor mode:
6. For each selected persona, reads persona prompt + full selected docs
7. Writes one comment in that persona's voice
8. Updates Persona Run via Worker tools
        |
        v
Stop when queue is empty, no persona acts, max turns reached, or run is manually completed
```

The Worker is not the primary reasoning layer in this MVP. It provides tools and guardrails for Notwin.

---

## Databases

### 1. Persona Registry Database

User/admin-editable database defining available personas.

| Property | Type | Description |
| --- | --- | --- |
| Name | Title | Display name, e.g. `Mike Wu` or `CTO Persona` |
| Handle | Text | Managed mention handle, e.g. `mikewu`, `cto`, `engineering` |
| Role | Text | Short role description, e.g. `Senior Engineer` |
| Tags | Multi-select | Managed tags such as `engineering`, `sales`, `leadership`, `cto` |
| System Prompt | Text | Persona voice, behavior, judgment, and style instructions |
| Source Pages | Relation | Docs used to ground this persona's voice and knowledge |
| Owner User ID | Text | Notion user ID for attribution and auto-discovery |
| Enabled | Checkbox | Whether the persona can currently participate |
| Sync Status | Select | `Draft`, `Needs Review`, `Enabled`, `Stale`, or `Disabled` |
| Notion Agent URL | URL | Optional link to a native Notion Agent if one exists later |

### 2. Source Docs / Docs Index Database

User-editable and Worker-maintained database of documents that personas can use for grounding.

| Property | Type | Description |
| --- | --- | --- |
| Name | Title | Document title |
| Page ID | Text | Underlying Notion page ID |
| Source Page | URL / Relation | Link or relation to the source Notion page |
| Owner | Person | Primary person responsible for the document |
| Contributors | People | People whose work or voice contributed to the document |
| Tags / Area | Multi-select | Topic, product area, team, or domain tags |
| Summary | Text | Short description used for discovery and routing |
| Key Quotes | Text | Representative excerpts capturing voice, opinions, and decision style |
| Content Type | Select | `Spec`, `Meeting Notes`, `Slack`, `Decision`, `Research`, etc. |
| Persona Enabled | Checkbox | Whether this doc can be used for persona grounding |
| Attribution Source | Select | `Manual`, `Owner`, `Created By`, `Last Edited By`, `Comments`, or `Imported` |
| Attribution Confidence | Select | `High`, `Medium`, or `Low` |
| Needs Review | Checkbox | Whether a human should verify attribution or summary |
| Last Indexed At | Date | When the row was last refreshed |
| Created By | Person | Notion metadata copied from the source page |
| Created Time | Date | Notion metadata copied from the source page |
| Last Edited By | Person | Notion metadata copied from the source page |
| Last Edited Time | Date | Notion metadata copied from the source page |

### 3. Persona Runs Database

Mostly system-owned database representing active and historical review/debate sessions.

| Property | Type | Description |
| --- | --- | --- |
| Run ID | Title | Stable unique ID for the run |
| Target Page ID | Text | Notion page being reviewed |
| Root Comment ID | Text | Initial comment that started the run |
| Status | Select | `active`, `complete`, `failed`, `cooling_down`, or `manual_stop` |
| Selected Personas | Text / Relation | Personas selected for this run |
| Selected Context Docs | Text / Relation | Docs selected for this run |
| Turn Count | Number | Total persona turns attempted |
| Max Turns | Number | Default `20`; hard cap to prevent infinite loops |
| Current Round | Number | Round number for grouped participation |
| Agent Queue | Text | Ordered handles still pending in the current round |
| Processed Comment IDs | Text | IDs used for idempotency |
| Last Actor | Text | Last persona that acted |
| Lock Until | Date | Short lock expiry to avoid concurrent updates |
| Failure Reason | Text | Error summary if the run fails |

---

## Attribution Rules

Document attribution is a scored, editable guess. The system should never pretend inferred ownership is perfect.

**Priority order:**

1. Manual `Owner`
2. Manual `Contributors`
3. `Created By`
4. `Last Edited By`
5. Commenters and mentions
6. Third-party source metadata

**MVP logic:**

```text
If Owner exists:
  owner = Owner
  confidence = High
else if Created By exists:
  owner = Created By
  confidence = Medium
  needs_review = true
else:
  owner = null
  confidence = Low
  needs_review = true

contributors = unique(Contributors + Last Edited By + commenters)
```

---

## Context Selection

The system uses two levels of context.

### Selection Context

Used by Manager to choose personas and docs. This should be lightweight.

**Fields:**

- Persona Registry entries
- Triggering comment
- Target doc metadata
- Docs Index metadata: title, owner, contributors, tags, summary, key quotes, content type, last edited time

### Embodiment Context

Used by Commentor to write the actual persona comment. This can include full text.

**Fields:**

- Persona system prompt
- Persona source pages
- Target document full text
- Selected related docs full text
- Current comment thread
- Run state

**Rule:** Summary and key quotes are for discovery. Full content is for embodiment.

---

## Triggering

A user starts the flow by mentioning the Notwin and at least one managed handle or tag in a Notion comment.

**Examples:**

```text
@Notwin @engineering review this
@Notwin @mikewu what would Mike push on here?
@Notwin @cto @sales debate the launch risk
```

The user must specify a person, role, or team tag. Managed handles and tags are defined in the Persona Registry.

**Resolution rules:**

1. Explicit persona handle wins
2. Role/team tag expands to enabled personas with that tag
3. Disabled or draft personas are ignored
4. The Manager may cap selected personas for MVP, e.g. max 3

---

## Game-of-Life Workflow

The MVP uses round-based sequential execution rather than true parallel execution.

```text
Human comment mentions @Notwin @engineering
-> Manager resolves @engineering to [eng1, eng2, eng3]
-> Manager selects context docs from Docs Index
-> Worker creates Persona Run with queue [eng1, eng2, eng3]
-> Commentor writes as eng1
-> Worker updates run: turn_count = 1, queue = [eng2, eng3]
-> Commentor writes as eng2
-> Worker updates run: turn_count = 2, queue = [eng3]
-> Commentor writes as eng3
-> Worker updates run: queue = []
-> Run completes unless another managed handle/tag was intentionally invoked
```

This is intentionally linear. Sequential turns are easier to debug, avoid stale-context races, reduce duplicate comments, and make the max-turn cap enforceable.

Later versions can support two-phase rounds:

1. Each persona generates a proposed action from the same snapshot
2. Proposals are stored in run state
3. A coordinator publishes approved actions in deterministic order

---

## Stop Conditions

A run must stop when any of these are true:

- Persona Run `Status` is not `active`
- `Turn Count >= Max Turns`
- Queue is empty and no managed handle/tag was intentionally invoked again
- All selected personas return `no_action`
- The run is manually stopped
- A cooldown is active
- A duplicate comment/event is detected
- No matching enabled persona exists for the requested handle or tag

When `Turn Count >= Max Turns`, mark the run `complete` and do not add further comments.

When all personas in a round return `no_action`, mark the run `complete`.

---

## Notion Worker Tools

Notwin should call Worker tools for deterministic operations.

**Suggested tools:**

```typescript
ensureDocsSchema({ data_source_id })
syncDocsIndex({ data_source_id })
suggestAttribution({ page_id })
generateDocSummaryAndQuotes({ page_id })
createOrUpdatePersona({ owner_user_id })
createRun({ page_id, root_comment_id, selected_personas, selected_context_docs })
updateRun({ run_id, patch })
appendRunEvent({ run_id, event })
getRunState({ run_id })
```

For MVP, the most important tools are:

1. `syncDocsIndex`
2. `createOrUpdatePersona`
3. `createRun`
4. `updateRun`
5. `getRunState`

---

## Agent Action Space

| Action | Description |
| --- | --- |
| `create_comment` | Post a persona comment on the target document or root thread |
| `reply_to_comment` | Reply to an existing discussion thread when available |
| `no_action` | Persona has nothing useful to add |
| `update_run_state` | Update queue, turn count, selected docs, status, or failure reason |

**API constraints:** The public Notion API can add top-level page comments, reply to existing discussion threads, read open comments, update comments, and delete comments created by the connection. It cannot start a new inline discussion thread or retrieve resolved comments. The MVP should not depend on resolving comment threads.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| User-facing agent | Notion Agent: Notwin |
| Deterministic backend | Notion Workers (TypeScript) |
| Persona storage | Persona Registry Notion database |
| Document index | Source Docs / Docs Index Notion database |
| Run state | Persona Runs Notion database |
| Workspace I/O | Notion API / Notion SDK / Worker tools |
| Reasoning | Notion Agent runtime for MVP; external LLM API optional later |

---

## MVP Implementation Notes

1. Create one hand-crafted Notion Agent: `Notwin`
2. Create Persona Registry DB
3. Create Source Docs / Docs Index DB
4. Create Persona Runs DB
5. Build Worker tools for schema setup, docs indexing, persona creation, and run updates
6. Implement attribution priority and confidence fields
7. Add Summary + Key Quotes generation for docs
8. Add Cloner mode to create draft personas from recent owned/contributed docs
9. Add Manager mode to resolve handles/tags and select context
10. Add Commentor mode to write one persona comment at a time
11. Enforce max turns and run status through Persona Runs

---

## Open Questions

- Should Notwin create comments directly, or should it call a Worker tool to create comments so all writes are logged uniformly?
- Should a run be scoped to the whole page, the root comment, or a specific discussion thread?
- What is the initial max number of personas per run: 2, 3, or more?
- How often should summaries, key quotes, and persona prompts be refreshed?
- Should third-party sources like Slack be imported into the same Source Docs DB or a separate source-specific DB?
- If Notion exposes programmable Agent Library APIs later, should Persona Registry sync into native Notion Agents?
