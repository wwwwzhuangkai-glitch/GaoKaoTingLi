/**
 * Text segmentation rules for Gaokao listening exam documents.
 * Parses raw text into structured segments.
 */

let _nextId = 1;
function makeId() {
    return `seg_${String(_nextId++).padStart(3, '0')}`;
}

export function resetIdCounter() {
    _nextId = 1;
}

// Patterns for segment detection
const PATTERNS = {
    // Chinese narrator instructions (旁白/指令)
    chineseNarrator: /^[\u4e00-\u9fff].*(?:请听|作答|回答|听下面|10秒|15秒|5段|对话|短文|独白|第[一二三四五六七八九十\d]+[节题段部])/,
    // Dialogue speaker labels
    dialogueSpeaker: /^(?:(?:W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：])/i,
    // Question markers
    question: /^(?:Question|Q)\s*(?:\d+|[A-Z])/i,
    // Section headers
    sectionHeader: /^(?:Part|Section|第[一二三四五六七八九十\d]+[节部分])/i,
    // Repeat instruction
    repeatInstruction: /两遍|再听一遍|read\s*(?:again|twice)/i,
    // Silence instruction
    silenceInstruction: /(\d+)\s*秒/,
};

/**
 * Parse raw text into structured segments.
 * @param {string} rawText - Full text from DOCX
 * @param {object} defaultVoices - { narrator, female, male }
 * @returns {Array} segments
 */
export function parseTextToSegments(rawText, defaultVoices = { narrator: 'Zephyr', female: 'Zephyr', male: 'Charon' }) {
    resetIdCounter();
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const segments = [];
    let currentDialogue = [];
    let inDialogue = false;

    function flushDialogue() {
        if (currentDialogue.length > 0) {
            const text = currentDialogue.join('\n');
            // Detect speaker names from the dialogue
            const speakers = detectSpeakers(text, defaultVoices);
            segments.push({
                id: makeId(),
                type: 'dialogue',
                text,
                speakerConfig: {
                    mode: 'multi',
                    voices: speakers,
                },
                repeat: 1,
                gapAfter: 5,
            });
            currentDialogue = [];
            inDialogue = false;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for dialogue line
        if (PATTERNS.dialogueSpeaker.test(line)) {
            inDialogue = true;
            currentDialogue.push(line);
            continue;
        }

        // If we were in a dialogue and hit a non-dialogue line, flush
        if (inDialogue) {
            flushDialogue();
        }

        // Chinese narrator instruction
        if (PATTERNS.chineseNarrator.test(line)) {
            // Check for silence instruction within
            const silenceMatch = line.match(PATTERNS.silenceInstruction);

            segments.push({
                id: makeId(),
                type: 'narrator',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter: silenceMatch ? parseInt(silenceMatch[1], 10) : 2,
            });
            continue;
        }

        // Section headers
        if (PATTERNS.sectionHeader.test(line)) {
            segments.push({
                id: makeId(),
                type: 'narrator',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter: 2,
            });
            continue;
        }

        // Question markers
        if (PATTERNS.question.test(line)) {
            segments.push({
                id: makeId(),
                type: 'narrator',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter: 10,
            });
            continue;
        }

        // Any remaining English text ≥ 20 chars → monologue
        if (line.length >= 20 && /[a-zA-Z]/.test(line)) {
            // Check if it might be a long passage (multiple sentences)
            segments.push({
                id: makeId(),
                type: 'monologue',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter: 5,
            });
            continue;
        }

        // Short leftover text → narrator
        if (line.length > 0) {
            segments.push({
                id: makeId(),
                type: 'narrator',
                text: line,
                speakerConfig: {
                    mode: 'single',
                    voices: { narrator: defaultVoices.narrator },
                },
                repeat: 1,
                gapAfter: 2,
            });
        }
    }

    // Flush any remaining dialogue
    flushDialogue();

    return segments;
}

/**
 * Detect speaker names from dialogue text and assign voices.
 */
function detectSpeakers(text, defaultVoices) {
    const speakers = {};
    const lines = text.split('\n');

    for (const line of lines) {
        const match = line.match(/^(W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：]/i);
        if (match) {
            const label = match[1].trim();
            const normalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

            if (/^(?:W|Woman|Female|Girl)/i.test(label)) {
                speakers[normalizedLabel] = defaultVoices.female;
            } else {
                speakers[normalizedLabel] = defaultVoices.male;
            }
        }
    }

    // Ensure we have at most 2 speakers (API limit)
    const entries = Object.entries(speakers);
    if (entries.length > 2) {
        const result = {};
        result[entries[0][0]] = entries[0][1];
        result[entries[1][0]] = entries[1][1];
        return result;
    }

    return speakers;
}
