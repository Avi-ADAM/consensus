import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface IssueWithClauses {
	id: string;
	title: string;
	clauses: { body: string; stanceValue: number }[];
}

interface SynthesizeBody {
	topic?: string;
	issues?: IssueWithClauses[];
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
			temperature: 0.5,
			max_tokens: 1200,
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
 * Proposes a middle-ground formula: for each issue it composes one clause both
 * sides could accept — sometimes adopting one side on this issue and the other
 * side on that issue, sometimes a genuine blend. Returns a draft proposal plus
 * a rationale. Degrades gracefully (available:false) without a key.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!env.GROQ_API_KEY) {
		return json({ available: false, reason: 'no_key' });
	}

	let body: SynthesizeBody;
	try {
		body = await request.json();
	} catch {
		return json({ available: false, reason: 'bad_request' });
	}

	const issues = body.issues ?? [];
	if (issues.length === 0) {
		return json({ available: false, reason: 'no_issues' });
	}

	const issueBlocks = issues
		.map((i) => {
			const lines = i.clauses
				.map((c) => `    - "${c.body}" (stance ${Math.round(c.stanceValue)})`)
				.join('\n');
			return `Issue id=${i.id}: "${i.title}"\n${lines || '    - (no clauses yet)'}`;
		})
		.join('\n');

	try {
		const result = await callGroq(
			`You synthesize a middle-ground proposal in a dispute. The opinions are
broken into ISSUES (sub-axes), each with clauses showing where people stand
(stanceValue 0..100). For EACH issue, compose ONE clause that both sides could
flow with — you may adopt one side on one issue and the other side on another,
or blend. Keep the same issue ids. Then give the whole proposal a heading,
a short description, and a rationale explaining why both sides can accept it.
Reply with JSON only, in the same language as the input.`,
			`Topic: "${body.topic ?? ''}"
Issues and their clauses:
${issueBlocks}

Return JSON:
{
  "heading": "<short title for the compromise>",
  "description": "<1-2 sentences>",
  "rationale": "<why both sides can flow with it>",
  "clauses": [
    { "issueId": "<existing id>", "issueTitle": "<title>", "body": "<composed clause>", "stanceValue": <0-100> }
  ]
}`
		);
		return json({ available: true, data: result });
	} catch {
		return json({ available: false, reason: 'upstream_error' });
	}
};
