# Notion Personas - Implementation Plan

## Goal

Build the MVP described in [spec.md](./spec.md): one Notion-native Notwin backed by Notion databases and Notion Worker tools. The MVP should let a user invoke personas from a Notion comment, select matching personas from the registry, choose relevant context from indexed features, write persona-style comments, and record run state in Notion.

## MVP Scope

Included:

- Persona Registry database
- Docs database
- Features database
- Persona Runs database
- One hand-crafted Notion Agent
- One Notion Worker exposing deterministic tools
- Manual or agent-triggered features indexing
- Persona creation/refinement from indexed features
- Comment-driven review flow using managed handles/tags
- Max-turn and run-status guardrails

Deferred:

- External LLM API calls from the Worker
- Vector database
- External web server
- Fully automatic page-change indexing
- True parallel persona execution
- Native Notion Agent Library sync
- Slack import beyond placeholder schema support

## Architecture Snapshot

```text
Notion comment:
@Notwin @engineering review this
        |
        v
Notwin
        |
        | calls tools
        v
Notion Worker
        |
        v
Notion databases:
- Docs
- Persona Registry
- Features
- Persona Runs
```

The Notion Agent does reasoning and writing. The Worker does deterministic setup, lookup, state mutation, and logging.

## Phase 0 - Repo and Environment Setup

Deliverables:

- Scaffold a TypeScript Notion Worker project.
- Add package scripts for build, typecheck, and deploy.
- Add environment variable documentation.
- Add placeholder config for database IDs.

Suggested files:

```text
package.json
tsconfig.json
src/worker.ts
src/config.ts
src/notion.ts
src/tools/
spec.md
plan.md
```

Environment variables:

```text
NOTION_TOKEN
DOCS_DATABASE_ID
PERSONA_REGISTRY_DATABASE_ID
FEATURES_DATABASE_ID
PERSONA_RUNS_DATABASE_ID
```

Acceptance criteria:

- Worker compiles locally.
- Worker can read required environment variables.
- `README.md` explains local setup and deployment.

## Phase 1 - Database Setup

Deliverables:

- Create the four Notion databases manually or with a setup tool:
  - Docs
  - Persona Registry
  - Features
  - Persona Runs
- Store database IDs in Worker environment variables.
- Add a Worker tool to verify required schema fields.

Worker tool:

```typescript
ensureWorkspaceSchema({})
```

Expected behavior:

- Fetch all four databases.
- Validate required properties exist.
- Return missing properties with suggested fixes.
- Optionally add missing properties where Notion API support permits.

Acceptance criteria:

- Tool returns `ok: true` when all required fields exist.
- Tool returns explicit missing fields when setup is incomplete.

## Phase 2 - Feature Sync

Deliverables:

- Implement indexing from the user-facing Docs database into Features. Docs stays minimal and contains raw documents; parsed artifacts belong in Features.
- Inherit the human-specified `Docs.Owner`.
- Add summary, quotes, and tags fields, initially manual or Notion-Agent-generated.

Worker tools:

```typescript
syncFeatures({ data_source_id })
updateFeatureRow({ page_id, patch })
```

Indexing behavior:

1. Query pages from the source data source.
2. Create or update one Features row per source page.
3. Copy stable metadata:
   - page ID
   - title
   - source URL
4. Apply owner priority:
   - `Docs.Owner`, assumed to be one human-specified owner and copied to `Features.Owner`
   - existing `Features.Owner`
   - Created By
   - Last Edited By
Acceptance criteria:

- Running `syncFeatures` twice is idempotent.
- `Docs.Owner` is inherited into `Features.Owner` as high-confidence attribution.
- Features rows keep `Summary`, `Quotes`, and `Tags` when resynced.

## Phase 3 - Persona Registry and Cloning

Deliverables:

- Implement persona lookup by handle and tag.
- Implement persona creation/update helper.
- Add Cloner instructions for generating draft persona rows from docs.

Worker tools:

```typescript
resolvePersonas({ handles_or_tags })
createOrUpdatePersona({ owner_user_id, patch })
getPersonaSourceFeatures({ handle })
```

Persona creation flow:

1. Notwin asks Worker for docs owned/contributed by a person.
2. Notwin reads summaries, key quotes, and selected full docs.
3. Notwin drafts:
   - display name
   - handle
   - role
   - tags
   - system prompt
   - source pages
4. Worker writes a Persona Registry row with:
   - `Enabled = false`
   - `Sync Status = Needs Review`

Acceptance criteria:

- `resolvePersonas({ handles_or_tags: ["engineering"] })` returns enabled personas tagged `engineering`.
- Draft personas are not selected for live runs.
- Existing persona rows can be refreshed without losing manual edits unless explicitly requested.

