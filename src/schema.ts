export const PERSONA_REGISTRY_PROPERTIES = [
	"Name",
	"Handle",
	"Role",
	"Tags",
	"System Prompt",
	"Source Pages",
	"Owner User ID",
	"Enabled",
	"Sync Status",
	"Notion Agent URL",
] as const;

export const DOCS_PROPERTIES = [
	"Name",
	"Owner",
] as const;

export const FEATURES_PROPERTIES = [
	"Name",
	"Page ID",
	"Source",
	"Owner",
	"Summary",
	"Quotes",
	"Tags",
] as const;

export const PERSONA_RUNS_PROPERTIES = [
	"Run ID",
	"Target Page ID",
	"Root Comment ID",
	"Status",
	"Selected Personas",
	"Selected Context Docs",
	"Turn Count",
	"Max Turns",
	"Current Round",
	"Agent Queue",
	"Processed Comment IDs",
	"Last Actor",
	"Lock Until",
	"Failure Reason",
] as const;

export const REQUIRED_SCHEMAS = {
	docs: DOCS_PROPERTIES,
	personaRegistry: PERSONA_REGISTRY_PROPERTIES,
	features: FEATURES_PROPERTIES,
	personaRuns: PERSONA_RUNS_PROPERTIES,
} as const;

export const DEFAULT_MAX_TURNS = 20;
