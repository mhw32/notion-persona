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

export const DOCS_INDEX_PROPERTIES = [
	"Name",
	"Page ID",
	"Source Page",
	"Owner",
	"Contributors",
	"Tags / Area",
	"Summary",
	"Key Quotes",
	"Content Type",
	"Persona Enabled",
	"Attribution Source",
	"Attribution Confidence",
	"Needs Review",
	"Last Indexed At",
	"Created By",
	"Created Time",
	"Last Edited By",
	"Last Edited Time",
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
	personaRegistry: PERSONA_REGISTRY_PROPERTIES,
	docsIndex: DOCS_INDEX_PROPERTIES,
	personaRuns: PERSONA_RUNS_PROPERTIES,
} as const;

export const DEFAULT_MAX_TURNS = 20;
