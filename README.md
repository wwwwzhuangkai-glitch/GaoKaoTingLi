# 🎧 GaoKaoTingLi

**高考听力音频生成器** — 上传 Word 文档，智能切割为段落，调用 Gemini TTS API 生成专业考试音频，时间轴编排后导出完整听力。

![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Gemini](https://img.shields.io/badge/Gemini_TTS-API-4285F4?logo=google)

## ✨ 功能特性

- **📄 Word 解析** — 上传 `.docx` 文件，自动识别旁白、对话、独白、问题等段落类型
- **🎙 Gemini TTS** — 调用 Google Gemini 2.5 Flash/Pro TTS API 生成高保真英语音频
- **💬 多说话人** — 自动检测 W/M 对话标记，分配不同音色（最多 2 说话人）
- **🔔 自定义音效** — 内置叮声 + 支持上传自己的音效文件（wav/mp3）
- **🎬 时间轴编排** — 类剪辑软件的时间轴界面，可视化编排所有音频片段
- **🔁 重复 & 间隔** — 指定段落重复次数、段间静音间隔
- **🎤 30 种音色** — 支持全部 30 种 Gemini 预置音色，含试听功能
- **📥 WAV 导出** — 一键拼接导出完整高考听力 WAV 文件
- **🌙 深色模式** — 支持亮/暗主题切换
- **🔒 隐私安全** — API Key 仅存浏览器 localStorage，不上传任何服务器

## 🚀 快速开始

### 前置条件

- Node.js 18+
- Gemini API Key（[获取地址](https://aistudio.google.com/apikey)）

### 安装与运行

```bash
git clone https://github.com/YOUR_USERNAME/gaokaotingli.git
cd gaokaotingli
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`

### 使用步骤

1. 点击右上角 ⚙ 设置，填入你的 Gemini API Key
2. 拖拽上传高考听力 `.docx` 文件
3. 检查自动切割的段落，调整类型、音色、重复次数
4. 点击 **▶ 全部生成**，等待 TTS 生成完成
5. 在底部时间轴预览、调整编排
6. 点击 **📥 导出 WAV** 下载完整听力文件

## 🏗 项目结构

```
src/
├── App.jsx                        # 主布局
├── index.css                      # Gemini 风格设计系统
├── store/appStore.js              # Zustand 全局状态
└── modules/
    ├── settings/                  # API Key & 偏好设置
    ├── doc-parser/                # DOCX 解析 & 文本切割
    ├── segment-editor/            # 段落卡片编辑 & 拖拽排序
    ├── tts-engine/                # Gemini TTS API 调用
    ├── audio-library/             # 音效库（内置 + 用户上传）
    ├── timeline/                  # 时间轴编辑器
    ├── audio-engine/              # Web Audio API & WAV 编码
    └── voice-preview/             # 音色试听面板
```

## 🔧 技术栈

| 技术 | 用途 |
|------|------|
| Vite + React | 前端框架 |
| @google/genai | Gemini TTS API（浏览器端直调） |
| mammoth.js | DOCX → 文本提取 |
| @dnd-kit | 拖拽排序 |
| zustand | 轻量状态管理 |
| Web Audio API | 音频播放 & 解码 |

## 📝 Gemini TTS 模型

| 模型 | 特点 |
|------|------|
| `gemini-2.5-flash-preview-tts` | 低延迟、低成本，适合批量生成 |
| `gemini-2.5-pro-preview-tts` | 高保真、studio 品质，适合正式考试 |

> 两个模型均限制最多 2 说话人 / 8192 input tokens

## 📄 License

MIT
