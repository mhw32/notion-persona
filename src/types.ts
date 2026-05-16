export type PersonaRecord = {
	pageId: string;
	name: string;
	handle: string;
	role: string;
	team: string;
	tags: string[];
	systemPrompt: string;
	voice: string;
	recurringConcerns: string;
	decisionStyle: string;
	principles: string;
	ownerUserId: string;
	enabled: boolean;
	syncStatus: string;
};

export type FeatureRecord = {
	pageId: string;
	sourcePageId: string;
	name: string;
	ownerIds: string[];
	tags: string[];
	summary: string;
	quotes: string;
	voice: string;
	concerns: string;
	decisionStyle: string;
	principles: string;
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
