# Notwin: Notion Digital Twins

AI-powered digital twins that review, debate, and comment as your team — built natively on Notion.

[![Notwin Demo](https://cdn.loom.com/sessions/thumbnails/2f70f2385a204b92b322b579a3117270-81895af9b26a1e96-full-play.gif#t=0.1)](https://www.loom.com/share/2f70f2385a204b92b322b579a3117270)

## What This Is

Notwin is a Notion-native system made of:

- one Notion Agent
- one TypeScript Notion Worker exposing 17 Agent tools
- four Notion databases:
  - Docs
  - Personas
  - Features
  - Executions

The Notion Agent does the reasoning and writing. The Worker provides deterministic tools for schema checks, features indexing, persona lookup, persona creation, and run-state updates.

Notwin operates in four modes and supports two pipeline actions:

| Mode / Action | What it does |
|---|---|
| **Manager** | Orchestrates a review run — resolves persona handles, selects up to three personas, and delegates to Commentor |
| **Commentor** | One persona takes bounded actions: reply to a thread, post a new comment, tag another persona, or skip |
| **Cloner** | Creates or refreshes a persona from a person's Docs-derived Features |
| **Indexer** | Extracts Features from changed Docs pages and refreshes affected Personas |
| **Update** | Full pipeline: sync changed Docs → extract Features → refresh Personas |
| **GitHub PR Import** | Pulls recent PRs into Docs, then runs Update |

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
DOCS_DATABASE_ID=
PERSONAS_DATABASE_ID=
FEATURES_DATABASE_ID=
EXECUTIONS_DATABASE_ID=
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

Preview feature sync:

```bash
npm run exec -- syncFeatures -d '{"data_source_id":"SOURCE_DATABASE_ID","limit":10,"dry_run":true}'
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
