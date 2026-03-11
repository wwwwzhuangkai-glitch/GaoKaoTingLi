import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Settings ──
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),
      defaultVoices: {
        narrator: 'Zephyr',
        female: 'Zephyr',
        male: 'Charon',
      },
      setDefaultVoices: (voices) => set({ defaultVoices: { ...get().defaultVoices, ...voices } }),
      darkMode: false,
      toggleDarkMode: () => {
        const next = !get().darkMode;
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
        set({ darkMode: next });
      },
      ttsModel: 'gemini-2.5-flash-preview-tts',
      setTtsModel: (model) => set({ ttsModel: model }),

      // ── Segments (parsed from DOCX) ──
      segments: [],
      setSegments: (segments) => set({ segments }),
      updateSegment: (id, updates) =>
        set({
          segments: get().segments.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }),
      addSegment: (segment, index) => {
        const segs = [...get().segments];
        if (index !== undefined) {
          segs.splice(index, 0, segment);
        } else {
          segs.push(segment);
        }
        set({ segments: segs });
      },
      removeSegment: (id) =>
        set({ segments: get().segments.filter((s) => s.id !== id) }),
      reorderSegments: (fromIndex, toIndex) => {
        const segs = [...get().segments];
        const [moved] = segs.splice(fromIndex, 1);
        segs.splice(toIndex, 0, moved);
        set({ segments: segs });
      },

      // ── Audio Buffers (generated TTS results) ──
      audioBuffers: {},  // { segmentId: Float32Array }
      setAudioBuffer: (id, buffer) =>
        set({ audioBuffers: { ...get().audioBuffers, [id]: buffer } }),
      clearAudioBuffers: () => set({ audioBuffers: {} }),

      // ── Audio Library (user uploaded + built-in sounds) ──
      userSounds: [],  // [{ id, name, data: Float32Array, duration }]
      addUserSound: (sound) => set({ userSounds: [...get().userSounds, sound] }),
      removeUserSound: (id) =>
        set({ userSounds: get().userSounds.filter((s) => s.id !== id) }),

      // ── Timeline ──
      timelineClips: [],  // derived from segments + user edits
      setTimelineClips: (clips) => set({ timelineClips: clips }),

      // ── Generation State ──
      generationStatus: {},  // { segmentId: 'idle' | 'generating' | 'done' | 'error' }
      setGenerationStatus: (id, status) =>
        set({ generationStatus: { ...get().generationStatus, [id]: status } }),
      resetGenerationStatus: () => set({ generationStatus: {} }),

      // ── UI State ──
      showSettings: false,
      setShowSettings: (v) => set({ showSettings: v }),
      showVoicePreview: false,
      setShowVoicePreview: (v) => set({ showVoicePreview: v }),

      // ── Toast notifications ──
      toasts: [],
      addToast: (toast) => {
        const id = Date.now().toString();
        set({ toasts: [...get().toasts, { ...toast, id }] });
        setTimeout(() => {
          set({ toasts: get().toasts.filter((t) => t.id !== id) });
        }, 4000);
      },
    }),
    {
      name: 'gaokaotingli_settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        defaultVoices: state.defaultVoices,
        darkMode: state.darkMode,
        ttsModel: state.ttsModel,
      }),
    }
  )
);

export default useAppStore;
