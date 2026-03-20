# Gemini TTS 高考听力音频生成 — 完整经验报告

> **项目时间**: 2026年3月  
> **目标**: 用 Gemini TTS API 将高考英语听力 `.docx` 原文自动转为专业考试音频  
> **最终成果**: 3 个版本迭代，最终 V3（Pro 模型 + Director's Notes）效果最佳

---

## 一、系统架构概览

```
docx 原文 ──→ preprocess.py ──→ segments.json ──→ generate_audio.py ──→ WAV 音频
                                                       ↑
                                              ding_sounds/ding_01.mp3
                                             (从真题音频中提取)
```

### 整体流程

1. **真题叮声提取** (`split_audio.py`): 从 2025 年高考真题 MP3 中，用 FFT 频谱分析检测 2580Hz 纯音，提取真实叮声
2. **音色测试** (`test_voices.py`): 逐个测试 Gemini 全部 9 种音色，选出最适合考试风格的组合
3. **文本预处理** (`preprocess.py`): 将 `.docx` 解析为结构化 `segments.json`
4. **TTS 生成** (`generate_audio.py`): 按 segment 逐段调用 Gemini TTS API，拼接为完整音频
5. **人工验听**: 检查货币、房间号、专有名词的发音

### 音频结构（每段听力）

```
🎙 中文旁白 → ⏸阅读停顿 → 🔔叮(真题提取) → ⏸0.5s → 💬英文第1遍 → ⏸2s → 💬英文第2遍 → ⏸作答停顿
```

---

## 二、技术选型

### 模型

| 版本 | 模型 | 说明 |
|------|------|------|
| V1/V2 | `gemini-2.5-flash-preview-tts` | 速度快、便宜，但语速控制不够稳定 |
| **V3** | **`gemini-2.5-pro-preview-tts`** | 更高质量，遵循 prompt 指令更好 |

### 音色选择

| 角色 | 音色 | 选择理由 |
|------|------|----------|
| 中文旁白 | **Orus** | 活力清晰，中文发音自然，适合播报 |
| 英文女声 (W:/Sarah) | **Zephyr** | 清晰专业，适合考试朗读 |
| 英文男声 (M:/James) | **Charon** | 深沉稳重，对比度好 |

> **备选**: Leda（女，沉稳）、Kore（女，明亮）、Puck（男，年轻）

### 其他参数

| 参数 | 值 |
|------|------|
| 采样率 | 24000 Hz |
| 位深 | 16-bit (s16) |
| 声道 | 单声道 |
| 速度版本 | 1.0x / 0.95x / 0.9x |

---

## 三、提示词迭代全记录（核心！）

### 🔴 V1 — 最简提示词（初始版本）

#### 中文旁白 (single_speaker)
```
Read this transcript aloud exactly as written:

{text}
```

#### 英文对话 (multi_speaker)
**直接传对话文本，无额外 prompt**：
```
Sarah: Yes. This term it'll be moving to Room B15...
James: My wife is really interested...
```

**问题**：
- 模型会"加戏"，用对话口吻朗读，语速不均匀
- 有些句子说得很快，有些很慢
- 短文本直接传入会报错 `Model tried to generate text`

---

### 🟡 V2 — 角色扮演提示词

#### 中文旁白 (不变)
```
Read this transcript aloud exactly as written:

{text}
```

#### 英文对话/独白
```
You are a professional narrator for a standardized English listening exam (like China's Gaokao).

CRITICAL RULES:
- Speak at a SLOW, STEADY, UNIFORM pace throughout. Every sentence must be at the same speed.
- Do NOT speed up or rush ANY sentence. Do NOT slow down dramatically either.
- Enunciate every word clearly. Pause briefly between sentences.
- This is an exam, not a casual conversation. Keep the tone neutral and professional.
- Read all numbers, currencies and proper nouns clearly.

Now read the following {dialogue/monologue}:

{text}
```

