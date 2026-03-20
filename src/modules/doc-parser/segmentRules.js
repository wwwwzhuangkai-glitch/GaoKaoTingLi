/**
 * Text segmentation rules for Gaokao listening exam documents.
 *
 * Parses raw text extracted from .docx into structured segments.
 * Handles the two standard Gaokao formats:
 *   1. Short conversations (W:/M: dialogue, 1-3 questions each)
 *   2. Long conversations + monologues (W:/M: dialogue or single-speaker passage)
 *
 * Speaker labels (W:/M:/Woman:/Man: etc.) are normalized to
 * API-safe names (Sarah/James) that match the Director's Notes
 * prompt and Gemini multi_speaker_voice_config.
 */

let _nextId = 1;
function makeId() {
    return `seg_${String(_nextId++).padStart(3, '0')}`;
}

export function resetIdCounter() {
    _nextId = 1;
}

// ── Speaker label normalization ── //

/** Map of raw label patterns → normalized API-safe name + gender */
const SPEAKER_MAP = [
    { pattern: /^(?:W|Woman|Female|Girl)/i, name: 'Sarah', gender: 'female' },
    { pattern: /^(?:M|Man|Male|Boy)/i, name: 'James', gender: 'male' },
];

/**
 * Normalize a raw speaker label to an API-safe name.
 * W:/Woman:/Female: → Sarah
 * M:/Man:/Male:     → James
 * Other (e.g. "Speaker 1") → keep as-is but sanitize
 */
