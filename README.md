# notion-persona

Persona Agents for the Notion Developer Hackathon.

## What This Is

This MVP is not a web app. It is a Notion-native system made of:

- one hand-crafted Notion Agent: **Notwin**
- one TypeScript Notion Worker exposing Agent tools
- three Notion databases:
  - Persona Registry
  - Source Docs / Docs Index
  - Persona Runs

The Notion Agent does the reasoning and writing. The Worker provides deterministic tools for schema checks, document indexing, persona lookup, persona creation, and run-state updates.

## Repo Structure

```text
src/index.ts                         Worker entrypoint and tool registration
src/tools/                           Worker tool implementations
src/instructions.md                  Instructions for Notwin
spec.md                              Technical spec
plan.md                              Implementation plan
.env.template                        Required local environment variables
```

## Setup

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.template .env
```

Fill in:

```text
NOTION_API_TOKEN=
PERSONA_REGISTRY_DATABASE_ID=
DOCS_INDEX_DATABASE_ID=
PERSONA_RUNS_DATABASE_ID=
```

`NOTION_API_TOKEN` is needed for local tool execution. Hosted Notion Agent tool calls receive a Notion client from the Worker runtime.

## Build

```bash
npm run typecheck
```

## Local Tool Examples

Validate database schemas:

```bash
npm run exec -- ensureWorkspaceSchema -d '{}'
```

Preview docs indexing:

```bash
npm run exec -- syncDocsIndex -d '{"data_source_id":"SOURCE_DATABASE_ID","limit":10,"dry_run":true}'
```

Resolve personas:

```bash
npm run exec -- resolvePersonas -d '{"handles_or_tags":["engineering"],"include_disabled":false}'
```

## Deploy

```bash
npm run deploy
```

After deploy, attach the Worker tools to the Notion Agent and paste the instructions from `src/instructions.md` into the agent configuration.

## Current Assumption

Manager, Commentor, and Cloner are implemented as modes of a single Notion Agent. The Worker does not require separate Notion Agent IDs. If those roles are split into separate native Notion Agents later, add optional agent IDs/URLs to configuration and the Persona Registry.
