import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import { syncChangedFeatures, syncFeatures, suggestAttribution, updateFeatureRow } from "./tools/features.js";
import { importGithubPullRequests } from "./tools/github.js";
import { createOrUpdatePersona, getFeaturesForOwner, getPersonaSourceFeatures, listFeatureOwners, resolvePersonas } from "./tools/personas.js";
import { appendRunEvent, createRun, enqueueDelegatedPersonas, getRunState, recordPersonaAction, updateRun } from "./tools/runs.js";
import { ensureWorkspaceSchema } from "./tools/schema.js";

const worker = new Worker();
export default worker;

const executeTool = <T extends (...args: any[]) => any>(fn: T) => fn as any;

worker.tool("ensureWorkspaceSchema", {
	title: "Ensure Workspace Schema",
	description:
		"Validate that the Docs, Personas, Features, and Executions databases have the properties required by the Notion Personas MVP.",
	schema: j.object({}),
	execute: executeTool(ensureWorkspaceSchema),
});

worker.tool("syncFeatures", {
	title: "Sync Features",
	description:
		"Index pages from the user-facing Docs database, or another Notion source database, into the Worker-maintained Features database.",
	schema: j.object({
		data_source_id: j
			.string()
			.describe("The source Notion database or data source ID containing documents to index. Use null to sync the configured Docs database.")
			.nullable(),
		limit: j.number().describe("Maximum number of source pages to sync. Use null for the default.").nullable(),
		dry_run: j.boolean().describe("When true, preview changes without writing to Notion.").nullable(),
	}),
	execute: executeTool(syncFeatures),
});

worker.tool("syncChangedFeatures", {
	title: "Sync Changed Features",
	description:
		"Sync the most recently edited Docs rows into Features. Use changed_since to process only Docs edited after a known timestamp.",
	schema: j.object({
		limit: j.number().describe("Maximum number of recently edited Docs rows to sync. Use null for the default.").nullable(),
		changed_since: j
			.string()
			.describe("ISO timestamp. Only Docs edited on or after this time are synced. Use null to sync the most recent Docs rows.")
			.nullable(),
		dry_run: j.boolean().describe("When true, preview changes without writing to Notion.").nullable(),
	}),
	execute: executeTool(syncChangedFeatures),
});

worker.tool("suggestAttribution", {
	title: "Suggest Attribution",
	description:
		"Suggest the Owner for a Notion page using Docs.Owner or available Notion metadata.",
	schema: j.object({
		page_id: j.string().describe("The Notion page ID to inspect."),
	}),
	execute: executeTool(suggestAttribution),
});

worker.tool("updateFeatureRow", {
	title: "Update Features Row",
	description:
		"Update editable discovery fields on an existing Features row, such as Summary, Quotes, Voice, Concerns, Decision Style, Principles, or Tags.",
	schema: j.object({
		page_id: j.string().describe("The source Notion page ID whose Features row should be updated."),
		summary: j.string().describe("Updated short summary, or null to leave unchanged.").nullable(),
		quotes: j.string().describe("Updated representative quotes, or null to leave unchanged.").nullable(),
		voice: j.string().describe("Updated voice/tone description, or null to leave unchanged.").nullable(),
		concerns: j.string().describe("Updated per-document concerns, risks, or recurring objections, or null to leave unchanged.").nullable(),
		decision_style: j.string().describe("Updated decision style signals from this document, or null to leave unchanged.").nullable(),
		principles: j.string().describe("Updated principles or values expressed in this document, or null to leave unchanged.").nullable(),
		tags: j.array(j.string()).describe("Updated tags, or null to leave unchanged.").nullable(),
	}),
	execute: executeTool(updateFeatureRow),
});

worker.tool("importGithubPullRequests", {
	title: "Import GitHub Pull Requests",
	description:
		"Fetch latest GitHub pull requests from one or more repositories and create raw source documents in the Docs database.",
	schema: j.object({
		repositories: j.array(j.string()).describe("GitHub repositories as owner/repo, such as notion/notion-sdk-js."),
		limit_per_repo: j.number().describe("Maximum PRs to import per repository, capped at 25. Use null for default 10.").nullable(),
		state: j.string().describe("PR state: open, closed, or all. Use null for open.").nullable(),
		owner_user_id: j.string().describe("Optional Notion user ID to set as Docs.Owner for imported PR docs. Use null for no owner.").nullable(),
		dry_run: j.boolean().describe("When true, preview imports without writing to Notion.").nullable(),
	}),
	execute: executeTool(importGithubPullRequests),
});

