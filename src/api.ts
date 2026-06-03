import { requestUrl, RequestUrlParam } from "obsidian";

// ============================================================
// Provider System
// ============================================================

export type ProviderType =
    | 'deepseek'
    | 'openai'
    | 'openrouter'
    | 'google'
    | 'claude'
    | 'grok'
    | 'kimi'
    | 'qwen'
    | 'custom';

export interface ProviderPreset {
    name: string;
    apiBase: string;
    defaultModel: string;
    models: string[];
    authType: 'bearer' | 'x-api-key';
    apiFormat: 'openai' | 'anthropic';
    extraHeaders?: Record<string, string>;
}

export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
    deepseek: {
        name: 'DeepSeek',
        apiBase: 'https://api.deepseek.com',
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    openai: {
        name: 'OpenAI',
        apiBase: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini', 'o4-mini'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    openrouter: {
        name: 'OpenRouter',
        apiBase: 'https://openrouter.ai/api/v1',
        defaultModel: 'openai/gpt-4o-mini',
        models: [
            'openai/gpt-4o-mini',
            'openai/gpt-4o',
            'anthropic/claude-sonnet-4',
            'google/gemini-2.5-flash',
            'deepseek/deepseek-chat',
            'meta-llama/llama-4-maverick',
        ],
        authType: 'bearer',
        apiFormat: 'openai',
        extraHeaders: {
            'HTTP-Referer': 'https://obsidian.md',
            'X-Title': 'Obsidian Multi Translator',
        },
    },
    google: {
        name: 'Google Gemini',
        apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-2.0-flash',
        models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    claude: {
        name: 'Anthropic Claude',
        apiBase: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-sonnet-4-20250514',
        models: [
            'claude-sonnet-4-20250514',
            'claude-opus-4-20250514',
            'claude-3-5-haiku-20241022',
        ],
        authType: 'x-api-key',
        apiFormat: 'anthropic',
    },
    grok: {
        name: 'Grok (xAI)',
        apiBase: 'https://api.x.ai/v1',
        defaultModel: 'grok-3-beta',
        models: ['grok-3-beta', 'grok-2-1212'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    kimi: {
        name: 'Kimi (Moonshot)',
        apiBase: 'https://api.moonshot.cn/v1',
        defaultModel: 'moonshot-v1-8k',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    qwen: {
        name: 'Qwen (DashScope)',
        apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: 'qwen-plus',
        models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
        authType: 'bearer',
        apiFormat: 'openai',
    },
    custom: {
        name: '自定义 (OpenAI 兼容)',
        apiBase: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo',
        models: [],
        authType: 'bearer',
        apiFormat: 'openai',
    },
};

export const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] =
    Object.entries(PROVIDER_PRESETS).map(([key, preset]) => ({
        value: key as ProviderType,
        label: preset.name,
    }));

// ============================================================
// Translator Config
// ============================================================

export interface TranslatorConfig {
    apiKey: string;
    model: string;
    apiBase: string;
    provider: ProviderType;
    sourceLang: string;
    targetLang: string;
    temperature: number;
    maxTokens: number;
}

export const DEFAULT_CONFIG: TranslatorConfig = {
    apiKey: "",
    model: "deepseek-chat",
    apiBase: "https://api.deepseek.com",
    provider: "deepseek",
    sourceLang: "auto",
    targetLang: "zh",
    temperature: 0.3,
    maxTokens: 4096,
};

// ============================================================
// System Prompt
// ============================================================

const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the following text from {source} to {target}.

Rules:
1. Preserve the original formatting: markdown syntax, code blocks, links, and whitespace must remain intact.
2. Only translate the natural language content, never modify markdown structures, URLs, or code.
3. For technical terms, use the most widely accepted translation.
4. Maintain the original tone and style.
5. If the source text is already in the target language or contains only non-text content, return it unchanged.
6. Output ONLY the translated text, no explanations, no notes, no markdown fences.

Text to translate:`;

// ============================================================
// Text Chunking
// ============================================================

function splitTextIntoChunks(text: string, maxChunkSize: number = 2000): string[] {
    if (text.length <= maxChunkSize) {
        return [text];
    }

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
        } else {
            currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// ============================================================
// Header Builder
// ============================================================

function buildHeaders(config: TranslatorConfig): Record<string, string> {
    const preset = PROVIDER_PRESETS[config.provider];
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Auth header
    if (preset.authType === 'x-api-key') {
        headers["x-api-key"] = config.apiKey;
    } else {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // Anthropic-specific version header
    if (preset.apiFormat === 'anthropic') {
        headers["anthropic-version"] = "2023-06-01";
    }

    // Provider extra headers (e.g. OpenRouter)
    if (preset.extraHeaders) {
        Object.assign(headers, preset.extraHeaders);
    }

    return headers;
}

// ============================================================
// OpenAI-compatible API Call (non-streaming)
// ============================================================

async function callOpenAICompatibleAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string
): Promise<string> {
    const url = `${config.apiBase}/chat/completions`;

    const body: Record<string, any> = {
        model: config.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false,
    };

    const requestParams: RequestUrlParam = {
        url: url,
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(body),
    };

    try {
        const response = await requestUrl(requestParams);
        const data = response.json;

        if (data.error) {
            throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from API");
        }

        return content.trim();
    } catch (error: any) {
        throw formatAPIError(error, config.provider);
    }
}

// ============================================================
// Anthropic API Call (non-streaming)
// ============================================================

async function callAnthropicAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string
): Promise<string> {
    const url = `${config.apiBase}/messages`;

    const body: Record<string, any> = {
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [
            { role: "user", content: text },
        ],
        temperature: config.temperature,
    };

    const requestParams: RequestUrlParam = {
        url: url,
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(body),
    };

    try {
        const response = await requestUrl(requestParams);
        const data = response.json;

        if (data.error) {
            throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        // Anthropic returns content as array of blocks
        const textBlocks = data.content?.filter((b: any) => b.type === "text");
        if (!textBlocks || textBlocks.length === 0) {
            throw new Error("Empty response from Anthropic API");
        }

        return textBlocks.map((b: any) => b.text).join("").trim();
    } catch (error: any) {
        throw formatAPIError(error, config.provider);
    }
}

// ============================================================
// Unified API Call
// ============================================================

async function callLLMAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string
): Promise<string> {
    const preset = PROVIDER_PRESETS[config.provider];
    if (preset.apiFormat === 'anthropic') {
        return await callAnthropicAPI(config, text, systemPrompt);
    }
    return await callOpenAICompatibleAPI(config, text, systemPrompt);
}

// ============================================================
// Error Formatting
// ============================================================

function formatAPIError(error: any, provider: ProviderType): Error {
    const providerName = PROVIDER_PRESETS[provider].name;
    if (error.status === 401) {
        return new Error(`${providerName} API Key 无效，请在设置中检查`);
    }
    if (error.status === 429) {
        return new Error(`${providerName} API 请求频率过高，请稍后重试`);
    }
    if (error.status === 402 || error.status === 403) {
        return new Error(`${providerName} API 余额不足或无权限，请检查账户`);
    }
    return new Error(`翻译失败: ${error.message || error}`);
}

// ============================================================
// Non-streaming Translation
// ============================================================

export async function translateText(
    config: TranslatorConfig,
    text: string
): Promise<string> {
    if (!text.trim()) {
        return text;
    }

    const prompt = TRANSLATION_SYSTEM_PROMPT
        .replace("{source}", config.sourceLang === "auto" ? "auto-detected language" : config.sourceLang)
        .replace("{target}", config.targetLang);

    // For short texts, translate directly
    if (text.length <= 3000) {
        return await callLLMAPI(config, text, prompt);
    }

    // For longer texts, split and translate in chunks
    const chunks = splitTextIntoChunks(text, 2000);
    const translatedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPrompt = chunks.length > 1
            ? `${prompt}\n\n(Part ${i + 1} of ${chunks.length}. Translate this part and return only the translated text without any additional commentary.)`
            : prompt;

        try {
            const translated = await callLLMAPI(config, chunk, chunkPrompt);
            translatedChunks.push(translated);
        } catch (error) {
            translatedChunks.push(`[翻译失败: ${error}]`);
            throw error;
        }
    }

    return translatedChunks.join("\n\n");
}

// ============================================================
// Anthropic SSE Streaming Helper
// ============================================================

async function streamAnthropicAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string,
    onChunk: (chunk: string) => void
): Promise<string> {
    const url = `${config.apiBase}/messages`;

    const body: Record<string, any> = {
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: text }],
        temperature: config.temperature,
        stream: true,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: buildHeaders(config),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API error ${response.status}: ${(errorData as any).error?.message || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const data = trimmed.slice(6);
                if (data === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(data);
                    // Anthropic SSE types: message_start, content_block_start, content_block_delta, message_delta, message_stop
                    if (parsed.type === "content_block_delta") {
                        const deltaText = parsed.delta?.text;
                        if (deltaText) {
                            fullText += deltaText;
                            onChunk(deltaText);
                        }
                    }
                } catch {
                    // Skip malformed JSON lines
                }
            }
        }

        return fullText.trim();
    } catch (error: any) {
        throw new Error(`流式翻译失败: ${error.message || error}`);
    }
}

// ============================================================
// OpenAI-compatible SSE Streaming
// ============================================================

async function streamOpenAICompatibleAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string,
    onChunk: (chunk: string) => void
): Promise<string> {
    const url = `${config.apiBase}/chat/completions`;

    const body: Record<string, any> = {
        model: config.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: buildHeaders(config),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API error ${response.status}: ${(errorData as any).error?.message || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const data = trimmed.slice(6);
                if (data === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        fullText += content;
                        onChunk(content);
                    }
                } catch {
                    // Skip malformed JSON lines
                }
            }
        }

        return fullText.trim();
    } catch (error: any) {
        throw new Error(`流式翻译失败: ${error.message || error}`);
    }
}

// ============================================================
// Streaming Translation (for sidebar)
// ============================================================

export async function translateTextStreaming(
    config: TranslatorConfig,
    text: string,
    onChunk: (chunk: string) => void
): Promise<string> {
    if (!text.trim()) return text;

    const prompt = TRANSLATION_SYSTEM_PROMPT
        .replace("{source}", config.sourceLang === "auto" ? "auto-detected language" : config.sourceLang)
        .replace("{target}", config.targetLang);

    const preset = PROVIDER_PRESETS[config.provider];
    if (preset.apiFormat === 'anthropic') {
        return await streamAnthropicAPI(config, text, prompt, onChunk);
    }
    return await streamOpenAICompatibleAPI(config, text, prompt, onChunk);
}

// ============================================================
// Batch Translation
// ============================================================

export async function batchTranslate(
    config: TranslatorConfig,
    texts: string[]
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toTranslate = texts.filter(t => t.trim());

    if (toTranslate.length === 0) return result;

    if (toTranslate.length <= 3) {
        for (const text of toTranslate) {
            try {
                result.set(text, await translateText(config, text));
            } catch {
                result.set(text, `[翻译失败] ${text}`);
            }
        }
        return result;
    }

    const delimiter = "\n---SEGMENT---\n";
    const combinedText = toTranslate.join(delimiter);

    const prompt = `You are a professional translator. Translate each segment below from {source} to {target}.
Rules:
1. Each segment is separated by "---SEGMENT---".
2. Return translations in the same order, separated by "---SEGMENT---".
3. Preserve markdown formatting, code, and links.
4. Output ONLY the translated segments with the same delimiter.

Text:`
        .replace("{source}", config.sourceLang === "auto" ? "auto-detected language" : config.sourceLang)
        .replace("{target}", config.targetLang);

    try {
        const response = await callLLMAPI(config, combinedText, prompt);
        const translatedSegments = response.split("---SEGMENT---").map(s => s.trim());

        for (let i = 0; i < toTranslate.length; i++) {
            result.set(toTranslate[i], translatedSegments[i] || toTranslate[i]);
        }
    } catch {
        for (const text of toTranslate) {
            try {
                result.set(text, await translateText(config, text));
            } catch {
                result.set(text, text);
            }
        }
    }

    return result;
}

// ============================================================
// Language Names
// ============================================================

export const LANGUAGE_NAMES: Record<string, string> = {
    "auto": "自动检测",
    "zh": "中文",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "pt": "Português",
    "ru": "Русский",
    "ar": "العربية",
    "it": "Italiano",
    "th": "ไทย",
    "vi": "Tiếng Việt",
    "id": "Bahasa Indonesia",
};

export function getLanguageName(code: string): string {
    return LANGUAGE_NAMES[code] || code;
}
