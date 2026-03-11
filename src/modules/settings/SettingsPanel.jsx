import { useState } from 'react';
import useAppStore from '../../store/appStore';
import './SettingsPanel.css';

export default function SettingsPanel() {
    const {
        apiKey, setApiKey,
        defaultVoices, setDefaultVoices,
        ttsModel, setTtsModel,
        showSettings, setShowSettings,
    } = useAppStore();

    const [showKey, setShowKey] = useState(false);
    const [localKey, setLocalKey] = useState(apiKey);

    const handleSave = () => {
        setApiKey(localKey);
        setShowSettings(false);
    };

    if (!showSettings) return null;

    return (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content settings-panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙ 设置</h2>
                    <button className="btn-icon" onClick={() => setShowSettings(false)}>✕</button>
                </div>
                <div className="modal-body">
                    {/* API Key */}
                    <div className="settings-group">
                        <label className="label">Gemini API Key</label>
                        <div className="settings-key-row">
                            <input
                                className="input"
                                type={showKey ? 'text' : 'password'}
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder="输入你的 Gemini API Key"
                            />
                            <button className="btn-icon" onClick={() => setShowKey(!showKey)} title={showKey ? '隐藏' : '显示'}>
                                {showKey ? '🙈' : '👁'}
                            </button>
                        </div>
                        <p className="settings-hint">
                            Key 仅保存在你的浏览器本地，不会上传到任何服务器。
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">获取 API Key →</a>
                        </p>
                    </div>

                    {/* TTS Model */}
                    <div className="settings-group">
                        <label className="label">TTS 模型</label>
                        <select className="select" value={ttsModel} onChange={(e) => setTtsModel(e.target.value)}>
                            <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS (快速)</option>
                            <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro TTS (高保真)</option>
                        </select>
                    </div>

                    {/* Default Voices */}
                    <div className="settings-group">
                        <label className="label">默认旁白音色</label>
                        <input
                            className="input"
                            value={defaultVoices.narrator}
                            onChange={(e) => setDefaultVoices({ narrator: e.target.value })}
                        />
                    </div>
                    <div className="settings-group">
                        <label className="label">默认女声音色</label>
                        <input
                            className="input"
                            value={defaultVoices.female}
                            onChange={(e) => setDefaultVoices({ female: e.target.value })}
                        />
                    </div>
                    <div className="settings-group">
                        <label className="label">默认男声音色</label>
                        <input
                            className="input"
                            value={defaultVoices.male}
                            onChange={(e) => setDefaultVoices({ male: e.target.value })}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>取消</button>
                    <button className="btn btn-primary" onClick={handleSave}>保存</button>
                </div>
            </div>
        </div>
    );
}
