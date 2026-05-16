import { getConfig } from "../config.js";
import { getNotionClient, propertyNames, retrieveCollection } from "../notion.js";
import { REQUIRED_SCHEMAS } from "../schema.js";

type ToolContext = { notion?: Record<string, any> };

export async function ensureWorkspaceSchema(_input: Record<string, never>, context?: ToolContext) {
	const notion = getNotionClient(context);
	const config = getConfig();

	const checks = await Promise.all([
		checkDatabase(notion, "docs", config.docsDatabaseId, [...REQUIRED_SCHEMAS.docs]),
		checkDatabase(notion, "personaRegistry", config.personaRegistryDatabaseId, [...REQUIRED_SCHEMAS.personaRegistry]),
		checkDatabase(notion, "docsIndex", config.docsIndexDatabaseId, [...REQUIRED_SCHEMAS.docsIndex]),
		checkDatabase(notion, "personaRuns", config.personaRunsDatabaseId, [...REQUIRED_SCHEMAS.personaRuns]),
	]);

	const missingCount = checks.reduce((count, check) => count + check.missing.length, 0);

	return {
		ok: missingCount === 0,
		message:
			missingCount === 0
				? "Workspace schema is ready."
				: `Workspace schema is missing ${missingCount} required properties.`,
		databases: checks,
	};
}

async function checkDatabase(
	notion: Record<string, any>,
	key: string,
	id: string,
	requiredProperties: string[],
) {
	const database = await retrieveCollection(notion, id);
	const actual = propertyNames(database);
	const missing = requiredProperties.filter((name) => !actual.includes(name));

	return {
		key,
		id,
		title: database.title?.map((item: { plain_text?: string }) => item.plain_text ?? "").join("") ?? "",
		ok: missing.length === 0,
		missing,
		actual,
	};
}
