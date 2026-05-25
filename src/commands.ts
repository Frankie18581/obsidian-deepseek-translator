import { Editor, Notice, MarkdownView, TFile, Modal, App } from "obsidian";
import type { DeepSeekTranslatorPlugin } from "../main";
import { translateText, batchTranslate, getLanguageName } from "./api";

/**
 * Translate selected text and show in a notice/modal.
 */
export async function translateSelection(plugin: DeepSeekTranslatorPlugin, editor: Editor): Promise<void> {
    const selection = editor.getSelection();
    if (!selection) {
        new Notice("请先选中要翻译的文本");
        return;
    }

    if (!plugin.settings.apiKey) {
        new Notice("❌ 请先在设置中配置 DeepSeek API Key");
        return;
    }

    const config = plugin.getConfig();
    const trimmed = selection.trim();

    // Show progress
    const notice = new Notice("🌐 翻译中...", 0);

    try {
        const result = await translateText(config, trimmed);
        notice.hide();

        // Show result in a modal
        new TranslationResultModal(plugin.app, trimmed, result, config.sourceLang, config.targetLang).open();
    } catch (error: any) {
        notice.hide();
        new Notice(`❌ 翻译失败: ${error.message}`, 5000);
    }
}

/**
 * Translate the full document with options.
 */
export async function translateFullDocument(plugin: DeepSeekTranslatorPlugin, editor: Editor): Promise<void> {
    const content = editor.getValue();
    if (!content.trim()) {
        new Notice("文档为空，无法翻译");
        return;
    }

    if (!plugin.settings.apiKey) {
        new Notice("❌ 请先在设置中配置 DeepSeek API Key");
        return;
    }

    // Show mode selection modal
    new FullDocTranslateModal(plugin, editor, content).open();
}

/**
 * Translate the full document inline (replace content).
 */
async function translateFullDocReplace(plugin: DeepSeekTranslatorPlugin, editor: Editor, content: string): Promise<void> {
    const config = plugin.getConfig();
    const notice = new Notice("🌐 正在翻译全文...", 0);

    try {
        // Split into paragraphs for better handling
        const paragraphs = content.split(/\n\n+/);
        const nonEmptyParagraphs = paragraphs.filter(p => p.trim());

        if (nonEmptyParagraphs.length <= 5) {
            // For short documents, translate as a whole
            const result = await translateText(config, content);
            editor.setValue(result);
            notice.hide();
            new Notice("✅ 全文翻译完成");
        } else {
            // For longer documents, translate paragraph by paragraph
            const translatedMap = await batchTranslate(config, nonEmptyParagraphs);
            const result = paragraphs.map(p => {
                if (!p.trim()) return p;
                return translatedMap.get(p) || p;
            }).join("\n\n");
            editor.setValue(result);
            notice.hide();
            new Notice("✅ 全文翻译完成");
        }
    } catch (error: any) {
        notice.hide();
        new Notice(`❌ 翻译失败: ${error.message}`, 5000);
    }
}

/**
 * Translate the full document and save as a new file.
 */
async function translateFullDocNewFile(
    plugin: DeepSeekTranslatorPlugin,
    editor: Editor,
    content: string,
    currentFile: TFile | null
): Promise<void> {
    const config = plugin.getConfig();
    const targetLang = config.targetLang;
    const notice = new Notice("🌐 正在翻译全文并创建新文件...", 0);

    try {
        const paragraphs = content.split(/\n\n+/);
        const nonEmptyParagraphs = paragraphs.filter(p => p.trim());

        let result: string;
        if (nonEmptyParagraphs.length <= 5) {
            result = await translateText(config, content);
        } else {
            const translatedMap = await batchTranslate(config, nonEmptyParagraphs);
            result = paragraphs.map(p => {
                if (!p.trim()) return p;
                return translatedMap.get(p) || p;
            }).join("\n\n");
        }

        notice.hide();

        // Create new file with language suffix
        let baseName = "translated";
        let folderPath = "/";

        if (currentFile) {
            baseName = currentFile.basename;
            folderPath = currentFile.parent?.path || "/";
        }

        const langName = getLanguageName(targetLang);
        const newFileName = `${baseName} (${langName}).md`;
        const newFilePath = `${folderPath}/${newFileName}`;

        // Check for existing file and add number suffix
        const fileExists = plugin.app.vault.getAbstractFileByPath(newFilePath);
        let finalPath = newFilePath;
        if (fileExists) {
            let counter = 1;
            while (plugin.app.vault.getAbstractFileByPath(`${folderPath}/${baseName} (${langName}) ${counter}.md`)) {
                counter++;
            }
            finalPath = `${folderPath}/${baseName} (${langName}) ${counter}.md`;
        }

        await plugin.app.vault.create(finalPath, result);
        new Notice(`✅ 翻译完成，已保存为: ${finalPath.split("/").pop()}`);

        // Open the new file
        const newFile = plugin.app.vault.getAbstractFileByPath(finalPath);
        if (newFile instanceof TFile) {
            await plugin.app.workspace.getLeaf().openFile(newFile);
        }
    } catch (error: any) {
        notice.hide();
        new Notice(`❌ 翻译失败: ${error.message}`, 5000);
    }
}

/**
 * Modal for showing translation result of selection.
 */
class TranslationResultModal extends Modal {
    private original: string;
    private translated: string;
    private sourceLang: string;
    private targetLang: string;

