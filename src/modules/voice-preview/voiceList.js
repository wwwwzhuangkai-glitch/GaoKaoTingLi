/**
 * Official Gemini TTS prebuilt voice options.
 * @see https://ai.google.dev/gemini-api/docs/speech-generation#voices
 */
export const VOICES = [
    { name: 'Zephyr', gender: 'female', style: 'Bright and warm' },
    { name: 'Kore', gender: 'female', style: 'Bright and authoritative' },
    { name: 'Leda', gender: 'female', style: 'Calm and professional' },
    { name: 'Aoede', gender: 'female', style: 'Warm and expressive' },
    { name: 'Despina', gender: 'female', style: 'Smooth and clear' },
    { name: 'Elara', gender: 'female', style: 'Soft and gentle' },
    { name: 'Callirhoe', gender: 'female', style: 'Rich and mellow' },
    { name: 'Autonoe', gender: 'female', style: 'Bright and lively' },
    { name: 'Tethys', gender: 'female', style: 'Steady and composed' },
    { name: 'Umbriel', gender: 'female', style: 'Clear and articulate' },
    { name: 'Algieba', gender: 'female', style: 'Poised and graceful' },
    { name: 'Sulafat', gender: 'female', style: 'Refined and polished' },
    { name: 'Vindemiatrix', gender: 'female', style: 'Confident and crisp' },
    { name: 'Sadachbia', gender: 'female', style: 'Light and airy' },
    { name: 'Enceladus', gender: 'female', style: 'Breathy and soft' },
    { name: 'Charon', gender: 'male', style: 'Deep and resonant' },
    { name: 'Orus', gender: 'male', style: 'Energetic and clear' },
    { name: 'Puck', gender: 'male', style: 'Upbeat and playful' },
    { name: 'Fenrir', gender: 'male', style: 'Strong and bold' },
    { name: 'Laomedeia', gender: 'male', style: 'Measured and calm' },
    { name: 'Iapetus', gender: 'male', style: 'Smooth and conversational' },
    { name: 'Narvi', gender: 'male', style: 'Clear and neutral' },
    { name: 'Schedar', gender: 'male', style: 'Warm and steady' },
    { name: 'Gacrux', gender: 'male', style: 'Bright and dynamic' },
    { name: 'Pulcherrima', gender: 'male', style: 'Rich and expressive' },
    { name: 'Achird', gender: 'male', style: 'Friendly and approachable' },
    { name: 'Zubenelgenubi', gender: 'male', style: 'Composed and reliable' },
    { name: 'Rasalgethi', gender: 'male', style: 'Authoritative and deep' },
    { name: 'Achernar', gender: 'male', style: 'Low and grounding' },
    { name: 'Muscida', gender: 'male', style: 'Gentle and mellow' },
];

export const DEFAULT_VOICE = 'Zephyr';

export const VOICE_GENDERS = {
    female: VOICES.filter((v) => v.gender === 'female'),
    male: VOICES.filter((v) => v.gender === 'male'),
};

export function getVoiceByName(name) {
    return VOICES.find((v) => v.name === name) || VOICES[0];
}
