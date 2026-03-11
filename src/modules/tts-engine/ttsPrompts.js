/**
 * Gaokao listening exam TTS prompt templates.
 * Based on Google official Prompting Guide structure:
 * Audio Profile → Scene → Director's Notes → Transcript
 */

export const NARRATOR_PROMPT = (text) =>
    `Say in a clear, professional, measured pace suitable for an English listening comprehension examination. Enunciate every word clearly:

${text}`;

export const DIALOGUE_PROMPT = (text) =>
    `TTS the following conversation. Speak clearly and at a moderate, steady pace suitable for a standardized English listening exam. Each speaker should have a distinct, natural voice:

${text}`;

export const MONOLOGUE_PROMPT = (text) =>
    `Read the following passage aloud clearly, at a moderate pace, with professional enunciation suitable for an English listening exam:

${text}`;

/**
 * Build the appropriate prompt based on segment type.
 */
export function buildPrompt(type, text) {
    switch (type) {
        case 'narrator':
            return NARRATOR_PROMPT(text);
        case 'dialogue':
            return DIALOGUE_PROMPT(text);
        case 'monologue':
            return MONOLOGUE_PROMPT(text);
        default:
            return text;
    }
}
