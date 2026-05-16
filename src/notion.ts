import { Client } from "@notionhq/client";

export type NotionClient = Record<string, any>;

export function getNotionClient(context: { notion?: NotionClient } | undefined): NotionClient {
	if (context?.notion) return context.notion;
	const token = process.env.NOTION_API_TOKEN;
	if (!token) {
		throw new Error("No Notion client was provided. For local runs, set NOTION_API_TOKEN.");
	}
	return new Client({ auth: token }) as unknown as NotionClient;
}

export async function retrieveCollection(notion: NotionClient, id: string): Promise<any> {
	if (notion.dataSources?.retrieve) {
		try {
			return await notion.dataSources.retrieve({ data_source_id: id });
		} catch (error) {
			if (!notion.databases?.retrieve) throw error;
		}
	}
	return notion.databases.retrieve({ database_id: id });
}

export async function queryCollection(
	notion: NotionClient,
	id: string,
	args: Record<string, unknown> = {},
): Promise<{ results: any[]; has_more: boolean; next_cursor: string | null }> {
	if (notion.dataSources?.query) {
		try {
			return await notion.dataSources.query({ data_source_id: id, ...args });
		} catch (error) {
			if (!notion.databases?.query) throw error;
		}
	}
	return notion.databases.query({ database_id: id, ...args });
}

export async function queryAllCollection(
	notion: NotionClient,
	id: string,
	args: Record<string, unknown> = {},
	limit = 1000,
): Promise<any[]> {
	const results: any[] = [];
	let cursor: string | null = null;

	do {
		const response = await queryCollection(notion, id, {
			...args,
			start_cursor: cursor ?? undefined,
			page_size: Math.min(100, limit - results.length),
		});
		results.push(...response.results);
		cursor = response.has_more ? response.next_cursor : null;
	} while (cursor && results.length < limit);

	return results;
}

export async function createDatabasePage(
	notion: NotionClient,
	databaseId: string,
	properties: Record<string, unknown>,
): Promise<any> {
	return notion.pages.create({
		parent: { database_id: databaseId },
		properties,
	});
}

export async function updatePageProperties(
	notion: NotionClient,
	pageId: string,
	properties: Record<string, unknown>,
): Promise<any> {
	return notion.pages.update({
		page_id: pageId,
		properties,
	});
}

export function pageUrl(pageId: string): string {
	return `https://www.notion.so/${pageId.replaceAll("-", "")}`;
}

export function propertyNames(collection: { properties?: Record<string, unknown> }): string[] {
	return Object.keys(collection.properties ?? {});
}
