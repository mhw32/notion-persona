export type AppConfig = {
	docsDatabaseId: string;
	personaRegistryDatabaseId: string;
	docsIndexDatabaseId: string;
	personaRunsDatabaseId: string;
};

export function getConfig(): AppConfig {
	return {
		docsDatabaseId: readEnv("DOCS_DATABASE_ID"),
		personaRegistryDatabaseId: readEnv("PERSONA_REGISTRY_DATABASE_ID"),
		docsIndexDatabaseId: readEnv("DOCS_INDEX_DATABASE_ID"),
		personaRunsDatabaseId: readEnv("PERSONA_RUNS_DATABASE_ID"),
	};
}

function readEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}