**改进**：
- 加入了考试风格角色设定
- 用否定指令 `Do NOT speed up` 对抗模型自适应加速
- `This is an exam, not a casual conversation` 抑制对话感
- 对数字/货币/专有名词做了特别强调

**残余问题**：
- 语速仍有波动，某些句子还是较快
- 模型有时不完全遵循 "CRITICAL RULES" 指令

---

### 🟢 V3 — Director's Notes 结构化提示词（最终成功版本）✅

采用 **Gemini 官方推荐的 Director's Notes 格式**，效果显著提升。

#### 中文旁白 (single_speaker, Orus)
```
Read this transcript aloud exactly as written:

{text}
```
> 中文旁白不需要复杂 prompt，因为播报风格本身就是模型的默认处理方式。

#### 英文对话 (multi_speaker, Charon + Zephyr)
```
# AUDIO PROFILE: Exam Narrator Duo
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams for Chinese high school students (Gaokao). The atmosphere is calm and professional. Two narrators sit at microphones, reading a scripted dialogue with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. No dramatic emotion or conversational casualness.
* Clear enunciation of every word, especially numbers, currencies, room numbers, and proper nouns.
* Each speaker maintains a consistent, steady vocal quality throughout.

Pacing:
* Extremely steady and uniform throughout. Every sentence at the exact same moderate pace.
* No acceleration on any sentence. No rushing. No slowing down dramatically either.
* Brief, consistent pauses between sentences.
* This is a standardized exam recording — treat every sentence with equal weight and timing.

Accent: Standard neutral English.

#### TRANSCRIPT
{text}
```

#### 英文独白 (single_speaker)
```
# AUDIO PROFILE: Exam Narrator
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams. The narrator reads an announcement with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. Clear enunciation of every word.
* Special attention to numbers, dates, prices, and proper nouns.

Pacing:
* Extremely steady and uniform. Every sentence at the same moderate pace.
* No acceleration. No rushing. Brief, consistent pauses between sentences.

Accent: Standard neutral English.

#### TRANSCRIPT
{text}
```

**为什么 V3 效果最好**：
1. **结构化 Markdown 格式** — `# AUDIO PROFILE` / `## THE SCENE` / `### DIRECTOR'S NOTES` / `#### TRANSCRIPT`，模型对这种层级结构的理解能力远超纯文本指令
2. **场景设定** — "Professional Recording Studio"、"soundproofed"、"precise, measured delivery" 等词创造了一个具体的心理场景
3. **Director's Notes 是官方推荐格式** — Gemini TTS 专门优化了对这种格式的解析
4. **Style + Pacing 分离** — 将风格和节奏分开描述，比混在一起更清晰
5. **`treat every sentence with equal weight and timing`** — 这句话对稳定语速非常关键

---

## 四、`segments.json` 数据结构

每段听力被拆解为以下 segment 类型：

| type | 说明 | API 调用 |
|------|------|----------|
| `narrator_cn` | 中文旁白 | ✅ 单人 TTS (Orus) |
| `dialogue` | 英文对话 第1遍 | ✅ 多人 TTS (Charon+Zephyr) |
| `dialogue_repeat` | 英文对话 第2遍 | ❌ 复用第1遍音频 |
| `monologue` | 英文独白 第1遍 | ✅ 单人 TTS |
| `monologue_repeat` | 英文独白 第2遍 | ❌ 复用第1遍音频 |
| `ding` | 叮声 | ❌ 使用真题音频文件 |
| `pause` | 静音 | ❌ 生成静音 PCM |

### 示例 segment

```json
{
  "type": "dialogue",
  "text": "James: Excuse me. You've got a class called Watercolors, haven't you?\nSarah: Yes. This term it'll be moving to Room B15...",
  "section_id": 1,
  "section_name": "对话1"
}
```

### 对话文本格式要求

- `W:` / `M:` 必须转换为 `Sarah:` / `James:`（Gemini multi_speaker 要求用名字）
- 每行一个说话人，用 `\n` 分隔
- 保留完整标点和特殊字符（£、—、'等）

