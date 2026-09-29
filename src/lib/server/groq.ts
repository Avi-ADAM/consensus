import { env } from '$env/dynamic/private';

/**
 * Chat model for every AI endpoint. Groq retires models without notice (the
 * previous `llama-3.3-70b-versatile` started answering `model_not_found`, which
 * silently turned every AI feature off), so it lives in one place and can be
 * swapped with GROQ_MODEL without a code change.
 */
export function groqModelParams(): Record<string, unknown> {
	const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';
	// gpt-oss reasons before answering; keep that short so it fits max_tokens.
	return model.startsWith('openai/gpt-oss') ? { model, reasoning_effort: 'low' } : { model };
}
