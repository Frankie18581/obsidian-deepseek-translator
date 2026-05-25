# DeepSeek Translator for Obsidian

沉浸式 AI 翻译插件，基于 DeepSeek 大模型，支持三种翻译模式。

## 功能

- **划词翻译** — 选中文本，悬浮窗即时翻译
- **全文翻译** — 一键翻译整篇笔记（替换原文或生成新文件）
- **侧边栏翻译** — 独立翻译面板，支持手动输入和语言切换

## 安装

### 手动安装

1. 下载 `main.js`、`styles.css`、`manifest.json` 放到 `{vault}/.obsidian/plugins/deepseek-translator/`
2. 在 Obsidian 设置 → 第三方插件中启用
3. 在插件设置中填入 DeepSeek API Key

### 从源码构建

```bash
git clone https://github.com/Frankie18581/obsidian-deepseek-translator.git
cd obsidian-deepseek-translator
npm install
npm run build
```

## 配置

| 设置项 | 说明 |
|--------|------|
| API Key | DeepSeek API Key（从 [platform.deepseek.com](https://platform.deepseek.com) 获取） |
| 模型 | 默认 `deepseek-chat` |
| 源语言 / 目标语言 | 支持中英日韩法等 15+ 语言 |

## 快捷键

- 侧边栏中 `Ctrl+Enter` / `Cmd+Enter` 触发翻译

## 许可

MIT
