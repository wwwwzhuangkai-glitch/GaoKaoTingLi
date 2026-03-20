/**
 * Official Gemini TTS prebuilt voice options.
 * Gender verified against official Google docs & AI Studio (March 2026).
 */
export const VOICES = [
    // ── Female (14) ──
    { name: 'Zephyr', gender: 'female', style: 'Bright and clear' },
    { name: 'Kore', gender: 'female', style: 'Firm and strong' },
    { name: 'Leda', gender: 'female', style: 'Youthful and energetic' },
    { name: 'Aoede', gender: 'female', style: 'Breezy and relaxed' },
    { name: 'Despina', gender: 'female', style: 'Smooth and gentle' },
    { name: 'Callirrhoe', gender: 'female', style: 'Friendly and easy-going' },
    { name: 'Autonoe', gender: 'female', style: 'Bright and cheerful' },
    { name: 'Erinome', gender: 'female', style: 'Clear and articulate' },
    { name: 'Laomedeia', gender: 'female', style: 'Upbeat and positive' },
    { name: 'Achernar', gender: 'female', style: 'Soft and warm' },
    { name: 'Gacrux', gender: 'female', style: 'Mature and composed' },
    { name: 'Vindemiatrix', gender: 'female', style: 'Confident and crisp' },
    { name: 'Sulafat', gender: 'female', style: 'Refined and polished' },
    // ── Male (17) ──
    { name: 'Puck', gender: 'male', style: 'Upbeat and lively' },
    { name: 'Charon', gender: 'male', style: 'Calm and professional' },
    { name: 'Fenrir', gender: 'male', style: 'Passionate and energetic' },
    { name: 'Orus', gender: 'male', style: 'Calm and firm' },
    { name: 'Enceladus', gender: 'male', style: 'Soft and breathy' },
    { name: 'Iapetus', gender: 'male', style: 'Clear and clean' },
    { name: 'Umbriel', gender: 'male', style: 'Relaxed and easy-going' },
    { name: 'Algieba', gender: 'male', style: 'Smooth and flowing' },
    { name: 'Algenib', gender: 'male', style: 'Gravelly and textured' },
    { name: 'Rasalgethi', gender: 'male', style: 'Professional narrator' },
    { name: 'Alnilam', gender: 'male', style: 'Confident and firm' },
    { name: 'Schedar', gender: 'male', style: 'Even and steady' },
    { name: 'Pulcherrima', gender: 'male', style: 'Rich and expressive' },
    { name: 'Achird', gender: 'male', style: 'Friendly and approachable' },
    { name: 'Zubenelgenubi', gender: 'male', style: 'Composed and reliable' },
    { name: 'Sadachbia', gender: 'male', style: 'Warm and mellow' },
    { name: 'Sadaltager', gender: 'male', style: 'Gentle and mellow' },
];

export const DEFAULT_VOICE = 'Zephyr';

export const VOICE_GENDERS = {
    female: VOICES.filter((v) => v.gender === 'female'),
    male: VOICES.filter((v) => v.gender === 'male'),
};

export function getVoiceByName(name) {
    return VOICES.find((v) => v.name === name) || VOICES[0];
}
