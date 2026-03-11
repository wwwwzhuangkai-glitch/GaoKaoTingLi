import { useCallback, useRef } from 'react';
import useAppStore from '../../store/appStore';
import { getBuiltinSounds } from './builtinSounds';
import { playFloat32 } from '../audio-engine/audioContext';
import { decodeAudioFile } from '../audio-engine/audioContext';
import { getDuration } from '../audio-engine/pcmUtils';
import './AudioLibrary.css';

export default function AudioLibrary() {
    const { userSounds, addUserSound, removeUserSound, addToast } = useAppStore();
    const fileInputRef = useRef(null);
    const builtinSounds = getBuiltinSounds();

    const handleUpload = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const decoded = await decodeAudioFile(file);
            const sound = {
                id: `user_${Date.now()}`,
                name: file.name.replace(/\.[^.]+$/, ''),
                data: decoded.data,
                duration: decoded.duration,
                builtin: false,
            };
            addUserSound(sound);
            addToast({ type: 'success', message: `已添加音效: ${sound.name}` });
        } catch (err) {
            addToast({ type: 'error', message: '音效文件解析失败: ' + err.message });
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [addUserSound, addToast]);

    const handlePlaySound = (sound) => {
        playFloat32(sound.data);
    };

    return (
        <div className="audio-library">
            <div className="audio-library__header">
                <h3 className="audio-library__title">🎵 音效库</h3>
            </div>

            {/* Built-in sounds */}
            <div className="audio-library__section">
                <div className="audio-library__section-title">内置音效</div>
                {builtinSounds.map((sound) => (
                    <div key={sound.id} className="audio-library__item">
                        <span className="audio-library__item-icon">🔔</span>
                        <span className="audio-library__item-name truncate">{sound.name}</span>
                        <span className="audio-library__item-duration">{sound.duration.toFixed(1)}s</span>
                        <button className="btn-icon" onClick={() => handlePlaySound(sound)} title="播放">▶</button>
                    </div>
                ))}
            </div>

            {/* User uploaded sounds */}
            <div className="audio-library__section">
                <div className="audio-library__section-title">自定义音效</div>
                {userSounds.map((sound) => (
                    <div key={sound.id} className="audio-library__item">
                        <span className="audio-library__item-icon">🎵</span>
                        <span className="audio-library__item-name truncate">{sound.name}</span>
                        <span className="audio-library__item-duration">{sound.duration.toFixed(1)}s</span>
                        <button className="btn-icon" onClick={() => handlePlaySound(sound)} title="播放">▶</button>
                        <button className="btn-icon" onClick={() => removeUserSound(sound.id)} title="删除">✕</button>
                    </div>
                ))}

                {userSounds.length === 0 && (
                    <div className="audio-library__empty">暂无自定义音效</div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".wav,.mp3,.ogg,.m4a"
                    style={{ display: 'none' }}
                    onChange={handleUpload}
                />
                <button
                    className="btn btn-secondary btn-sm audio-library__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                >
                    + 上传音效
                </button>
            </div>
        </div>
    );
}
