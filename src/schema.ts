export const PERSONAS_PROPERTIES = [
	"Name",
	"Handle",
	"Role",
	"Team",
	"Tags",
	"System Prompt",
	"Voice",
	"Recurring Concerns",
	"Decision Style",
	"Principles",
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
	"Voice",
	"Concerns",
	"Decision Style",
	"Principles",
	"Last Updated Time",
	"Tags",
] as const;

export const EXECUTIONS_PROPERTIES = [
	"Run ID",
	"Target Page ID",
	"Root Comment ID",
	"Status",
	"Selected Personas",
	"Selected Context Docs",
	"Turn Count",
	"Max Turns",
	"Per Persona Max Actions",
	"Persona Action Counts",
	"Current Round",
	"Agent Queue",
	"Processed Comment IDs",
	"Last Actor",
	"Lock Until",
	"Failure Reason",
] as const;

export const REQUIRED_SCHEMAS = {
	docs: DOCS_PROPERTIES,
	personas: PERSONAS_PROPERTIES,
	features: FEATURES_PROPERTIES,
	executions: EXECUTIONS_PROPERTIES,
} as const;

export const DEFAULT_MAX_TURNS = 10;
