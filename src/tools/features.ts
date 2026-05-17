import { getConfig } from "../config.js";
import {
	createDatabasePage,
	getNotionClient,
	pageUrl,
	queryAllCollection,
	updatePageProperties,
} from "../notion.js";
import {
	getProperty,
	dateStart,
	dateTime,
	people,
	peopleIds,
	plainText,
	richText,
	title,
	titleFromPage,
	url,
} from "../properties.js";

type ToolContext = { notion?: Record<string, any> };

export async function syncFeatures(
	input: { data_source_id: string | null; limit: number | null; dry_run: boolean | null },
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const sourceId = input.data_source_id || config.docsDatabaseId;
	const sourcePages = await queryAllCollection(notion, sourceId, {}, input.limit ?? 100);

	return syncFeaturePages(notion, config.featuresDatabaseId, sourceId, sourcePages, Boolean(input.dry_run));
}

export async function syncChangedFeatures(
	input: { limit: number | null; changed_since: string | null; dry_run: boolean | null },
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const filter = input.changed_since
		? {
				filter: {
					timestamp: "last_edited_time",
					last_edited_time: { on_or_after: input.changed_since },
				},
			}
		: {};
	const sourcePages = await queryAllCollection(
		notion,
		config.docsDatabaseId,
		{
			...filter,
			sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
		},
		input.limit ?? 25,
	);
	const staleSourcePages = await filterChangedSourcePages(notion, config.featuresDatabaseId, sourcePages);

	return syncFeaturePages(notion, config.featuresDatabaseId, config.docsDatabaseId, staleSourcePages, Boolean(input.dry_run));
}

async function syncFeaturePages(
	notion: Record<string, any>,
	featuresDatabaseId: string,
	sourceId: string,
	sourcePages: any[],
	dryRun: boolean,
) {
	const existingRows = await queryAllCollection(notion, featuresDatabaseId, {}, 1000);
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
		const properties = buildFeatureProperties(sourcePage, existing, inferred);

		if (dryRun) {
			changes.push({
				action: existing ? "would_update" : "would_create",
				page_id: sourcePageId,
				source_url: pageUrl(sourcePageId),
				title: titleFromPage(sourcePage),
				last_edited_time: sourcePage.last_edited_time,
			});
			continue;
		}

		if (existing) {
			await updatePageProperties(notion, existing.id, properties);
			changes.push({
				action: "updated",
				page_id: sourcePageId,
				source_url: pageUrl(sourcePageId),
				feature_row_id: existing.id,
				last_edited_time: sourcePage.last_edited_time,
			});
		} else {
			const created = await createDatabasePage(notion, featuresDatabaseId, properties);
			changes.push({
				action: "created",
				page_id: sourcePageId,
				source_url: pageUrl(sourcePageId),
				feature_row_id: created.id,
				last_edited_time: sourcePage.last_edited_time,
			});
		}
	}

	return {
		ok: true,
		source_database_id: sourceId,
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
		reason: inferred.reason,
	};
}