---

## 五、Gemini TTS API 调用方式

### 单人模式 (narrator_cn / monologue)

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=API_KEY)

response = client.models.generate_content(
    model="gemini-2.5-pro-preview-tts",  # 或 flash
    contents=prompt,  # prompt 文本（含 Director's Notes）
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Orus"  # 音色名
                )
            ),
        ),
    ),
)
# 返回的是 raw PCM 数据 (24kHz 16-bit mono)
audio_data = response.candidates[0].content.parts[0].inline_data.data
```

### 多人模式 (dialogue)

```python
response = client.models.generate_content(
    model="gemini-2.5-pro-preview-tts",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Sarah",  # 与文本中的 "Sarah:" 对应
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Zephyr"  # 女声
                            )
                        ),
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="James",  # 与文本中的 "James:" 对应
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Charon"  # 男声
                            )
                        ),
                    ),
                ]
            ),
        ),
    ),
)
```

---

## 六、已知坑点与解决方案

### 1. multi_speaker 严格限制 2 人
Gemini `multi_speaker_voice_config` 最多支持 2 个 speaker。中文旁白必须**单独生成**再拼接。

### 2. TTS 拒绝朗读短文本
直接传 `"Conversation one."` 会报错 `Model tried to generate text`。

**解决**: 加前缀 `"Read this transcript aloud exactly as written:\n\n"`

### 3. 模型自适应语速（语速不均匀）
LLM-based TTS 会根据语义上下文自动调整语速，对话感强的句子会加速。

**解决**:
- V2: 加 `CRITICAL RULES` 否定指令
- V3: 用 Director's Notes 场景设定 + `treat every sentence with equal weight and timing`
- 后处理: 用 `ffmpeg atempo` 整体减速（0.9x/0.95x）

### 4. 长对话可能超时
9+ 句的对话可能触发 `RemoteProtocolError`。

**解决**: 内置指数退避重试机制（最多 3 次，间隔 2s/4s/8s）

```python
def _call_with_retry(func, retries=3):
    for attempt in range(retries):
        try:
            return func()
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                time.sleep(wait)
            else:
                raise
```

### 5. 叮声必须用真题提取
合成叮声（纯音 sin 波）听起来机械、不自然。从真题 MP3 中用 FFT 检测 2580Hz 纯音位置，提取真实叮声效果好得多。

### 6. 音色名是天文学命名
不是 `Sage`/`Echo` 这种名字，而是 `Kore`/`Charon`/`Leda` 等恒星/卫星名。

### 7. 中文旁白不需要复杂 prompt
中文播报风格是模型的默认处理方式，简单的 `Read this transcript aloud exactly as written` 就够了。

### 8. pip 安装可能很慢
```bash
pip install google-genai -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 七、缓存与多速度输出策略

### 磁盘缓存 (V2+)
- 原始 TTS 输出（原速 PCM）缓存到磁盘（`tts_cache/` 或 `tts_cache_v3/`）
- cache key = `{seg_type}_{md5(model:type:text)[:12]}`
- 重跑时先检查缓存，命中则跳过 API 调用
- V3 使用独立缓存目录 `tts_cache_v3/`（因为换了模型）

### 多速度输出 (V2+)
- 保存 3 个速度版本：1.0x / 0.95x / 0.9x
- 只对**英文对话/独白**执行 `atempo`，中文旁白/静音/叮声保持原速
- 同一段对话的 repeat 复用 atempo 结果，不重复处理

```
output_v3/
├── 1.0x/
│   ├── full_listening.wav
│   ├── 01_对话1.wav
│   └── ...
├── 0.95x/
│   └── ...
└── 0.9x/
    └── ...
```

---

## 八、preprocess.py 文本解析规则

