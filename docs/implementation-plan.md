# Notion Personas - Implementation Plan

## Goal

Build the MVP described in [spec.md](./spec.md): one Notion-native Persona Agent backed by Notion databases and Notion Worker tools. The MVP should let a user invoke personas from a Notion comment, select matching personas from the registry, choose relevant context from indexed docs, write persona-style comments, and record run state in Notion.

## MVP Scope

Included:

- Persona Registry database
- Source Docs / Docs Index database
- Persona Runs database
- One hand-crafted Notion Persona Agent
- One Notion Worker exposing deterministic tools
- Manual or agent-triggered docs indexing
- Persona creation/refinement from indexed docs
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
@PersonaAgent @engineering review this
        |
        v
Persona Agent
        |
        | calls tools
        v
Notion Worker
        |
        v
Notion databases:
- Persona Registry
- Source Docs / Docs Index
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
docs/spec.md
docs/implementation-plan.md
```

Environment variables:

```text
NOTION_TOKEN
PERSONA_REGISTRY_DATABASE_ID
DOCS_INDEX_DATABASE_ID
PERSONA_RUNS_DATABASE_ID
```

Acceptance criteria:

- Worker compiles locally.
- Worker can read required environment variables.
- `README.md` explains local setup and deployment.

## Phase 1 - Database Setup

Deliverables:

- Create the three Notion databases manually or with a setup tool:
  - Persona Registry
  - Source Docs / Docs Index
  - Persona Runs
- Store database IDs in Worker environment variables.
- Add a Worker tool to verify required schema fields.

Worker tool:

```typescript
ensureWorkspaceSchema({})
```

Expected behavior:

- Fetch all three databases.
- Validate required properties exist.
- Return missing properties with suggested fixes.
- Optionally add missing properties where Notion API support permits.

Acceptance criteria:

- Tool returns `ok: true` when all required fields exist.
- Tool returns explicit missing fields when setup is incomplete.

## Phase 2 - Docs Indexing

Deliverables:

- Implement indexing from an existing Notion source database into Source Docs / Docs Index.
- Add attribution inference.
- Add summary and key quote fields, initially manual or Notion-Agent-generated.

Worker tools:

```typescript
syncDocsIndex({ data_source_id })
suggestAttribution({ page_id })
updateDocIndexRow({ page_id, patch })
```

Indexing behavior:

1. Query pages from the source data source.
2. Create or update one Docs Index row per source page.
3. Copy stable metadata:
   - page ID
   - title
   - created by
   - created time
   - last edited by
   - last edited time
4. Apply attribution priority:
   - manual Owner
   - manual Contributors
   - Created By
   - Last Edited By
   - commenters/mentions later
   - imported metadata later
5. Mark low-confidence rows with `Needs Review`.

Acceptance criteria:

- Running `syncDocsIndex` twice is idempotent.
- Existing manual Owner/Contributors values are not overwritten.
- Rows with inferred owners show attribution source and confidence.
- Missing or ambiguous attribution is visible through `Needs Review`.

## Phase 3 - Persona Registry and Cloning

Deliverables:

- Implement persona lookup by handle and tag.
- Implement persona creation/update helper.
- Add Agent Cloner instructions for generating draft persona rows from docs.

Worker tools:

```typescript
resolvePersonas({ handles_or_tags })
createOrUpdatePersona({ owner_user_id, patch })
getPersonaSourceDocs({ handle })
```

Persona creation flow:

1. Persona Agent asks Worker for docs owned/contributed by a person.
2. Persona Agent reads summaries, key quotes, and selected full docs.
3. Persona Agent drafts:
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
- Store selected personas, selected docs, queue, and processed comment IDs.

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

## Phase 5 - Persona Agent Instructions

Deliverables:

- Write the hand-crafted Notion Persona Agent instructions.
- Define three operating modes:
  - Agent Manager
  - Agent Commenter
  - Agent Cloner
- Teach the agent when to call Worker tools.

Agent Manager behavior:

1. Require the user to specify at least one managed handle or tag.
2. Resolve handles/tags through the Persona Registry.
3. Cap selected personas for MVP, default max 3.
4. Select context docs using Docs Index metadata:
   - title
   - owner
   - contributors
   - tags
   - summary
   - key quotes
5. Create a Persona Run.
6. Hand each persona/context bundle to Agent Commenter.

Agent Commenter behavior:

1. Read persona system prompt.
2. Read target doc and selected docs.
3. Write one concise, grounded comment in that persona's voice.
4. Prefix or label the comment clearly, since comments may appear as the Persona Agent.
5. Update run state after each comment.

Agent Cloner behavior:

1. Use indexed docs to infer role, tags, voice, and judgment style.
2. Prefer owned docs over contributed docs.
3. Use key quotes for voice/style.
4. Create draft personas only.

Acceptance criteria:

- Persona Agent can explain which personas it selected and why.
- Persona Agent creates or updates a run before writing persona comments.
- Persona Agent updates the run after each comment.
- Persona comments are clearly attributed to simulated personas.

## Phase 6 - Comment Workflow MVP

Deliverables:

- End-to-end manual run from a Notion comment.
- Persona Agent reads the triggering comment, resolves tags, creates a run, and writes persona comments.

Happy path:

```text
User comments:
@PersonaAgent @engineering review this

Persona Agent:
1. Resolves @engineering
2. Selects up to 3 enabled personas
3. Selects relevant context docs
4. Creates Persona Run
5. Writes one comment per selected persona
6. Marks run complete
```

Acceptance criteria:

- One comment invocation produces a completed Persona Run row.
- Persona Run shows selected personas, selected docs, turn count, and status.
- Each persona comment is grounded in the target doc or selected docs.
- No infinite loop is possible in the MVP flow.

## Phase 7 - Guardrails and Observability

Deliverables:

- Add simple run event logging.
- Add validation around Persona Agent tool calls.
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
- Missing source docs: persona can still act from prompt + target doc, but run event records degraded context.
- Max turns exceeded: mark complete.

Acceptance criteria:

- Every run has enough state to debug from Notion alone.
- Failures are visible in Persona Runs.
- Worker tools return structured errors that the Persona Agent can explain.

## Phase 8 - Optional Automation

Add only after the manual Agent-driven MVP works.

Options:

- Worker webhook for `comment.created`.
- Worker sync job to refresh Docs Index.
- Run Events database as append-only logs instead of serialized run text.
- Automatic stale persona detection.
- Slack import into Source Docs.
- Two-phase persona rounds for more simultaneous debates.

## Implementation Order

1. Create databases in Notion.
2. Scaffold Worker and config.
3. Implement schema validation.
4. Implement Docs Index sync.
5. Implement persona lookup.
6. Implement run create/update.
7. Draft Persona Agent instructions.
8. Test Agent Cloner on one person.
9. Test Agent Manager + Commenter on one doc and one tag.
10. Add guardrails and run events.

## Open Decisions Before Coding

- Should the Worker create the Notion databases, or will they be created manually first?
- Should Persona Agent comments be written directly by the Notion Agent, or through a Worker tool for uniform logging?
- What is the initial persona cap per run: 2 or 3?
- What exact Notion source database should be indexed first?
- Are Summary and Key Quotes generated by Persona Agent initially, or manually filled for seed docs?