export async function updateFeatureRow(
	input: {
		page_id: string;
		summary: string | null;
		quotes: string | null;
		voice: string | null;
		concerns: string | null;
		decision_style: string | null;
		principles: string | null;
		tags: string[] | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const row = await findFeatureRowBySourcePageId(notion, config.featuresDatabaseId, input.page_id);
	if (!row) {
		return { ok: false, message: `No Features row found for page ${input.page_id}. Run syncFeatures first.` };
	}

	const properties: Record<string, unknown> = {};
	if (input.summary !== null) properties["Summary"] = richText(input.summary);
	if (input.quotes !== null) properties["Quotes"] = richText(input.quotes);
	if (input.voice !== null) properties["Voice"] = richText(input.voice);
	if (input.concerns !== null) properties["Concerns"] = richText(input.concerns);
	if (input.decision_style !== null) properties["Decision Style"] = richText(input.decision_style);
	if (input.principles !== null) properties["Principles"] = richText(input.principles);
	if (input.tags !== null) properties["Tags"] = { multi_select: input.tags.map((name) => ({ name })) };

	await updatePageProperties(notion, row.id, properties);
	return { ok: true, feature_row_id: row.id, updated_properties: Object.keys(properties) };
}

async function findFeatureRowBySourcePageId(notion: Record<string, any>, featuresDatabaseId: string, pageId: string) {
	const rows = await queryAllCollection(
		notion,
		featuresDatabaseId,
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

function buildFeatureProperties(sourcePage: any, existing: any | null, inferred: Attribution) {
	const existingSummary = existing ? plainText(getProperty(existing, "Summary")) : "";
	const existingQuotes = existing ? plainText(getProperty(existing, "Quotes")) : "";
	const existingVoice = existing ? plainText(getProperty(existing, "Voice")) : "";
	const existingConcerns = existing ? plainText(getProperty(existing, "Concerns")) : "";
	const existingDecisionStyle = existing ? plainText(getProperty(existing, "Decision Style")) : "";
	const existingPrinciples = existing ? plainText(getProperty(existing, "Principles")) : "";
	const existingTags = existing ? ((getProperty(existing, "Tags") as any)?.multi_select ?? []).map((item: { name: string }) => item.name) : [];

	const ownerIds = firstOwner(inferred.ownerIds);

	return {
		Name: title(titleFromPage(sourcePage)),
		"Page ID": richText(sourcePage.id),
		Source: url(pageUrl(sourcePage.id)),
		Owner: people(ownerIds),
		Tags: { multi_select: existingTags.map((name: string) => ({ name })) },
		Summary: richText(existingSummary),
		Quotes: richText(existingQuotes),
		Voice: richText(existingVoice),
		Concerns: richText(existingConcerns),
		"Decision Style": richText(existingDecisionStyle),
		Principles: richText(existingPrinciples),
		"Last Updated Time": dateTime(sourcePage.last_edited_time ?? null),
	};
}

async function filterChangedSourcePages(notion: Record<string, any>, featuresDatabaseId: string, sourcePages: any[]) {
	const existingRows = await queryAllCollection(notion, featuresDatabaseId, {}, 1000);
	const existingBySourcePageId = new Map<string, any>();

	for (const row of existingRows) {
		const sourcePageId = plainText(getProperty(row, "Page ID"));
		if (sourcePageId) existingBySourcePageId.set(sourcePageId, row);
	}

	return sourcePages.filter((sourcePage) => {
		const existing = existingBySourcePageId.get(sourcePage.id);
		if (!existing) return true;
		const lastSyncedSourceUpdate = dateStart(getProperty(existing, "Last Updated Time"));
		return !lastSyncedSourceUpdate || lastSyncedSourceUpdate < sourcePage.last_edited_time;
	});
}

type Attribution = {
	ownerIds: string[];
	reason: string;
};

function inferAttribution(sourcePage: any, existing: any | null): Attribution {
	const sourceOwnerIds = firstOwner(peopleIds(getProperty(sourcePage, "Owner")));
	if (sourceOwnerIds.length > 0) {
		const lastEditedBy = sourcePage.last_edited_by?.id;
		return {
			ownerIds: sourceOwnerIds,
			reason: "Docs.Owner is present; using the human-specified document owner.",
		};
	}

	const existingOwnerIds = existing ? peopleIds(getProperty(existing, "Owner")) : [];
	if (existingOwnerIds.length > 0) {
		return {
			ownerIds: existingOwnerIds,
			reason: "Existing Owner field is present; preserving manual attribution.",
		};
	}

	const createdBy = sourcePage.created_by?.id;
	const lastEditedBy = sourcePage.last_edited_by?.id;
	if (createdBy) {
		return {
			ownerIds: [createdBy],
			reason: "Owner was empty; using Created By as the initial owner suggestion.",
		};
	}

	return {
		ownerIds: [],
		reason: lastEditedBy
			? "Owner was empty and Created By was unavailable; using Last Edited By as weak contributor signal."
			: "No reliable Notion attribution metadata was available.",
	};
}

function firstOwner(ids: string[]): string[] {
	return ids.length > 0 ? [ids[0]] : [];
}