| 输入 | 处理方式 |
|------|----------|
| 中文行（≥3个汉字） | → `narrator_cn`（连续中文行合并） |
| `W:` 开头 | → `Sarah:` 对话行 |
| `M:` 开头 | → `James:` 对话行 |
| 空行 | → 段落分隔 |
| `每小题X秒` / `X秒钟` | → 提取停顿时间 |
| `X至Y` | → 提取题号范围，计算停顿 = 题数 × 每题秒数 |

### 停顿计算

- **阅读停顿**（对话前）= 题数 × 每题秒数
- **作答停顿**（对话后）= 题数 × 每题秒数
- **两遍间停顿** = 固定 2s
- **叮后停顿** = 固定 0.5s

---

## 九、叮声提取（split_audio.py）

### 真题叮声频谱特征
- **第1音**: 2580Hz 纯音，~200ms
- **间隔**: ~400ms 静音
- **第2音**: 2040Hz 纯音 + 指数衰减尾，~500ms
- **总时长**: ~1.5s

### 检测算法
1. 50ms 窗口 + 25ms 步进滑动
2. 对每个窗口做 FFT，找主频
3. 判断主频是否在 2580Hz ± 200Hz 范围内
4. 计算频谱纯度（主频附近能量/总能量 ≥ 80%）
5. 合并连续窗口 → 叮声起点
6. 每个叮声从起点到 +1500ms 为完整范围

---

## 十、费用估算

| 模型 | 单价 | 单份试卷（~3500字符） | 100 份 |
|------|------|---------------------|--------|
| `flash-preview-tts` | ~$0.04/1k字符 | ≈ ¥1 | ≈ ¥100 |
| `pro-preview-tts` | 更贵（具体待确认） | — | — |

---

## 十一、可用音色完整列表

### 女声
| 名称 | 风格 |
|------|------|
| **Zephyr** | 清晰专业（✅ 选用） |
| **Leda** | 沉稳专业 |
| Kore | 明亮活力 |
| Aoede | 清晰对话感 |

### 男声
| 名称 | 风格 |
|------|------|
| **Charon** | 深沉稳重（✅ 选用） |
| **Orus** | 活力清晰（✅ 中文旁白选用） |
| Puck | 年轻活泼 |
| Fenrir | — |
| Perseus | — |
| Alnilam | 中低音，兴奋 |

---

## 十二、APP 开发集成建议

如果你要在 APP 中集成这套 TTS 系统，以下是关键要点：

### 必须保留的

1. **Director's Notes 提示词格式**（V3版本） — 这是效果最好的提示词
2. **multi_speaker 的 speaker 名必须和文本中的标记一致**（如 `Sarah:` 对应 `speaker="Sarah"`）
3. **缓存机制** — TTS API 调用慢且费钱，必须缓存
4. **重试机制** — 长文本容易超时
5. **真题叮声** — 合成叮声效果差

### 可以简化的

1. 预处理可以改用 API 或前端 UI 手动编辑 `segments.json`
2. 速度版本可以只出一个（推荐 0.95x）
3. 如果只做对话不做独白，可以省掉 monologue 相关逻辑

### API 调用注意

- **安装**: `pip install google-genai`
- **认证**: `genai.Client(api_key=API_KEY)`
- **response_modalities**: 必须设为 `["AUDIO"]`
- **返回格式**: `response.candidates[0].content.parts[0].inline_data.data` → raw PCM (24kHz 16-bit mono)
- **保存**: 使用 Python `wave` 模块将 PCM 写为 WAV

---

## 十三、文件清单

| 文件 | 作用 | 版本 |
|------|------|------|
| `preprocess.py` | docx → segments.json | — |
| `generate_audio.py` | TTS 生成（无缓存，固定0.9x减速） | V1 |
| `generate_audio_v2.py` | 加缓存 + 多速度 + 加强prompt | V2 |
| `generate_audio_v3.py` | Pro模型 + Director's Notes | **V3 (最终)** |
| `split_audio.py` | 从真题提取叮声 | — |
| `test_voices.py` | 音色对比测试 | — |
| `test_dialogue.py` | 单段对话测试 | — |
| `segments.json` | 结构化数据（中间产物） | — |