worker.tool("resolvePersonas", {
	title: "Resolve Personas",
	description:
		"Resolve managed handles or teams from the Personas into enabled personas for a review run.",
	schema: j.object({
		handles_or_tags: j.array(j.string()).describe("Persona handles or teams to resolve, with or without # or @ prefixes."),
		include_disabled: j.boolean().describe("Whether to include disabled/draft personas. Usually false.").nullable(),
	}),
	execute: executeTool(resolvePersonas),
});

worker.tool("createOrUpdatePersona", {
	title: "Create Or Update Persona",
	description:
		"Create or update a Personas row. Use this from Cloner mode after drafting a persona from indexed features.",
	schema: j.object({
		owner_user_id: j.string().describe("Notion user ID represented by this persona, or null for role personas.").nullable(),
		handle: j.string().describe("Managed persona handle without @, such as mikewu or cto."),
		display_name: j.string().describe("Display name for the persona."),
		role: j.string().describe("Short role description, or null if unknown.").nullable(),
		team: j
			.string()
			.describe("Persona team: customer, sales, design, marketing, engineering, or executive. Use null if unknown.")
			.nullable(),
		tags: j.array(j.string()).describe("Persona tags, or null for none.").nullable(),
		system_prompt: j.string().describe("Persona system prompt, or null to leave empty.").nullable(),
		voice: j.string().describe("Aggregated persona voice/tone, or null to leave empty.").nullable(),
		recurring_concerns: j.string().describe("Aggregated recurring concerns for this persona, or null to leave empty.").nullable(),
		decision_style: j.string().describe("Aggregated decision style for this persona, or null to leave empty.").nullable(),
		principles: j.string().describe("Aggregated principles for this persona, or null to leave empty.").nullable(),
		source_page_ids: j.array(j.string()).describe("Source page IDs selected for this persona, or null.").nullable(),
		enabled: j.boolean().describe("Whether this persona can participate in live runs. Drafts should be false.").nullable(),
		sync_status: j.string().describe("Sync status, such as Needs Review or Enabled.").nullable(),
		notion_agent_url: j.string().describe("Optional native Notion Agent URL, or null.").nullable(),
	}),
	execute: executeTool(createOrUpdatePersona),
});

worker.tool("getPersonaSourceFeatures", {
	title: "Get Persona Source Features",
	description:
		"Return Features rows owned or contributed by a persona's owner user ID so the Notwin can draft or refresh persona prompts.",
	schema: j.object({
		handle: j.string().describe("Persona handle to inspect."),
	}),
	execute: executeTool(getPersonaSourceFeatures),
});

worker.tool("getFeaturesForOwner", {
	title: "Get Features For Owner",
	description:
		"Return all Features rows owned by a Notion user. Use this after syncing new docs to aggregate persona-level traits.",
	schema: j.object({
		owner_user_id: j.string().describe("Notion user ID whose owned features should be returned."),
	}),
	execute: executeTool(getFeaturesForOwner),
});

worker.tool("listFeatureOwners", {
	title: "List Feature Owners",
	description:
		"Return every Notion user represented in Features.Owner, with feature counts. Use this before aggregating all Features into Personas.",
	schema: j.object({}),
	execute: executeTool(listFeatureOwners),
});

worker.tool("createRun", {
	title: "Create Execution",
	description:
		"Create an Executions row after the Manager has selected personas and context features for a review.",
	schema: j.object({
		page_id: j.string().describe("Target Notion page ID being reviewed."),
		root_comment_id: j.string().describe("Comment ID that started the run, or null if unavailable.").nullable(),
		selected_personas: j.array(j.string()).describe("Ordered persona handles selected for the run."),
		selected_context_docs: j.array(j.string()).describe("Source page IDs or Feature row IDs selected as context."),
		max_turns: j.number().describe("Max persona turns before forced completion. Use null for default 16.").nullable(),
		per_persona_max_actions: j.number().describe("Internal guardrail. Use null for default 4 total actions per persona per Execution.").nullable(),
	}),
	execute: executeTool(createRun),
});

