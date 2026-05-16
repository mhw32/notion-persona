type RichText = Array<{ plain_text?: string; text?: { content: string } }>;

export function title(content: string) {
	return { title: [{ text: { content: truncate(content, 2000) } }] };
}

export function richText(content: string | null | undefined) {
	return { rich_text: content ? [{ text: { content: truncate(content, 2000) } }] : [] };
}

export function longRichText(content: string | null | undefined) {
	return { rich_text: content ? [{ text: { content: truncate(content, 1800) } }] : [] };
}

export function select(name: string | null | undefined) {
	return { select: name ? { name } : null };
}

export function multiSelect(names: string[] | null | undefined) {
	return { multi_select: (names ?? []).map((name) => ({ name })) };
}

export function checkbox(value: boolean | null | undefined) {
	return { checkbox: Boolean(value) };
}

export function number(value: number | null | undefined) {
	return { number: value ?? null };
}

export function date(iso: string | null | undefined) {
	return { date: iso ? { start: iso } : null };
}

export function url(value: string | null | undefined) {
	return { url: value ?? null };
}

export function people(ids: string[] | null | undefined) {
	return { people: (ids ?? []).map((id) => ({ id })) };
}

export function plainText(property: unknown): string {
	const prop = property as { type?: string; title?: RichText; rich_text?: RichText; url?: string | null; select?: { name?: string } | null };
	if (prop.type === "title") return textFromRichText(prop.title);
	if (prop.type === "rich_text") return textFromRichText(prop.rich_text);
	if (prop.type === "url") return prop.url ?? "";
	if (prop.type === "select") return prop.select?.name ?? "";
	return "";
}

export function textFromRichText(items: RichText | undefined): string {
	return (items ?? []).map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

export function checkboxValue(property: unknown): boolean {
	const prop = property as { checkbox?: boolean };
	return Boolean(prop.checkbox);
}

export function selectValue(property: unknown): string {
	const prop = property as { select?: { name?: string } | null };
	return prop.select?.name ?? "";
}

export function multiSelectValues(property: unknown): string[] {
	const prop = property as { multi_select?: Array<{ name: string }> };
	return (prop.multi_select ?? []).map((item) => item.name);
}

export function peopleIds(property: unknown): string[] {
	const prop = property as { people?: Array<{ id: string }> };
	return (prop.people ?? []).map((person) => person.id);
}

export function titleFromPage(page: { properties?: Record<string, unknown> }): string {
	const properties = page.properties ?? {};
	for (const value of Object.values(properties)) {
		const prop = value as { type?: string };
		if (prop.type === "title") return plainText(value);
	}
	return "Untitled";
}

export function getProperty(page: { properties?: Record<string, unknown> }, name: string): unknown {
	return page.properties?.[name];
}

export function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength - 1)}…`;
}
