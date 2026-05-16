export type AppConfig = {
	docsDatabaseId: string;
	personasDatabaseId: string;
	featuresDatabaseId: string;
	executionsDatabaseId: string;
};

export function getConfig(): AppConfig {
	return {
		docsDatabaseId: readEnv("DOCS_DATABASE_ID"),
		personasDatabaseId: readEnv("PERSONAS_DATABASE_ID"),
		featuresDatabaseId: readEnv("FEATURES_DATABASE_ID"),
		executionsDatabaseId: readEnv("EXECUTIONS_DATABASE_ID"),
	};
}

function readEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}
