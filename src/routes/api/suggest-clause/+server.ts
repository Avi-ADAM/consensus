import { json, type RequestHandler } from '@sveltejs/kit';
import { GROQ_API_KEY } from '$env/static/private';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface SuggestBody {
	topic?: string;
	heading?: string;
	description?: string;
	/** The issue this opinion skipped and should now address. */
	issueTitle?: string;
}

async function callGroq(system: string, user: string): Promise<Record<string, unknown>> {
	const res = await fetch(GROQ_API, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${GROQ_API_KEY}`
		},
		body: JSON.stringify({
			model: MODEL,
			temperature: 0.4,
			max_tokens: 400,
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
 * Drafts the clause an opinion is missing on a given issue — the "fill the gap"
 * action. The draft stays in the spirit of the opinion rather than inventing a
 * contradictory stance. Degrades gracefully (available:false) without a key.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!GROQ_API_KEY) {
		return json({ available: false, reason: 'no_key' });
	}

	let body: SuggestBody;
	try {
		body = await request.json();
	} catch {
		return json({ available: false, reason: 'bad_request' });
	}

	try {
		const result = await callGroq(
			`An opinion in a dispute did not address one issue (sub-axis) that others
raised. Draft the clause this opinion would plausibly hold on that issue, in the
spirit of its existing stance — do not invent a contradictory position. Give a
stanceValue 0..100 for where that clause sits on the issue's axis. Reply with
JSON only, in the same language as the input.`,
			`Topic: "${body.topic ?? ''}"
Opinion: "${body.heading ?? ''}" — ${body.description ?? ''}
Issue to address: "${body.issueTitle ?? ''}"

Return JSON:
{ "body": "<clause text>", "stanceValue": <0-100> }`
		);
		return json({ available: true, data: result });
	} catch {
		return json({ available: false, reason: 'upstream_error' });
	}
};