## Phase 4 - Run State

Deliverables:

- Implement Persona Runs creation and updates.
- Enforce max turns.
- Store selected personas, selected features, queue, and processed comment IDs.

Worker tools:

```typescript
createRun({
  page_id,
  root_comment_id,
  selected_personas,
  selected_context_docs,
  max_turns
})

getRunState({ run_id })

updateRun({ run_id, patch })

appendRunEvent({ run_id, event })
```

State rules:

- Default `Max Turns = 20`.
- New runs start as `active`.
- Every persona comment increments `Turn Count`.
- `Turn Count >= Max Turns` forces `Status = complete`.
- Queue exhaustion forces `Status = complete` unless another managed handle/tag is intentionally invoked.
- Duplicate processed comment IDs are ignored.

Acceptance criteria:

- A run can be created from selected personas/docs.
- Queue and turn count update predictably after each persona turn.
- Completed runs are not accidentally resumed.
- Manual `manual_stop` prevents further turns.

## Phase 5 - Notwin Instructions

Deliverables:

- Write the hand-crafted Notion Agent instructions.
- Define three operating modes:
  - Manager
  - Commentor
  - Cloner
- Teach the agent when to call Worker tools.

Manager behavior:

1. Require the user to specify at least one managed handle or tag.
2. Resolve handles/tags through the Persona Registry.
3. Cap selected personas for MVP, default max 3.
4. Select context features using Features metadata:
   - title
   - owner
   - tags
   - summary
   - quotes
5. Create a Persona Run.
6. Hand each persona/context bundle to Commentor.

Commentor behavior:

1. Read persona system prompt.
2. Read target doc and selected features.
3. Write one concise, grounded comment in that persona's voice.
4. Prefix or label the comment clearly, since comments may appear as Notwin.
5. Update run state after each comment.

Cloner behavior:

1. Use indexed features to infer role, tags, voice, and judgment style.
2. Prefer owned docs over contributed docs.
3. Use quotes for voice/style.
4. Create draft personas only.

Acceptance criteria:

- Notwin can explain which personas it selected and why.
- Notwin creates or updates a run before writing persona comments.
- Notwin updates the run after each comment.
- Persona comments are clearly attributed to simulated personas.

## Phase 6 - Comment Workflow MVP

Deliverables:

- End-to-end manual run from a Notion comment.
- Notwin reads the triggering comment, resolves tags, creates a run, and writes persona comments.

Happy path:

```text
User comments:
@Notwin @engineering review this

Notwin:
1. Resolves @engineering
2. Selects up to 3 enabled personas
3. Selects relevant context features
4. Creates Persona Run
5. Writes one comment per selected persona
6. Marks run complete
```

Acceptance criteria:

- One comment invocation produces a completed Persona Run row.
- Persona Run shows selected personas, selected features, turn count, and status.
- Each persona comment is grounded in the target doc or selected features.
- No infinite loop is possible in the MVP flow.

## Phase 7 - Guardrails and Observability

Deliverables:

- Add simple run event logging.
- Add validation around Notwin tool calls.
- Add failure states.

Suggested `appendRunEvent` event types:

```text
run_created
personas_resolved
context_selected
persona_turn_started
persona_comment_created
persona_no_action
run_completed
run_failed
manual_stop
```

Failure handling:

- Invalid handle/tag: no run or `failed` run with reason.
- Missing database ID: Worker tool returns explicit setup error.
- Missing source features: persona can still act from prompt + target doc, but run event records degraded context.
- Max turns exceeded: mark complete.

Acceptance criteria:

- Every run has enough state to debug from Notion alone.
- Failures are visible in Persona Runs.
- Worker tools return structured errors that Notwin can explain.

## Phase 8 - Optional Automation

Add only after the manual Agent-driven MVP works.

Options:

- Worker webhook for `comment.created`.
- Worker sync job to refresh Features.
- Run Events database as append-only logs instead of serialized run text.
- Automatic stale persona detection.
- Slack import into Docs.
- Two-phase persona rounds for more simultaneous debates.

## Implementation Order

1. Create databases in Notion.
2. Scaffold Worker and config.
3. Implement schema validation.
4. Implement Features sync.
5. Implement persona lookup.
6. Implement run create/update.
7. Draft Notwin instructions.
8. Test Cloner on one person.
9. Test Manager + Commentor on one doc and one tag.
10. Add guardrails and run events.

## Open Decisions Before Coding

- Should the Worker create the Notion databases, or will they be created manually first?
- Should Notwin comments be written directly by the Notion Agent, or through a Worker tool for uniform logging?
- What is the initial persona cap per run: 2 or 3?
- What exact Notion source database should be indexed first?
- Are Summary and Quotes generated by Notwin initially, or manually filled for seed docs?