function normalizeSpeakerLabel(rawLabel) {
    const trimmed = rawLabel.trim();
    for (const { pattern, name } of SPEAKER_MAP) {
        if (pattern.test(trimmed)) return name;
    }
    // Unknown label: sanitize for API safety (no spaces, no special chars)
    return trimmed.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Normalize all speaker labels in a dialogue text block.
 * "W: Hello\nM: Hi" → "Sarah: Hello\nJames: Hi"
 */
function normalizeDialogueText(text) {
    return text.split('\n').map(line => {
        const match = line.match(/^(W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：]\s*(.*)/i);
        if (match) {
            const normalized = normalizeSpeakerLabel(match[1]);
            return `${normalized}: ${match[2]}`;
        }
        return line;
    }).join('\n');
}

// ── Patterns for segment detection ── //

const PATTERNS = {
    // Chinese narrator instructions (旁白/指令) — more permissive
    chineseNarrator: /[\u4e00-\u9fff]{3,}/,
    // Dialogue speaker labels
    dialogueSpeaker: /^(?:W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：]/i,
    // Section headers like "听第一段对话" etc. — Chinese instructions with timing
    sectionInstruction: /(?:请听|作答|回答|听下面|听第|10秒|15秒|20秒|5秒钟|5段|现在你有|每段对话|每小题|阅读)/,
    // Time extraction
    timeExtract: /(\d+)\s*秒/,
    // Question count extraction (第6和第7 → 2 questions, 第10至第13 → 4 questions)
    questionRange: /第\s*(\d+)\s*(?:和|至|到)\s*第?\s*(\d+)/,
    questionCount: /(\d+)\s*(?:个|道)?\s*小题/,
};

/**
 * Check if a line is primarily Chinese (≥3 Chinese characters).
 */
function isChinese(line) {
    return PATTERNS.chineseNarrator.test(line);
}

/**
 * Check if a line is a speaker label line.
 */
function isSpeakerLine(line) {
    return PATTERNS.dialogueSpeaker.test(line);
}

/**
 * Detect speakers from dialogue text and assign voices.
 */
function detectSpeakers(text, defaultVoices) {
    const speakers = {};
    const lines = text.split('\n');

    for (const line of lines) {
        const match = line.match(/^(Sarah|James|[A-Za-z_]+)\s*[:：]/);
        if (match) {
            const name = match[1];
            if (name === 'Sarah' || !speakers[name]) {
                if (name === 'Sarah') {
                    speakers[name] = defaultVoices.female;
                } else if (name === 'James') {
                    speakers[name] = defaultVoices.male;
                } else {
                    // Unknown speaker: alternate gender
                    const existingCount = Object.keys(speakers).length;
                    speakers[name] = existingCount % 2 === 0 ? defaultVoices.female : defaultVoices.male;
                }
            }
        }
    }

    // Ensure max 2 speakers (API limit)
    const entries = Object.entries(speakers);
    if (entries.length > 2) {
        return Object.fromEntries(entries.slice(0, 2));
    }

    return speakers;
}

/**
 * Determine if a group of speaker lines is a monologue (single speaker)
 * or a dialogue (2 speakers).
 */
function isMonologue(text) {
    const speakerSet = new Set();
    for (const line of text.split('\n')) {
        const match = line.match(/^([A-Za-z_]+)\s*[:：]/);
        if (match) speakerSet.add(match[1]);
    }
    return speakerSet.size <= 1;
}

/**
 * Pre-process lines to merge IDML-extracted continuation lines.
 * When a long sentence is split across paragraphs during IDML extraction,
 * the continuation (English text without speaker label or Chinese) is
 * merged back into the preceding line with a space.
 */
function mergeWrappedLines(lines) {
    const merged = [];
    for (const line of lines) {
        const isSpeaker = PATTERNS.dialogueSpeaker.test(line);
        const isChinese = PATTERNS.chineseNarrator.test(line);

        // If current line is an English continuation (not speaker, not Chinese)
        // and the previous line is also English content, merge them.
        if (!isSpeaker && !isChinese && merged.length > 0) {
            const prev = merged[merged.length - 1];
            const prevIsChinese = PATTERNS.chineseNarrator.test(prev);
            if (!prevIsChinese && /[a-zA-Z]/.test(prev)) {
                merged[merged.length - 1] = prev + ' ' + line;
                continue;
            }
        }
        merged.push(line);
    }
    return merged;
}

/**
 * Parse raw text into structured segments.
 * @param {string} rawText - Full text from DOCX
 * @param {object} defaultVoices - { narrator, female, male }
 * @returns {Array} segments
 */
export function parseTextToSegments(rawText, defaultVoices = { narrator: 'Orus', female: 'Zephyr', male: 'Charon' }) {
    resetIdCounter();
    const rawLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const lines = mergeWrappedLines(rawLines);
    const segments = [];
    let currentDialogueLines = [];

    function flushDialogue() {
        if (currentDialogueLines.length === 0) return;

        const rawText = currentDialogueLines.join('\n');
        // Normalize speaker labels: W: → Sarah:, M: → James:
        const normalizedText = normalizeDialogueText(rawText);
        const mono = isMonologue(normalizedText);

        // ── Auto-insert ding before each dialogue/monologue ──
        segments.push({
            id: makeId(),
            type: 'ding',
            text: '',
            speakerConfig: { mode: 'single', voices: {} },
            repeat: 1,
            gapAfter: 1,
        });

        if (mono) {
            // Single speaker → monologue
            segments.push({
                id: makeId(),
                type: 'monologue',
                text: normalizedText,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.female },
                },
                repeat: 2,
                gapAfter: 5,
            });
        } else {
            // Multi speaker → dialogue
            const speakers = detectSpeakers(normalizedText, defaultVoices);
            segments.push({
                id: makeId(),
                type: 'dialogue',
                text: normalizedText,
                speakerConfig: {
                    mode: Object.keys(speakers).length >= 2 ? 'multi' : 'single',
                    voices: Object.keys(speakers).length >= 2
                        ? speakers
                        : { narrator: Object.values(speakers)[0] || defaultVoices.female },
                },
                repeat: 2,
                gapAfter: 5,
            });
        }

        currentDialogueLines = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Speaker line → accumulate into current dialogue block
        if (isSpeakerLine(line)) {
            currentDialogueLines.push(line);
            continue;
        }

        // Non-speaker line: flush any pending dialogue
        if (currentDialogueLines.length > 0) {
            flushDialogue();
        }

        // Chinese line → narrator segment
        if (isChinese(line)) {
            // Extract timing for gapAfter
            const timeMatch = line.match(PATTERNS.timeExtract);
            let gapAfter = 2;
            if (timeMatch) {
                // If it mentions questions and time, calculate pause
                const questionMatch = line.match(PATTERNS.questionRange);
                const countMatch = line.match(PATTERNS.questionCount);
                if (questionMatch) {
                    const from = parseInt(questionMatch[1], 10);
                    const to = parseInt(questionMatch[2], 10);
                    const questionCount = to - from + 1;
                    const perQuestion = parseInt(timeMatch[1], 10);
                    gapAfter = questionCount * perQuestion;
                } else if (countMatch) {
                    gapAfter = parseInt(countMatch[1], 10) * parseInt(timeMatch[1], 10);
                } else {
                    gapAfter = parseInt(timeMatch[1], 10);
                }
            }

            segments.push({
                id: makeId(),
                type: 'narrator',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter,
            });
            continue;
        }

        // Remaining English text without speaker label (rare edge case)
        if (line.length >= 10 && /[a-zA-Z]/.test(line)) {
            segments.push({
                id: makeId(),
                type: 'monologue',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.female },
                },
                repeat: 1,
                gapAfter: 5,
            });
        }
    }

    // Flush any remaining dialogue
    flushDialogue();

    return segments;
}
