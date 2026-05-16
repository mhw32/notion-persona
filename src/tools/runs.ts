import { getConfig } from "../config.js";
import { DEFAULT_MAX_TURNS } from "../schema.js";
import { createDatabasePage, getNotionClient, queryAllCollection, updatePageProperties } from "../notion.js";
import { date, getProperty, number, plainText, richText, select, title } from "../properties.js";

type ToolContext = { notion?: Record<string, any> };

export async function createRun(
	input: {
		page_id: string;
		root_comment_id: string | null;
		selected_personas: string[];
		selected_context_docs: string[];
		max_turns: number | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const runId = `run_${new Date().toISOString().replaceAll(/[-:.]/g, "").slice(0, 15)}_${randomSuffix()}`;
	const maxTurns = input.max_turns ?? DEFAULT_MAX_TURNS;
	const properties = {
		"Run ID": title(runId),
		"Target Page ID": richText(input.page_id),
		"Root Comment ID": richText(input.root_comment_id ?? ""),
		Status: select("active"),
		"Selected Personas": richText(JSON.stringify(input.selected_personas)),
		"Selected Context Docs": richText(JSON.stringify(input.selected_context_docs)),
		"Turn Count": number(0),
		"Max Turns": number(maxTurns),
		"Current Round": number(1),
		"Agent Queue": richText(JSON.stringify(input.selected_personas)),
		"Processed Comment IDs": richText(input.root_comment_id ? JSON.stringify([input.root_comment_id]) : "[]"),
		"Last Actor": richText(""),
		"Lock Until": date(null),
		"Failure Reason": richText(""),
	};
	const created = await createDatabasePage(notion, config.executionsDatabaseId, properties);

	return {
		ok: true,
		run_id: runId,
		run_row_id: created.id,
		status: "active",
		agent_queue: input.selected_personas,
		max_turns: maxTurns,
	};
}

export async function getRunState(input: { run_id: string }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findRunById(notion, config.executionsDatabaseId, input.run_id);
	if (!row) return { ok: false, message: `No run found for ${input.run_id}.` };
	return { ok: true, run: pageToRun(row) };
}

export async function updateRun(
	input: {
		run_id: string;
		status: string | null;
		selected_personas: string[] | null;
		selected_context_docs: string[] | null;
		turn_count: number | null;
		current_round: number | null;
		agent_queue: string[] | null;
		processed_comment_ids: string[] | null;
		last_actor: string | null;
		lock_until: string | null;
		failure_reason: string | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findRunById(notion, config.executionsDatabaseId, input.run_id);
	if (!row) return { ok: false, message: `No run found for ${input.run_id}.` };

	const current = pageToRun(row);
	const nextTurnCount = input.turn_count ?? current.turnCount;
	const maxTurns = current.maxTurns || DEFAULT_MAX_TURNS;
	let nextStatus = input.status ?? current.status;
	if (nextTurnCount >= maxTurns && nextStatus === "active") nextStatus = "complete";
	if (input.agent_queue && input.agent_queue.length === 0 && nextStatus === "active") nextStatus = "complete";

	const properties: Record<string, unknown> = {
		Status: select(nextStatus),
		"Turn Count": number(nextTurnCount),
	};
	if (input.selected_personas !== null) properties["Selected Personas"] = richText(JSON.stringify(input.selected_personas));
	if (input.selected_context_docs !== null) properties["Selected Context Docs"] = richText(JSON.stringify(input.selected_context_docs));
	if (input.current_round !== null) properties["Current Round"] = number(input.current_round);
	if (input.agent_queue !== null) properties["Agent Queue"] = richText(JSON.stringify(input.agent_queue));
	if (input.processed_comment_ids !== null) properties["Processed Comment IDs"] = richText(JSON.stringify(input.processed_comment_ids));
	if (input.last_actor !== null) properties["Last Actor"] = richText(input.last_actor);
	if (input.lock_until !== null) properties["Lock Until"] = date(input.lock_until || null);
	if (input.failure_reason !== null) properties["Failure Reason"] = richText(input.failure_reason);

	await updatePageProperties(notion, row.id, properties);
	return {
		ok: true,
		run_id: input.run_id,
		run_row_id: row.id,
		status: nextStatus,
		turn_count: nextTurnCount,
	};
}

export async function appendRunEvent(
	input: { run_id: string; event_type: string; message: string; metadata_json: string | null },
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findRunById(notion, config.executionsDatabaseId, input.run_id);
	if (!row) return { ok: false, message: `No run found for ${input.run_id}.` };

	const previous = plainText(getProperty(row, "Failure Reason"));
	const event = {
		at: new Date().toISOString(),
		type: input.event_type,
		message: input.message,
		metadata: safeParseJson(input.metadata_json),
	};
	const nextLog = [previous, JSON.stringify(event)].filter(Boolean).join("\n");
	await updatePageProperties(notion, row.id, { "Failure Reason": richText(nextLog) });

	return { ok: true, run_id: input.run_id, appended: event };
}

async function findRunById(notion: Record<string, any>, databaseId: string, runId: string) {
	const rows = await queryAllCollection(
		notion,
		databaseId,
		{
			filter: {
				property: "Run ID",
				title: { equals: runId },
			},
		},
		1,
	);
	return rows[0] ?? null;
}

function pageToRun(page: any) {
	return {
		pageId: page.id,
		runId: plainText(getProperty(page, "Run ID")),
		targetPageId: plainText(getProperty(page, "Target Page ID")),
		rootCommentId: plainText(getProperty(page, "Root Comment ID")),
		status: plainText(getProperty(page, "Status")),
		selectedPersonas: parseArray(plainText(getProperty(page, "Selected Personas"))),
		selectedContextDocs: parseArray(plainText(getProperty(page, "Selected Context Docs"))),
		turnCount: ((getProperty(page, "Turn Count") as any)?.number ?? 0) as number,
		maxTurns: ((getProperty(page, "Max Turns") as any)?.number ?? DEFAULT_MAX_TURNS) as number,
		currentRound: ((getProperty(page, "Current Round") as any)?.number ?? 1) as number,
		agentQueue: parseArray(plainText(getProperty(page, "Agent Queue"))),
		processedCommentIds: parseArray(plainText(getProperty(page, "Processed Comment IDs"))),
		lastActor: plainText(getProperty(page, "Last Actor")),
		failureReason: plainText(getProperty(page, "Failure Reason")),
	};
}

function parseArray(value: string): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

function safeParseJson(value: string | null) {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function randomSuffix(): string {
	return Math.random().toString(36).slice(2, 8);
}
