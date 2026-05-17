import { getConfig } from "../config.js";
import { createDatabasePageWithChildren, getNotionClient, queryAllCollection } from "../notion.js";
import { getProperty, people, plainText, title, truncate } from "../properties.js";

type ToolContext = { notion?: Record<string, any> };

type GithubPullRequest = {
	html_url: string;
	number: number;
	title: string;
	state: string;
	draft?: boolean;
	user?: { login?: string };
	created_at: string;
	updated_at: string;
	merged_at?: string | null;
	body?: string | null;
	head?: { ref?: string };
	base?: { ref?: string };
};

export async function importGithubPullRequests(
	input: {
		repositories: string[];
		limit_per_repo: number | null;
		state: string | null;
		owner_user_id: string | null;
		created_within_days: number | null;
		dry_run: boolean | null;
	},
	context?: ToolContext,
) {
	const notion = getNotionClient(context);
	const config = getConfig();
	const limit = Math.max(1, Math.min(input.limit_per_repo ?? 10, 25));
	const state = input.state ?? "open";
	const createdWithinDays = Math.max(1, Math.min(input.created_within_days ?? 7, 365));
	const createdSince = Date.now() - createdWithinDays * 24 * 60 * 60 * 1000;
	const existingDocs = await queryAllCollection(notion, config.docsDatabaseId, {}, 1000);
	const existingTitles = new Set(existingDocs.map((page) => plainText(getProperty(page, "Name"))));
	const existingExternalIds = new Set(existingDocs.map((page) => plainText(getProperty(page, "External ID"))).filter(Boolean));
	const imported = [];
	const skipped = [];

	for (const repository of input.repositories) {
		const repo = parseRepository(repository);
		const prs = (await fetchPullRequests(repo.owner, repo.name, state, 100))
			.filter((pr) => new Date(pr.created_at).getTime() >= createdSince)
			.slice(0, limit);

		for (const pr of prs) {
			const externalId = externalPullRequestId(repo.fullName, pr.number);
			const docTitle = `GitHub PR ${repo.owner}/${repo.name} #${pr.number}`;
			if (existingExternalIds.has(externalId) || existingTitles.has(docTitle)) {
				skipped.push({ repository, number: pr.number, title: pr.title, reason: "already_exists" });
				continue;
			}

			if (input.dry_run) {
				imported.push({ action: "would_create", repository, number: pr.number, external_id: externalId, name: docTitle, title: pr.title });
				continue;
			}

			const created = await createDatabasePageWithChildren(
				notion,
				config.docsDatabaseId,
				{
					Name: title(docTitle),
					Owner: people(input.owner_user_id ? [input.owner_user_id] : []),
					"External ID": { rich_text: [{ text: { content: externalId } }] },
				},
				buildPullRequestBlocks(repo.fullName, pr),
			);
			existingTitles.add(docTitle);
			existingExternalIds.add(externalId);
			imported.push({
				action: "created",
				repository,
				number: pr.number,
				external_id: externalId,
				name: docTitle,
				title: pr.title,
				page_id: created.id,
				url: pr.html_url,
			});
		}
	}

	return {
		ok: true,
		state,
		limit_per_repo: limit,
		created_within_days: createdWithinDays,
		imported_count: imported.length,
		skipped_count: skipped.length,
		imported,
		skipped,
	};
}

function externalPullRequestId(repository: string, number: number) {
	return `github-pr:${repository.toLowerCase()}:${number}`;
}

function parseRepository(repository: string) {
	const trimmed = repository.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
	const [owner, name] = trimmed.split("/");
	if (!owner || !name) throw new Error(`Invalid GitHub repository: ${repository}. Use owner/repo.`);
	return { owner, name, fullName: `${owner}/${name}` };
}

async function fetchPullRequests(owner: string, repo: string, state: string, limit: number): Promise<GithubPullRequest[]> {
	const token = process.env.GITHUB_TOKEN;
	const response = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${encodeURIComponent(state)}&sort=updated&direction=desc&per_page=${limit}`,
		{
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "notion-persona-worker",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub PR fetch failed for ${owner}/${repo}: ${response.status} ${body}`);
	}

	return (await response.json()) as GithubPullRequest[];
}

function buildPullRequestBlocks(repository: string, pr: GithubPullRequest) {
	const lines = [
		`Repository: ${repository}`,
		`PR: #${pr.number} - ${pr.title}`,
		`URL: ${pr.html_url}`,
		`Author: ${pr.user?.login ?? "unknown"}`,
		`State: ${pr.state}${pr.draft ? " draft" : ""}`,
		`Branch: ${pr.head?.ref ?? "unknown"} -> ${pr.base?.ref ?? "unknown"}`,
		`Created: ${pr.created_at}`,
		`Updated: ${pr.updated_at}`,
		pr.merged_at ? `Merged: ${pr.merged_at}` : "",
	].filter(Boolean);

	const blocks: Array<Record<string, unknown>> = [
		headingBlock("GitHub Pull Request"),
		paragraphBlock(lines.join("\n")),
		headingBlock("PR Body"),
	];

	const body = (pr.body ?? "").trim() || "(No PR body.)";
	for (const chunk of chunkText(body, 1900).slice(0, 20)) {
		blocks.push(paragraphBlock(chunk));
	}

	return blocks;
}

function headingBlock(content: string) {
	return {
		object: "block",
		type: "heading_2",
		heading_2: {
			rich_text: [{ type: "text", text: { content: truncate(content, 2000) } }],
		},
	};
}

function paragraphBlock(content: string) {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: [{ type: "text", text: { content: truncate(content, 2000) } }],
		},
	};
}

function chunkText(value: string, size: number) {
	const chunks: string[] = [];
	for (let index = 0; index < value.length; index += size) {
		chunks.push(value.slice(index, index + size));
	}
	return chunks;
}
