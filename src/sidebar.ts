import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type { DeepSeekTranslatorPlugin } from "../main";
import { translateTextStreaming, getLanguageName, LANGUAGE_NAMES } from "./api";

export const SIDEBAR_VIEW_TYPE = "deepseek-translator-sidebar";

export class TranslatorSidebarView extends ItemView {
    plugin: DeepSeekTranslatorPlugin;
    private inputEl: HTMLTextAreaElement;
    private outputEl: HTMLDivElement;
    private sourceLangEl: HTMLSelectElement;
    private targetLangEl: HTMLSelectElement;
    private translateBtn: HTMLButtonElement;
    private loadingEl: HTMLDivElement;
    private isTranslating: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: DeepSeekTranslatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return SIDEBAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Multi Translator";
    }

    getIcon(): string {
        return "languages";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("translator-sidebar");

        // Header (fixed at top)
        const header = container.createDiv("translator-sidebar-header");
        header.createSpan({ text: "🌐 Multi Translator", cls: "translator-sidebar-title" });

        // Scrollable body
        const scrollBody = container.createDiv("translator-sidebar-scroll");

        // Language selectors
        const langRow = scrollBody.createDiv("translator-lang-row");

        const sourceGroup = langRow.createDiv("translator-lang-group");
        sourceGroup.createSpan({ text: "源语言" });
        this.sourceLangEl = sourceGroup.createEl("select", { cls: "translator-lang-select" });
        for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
            const option = this.sourceLangEl.createEl("option", { text: name });
            option.value = code;
            if (code === this.plugin.settings.sourceLang) {
                option.selected = true;
            }
        }

        const swapBtn = langRow.createEl("button", { cls: "translator-swap-btn" });
        swapBtn.setAttribute("aria-label", "交换语言");
        swapBtn.createSpan({ text: "⇄" });
        swapBtn.addEventListener("click", () => this.swapLanguages());

        const targetGroup = langRow.createDiv("translator-lang-group");
        targetGroup.createSpan({ text: "目标语言" });
        this.targetLangEl = targetGroup.createEl("select", { cls: "translator-lang-select" });
        for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
            if (code === "auto") continue;
            const option = this.targetLangEl.createEl("option", { text: name });
            option.value = code;
            if (code === this.plugin.settings.targetLang) {
                option.selected = true;
            }
        }

        // Input area
        const inputSection = scrollBody.createDiv("translator-input-section");
        inputSection.createSpan({ text: "输入文本", cls: "translator-section-label" });
        this.inputEl = inputSection.createEl("textarea", {
            cls: "translator-input",
            attr: { placeholder: "输入或粘贴要翻译的文本..." }
        });
        this.inputEl.addEventListener("input", () => this.autoResize());

        // Translate button
        const btnRow = scrollBody.createDiv("translator-btn-row");
        this.translateBtn = btnRow.createEl("button", {
            cls: "translator-translate-btn",
            text: "翻译"
        });
        this.translateBtn.addEventListener("click", () => this.doTranslate());

        const clearBtn = btnRow.createEl("button", {
            cls: "translator-clear-btn",
            text: "清空"
        });
        clearBtn.addEventListener("click", () => this.clearAll());

        // Loading indicator (hidden by default)
        this.loadingEl = scrollBody.createDiv("translator-loading is-hidden");
        this.loadingEl.createSpan({ text: "⏳ 翻译中..." });

        // Output area
        const outputSection = scrollBody.createDiv("translator-output-section");
        const outputHeader = outputSection.createDiv("translator-output-header");
        outputHeader.createSpan({ text: "翻译结果", cls: "translator-section-label" });

        const copyBtn = outputHeader.createEl("button", {
            cls: "translator-copy-btn",
            text: "复制"
        });
        copyBtn.addEventListener("click", () => this.copyOutput());

        this.outputEl = outputSection.createDiv("translator-output");

        // Keyboard shortcut
        this.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.doTranslate();
            }
        });
    }

    async onClose(): Promise<void> {
        // Cleanup
    }

    private async doTranslate(): Promise<void> {
        const text = this.inputEl.value.trim();
        if (!text) {
            new Notice("请输入要翻译的文本");
            return;
        }

        if (!this.plugin.settings.apiKey) {
            new Notice("❌ 请先在设置中配置 API Key");
            return;
        }

        if (this.isTranslating) return;

        this.isTranslating = true;
        this.translateBtn.disabled = true;
        this.translateBtn.setText("翻译中...");
        this.loadingEl.removeClass("is-hidden");
        this.outputEl.empty();

        const config = {
            ...this.plugin.getConfig(),
            sourceLang: this.sourceLangEl.value,
            targetLang: this.targetLangEl.value,
        };

        try {
            let fullText = "";
            await translateTextStreaming(config, text, (chunk) => {
                fullText += chunk;
                this.outputEl.setText(fullText);
                this.outputEl.scrollTop = this.outputEl.scrollHeight;
            });

            if (!fullText) {
                this.outputEl.setText("(翻译结果为空)");
            }
        } catch (error: any) {
            this.outputEl.createDiv({
                cls: "translator-error",
                text: `❌ ${error.message}`
            });
        } finally {
            this.isTranslating = false;
            this.translateBtn.disabled = false;
            this.translateBtn.setText("翻译");
            this.loadingEl.addClass("is-hidden");
        }
    }

    private swapLanguages(): void {
        const sourceVal = this.sourceLangEl.value;
        const targetVal = this.targetLangEl.value;

        if (sourceVal === "auto") {
            new Notice("自动检测语言不能作为目标语言");
            return;
        }

        this.sourceLangEl.value = targetVal;
        this.targetLangEl.value = sourceVal;
    }

    private clearAll(): void {
        this.inputEl.value = "";
        this.outputEl.empty();
        this.inputEl.setCssProps({ height: "auto" as string });
    }

    private async copyOutput(): Promise<void> {
        const text = this.outputEl.getText();
        if (!text) {
            new Notice("没有可复制的内容");
            return;
        }
        await navigator.clipboard.writeText(text);
        new Notice("已复制到剪贴板");
    }

    private autoResize(): void {
        this.inputEl.setCssProps({ height: "auto" as string });
        this.inputEl.setCssProps({ height: Math.min(this.inputEl.scrollHeight, 300) + "px" as string });
    }
}
