# Obsidian Multi Translator

> Immersive AI translation plugin for Obsidian — inline, full-doc, sidebar, and hover translation powered by 9+ AI providers.

[中文说明 ↓](#中文)

## Features

- **Inline Translation**: Select text → right-click / `Ctrl+Shift+T` → popup result
- **Hover Translation**: Auto popup on text selection (configurable delay)
- **Full-Document Translation**: Replace original or create new file
- **Sidebar Panel**: Streaming translation with language swap & manual input
- **Batch Translation**: Auto-split long documents, preserving Markdown formatting

## Supported Providers

| Provider | Models |
|----------|--------|
| DeepSeek | deepseek-chat, deepseek-reasoner |
| OpenAI | gpt-4o-mini, gpt-4o, o4-mini |
| OpenRouter | 200+ models (Claude, GPT, Gemini, etc.) |
| Google Gemini | gemini-2.0-flash, gemini-2.5-pro |
| Anthropic Claude | claude-sonnet-4, claude-haiku |
| Grok | grok-3 |
| Kimi | moonshot-v1 |
| Qwen | qwen-turbo, qwen-plus |
| Custom | Any OpenAI-compatible endpoint |

## Tech Stack

- **Language**: TypeScript
- **Platform**: [Obsidian](https://obsidian.md) Plugin API
- **Build**: esbuild
- **Styling**: CSS3
- **AI Integration**: Multi-provider API abstraction layer (`src/api.ts`)

## Installation

### Obsidian Community Plugin (Recommended)
Search "Multi Translator" in Obsidian Community Plugins.

### Manual
1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/Frankie18581/obsidian-deepseek-translator/releases)
2. Copy to `{vault}/.obsidian/plugins/deepseek-translator/`

## 中文

沉浸式 Obsidian AI 翻译插件，支持划词翻译、全文翻译、侧边栏翻译和悬停翻译，兼容 9+ AI 大模型供应商。

## License

MIT
