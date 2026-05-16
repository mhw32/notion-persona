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
	const pages = await queryAllCollection(notion, config.personaRegistryDatabaseId, {}, 1000);
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
		tags: string[] | null;
		system_prompt: string | null;
		source_page_ids: string[] | null;
		enabled: boolean | null;
		sync_status: string | null;
		notion_agent_url: string | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const existing = await findPersonaByHandle(notion, config.personaRegistryDatabaseId, input.handle);
	const properties = buildPersonaProperties(input);

	if (existing) {
		await updatePageProperties(notion, existing.id, properties);
		return { ok: true, action: "updated", persona_row_id: existing.id, handle: input.handle };
	}

	const created = await createDatabasePage(notion, config.personaRegistryDatabaseId, properties);
	return { ok: true, action: "created", persona_row_id: created.id, handle: input.handle };
}

export async function getPersonaSourceFeatures(input: { handle: string }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const personaPage = await findPersonaByHandle(notion, config.personaRegistryDatabaseId, input.handle);
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
		}));

	return {
		ok: true,
		persona,
		source_features: relatedDocs,
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
		Tags: multiSelect(input.tags ?? []),
		"System Prompt": longRichText(input.system_prompt ?? ""),
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
		tags: multiSelectValues(getProperty(page, "Tags")),
		systemPrompt: plainText(getProperty(page, "System Prompt")),
		ownerUserId: plainText(getProperty(page, "Owner User ID")),
		enabled: checkboxValue(getProperty(page, "Enabled")),
		syncStatus: selectValue(getProperty(page, "Sync Status")),
	};
}

function normalizeToken(value: string): string {
	return value.trim().replace(/^@/, "").toLowerCase();
}
