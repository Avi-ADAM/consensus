import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface ExistingIssue {
	id: string;
	title: string;
}

interface DecomposeBody {
	topic?: string;
	heading?: string;
	description?: string;
	/** Where the author placed themselves on 0..100 — a hint for stance values. */
	selfPlacement?: number;
	/** Issues already raised by other opinions, so clauses hang on the same axes. */
	existingIssues?: ExistingIssue[];
}

async function callGroq(system: string, user: string): Promise<Record<string, unknown>> {
	const res = await fetch(GROQ_API, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.GROQ_API_KEY}`
		},
		body: JSON.stringify({
			model: MODEL,
			temperature: 0.3,
			max_tokens: 1100,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			]
		})
	});
	if (!res.ok) {
		throw new Error(`Groq ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

/**
 * Breaks an opinion into clauses, each mapped to a shared issue (axis) of the
 * dispute. When other opinions already raised issues, clauses hang on the same
 * axes (by id) and we surface the issues this opinion skipped — the gaps.
 *
 * Degrades gracefully (200 with available:false) when no GROQ_API_KEY is set or
 * the upstream call fails, so the anchor-based flow keeps working without AI.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!env.GROQ_API_KEY) {
		return json({ available: false, reason: 'no_key' });
	}

	let body: DecomposeBody;
	try {
		body = await request.json();
	} catch {
		return json({ available: false, reason: 'bad_request' });
	}

	const existing = body.existingIssues ?? [];
	const issueList = existing.length
		? existing.map((i) => `- id=${i.id}: "${i.title}"`).join('\n')
		: '(none yet — this is the first opinion; define the initial issues)';

	const placement =
		typeof body.selfPlacement === 'number'
			? `The author places themselves at ${Math.round(body.selfPlacement)} on a 0..100 scale.`
			: 'The author gave no self-placement.';

	try {
		const result = await callGroq(
			`You break a single opinion in a dispute into discrete CLAUSES. Each clause
answers one shared ISSUE (a sub-axis of the topic, e.g. "budget", "who decides",
"timeline"). Map each clause to an existing issue by its id when it fits; only
propose a new issue when none matches. Give each clause a stanceValue 0..100
showing where it falls on that issue's axis. Also list issues that OTHER opinions
raised (from the provided list) that THIS opinion does not address — these are
gaps to fill. Reply with JSON only, in the same language as the input.`,
			`Topic: "${body.topic ?? ''}"
Opinion: "${body.heading ?? ''}" — ${body.description ?? ''}
${placement}
Existing issues raised so far:
${issueList}

Return JSON:
{
  "clauses": [
    { "body": "<clause text>", "issueId": "<existing id or null>", "issueTitle": "<title; new or existing>", "stanceValue": <0-100> }
  ],
  "gaps": [
    { "issueId": "<existing id>", "issueTitle": "<title>", "suggestedClause": "<draft this opinion could adopt>" }
  ]
}`
		);
		return json({ available: true, data: result });
	} catch {
		return json({ available: false, reason: 'upstream_error' });
	}
};
