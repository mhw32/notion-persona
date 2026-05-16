export type PersonaRecord = {
	pageId: string;
	name: string;
	handle: string;
	role: string;
	tags: string[];
	systemPrompt: string;
	ownerUserId: string;
	enabled: boolean;
	syncStatus: string;
};

export type DocsIndexRecord = {
	pageId: string;
	sourcePageId: string;
	name: string;
	ownerIds: string[];
	contributorIds: string[];
	tags: string[];
	summary: string;
	keyQuotes: string;
	personaEnabled: boolean;
	attributionSource: string;
	attributionConfidence: string;
	needsReview: boolean;
};

export type RunRecord = {
	pageId: string;
	runId: string;
	targetPageId: string;
	status: string;
	selectedPersonas: string[];
	selectedContextDocs: string[];
	turnCount: number;
	maxTurns: number;
	currentRound: number;
	agentQueue: string[];
	processedCommentIds: string[];
	lastActor: string;
};
