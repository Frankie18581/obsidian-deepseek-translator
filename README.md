# Obsidian Multi Translator

*Immersive AI translation plugin for Obsidian — inline, full-doc, sidebar, and hover translation powered by 9+ AI providers.*

[中文说明 ↓](#中文)

## Features

- **Inline Translation**: Select text → right-click menu / `Ctrl+Shift+T` → popup result
- **Hover Translation**: Auto popup translation on text selection (configurable delay)
- **Full-Document Translation**: Replace original or create a new file
- **Sidebar Panel**: Streaming translation with language swap, manual input
- **Batch Translation**: Auto-split long documents, preserving Markdown formatting

## Supported Providers

| Provider | Example Models | API Format |
|---|---|---|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | OpenAI Compatible |
| **OpenAI** | gpt-4o-mini, gpt-4o, o4-mini | OpenAI Compatible |
| **OpenRouter** | openai/gpt-4o, anthropic/claude-sonnet-4 | OpenAI Compatible |
| **Google Gemini** | gemini-2.0-flash, gemini-2.5-pro | OpenAI Compatible |
| **Anthropic Claude** | claude-sonnet-4, claude-opus-4 | Native Messages API |
| **Grok (xAI)** | grok-3-beta | OpenAI Compatible |
| **Kimi (Moonshot)** | moonshot-v1-8k | OpenAI Compatible |
| **Qwen (DashScope)** | qwen-plus, qwen-max | OpenAI Compatible |
| **Custom** | Any OpenAI-compatible API | OpenAI Compatible |

## Installation

### From GitHub

1. Download `main.js`, `manifest.json`, `styles.css`
2. Place them in your vault's `.obsidian/plugins/multi-translator/` directory
3. Restart Obsidian, enable in Settings → Community Plugins

### Manual Build

```bash
git clone https://github.com/Frankie18581/obsidian-deepseek-translator.git
cd obsidian-deepseek-translator
npm install
npm run build
```

## Usage

1. Open Settings → Multi Translator → select provider → enter API Key
2. Select text → right-click "🌐 Translate Selection" or press `Ctrl+Shift+T`
3. Or click the Ribbon icon to open the sidebar translation panel

## License

MIT

---

## 中文

沉浸式 AI 翻译插件 — 支持多种 AI 服务商，选词翻译、全文翻译、侧边栏翻译。

## 支持的服务商

| Provider | 模型示例 | API 格式 |
|---|---|---|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | OpenAI 兼容 |
| **OpenAI** | gpt-4o-mini, gpt-4o, o4-mini | OpenAI 兼容 |
| **OpenRouter** | openai/gpt-4o, anthropic/claude-sonnet-4 | OpenAI 兼容 |
| **Google Gemini** | gemini-2.0-flash, gemini-2.5-pro | OpenAI 兼容 |
| **Anthropic Claude** | claude-sonnet-4, claude-opus-4 | 原生 Messages API |
| **Grok (xAI)** | grok-3-beta | OpenAI 兼容 |
| **Kimi (Moonshot)** | moonshot-v1-8k | OpenAI 兼容 |
| **Qwen (DashScope)** | qwen-plus, qwen-max | OpenAI 兼容 |
| **自定义** | 任意 OpenAI 兼容 API | OpenAI 兼容 |

## 功能

- **选词翻译**：选中文本 → 右键菜单 / 快捷键 `Ctrl+Shift+T` → 弹窗显示结果
- **悬停翻译**：选中文本后自动浮窗显示翻译（可配置延迟）
- **全文翻译**：支持替换原文或创建新文件
- **侧边栏翻译**：右侧面板手动输入翻译，支持流式输出、语言交换
- **批量翻译**：长文档自动分段翻译，保持 Markdown 格式完整

## 安装

### 从 GitHub 安装

1. 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 vault 的 `.obsidian/plugins/multi-translator/` 目录
3. 重启 Obsidian，在「设置 → 第三方插件」中启用

### 手动构建

```bash
git clone https://github.com/Frankie18581/obsidian-deepseek-translator.git
cd obsidian-deepseek-translator
npm install
npm run build
```

## 使用

1. 打开设置 → Multi Translator → 选择服务商 → 填写 API Key
2. 选中文本 → 右键「🌐 翻译选中文本」或按 `Ctrl+Shift+T`
3. 或点击左侧 Ribbon 图标打开侧边栏翻译面板

## License

MIT
