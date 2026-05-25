import { Plugin, MarkdownView } from "obsidian";
import { TranslatorSettingTab, PluginSettings, DEFAULT_SETTINGS } from "./src/settings";
import { TranslatorSidebarView, SIDEBAR_VIEW_TYPE } from "./src/sidebar";
import { createHoverTranslationExtension } from "./src/hover";
import { registerCommands } from "./src/commands";
import { TranslatorConfig, DEFAULT_CONFIG } from "./src/api";

export class DeepSeekTranslatorPlugin extends Plugin {
    settings: PluginSettings;

    async onload(): Promise<void> {
        console.log("🌐 DeepSeek Translator: loading plugin");

        await this.loadSettings();

        // Register settings tab
        this.addSettingTab(new TranslatorSettingTab(this.app, this));

        // Register sidebar view
        this.registerView(
            SIDEBAR_VIEW_TYPE,
            (leaf) => new TranslatorSidebarView(leaf, this)
        );

        // Register CodeMirror extensions for hover translation
        this.registerEditorExtension([
            createHoverTranslationExtension(this),
        ]);

        // Register commands
        registerCommands(this);

        // Ribbon icon to open sidebar
        this.addRibbonIcon("languages", "DeepSeek Translator", () => {
            this.activateSidebar();
        });

        // Right-click menu on editor
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu, editor, view) => {
                const selection = editor.getSelection();
                if (selection) {
                    menu.addItem((item) => {
                        item
                            .setTitle("🌐 翻译选中文本")
                            .setIcon("languages")
                            .onClick(async () => {
                                const { translateSelection } = await import("./src/commands");
                                await translateSelection(this, editor);
                            });
                    });
                }

                menu.addItem((item) => {
                    item
                        .setTitle("📄 翻译全文")
                        .setIcon("book-open")
                        .onClick(async () => {
                            const { translateFullDocument } = await import("./src/commands");
                            await translateFullDocument(this, editor);
                        });
                });
            })
        );

        console.log("🌐 DeepSeek Translator: plugin loaded");
    }

    onunload(): void {
        console.log("🌐 DeepSeek Translator: unloading plugin");
        this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /**
     * Get the translator config from current settings.
     */
    getConfig(): TranslatorConfig {
        return {
            apiKey: this.settings.apiKey,
            model: this.settings.model,
            apiBase: this.settings.apiBase,
            sourceLang: this.settings.sourceLang,
            targetLang: this.settings.targetLang,
            temperature: this.settings.temperature,
            maxTokens: this.settings.maxTokens,
        };
    }

    /**
     * Activate or open the sidebar translation view.
     */
    async activateSidebar(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
        if (existing.length > 0) {
            this.app.workspace.revealLeaf(existing[0]);
        } else {
            const leaf = this.app.workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: SIDEBAR_VIEW_TYPE,
                    active: true,
                });
                this.app.workspace.revealLeaf(
                    this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0]
                );
            }
        }
    }
}

module.exports = DeepSeekTranslatorPlugin;