    constructor(app: App, original: string, translated: string, sourceLang: string, targetLang: string) {
        super(app);
        this.original = original;
        this.translated = translated;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("translator-modal");

        // Title
        const title = contentEl.createDiv({ cls: "translator-modal-title" });
        const srcName = getLanguageName(this.sourceLang === "auto" ? "自动检测" : this.sourceLang);
        const tgtName = getLanguageName(this.targetLang);
        title.createSpan({ text: `🌐 翻译结果` });
        title.createSpan({
            cls: "translator-modal-lang",
            text: `${this.sourceLang === "auto" ? srcName : srcName} → ${tgtName}`
        });

        // Original text
        contentEl.createDiv({ cls: "translator-modal-section-label", text: "📝 原文" });
        const originalEl = contentEl.createDiv({ cls: "translator-modal-text", text: this.original });

        // Divider
        contentEl.createEl("hr", { cls: "translator-modal-divider" });

        // Translated text
        contentEl.createDiv({ cls: "translator-modal-section-label", text: "✨ 译文" });
        const translatedEl = contentEl.createDiv({
            cls: "translator-modal-text translator-modal-translated",
            text: this.translated
        });

        // Action buttons
        const btnRow = contentEl.createDiv({ cls: "translator-modal-buttons" });

        const copyBtn = btnRow.createEl("button", { text: "📋 复制译文" });
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(this.translated);
            new Notice("已复制到剪贴板");
        });

        const replaceBtn = btnRow.createEl("button", {
            text: "✏️ 替换原文",
            cls: "translator-modal-replace-btn"
        });
        replaceBtn.addEventListener("click", () => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                editor.replaceSelection(this.translated);
                new Notice("已替换原文");
                this.close();
            }
        });

        const closeBtn = btnRow.createEl("button", { text: "关闭" });
        closeBtn.addEventListener("click", () => this.close());
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for choosing full document translation mode.
 */
class FullDocTranslateModal extends Modal {
    private plugin: DeepSeekTranslatorPlugin;
    private editor: Editor;
    private content: string;

    constructor(plugin: DeepSeekTranslatorPlugin, editor: Editor, content: string) {
        super(plugin.app);
        this.plugin = plugin;
        this.editor = editor;
        this.content = content;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("translator-fdl-modal");

        contentEl.createEl("h2", { text: "📄 全文翻译" });

        const srcName = getLanguageName(this.plugin.settings.sourceLang);
        const tgtName = getLanguageName(this.plugin.settings.targetLang);
        contentEl.createEl("p", {
            cls: "translator-fdl-info",
            text: `源语言: ${srcName} → 目标语言: ${tgtName}`
        });

        contentEl.createEl("p", {
            cls: "translator-fdl-warning",
            text: `⚠️ 将翻译约 ${this.content.length} 个字符的内容，可能需要一些时间。`
        });

        const btnRow = contentEl.createDiv({ cls: "translator-fdl-buttons" });

        // Replace mode
        const replaceBtn = btnRow.createEl("button", {
            text: "📝 替换原文",
            cls: "translator-fdl-replace-btn"
        });
        replaceBtn.addEventListener("click", async () => {
            this.close();
            await translateFullDocReplace(this.plugin, this.editor, this.content);
        });

        // New file mode
        const newFileBtn = btnRow.createEl("button", {
            text: "📄 创建新文件",
            cls: "translator-fdl-newfile-btn"
        });
        newFileBtn.addEventListener("click", async () => {
            this.close();
            const activeFile = this.plugin.app.workspace.getActiveFile();
            await translateFullDocNewFile(this.plugin, this.editor, this.content, activeFile);
        });

        // Cancel
        const cancelBtn = btnRow.createEl("button", { text: "取消" });
        cancelBtn.addEventListener("click", () => this.close());
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Register all translation commands.
 */
export function registerCommands(plugin: DeepSeekTranslatorPlugin): void {
    plugin.addCommand({
        id: "translate-selection",
        name: "翻译选中文本",
        icon: "languages",
        editorCallback: (editor: Editor) => translateSelection(plugin, editor),
    });

    plugin.addCommand({
        id: "translate-full-document",
        name: "翻译全文",
        icon: "book-open",
        editorCallback: (editor: Editor) => translateFullDocument(plugin, editor),
    });

    plugin.addCommand({
        id: "translate-full-doc-replace",
        name: "翻译全文（直接替换）",
        icon: "pencil",
        editorCallback: async (editor: Editor) => {
            const content = editor.getValue();
            if (!content.trim()) {
                new Notice("文档为空，无法翻译");
                return;
            }
            if (!plugin.settings.apiKey) {
                new Notice("❌ 请先在设置中配置 DeepSeek API Key");
                return;
            }
            await translateFullDocReplace(plugin, editor, content);
        },
    });

    plugin.addCommand({
        id: "translate-full-doc-new-file",
        name: "翻译全文（创建新文件）",
        icon: "file-plus",
        editorCallback: async (editor: Editor) => {
            const content = editor.getValue();
            if (!content.trim()) {
                new Notice("文档为空，无法翻译");
                return;
            }
            if (!plugin.settings.apiKey) {
                new Notice("❌ 请先在设置中配置 DeepSeek API Key");
                return;
            }
            const activeFile = plugin.app.workspace.getActiveFile();
            await translateFullDocNewFile(plugin, editor, content, activeFile);
        },
    });

    // Open sidebar command
    plugin.addCommand({
        id: "open-translator-sidebar",
        name: "打开翻译侧边栏",
        icon: "panel-right",
        callback: async () => {
            const { SIDEBAR_VIEW_TYPE } = await import("./sidebar");
            const existing = plugin.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
            if (existing.length > 0) {
                plugin.app.workspace.revealLeaf(existing[0]);
            } else {
                await plugin.app.workspace.getRightLeaf(false)?.setViewState({
                    type: SIDEBAR_VIEW_TYPE,
                    active: true,
                });
                plugin.app.workspace.revealLeaf(
                    plugin.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0]
                );
            }
        },
    });
}
