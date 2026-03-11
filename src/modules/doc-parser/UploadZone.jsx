import { useCallback } from 'react';
import useAppStore from '../../store/appStore';
import { parseDocx } from './parseDocx';
import { parseTextToSegments } from './segmentRules';
import './UploadZone.css';

export default function UploadZone() {
    const { setSegments, defaultVoices, addToast } = useAppStore();

    const handleFile = useCallback(async (file) => {
        if (!file) return;
        if (!file.name.endsWith('.docx')) {
            addToast({ type: 'error', message: '请上传 .docx 格式文件' });
            return;
        }

        try {
            addToast({ type: 'info', message: '正在解析文档...' });
            const rawText = await parseDocx(file);
            const segments = parseTextToSegments(rawText, defaultVoices);
            setSegments(segments);
            addToast({ type: 'success', message: `解析完成，共 ${segments.length} 个段落` });
        } catch (err) {
            console.error('Parse error:', err);
            addToast({ type: 'error', message: '文档解析失败：' + err.message });
        }
    }, [setSegments, defaultVoices, addToast]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('upload-zone--active');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }, [handleFile]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('upload-zone--active');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('upload-zone--active');
    };

    const handleClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.docx';
        input.onchange = (e) => handleFile(e.target.files[0]);
        input.click();
    };

    return (
        <div
            className="upload-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
        >
            <div className="upload-zone__icon">📄</div>
            <div className="upload-zone__title">上传听力 Word 文档</div>
            <div className="upload-zone__subtitle">
                拖拽 .docx 文件到此处，或点击选择文件
            </div>
        </div>
    );
}
