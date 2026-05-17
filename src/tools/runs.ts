import { getConfig } from "../config.js";
import { DEFAULT_MAX_TURNS } from "../schema.js";
import { createDatabasePage, getNotionClient, queryAllCollection, updatePageProperties } from "../notion.js";
import { checkboxValue, date, getProperty, number, plainText, richText, select, selectValue, title } from "../properties.js";

type ToolContext = { notion?: Record<string, any> };

export async function createRun(
	input: {
		page_id: string;
		root_comment_id: string | null;
		selected_personas: string[];
		selected_context_docs: string[];
		max_turns: number | null;
		per_persona_max_actions: number | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const runId = `run_${new Date().toISOString().replaceAll(/[-:.]/g, "").slice(0, 15)}_${randomSuffix()}`;
	const maxTurns = input.max_turns ?? DEFAULT_MAX_TURNS;
	const perPersonaMaxActions = input.per_persona_max_actions ?? 4;
	const properties = {
		"Run ID": title(runId),
		"Target Page ID": richText(input.page_id),
		"Root Comment ID": richText(input.root_comment_id ?? ""),
		Status: select("active"),
		"Selected Personas": richText(JSON.stringify(input.selected_personas)),
		"Selected Context Docs": richText(JSON.stringify(input.selected_context_docs)),
		"Turn Count": number(0),
		"Max Turns": number(maxTurns),
		"Per Persona Max Actions": number(perPersonaMaxActions),
		"Persona Action Counts": richText("{}"),
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
		per_persona_max_actions: perPersonaMaxActions,
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
		persona_action_counts_json: string | null;
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
	if (input.persona_action_counts_json !== null) properties["Persona Action Counts"] = richText(JSON.stringify(normalizeCounts(safeParseJson(input.persona_action_counts_json))));
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

export async function recordPersonaAction(
	input: {
		run_id: string;
		persona_handle: string;
		action_type: string;
		agent_queue: string[] | null;
		processed_comment_ids: string[] | null;
		message: string | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findRunById(notion, config.executionsDatabaseId, input.run_id);
	if (!row) return { ok: false, message: `No run found for ${input.run_id}.` };

	const current = pageToRun(row);
	if (current.status !== "active") {
		return { ok: false, message: `Run ${input.run_id} is ${current.status}; action was not recorded.` };
	}

	const personaHandle = normalizeToken(input.persona_handle);
	const currentPersonaCount = current.personaActionCounts[personaHandle] ?? 0;
	if (currentPersonaCount >= current.perPersonaMaxActions) {
		return { ok: false, message: `${personaHandle} has already used ${current.perPersonaMaxActions} actions.` };
	}

	const nextTurnCount = current.turnCount + 1;
	const nextCounts = { ...current.personaActionCounts, [personaHandle]: currentPersonaCount + 1 };
	const nextQueue = input.agent_queue ?? defaultNextQueue(current.agentQueue, personaHandle, input.action_type, nextCounts[personaHandle], current.perPersonaMaxActions);
	const nextProcessedCommentIds = input.processed_comment_ids ?? current.processedCommentIds;
	let nextStatus = current.status;
	if (nextTurnCount >= current.maxTurns || nextQueue.length === 0) nextStatus = "complete";

	await updatePageProperties(notion, row.id, {
		Status: select(nextStatus),
		"Turn Count": number(nextTurnCount),
		"Persona Action Counts": richText(JSON.stringify(nextCounts)),
		"Agent Queue": richText(JSON.stringify(nextQueue)),
		"Processed Comment IDs": richText(JSON.stringify(nextProcessedCommentIds)),
		"Last Actor": richText(personaHandle),
	});

	await appendRunEvent(
		{
			run_id: input.run_id,
			event_type: "persona_action_recorded",
			message: input.message ?? `${personaHandle} took ${input.action_type}`,
			metadata_json: JSON.stringify({
				persona_handle: personaHandle,
				action_type: input.action_type,
				persona_action_count: nextCounts[personaHandle],
				turn_count: nextTurnCount,
				status: nextStatus,
			}),
		},
		context,
	);

	return {
		ok: true,
		run_id: input.run_id,
		status: nextStatus,
		turn_count: nextTurnCount,
		persona_handle: personaHandle,
		persona_action_count: nextCounts[personaHandle],
		persona_action_budget: current.perPersonaMaxActions,
		agent_queue: nextQueue,
	};
}

export async function enqueueDelegatedPersonas(
	input: { run_id: string; handles_or_teams: string[]; delegated_by: string | null; reason: string | null },
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findRunById(notion, config.executionsDatabaseId, input.run_id);
	if (!row) return { ok: false, message: `No run found for ${input.run_id}.` };

	const current = pageToRun(row);
	if (current.status !== "active" && current.status !== "complete") {
		return { ok: false, message: `Run ${input.run_id} is ${current.status}; no personas were enqueued.` };
	}

	const remainingBudget = Math.max(0, current.maxTurns - current.turnCount - current.agentQueue.length);
	if (remainingBudget <= 0) {
		return { ok: false, message: `Run ${input.run_id} has no remaining action budget.` };
	}

	const delegated = await resolveDelegatedPersonas(notion, config.personasDatabaseId, input.handles_or_teams);
	const queued = new Set(current.agentQueue.map(normalizeToken));
	const toAdd: string[] = [];

	for (const persona of delegated) {
		const handle = normalizeToken(persona.handle);
		if (!handle || queued.has(handle)) continue;
		if ((current.personaActionCounts[handle] ?? 0) >= current.perPersonaMaxActions) continue;
		toAdd.push(handle);
		queued.add(handle);
		if (toAdd.length >= remainingBudget) break;
	}

	if (toAdd.length === 0) {
		return {
			ok: true,
			run_id: input.run_id,
			enqueued: [],
			message: "No new enabled personas matched, or all matches were already selected or queued.",
		};
	}

	const nextQueue = [...current.agentQueue, ...toAdd];
	const selected = new Set(current.selectedPersonas.map(normalizeToken));
	const nextSelected = [...current.selectedPersonas];
	for (const handle of toAdd) {
		if (!selected.has(handle)) nextSelected.push(handle);
	}
	await updatePageProperties(notion, row.id, {
		Status: select("active"),
		"Agent Queue": richText(JSON.stringify(nextQueue)),
		"Selected Personas": richText(JSON.stringify(nextSelected)),
	});

	await appendRunEvent(
		{
			run_id: input.run_id,
			event_type: "personas_delegated",
			message: `${input.delegated_by ?? "unknown"} delegated to ${toAdd.join(", ")}`,
			metadata_json: JSON.stringify({
				requested: input.handles_or_teams,
				enqueued: toAdd,
				reason: input.reason,
				remaining_budget_before_enqueue: remainingBudget,
			}),
		},
		context,
	);

	return {
		ok: true,
		run_id: input.run_id,
		enqueued: toAdd,
		agent_queue: nextQueue,
		selected_personas: nextSelected,
		remaining_budget_after_enqueue: current.maxTurns - current.turnCount - nextQueue.length,
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

async function resolveDelegatedPersonas(notion: Record<string, any>, personasDatabaseId: string, handlesOrTeams: string[]) {
	const requested = new Set(handlesOrTeams.map(normalizeToken));
	const rows = await queryAllCollection(notion, personasDatabaseId, {}, 1000);

	return rows
		.map((row) => ({
			handle: plainText(getProperty(row, "Handle")),
			team: selectValue(getProperty(row, "Team")),
			enabled: checkboxValue(getProperty(row, "Enabled")),
			syncStatus: selectValue(getProperty(row, "Sync Status")),
		}))
		.filter((persona) => {
			if (!persona.enabled || !["Enabled", "Needs Review"].includes(persona.syncStatus)) return false;
			return requested.has(normalizeToken(persona.handle)) || requested.has(normalizeToken(persona.team));
		});
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
		perPersonaMaxActions: ((getProperty(page, "Per Persona Max Actions") as any)?.number ?? 4) as number,
		personaActionCounts: parseCounts(plainText(getProperty(page, "Persona Action Counts"))),
		currentRound: ((getProperty(page, "Current Round") as any)?.number ?? 1) as number,
		agentQueue: parseArray(plainText(getProperty(page, "Agent Queue"))),
		processedCommentIds: parseArray(plainText(getProperty(page, "Processed Comment IDs"))),
		lastActor: plainText(getProperty(page, "Last Actor")),
		failureReason: plainText(getProperty(page, "Failure Reason")),
	};
}

function parseCounts(value: string): Record<string, number> {
	if (!value) return {};
	try {
		return normalizeCounts(JSON.parse(value));
	} catch {
		return {};
	}
}

function normalizeCounts(value: unknown): Record<string, number> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const counts: Record<string, number> = {};
	for (const [key, rawCount] of Object.entries(value)) {
		const count = Number(rawCount);
		if (!Number.isFinite(count) || count < 0) continue;
		counts[normalizeToken(key)] = count;
	}
	return counts;
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

function defaultNextQueue(
	currentQueue: string[],
	personaHandle: string,
	actionType: string,
	nextPersonaCount: number,
	perPersonaMaxActions: number,
) {
	const normalizedActionType = normalizeToken(actionType);
	const shouldRemovePersona =
		normalizedActionType === "new_comment" ||
		normalizedActionType === "skip" ||
		nextPersonaCount >= perPersonaMaxActions;

	if (!shouldRemovePersona) return currentQueue;
	return currentQueue.filter((handle) => normalizeToken(handle) !== personaHandle);
}

function normalizeToken(value: string): string {
	return value.trim().replace(/^[@#]/, "").toLowerCase();
}

function randomSuffix(): string {
	return Math.random().toString(36).slice(2, 8);
}