worker.tool("getRunState", {
	title: "Get Run State",
	description: "Read an Execution row by run ID.",
	schema: j.object({
		run_id: j.string().describe("Run ID to retrieve."),
	}),
	execute: executeTool(getRunState),
});

worker.tool("updateRun", {
	title: "Update Execution",
	description:
		"Update Execution state after each persona turn. Enforces max-turn and empty-queue completion guardrails.",
	schema: j.object({
		run_id: j.string().describe("Run ID to update."),
		status: j.string().describe("New status, or null to preserve current status.").nullable(),
		selected_personas: j.array(j.string()).describe("Updated selected personas, or null to preserve.").nullable(),
		selected_context_docs: j.array(j.string()).describe("Updated context features, or null to preserve.").nullable(),
		turn_count: j.number().describe("Updated total turn count, or null to preserve.").nullable(),
		current_round: j.number().describe("Updated current round, or null to preserve.").nullable(),
		agent_queue: j.array(j.string()).describe("Updated remaining queue, or null to preserve.").nullable(),
		processed_comment_ids: j.array(j.string()).describe("Updated processed comment IDs, or null to preserve.").nullable(),
		persona_action_counts_json: j.string().describe("Updated JSON object of persona handle to action count, or null to preserve.").nullable(),
		last_actor: j.string().describe("Last persona handle that acted, or null to preserve.").nullable(),
		lock_until: j.string().describe("ISO timestamp for lock expiry, empty string to clear, or null to preserve.").nullable(),
		failure_reason: j.string().describe("Failure reason or log text, or null to preserve.").nullable(),
	}),
	execute: executeTool(updateRun),
});

worker.tool("recordPersonaAction", {
	title: "Record Persona Action",
	description:
		"Record one persona action against an Execution. If the reply tagged personas/teams, pass them in delegated_handles_or_teams so queueing and recording happen atomically.",
	schema: j.object({
		run_id: j.string().describe("Run ID to update."),
		persona_handle: j.string().describe("Persona handle that acted."),
		action_type: j.string().describe("One of new_comment, reply_to_thread, tag_persona, skip, or no_action."),
		agent_queue: j.array(j.string()).describe("Updated remaining queue after this action, or null to auto-remove this persona.").nullable(),
		delegated_handles_or_teams: j
			.array(j.string())
			.describe("Persona handles or teams visibly tagged in this action, or null if none. These are enqueued atomically before completion checks.")
			.nullable(),
		processed_comment_ids: j.array(j.string()).describe("Updated processed comment IDs, or null to preserve.").nullable(),
		message: j.string().describe("Short action summary for the execution log, or null.").nullable(),
	}),
	execute: executeTool(recordPersonaAction),
});

worker.tool("enqueueDelegatedPersonas", {
	title: "Enqueue Delegated Personas",
	description:
		"Resolve delegated #handles or #teams and append matching enabled personas to an active Execution queue if action budget remains.",
	schema: j.object({
		run_id: j.string().describe("Run ID whose Agent Queue should receive delegated personas."),
		handles_or_teams: j.array(j.string()).describe("Delegated persona handles or teams, with or without # prefixes."),
		delegated_by: j.string().describe("Persona handle that delegated, or null if unknown.").nullable(),
		reason: j.string().describe("Short reason for delegation, or null.").nullable(),
	}),
	execute: executeTool(enqueueDelegatedPersonas),
});

worker.tool("appendRunEvent", {
	title: "Append Run Event",
	description:
		"Append a lightweight run event to the Execution log field for debugging and observability.",
	schema: j.object({
		run_id: j.string().describe("Run ID to append to."),
		event_type: j.string().describe("Event type, such as run_created or persona_comment_created."),
		message: j.string().describe("Human-readable event message."),
		metadata_json: j.string().describe("Optional JSON metadata string, or null.").nullable(),
	}),
	execute: executeTool(appendRunEvent),
});
