import { getConfig } from "../config.js";
import {
	createDatabasePage,
	getNotionClient,
	pageUrl,
	queryAllCollection,
	updatePageProperties,
} from "../notion.js";
import {
	checkbox,
	checkboxValue,
	date,
	getProperty,
	people,
	peopleIds,
	plainText,
	richText,
	select,
	selectValue,
	title,
	titleFromPage,
	url,
} from "../properties.js";

type ToolContext = { notion?: Record<string, any> };

export async function syncDocsIndex(
	input: { data_source_id: string; limit: number | null; dry_run: boolean | null },
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const sourcePages = await queryAllCollection(notion, input.data_source_id, {}, input.limit ?? 100);
	const existingRows = await queryAllCollection(notion, config.docsIndexDatabaseId, {}, 1000);
	const existingBySourcePageId = new Map<string, any>();

	for (const row of existingRows) {
		const sourcePageId = plainText(getProperty(row, "Page ID"));
		if (sourcePageId) existingBySourcePageId.set(sourcePageId, row);
	}

	const changes = [];

	for (const sourcePage of sourcePages) {
		const sourcePageId = sourcePage.id;
		const existing = existingBySourcePageId.get(sourcePageId);
		const inferred = inferAttribution(sourcePage, existing);
		const properties = buildDocsIndexProperties(sourcePage, existing, inferred);

		if (input.dry_run) {
			changes.push({ action: existing ? "would_update" : "would_create", page_id: sourcePageId, title: titleFromPage(sourcePage) });
			continue;
		}

		if (existing) {
			await updatePageProperties(notion, existing.id, properties);
			changes.push({ action: "updated", page_id: sourcePageId, docs_index_row_id: existing.id });
		} else {
			const created = await createDatabasePage(notion, config.docsIndexDatabaseId, properties);
			changes.push({ action: "created", page_id: sourcePageId, docs_index_row_id: created.id });
		}
	}

	return {
		ok: true,
		source_count: sourcePages.length,
		changes,
	};
}

export async function suggestAttribution(input: { page_id: string }, context?: ToolContext) {
	const notion = getNotionClient(context);
	const page = await notion.pages.retrieve({ page_id: input.page_id });
	const inferred = inferAttribution(page, null);

	return {
		page_id: input.page_id,
		suggested_owner_ids: inferred.ownerIds,
		suggested_contributor_ids: inferred.contributorIds,
		attribution_source: inferred.source,
		attribution_confidence: inferred.confidence,
		needs_review: inferred.needsReview,
		reason: inferred.reason,
	};
}

