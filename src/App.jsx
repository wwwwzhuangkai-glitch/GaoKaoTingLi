import { useEffect, useCallback } from 'react';
import useAppStore from './store/appStore';
import UploadZone from './modules/doc-parser/UploadZone';
import SegmentList from './modules/segment-editor/SegmentList';
import AudioLibrary from './modules/audio-library/AudioLibrary';
import Timeline from './modules/timeline/Timeline';
import SettingsPanel from './modules/settings/SettingsPanel';
import VoicePreview from './modules/voice-preview/VoicePreview';
import { generateSingle, generateMulti } from './modules/tts-engine/ttsClient';
import { loadRealDing } from './modules/audio-library/builtinSounds';
import { makeSilence } from './modules/audio-engine/pcmUtils';
import './App.css';

function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const {
    segments,
    apiKey,
    ttsModel,
    darkMode,
    toggleDarkMode,
    setShowSettings,
    setShowVoicePreview,
    setAudioBuffer,
    setGenerationStatus,
    resetGenerationStatus,
    generationStatus,
    addToast,
  } = useAppStore();

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Generate TTS for a single segment
  const generateSegment = useCallback(async (segment) => {
    if (!apiKey) {
      addToast({ type: 'error', message: '请先在设置中填写 API Key' });
      return;
    }

    setGenerationStatus(segment.id, 'generating');

    try {
      let audioData;

      if (segment.type === 'ding') {
        audioData = await loadRealDing();
      } else if (segment.type === 'silence') {
        audioData = makeSilence(segment.gapAfter || 5);
      } else if (segment.speakerConfig?.mode === 'multi') {
        audioData = await generateMulti(
          apiKey,
          segment.text,
          segment.speakerConfig.voices,
          ttsModel
        );
      } else {
        const voiceName = segment.speakerConfig?.voices?.narrator || 'Zephyr';
        audioData = await generateSingle(
          apiKey,
          segment.text,
          voiceName,
          ttsModel,
          segment.type
        );
      }

      setAudioBuffer(segment.id, audioData);
      setGenerationStatus(segment.id, 'done');
    } catch (err) {
      console.error('TTS error:', err);
      setGenerationStatus(segment.id, 'error');
      addToast({ type: 'error', message: `段落生成失败: ${err.message}` });
    }
  }, [apiKey, ttsModel, setAudioBuffer, setGenerationStatus, addToast]);

  // Generate all segments
  const generateAll = useCallback(async () => {
    if (!apiKey) {
      addToast({ type: 'error', message: '请先在设置中填写 API Key' });
      return;
    }

    resetGenerationStatus();

    for (const seg of segments) {
      await generateSegment(seg);
    }

    addToast({ type: 'success', message: '全部段落生成完成！' });
  }, [apiKey, segments, generateSegment, resetGenerationStatus, addToast]);

  const hasSegments = segments.length > 0;
  const doneCount = Object.values(generationStatus).filter((s) => s === 'done').length;
  const isGenerating = Object.values(generationStatus).some((s) => s === 'generating');

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar__left">
          <span className="topbar__logo">🎧</span>
          <h1 className="topbar__title">GaoKaoTingLi</h1>
          <span className="topbar__subtitle">高考听力音频生成器</span>
        </div>
        <div className="topbar__right">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowVoicePreview(true)}>
            🎤 音色试听
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="设置">
            ⚙
          </button>
          <button className="btn-icon" onClick={toggleDarkMode} title="主题切换">
            {darkMode ? '☀' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <AudioLibrary />
        </aside>

        {/* Center */}
        <main className="center-panel">
          {!hasSegments ? (
            <div className="center-panel__empty">
              <UploadZone />
            </div>
          ) : (
            <>
              <div className="center-panel__header">
                <h2>段落列表</h2>
                <div className="center-panel__actions">
                  <button
                    className="btn btn-primary"
                    onClick={generateAll}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <span className="spinner" />
                        生成中...
                      </>
                    ) : (
                      '▶ 全部生成'
                    )}
                  </button>
                  {doneCount > 0 && (
                    <span className="center-panel__progress">
                      {doneCount}/{segments.length} 完成
                    </span>
                  )}
                </div>
              </div>

              <div className="center-panel__scrollable">
                <SegmentList />

                {/* Re-upload */}
                <div className="center-panel__reupload">
                  <UploadZone />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Timeline */}
      {hasSegments && <Timeline />}

      {/* Modals */}
      <SettingsPanel />
      <VoicePreview />
      <ToastContainer />
    </div>
  );
}
