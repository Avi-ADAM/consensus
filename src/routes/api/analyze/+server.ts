import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface NeighborInput {
	heading: string;
	location: number;
}

interface AnalyzeBody {
	topic?: string;
	heading?: string;
	description?: string;
	/** Where the user manually placed it, if any. When omitted the AI proposes a spot. */
	chosenLocation?: number;
	neighbors?: NeighborInput[];
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
			max_tokens: 700,
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
 * Suggests where an opinion belongs on the 0..100 scale, or comments on the
 * user's own placement. The opinion need not sit at the midpoint — landing close
 * to an existing opinion is valid, meaningful progress.
 *
 * Degrades gracefully (200 with available:false) when no GROQ_API_KEY is set or
 * the upstream call fails, so the discussion UI keeps working without AI.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!env.GROQ_API_KEY) {
		return json({ available: false, reason: 'no_key' });
	}

	let body: AnalyzeBody;
	try {
		body = await request.json();
	} catch {
		return json({ available: false, reason: 'bad_request' });
	}

	const neighbors = (body.neighbors ?? [])
		.map((n) => `- "${n.heading}" at ${Math.round(n.location)}`)
		.join('\n');

	const placement =
		typeof body.chosenLocation === 'number'
			? `The user placed it at ${Math.round(body.chosenLocation)} on a 0..100 scale.`
			: 'The user has not placed it yet.';

	try {
		const result = await callGroq(
			`You help people position opinions on a 0..100 spectrum relative to others.
0 and 100 are the two anchor poles. An opinion may sit anywhere — including very
close to an existing one; it does NOT have to be the midpoint. Reply with JSON only,
in the same language as the input.`,
			`Topic: "${body.topic ?? ''}"
New opinion: "${body.heading ?? ''}" — ${body.description ?? ''}
Existing opinions:
${neighbors || '(only the two anchors)'}
${placement}

Return JSON:
{
  "suggestedLocation": <number 0-100>,
  "rationale": "<why there>",
  "comment": "<short note on the user's placement, e.g. suggest moving closer to a specific opinion and why>"
}`
		);
		return json({ available: true, data: result });
	} catch {
		return json({ available: false, reason: 'upstream_error' });
	}
};