export async function updateDocIndexRow(
	input: {
		page_id: string;
		summary: string | null;
		key_quotes: string | null;
		tags: string[] | null;
		persona_enabled: boolean | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findDocsIndexRowBySourcePageId(notion, config.docsIndexDatabaseId, input.page_id);
	if (!row) {
		return { ok: false, message: `No Docs Index row found for page ${input.page_id}. Run syncDocsIndex first.` };
	}

	const properties: Record<string, unknown> = {};
	if (input.summary !== null) properties["Summary"] = richText(input.summary);
	if (input.key_quotes !== null) properties["Key Quotes"] = richText(input.key_quotes);
	if (input.tags !== null) properties["Tags / Area"] = { multi_select: input.tags.map((name) => ({ name })) };
	if (input.persona_enabled !== null) properties["Persona Enabled"] = checkbox(input.persona_enabled);

	await updatePageProperties(notion, row.id, properties);
	return { ok: true, docs_index_row_id: row.id, updated_properties: Object.keys(properties) };
}

async function findDocsIndexRowBySourcePageId(notion: Record<string, any>, docsIndexDatabaseId: string, pageId: string) {
	const rows = await queryAllCollection(
		notion,
		docsIndexDatabaseId,
		{
			filter: {
				property: "Page ID",
				rich_text: { equals: pageId },
			},
		},
		1,
	);
	return rows[0] ?? null;
}

function buildDocsIndexProperties(sourcePage: any, existing: any | null, inferred: Attribution) {
	const existingOwnerIds = existing ? peopleIds(getProperty(existing, "Owner")) : [];
	const existingContributorIds = existing ? peopleIds(getProperty(existing, "Contributors")) : [];
	const existingSummary = existing ? plainText(getProperty(existing, "Summary")) : "";
	const existingKeyQuotes = existing ? plainText(getProperty(existing, "Key Quotes")) : "";
	const existingTags = existing ? ((getProperty(existing, "Tags / Area") as any)?.multi_select ?? []).map((item: { name: string }) => item.name) : [];
	const existingContentType = existing ? selectValue(getProperty(existing, "Content Type")) : "";
	const existingPersonaEnabled = existing ? checkboxValue(getProperty(existing, "Persona Enabled")) : true;

	const ownerIds = existingOwnerIds.length > 0 ? existingOwnerIds : inferred.ownerIds;
	const contributorIds = unique([...existingContributorIds, ...inferred.contributorIds]);

	return {
		Name: title(titleFromPage(sourcePage)),
		"Page ID": richText(sourcePage.id),
		"Source Page": url(pageUrl(sourcePage.id)),
		Owner: people(ownerIds),
		Contributors: people(contributorIds),
		"Tags / Area": { multi_select: existingTags.map((name: string) => ({ name })) },
		Summary: richText(existingSummary),
		"Key Quotes": richText(existingKeyQuotes),
		"Content Type": select(existingContentType || "Spec"),
		"Persona Enabled": checkbox(existingPersonaEnabled),
		"Attribution Source": select(existingOwnerIds.length > 0 ? "Manual" : inferred.source),
		"Attribution Confidence": select(existingOwnerIds.length > 0 ? "High" : inferred.confidence),
		"Needs Review": checkbox(existingOwnerIds.length === 0 && inferred.needsReview),
		"Last Indexed At": date(new Date().toISOString()),
		"Created By": people(sourcePage.created_by?.id ? [sourcePage.created_by.id] : []),
		"Created Time": date(sourcePage.created_time),
		"Last Edited By": people(sourcePage.last_edited_by?.id ? [sourcePage.last_edited_by.id] : []),
		"Last Edited Time": date(sourcePage.last_edited_time),
	};
}

type Attribution = {
	ownerIds: string[];
	contributorIds: string[];
	source: string;
	confidence: "High" | "Medium" | "Low";
	needsReview: boolean;
	reason: string;
};

function inferAttribution(sourcePage: any, existing: any | null): Attribution {
	const existingOwnerIds = existing ? peopleIds(getProperty(existing, "Owner")) : [];
	const existingContributorIds = existing ? peopleIds(getProperty(existing, "Contributors")) : [];
	if (existingOwnerIds.length > 0) {
		return {
			ownerIds: existingOwnerIds,
			contributorIds: existingContributorIds,
			source: "Manual",
			confidence: "High",
			needsReview: false,
			reason: "Existing Owner field is present; preserving manual attribution.",
		};
	}

	const createdBy = sourcePage.created_by?.id;
	const lastEditedBy = sourcePage.last_edited_by?.id;
	if (createdBy) {
		return {
			ownerIds: [createdBy],
			contributorIds: unique([lastEditedBy].filter(Boolean)),
			source: "Created By",
			confidence: "Medium",
			needsReview: true,
			reason: "Owner was empty; using Created By as the initial owner suggestion.",
		};
	}

	return {
		ownerIds: [],
		contributorIds: unique([lastEditedBy].filter(Boolean)),
		source: lastEditedBy ? "Last Edited By" : "Manual",
		confidence: "Low",
		needsReview: true,
		reason: lastEditedBy
			? "Owner was empty and Created By was unavailable; using Last Edited By as weak contributor signal."
			: "No reliable Notion attribution metadata was available.",
	};
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values)];
}
