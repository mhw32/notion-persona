import { getConfig } from "../config.js";
import { createDatabasePage, getNotionClient, queryAllCollection, updatePageProperties } from "../notion.js";
import {
	checkbox,
	checkboxValue,
	getProperty,
	longRichText,
	multiSelect,
	multiSelectValues,
	plainText,
	richText,
	select,
	selectValue,
	title,
	url,
} from "../properties.js";
import type { PersonaRecord } from "../types.js";

type ToolContext = { notion?: Record<string, any> };

export async function resolvePersonas(input: { handles_or_tags: string[]; include_disabled: boolean | null }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const requested = new Set(input.handles_or_tags.map(normalizeToken));
	const pages = await queryAllCollection(notion, config.personasDatabaseId, {}, 1000);
	const personas = pages.map(pageToPersona).filter((persona) => {
		if (!input.include_disabled && (!persona.enabled || !["Enabled", "Needs Review"].includes(persona.syncStatus))) return false;
		if (requested.has(normalizeToken(persona.handle))) return true;
		return persona.tags.some((tag) => requested.has(normalizeToken(tag)));
	});

	return {
		ok: true,
		count: personas.length,
		personas,
	};
}

export async function createOrUpdatePersona(
	input: {
		owner_user_id: string | null;
		handle: string;
		display_name: string;
		role: string | null;
		team: string | null;
		tags: string[] | null;
		system_prompt: string | null;
		voice: string | null;
		recurring_concerns: string | null;
		decision_style: string | null;
		principles: string | null;
		source_page_ids: string[] | null;
		enabled: boolean | null;
		sync_status: string | null;
		notion_agent_url: string | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const existing = await findPersonaByHandle(notion, config.personasDatabaseId, input.handle);
	const properties = buildPersonaProperties(input);

	if (existing) {
		await updatePageProperties(notion, existing.id, properties);
		return { ok: true, action: "updated", persona_row_id: existing.id, handle: input.handle };
	}

	const created = await createDatabasePage(notion, config.personasDatabaseId, properties);
	return { ok: true, action: "created", persona_row_id: created.id, handle: input.handle };
}

export async function getPersonaSourceFeatures(input: { handle: string }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const personaPage = await findPersonaByHandle(notion, config.personasDatabaseId, input.handle);
	if (!personaPage) {
		return { ok: false, message: `No persona found for handle ${input.handle}.` };
	}

	const persona = pageToPersona(personaPage);
	const docs = await queryAllCollection(notion, config.featuresDatabaseId, {}, 1000);
	const relatedDocs = docs
		.filter((doc) => {
			const ownerIds = ((getProperty(doc, "Owner") as any)?.people ?? []).map((person: { id: string }) => person.id);
			return persona.ownerUserId && ownerIds.includes(persona.ownerUserId);
		})
		.map((doc) => ({
			feature_row_id: doc.id,
			page_id: plainText(getProperty(doc, "Page ID")),
			name: plainText(getProperty(doc, "Name")),
			summary: plainText(getProperty(doc, "Summary")),
			quotes: plainText(getProperty(doc, "Quotes")),
			voice: plainText(getProperty(doc, "Voice")),
			concerns: plainText(getProperty(doc, "Concerns")),
			decision_style: plainText(getProperty(doc, "Decision Style")),
			principles: plainText(getProperty(doc, "Principles")),
		}));

	return {
		ok: true,
		persona,
		source_features: relatedDocs,
	};
}

export async function getFeaturesForOwner(input: { owner_user_id: string }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const features = await queryAllCollection(notion, config.featuresDatabaseId, {}, 1000);
	const ownerFeatures = features
		.filter((feature) => {
			const ownerIds = ((getProperty(feature, "Owner") as any)?.people ?? []).map((person: { id: string }) => person.id);
			return ownerIds.includes(input.owner_user_id);
		})
		.map((feature) => ({
			feature_row_id: feature.id,
			page_id: plainText(getProperty(feature, "Page ID")),
			name: plainText(getProperty(feature, "Name")),
			summary: plainText(getProperty(feature, "Summary")),
			quotes: plainText(getProperty(feature, "Quotes")),
			voice: plainText(getProperty(feature, "Voice")),
			concerns: plainText(getProperty(feature, "Concerns")),
			decision_style: plainText(getProperty(feature, "Decision Style")),
			principles: plainText(getProperty(feature, "Principles")),
			tags: multiSelectValues(getProperty(feature, "Tags")),
		}));

	return {
		ok: true,
		owner_user_id: input.owner_user_id,
		count: ownerFeatures.length,
		features: ownerFeatures,
	};
}

async function findPersonaByHandle(notion: Record<string, any>, databaseId: string, handle: string) {
	const rows = await queryAllCollection(
		notion,
		databaseId,
		{
			filter: {
				property: "Handle",
				rich_text: { equals: normalizeToken(handle) },
			},
		},
		1,
	);
	return rows[0] ?? null;
}

function buildPersonaProperties(input: Parameters<typeof createOrUpdatePersona>[0]) {
	return {
		Name: title(input.display_name),
		Handle: richText(normalizeToken(input.handle)),
		Role: richText(input.role ?? ""),
		Team: select(input.team ?? null),
		Tags: multiSelect(input.tags ?? []),
		"System Prompt": longRichText(input.system_prompt ?? ""),
		Voice: longRichText(input.voice ?? ""),
		"Recurring Concerns": longRichText(input.recurring_concerns ?? ""),
		"Decision Style": longRichText(input.decision_style ?? ""),
		Principles: longRichText(input.principles ?? ""),
		"Owner User ID": richText(input.owner_user_id ?? ""),
		Enabled: checkbox(input.enabled ?? false),
		"Sync Status": select(input.sync_status ?? "Needs Review"),
		"Notion Agent URL": url(input.notion_agent_url),
	};
}

function pageToPersona(page: any): PersonaRecord {
	return {
		pageId: page.id,
		name: plainText(getProperty(page, "Name")),
		handle: plainText(getProperty(page, "Handle")),
		role: plainText(getProperty(page, "Role")),
		team: selectValue(getProperty(page, "Team")),
		tags: multiSelectValues(getProperty(page, "Tags")),
		systemPrompt: plainText(getProperty(page, "System Prompt")),
		voice: plainText(getProperty(page, "Voice")),
		recurringConcerns: plainText(getProperty(page, "Recurring Concerns")),
		decisionStyle: plainText(getProperty(page, "Decision Style")),
		principles: plainText(getProperty(page, "Principles")),
		ownerUserId: plainText(getProperty(page, "Owner User ID")),
		enabled: checkboxValue(getProperty(page, "Enabled")),
		syncStatus: selectValue(getProperty(page, "Sync Status")),
	};
}

function normalizeToken(value: string): string {
	return value.trim().replace(/^@/, "").toLowerCase();
}
