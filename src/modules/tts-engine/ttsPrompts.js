/**
 * Gaokao listening exam TTS prompt templates — V3 Director's Notes.
 *
 * Based on the proven V3 approach from gemini_tts_listening_report.md:
 * Audio Profile → Scene → Director's Notes → Transcript
 *
 * This format is the official Gemini-recommended structure and produces
 * the most stable pacing and professional tone for exam recordings.
 */

/**
 * Chinese narrator prompt (simple — model handles Chinese narration well by default).
 */
export const NARRATOR_CN_PROMPT = (text) =>
    `Read this transcript aloud exactly as written:\n\n${text}`;

/**
 * English dialogue prompt — V3 Director's Notes for multi-speaker.
 */
export const DIALOGUE_PROMPT = (text) =>
    `# AUDIO PROFILE: Exam Narrator Duo
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams for Chinese high school students (Gaokao). The atmosphere is calm and professional. Two narrators sit at microphones, reading a scripted dialogue with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. No dramatic emotion or conversational casualness.
* Clear enunciation of every word, especially numbers, currencies, room numbers, and proper nouns.
* Each speaker maintains a consistent, steady vocal quality throughout.

Pacing:
* Extremely steady and uniform throughout. Every sentence at the exact same moderate pace.
* No acceleration on any sentence. No rushing. No slowing down dramatically either.
* Brief, consistent pauses between sentences.
* This is a standardized exam recording — treat every sentence with equal weight and timing.

Accent: Standard neutral English.

#### TRANSCRIPT
${text}`;

/**
 * English monologue prompt — V3 Director's Notes for single-speaker.
 */
export const MONOLOGUE_PROMPT = (text) =>
    `# AUDIO PROFILE: Exam Narrator
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams. The narrator reads an announcement with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. Clear enunciation of every word.
* Special attention to numbers, dates, prices, and proper nouns.

Pacing:
* Extremely steady and uniform. Every sentence at the same moderate pace.
* No acceleration. No rushing. Brief, consistent pauses between sentences.

Accent: Standard neutral English.

#### TRANSCRIPT
${text}`;

/**
 * Short-text safe wrapper.
 * Gemini TTS refuses to speak very short texts (< ~10 chars),
 * reporting "Model tried to generate text" error.
 * This prefix forces TTS mode reliably.
 */
function ensureSafeForTts(text) {
    if (text.trim().length < 15) {
        return `Read this transcript aloud exactly as written:\n\n${text}`;
    }
    return text;
}

/**
 * Build the appropriate prompt based on segment type.
 * @param {string} type - 'narrator' | 'dialogue' | 'monologue' | default
 * @param {string} text - The raw text content
 * @returns {string} The full prompt to send to Gemini TTS
 */
export function buildPrompt(type, text) {
    const safeText = ensureSafeForTts(text);

    switch (type) {
        case 'narrator':
            return NARRATOR_CN_PROMPT(safeText);
        case 'dialogue':
            return DIALOGUE_PROMPT(safeText);
        case 'monologue':
            return MONOLOGUE_PROMPT(safeText);
        default:
            // Fallback: treat as narrator
            return NARRATOR_CN_PROMPT(safeText);
    }
}
