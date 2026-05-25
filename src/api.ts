import { requestUrl, RequestUrlParam } from "obsidian";

export interface TranslatorConfig {
    apiKey: string;
    model: string;
    apiBase: string;
    sourceLang: string;
    targetLang: string;
    temperature: number;
    maxTokens: number;
}

export const DEFAULT_CONFIG: TranslatorConfig = {
    apiKey: "",
    model: "deepseek-chat",
    apiBase: "https://api.deepseek.com",
    sourceLang: "auto",
    targetLang: "zh",
    temperature: 0.3,
    maxTokens: 4096,
};

const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the following text from {source} to {target}.

Rules:
1. Preserve the original formatting: markdown syntax, code blocks, links, and whitespace must remain intact.
2. Only translate the natural language content, never modify markdown structures, URLs, or code.
3. For technical terms, use the most widely accepted translation.
4. Maintain the original tone and style.
5. If the source text is already in the target language or contains only non-text content, return it unchanged.
6. Output ONLY the translated text, no explanations, no notes, no markdown fences.

Text to translate:`;

/**
 * Split text into chunks for translation, preserving markdown structures.
 * Chunks are split at paragraph boundaries to keep context.
 */
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

/**
 * Call DeepSeek API for translation.
 */
async function callDeepSeekAPI(
    config: TranslatorConfig,
    text: string,
    systemPrompt: string
): Promise<string> {
    const url = `${config.apiBase}/chat/completions`;

    const body = {
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
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
    };

    try {
        const response = await requestUrl(requestParams);
        const data = response.json;

        if (data.error) {
            throw new Error(`DeepSeek API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from DeepSeek API");
        }

        return content.trim();
    } catch (error: any) {
        if (error.status === 401) {
            throw new Error("API Key 无效，请在设置中检查你的 DeepSeek API Key");
        }
        if (error.status === 429) {
            throw new Error("API 请求频率过高，请稍后重试");
        }
        if (error.status === 402) {
            throw new Error("DeepSeek API 余额不足，请充值");
        }
        throw new Error(`翻译失败: ${error.message || error}`);
    }
}

/**
 * Translate a single text segment.
 */
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
        return await callDeepSeekAPI(config, text, prompt);
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
            const translated = await callDeepSeekAPI(config, chunk, chunkPrompt);
            translatedChunks.push(translated);
        } catch (error) {
            // If chunk translation fails, include original with error marker
            translatedChunks.push(`[翻译失败: ${error}]`);
            throw error; // Re-throw to let caller handle
        }
    }

    return translatedChunks.join("\n\n");
}

/**
 * Translate text with streaming (for sidebar live display).
 */
export async function translateTextStreaming(
    config: TranslatorConfig,
    text: string,
    onChunk: (chunk: string) => void
): Promise<string> {
    if (!text.trim()) {
        return text;
    }

    const prompt = TRANSLATION_SYSTEM_PROMPT
        .replace("{source}", config.sourceLang === "auto" ? "auto-detected language" : config.sourceLang)
        .replace("{target}", config.targetLang);

    const url = `${config.apiBase}/chat/completions`;

    const body = {
        model: config.model,
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: text },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API error ${response.status}: ${(errorData as any).error?.message || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No response body");
        }

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

/**
 * Batch translate multiple text segments (e.g., paragraphs).
 * Returns a map of original -> translated.
 */
export async function batchTranslate(
    config: TranslatorConfig,
    texts: string[]
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toTranslate = texts.filter(t => t.trim());

    if (toTranslate.length === 0) {
        return result;
    }

    // For small batches, translate each individually
    if (toTranslate.length <= 3) {
        for (const text of toTranslate) {
            try {
                const translated = await translateText(config, text);
                result.set(text, translated);
            } catch {
                result.set(text, `[翻译失败] ${text}`);
            }
        }
        return result;
    }

    // For larger batches, combine into one API call with delimiters
    const delimiter = "\n---SEGMENT---\n";
    const combinedText = toTranslate.join(delimiter);

    const prompt = `You are a professional translator. Translate each segment below from {source} to {target}.
Rules:
1. Each segment is separated by "---SEGMENT---".
2. Return translations in the same order, separated by "---SEGMENT---".
3. Preserve markdown formatting, code, and links.
4. Output ONLY the translated segments with the same delimiter.

Text:`.replace("{source}", config.sourceLang === "auto" ? "auto-detected language" : config.sourceLang)
        .replace("{target}", config.targetLang);

    try {
        const response = await callDeepSeekAPI(config, combinedText, prompt);
        const translatedSegments = response.split("---SEGMENT---").map(s => s.trim());

        for (let i = 0; i < toTranslate.length; i++) {
            result.set(toTranslate[i], translatedSegments[i] || toTranslate[i]);
        }
    } catch {
        // Fallback: translate individually
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

/**
 * Language name mapping for display.
 */
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

/**
 * Get display name for a language code.
 */
export function getLanguageName(code: string): string {
    return LANGUAGE_NAMES[code] || code;
}
