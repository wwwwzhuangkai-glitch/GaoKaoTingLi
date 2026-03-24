#!/usr/bin/env node
/**
 * Step 1: Parse all docx files → JSON segments
 * 
 * Reads all .docx files from 听力原文_提取/
 * Outputs structured JSON to output/segments/
 * 
 * Usage: node scripts/parse_all.js
 */
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, '听力原文_提取');
const OUTPUT_DIR = path.join(ROOT, 'output', 'segments');

// ── Patterns ──
const PATTERNS = {
    chineseNarrator: /[\u4e00-\u9fff]{3,}/,
    dialogueSpeaker: /^(?:W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：]/i,
    questionRange: /(?:回答|答).*?(\d+)\s*(?:和|至|到|—)\s*第?\s*(\d+)/,
};

const SPEAKER_NORM = [
    { pattern: /^(?:W|Woman|Female|Girl)/i, name: 'Sarah', gender: 'female' },
    { pattern: /^(?:M|Man|Male|Boy)/i, name: 'James', gender: 'male' },
];

function normalizeSpeakerLabel(raw) {
    for (const { pattern, name } of SPEAKER_NORM) {
        if (pattern.test(raw.trim())) return name;
    }
    return raw.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function normalizeDialogueText(text) {
    return text.split('\n').map(line => {
        const m = line.match(/^(W|M|Woman|Man|Female|Male|Speaker\s*\d|Boy|Girl)\s*[:：]\s*(.*)/i);
        if (m) return `${normalizeSpeakerLabel(m[1])}: ${m[2]}`;
        return line;
    }).join('\n');
}

function mergeWrappedLines(lines) {
    const merged = [];
    for (const line of lines) {
        const isSpeaker = PATTERNS.dialogueSpeaker.test(line);
        const isChinese = PATTERNS.chineseNarrator.test(line);
        if (!isSpeaker && !isChinese && merged.length > 0) {
            const prev = merged[merged.length - 1];
            if (!PATTERNS.chineseNarrator.test(prev) && /[a-zA-Z]/.test(prev)) {
                merged[merged.length - 1] = prev + ' ' + line;
                continue;
            }
        }
        merged.push(line);
    }
    return merged;
}

function detectSpeakerGender(lines) {
    const genders = new Set();
    for (const line of lines) {
        const m = line.match(/^(W|M|Woman|Man|Female|Male|Boy|Girl)\s*[:：]/i);
        if (m) {
            const c = m[1].toUpperCase().charAt(0);
            genders.add((c === 'W' || c === 'F' || c === 'G') ? 'female' : 'male');
        }
    }
    return [...genders];
}

/**
 * Extract question count from a narrator line.
 * "回答1至3小题" → 3, "回答7至10小题" → 4
 * Returns 0 if no question range found.
 */
function extractQuestionCount(line) {
    const qm = line.match(PATTERNS.questionRange);
    if (qm) {
        const from = parseInt(qm[1], 10);
        const to = parseInt(qm[2], 10);
        return to - from + 1;
    }
    return 0;
}

/**
 * Calculate gapAfter for a narrator line (reading time before content).
 * Rule: if "回答X至Y小题" → (Y-X+1) × 5s
 * Otherwise: 2s default
 */
function calcNarratorGap(line) {
    const count = extractQuestionCount(line);
    return count > 0 ? count * 5 : 2;
}

let _nextId = 0;
function makeId() {
    return `seg_${String(++_nextId).padStart(3, '0')}`;
}

function parseToSegments(lines) {
    _nextId = 0;
    const segments = [];
    let dialogueBuf = [];
    let lastQuestionCount = 0; // track question count from preceding narrator

    function flushDialogue() {
        if (dialogueBuf.length === 0) return;
        const rawText = dialogueBuf.join('\n');
        const normalizedText = normalizeDialogueText(rawText);
        const genders = detectSpeakerGender(dialogueBuf);
        const isMono = genders.length <= 1;

        // Answering time after content = questions × 5s
        const answerGap = lastQuestionCount > 0 ? lastQuestionCount * 5 : 5;

        // ding before each content block
        segments.push({
            id: makeId(), type: 'ding', text: '', repeat: 1, gapAfter: 1,
            speakerConfig: { mode: 'single', voices: {} },
        });

        if (isMono) {
            const gender = genders[0] || 'female';
            const voice = gender === 'male' ? 'Charon' : 'Zephyr';
            segments.push({
                id: makeId(), type: 'monologue', text: normalizedText,
                repeat: 2, gapAfter: answerGap,
                speakerConfig: { mode: 'single', voices: { narrator: voice } },
                monologueGender: gender,
            });
        } else {
            segments.push({
                id: makeId(), type: 'dialogue', text: normalizedText,
                repeat: 2, gapAfter: answerGap,
                speakerConfig: {
                    mode: 'multi',
                    voices: { Sarah: 'Zephyr', James: 'Charon' },
                },
            });
        }
        dialogueBuf = [];
    }

    for (const line of lines) {
        if (PATTERNS.dialogueSpeaker.test(line)) {
            dialogueBuf.push(line);
            continue;
        }
        if (dialogueBuf.length > 0) flushDialogue();

        if (PATTERNS.chineseNarrator.test(line)) {
            // Track question count for the upcoming content segment
            const qCount = extractQuestionCount(line);
            if (qCount > 0) lastQuestionCount = qCount;

            const gapAfter = calcNarratorGap(line);
            segments.push({
                id: makeId(), type: 'narrator', text: line,
                repeat: 1, gapAfter,
                speakerConfig: { mode: 'single', voices: { narrator: 'Orus' } },
            });
            continue;
        }

        // Orphan English text (shouldn't happen after mergeWrappedLines, but just in case)
        if (line.length >= 10 && /[a-zA-Z]/.test(line)) {
            const answerGap = lastQuestionCount > 0 ? lastQuestionCount * 5 : 5;
            segments.push({
                id: makeId(), type: 'monologue', text: line,
                repeat: 2, gapAfter: answerGap,
                speakerConfig: { mode: 'single', voices: { narrator: 'Zephyr' } },
                monologueGender: 'female',
            });
        }
    }
    // Flush any remaining dialogue
    flushDialogue();

    // ── Post-processing: fix intro narrator if it mentions 独白 but no monologue exists ──
    const hasMonologue = segments.some(s => s.type === 'monologue');
    const hasDialogue = segments.some(s => s.type === 'dialogue');
    for (const seg of segments) {
        if (seg.type !== 'narrator') continue;
        // Fix intro: "对话或独白" → "对话" when no monologue
        if (!hasMonologue && hasDialogue && seg.text.includes('对话或独白')) {
            seg.text = seg.text.replace(/对话或独白/g, '对话');
            seg._fixed = 'removed 独白 (no monologue in content)';
        }
        // Fix intro: "每段对话或独白" → "每段对话" when no monologue
        if (!hasMonologue && hasDialogue && seg.text.includes('或独白')) {
            seg.text = seg.text.replace(/或独白/g, '');
            seg._fixed = 'removed 或独白 (no monologue in content)';
        }
    }

    return segments;
}

// ── Main ──
async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.docx')).sort();
    console.log(`Found ${files.length} docx files\n`);

    let totalSegments = 0;
    let totalTTSCalls = 0;

    for (const filename of files) {
        const buf = fs.readFileSync(path.join(INPUT_DIR, filename));
        const result = await mammoth.extractRawText({ buffer: buf });
        const rawLines = result.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const lines = mergeWrappedLines(rawLines);
        const segments = parseToSegments(lines);

        // Derive a clean basename for output
        const baseName = path.basename(filename, '.docx');
        const outPath = path.join(OUTPUT_DIR, `${baseName}.json`);
        fs.writeFileSync(outPath, JSON.stringify(segments, null, 2), 'utf-8');

        const ttsCalls = segments.filter(s => s.type !== 'ding').length;
        totalSegments += segments.length;
        totalTTSCalls += ttsCalls;

        console.log(`✅ ${baseName}`);
        console.log(`   ${segments.length} segments (${ttsCalls} TTS calls)`);
        for (const seg of segments) {
            const icon = { ding: '🔔', narrator: '🎙️', dialogue: '💬', monologue: '📢' }[seg.type];
            const extra = seg.type === 'monologue' ? ` [${seg.monologueGender}]` : '';
            const fixed = seg._fixed ? ' 🔧 FIXED' : '';
            const textPreview = seg.text.substring(0, 60).replace(/\n/g, ' ');
            console.log(`   ${icon} ${seg.id} ${seg.type}${extra} ×${seg.repeat} gap=${seg.gapAfter}s${fixed} | ${textPreview}`);
        }
        console.log();
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Total: ${files.length} files, ${totalSegments} segments, ${totalTTSCalls} TTS calls`);
    console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
