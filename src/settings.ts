import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import type { DeepSeekTranslatorPlugin } from "../main";
import { DEFAULT_CONFIG, LANGUAGE_NAMES, getLanguageName } from "./api";

export interface PluginSettings {
    apiKey: string;
    model: string;
    apiBase: string;
    sourceLang: string;
    targetLang: string;
    temperature: number;
    maxTokens: number;
    enableHover: boolean;
    hoverDelay: number;
    enableFullDocReplace: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    apiKey: "",
    model: "deepseek-chat",
    apiBase: "https://api.deepseek.com",
    sourceLang: "auto",
    targetLang: "zh",
    temperature: 0.3,
    maxTokens: 4096,
    enableHover: true,
    hoverDelay: 800,
    enableFullDocReplace: false,
};

const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_NAMES);

export class TranslatorSettingTab extends PluginSettingTab {
    plugin: DeepSeekTranslatorPlugin;

    constructor(app: App, plugin: DeepSeekTranslatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "DeepSeek Translator 设置" });

        // === API Settings ===
        containerEl.createEl("h3", { text: "🔑 API 设置" });

        new Setting(containerEl)
            .setName("API Key")
            .setDesc("你的 DeepSeek API Key。前往 https://platform.deepseek.com/api_keys 获取")
            .addText(text => text
                .setPlaceholder("sk-...")
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value.trim();
                    await this.plugin.saveSettings();
                })
                .inputEl.type = "password"
            );

        new Setting(containerEl)
            .setName("API 地址")
            .setDesc("DeepSeek API 的基础地址（默认无需修改）")
            .addText(text => text
                .setPlaceholder(DEFAULT_CONFIG.apiBase)
                .setValue(this.plugin.settings.apiBase)
                .onChange(async (value) => {
                    this.plugin.settings.apiBase = value.trim() || DEFAULT_CONFIG.apiBase;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("模型")
            .setDesc("选择翻译使用的 DeepSeek 模型")
            .addDropdown(dropdown => dropdown
                .addOption("deepseek-chat", "DeepSeek Chat (推荐)")
                .addOption("deepseek-reasoner", "DeepSeek Reasoner (推理增强)")
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                })
            );

        // === Test Connection ===
        new Setting(containerEl)
            .setName("测试连接")
            .setDesc("发送一条简短的测试翻译请求来验证 API Key 是否有效")
            .addButton(button => button
                .setButtonText("测试")
                .setCta()
                .onClick(async () => {
                    if (!this.plugin.settings.apiKey) {
                        new Notice("❌ 请先填写 API Key");
                        return;
                    }
                    button.setButtonText("测试中...");
                    button.setDisabled(true);
                    try {
                        const { translateText } = await import("./api");
                        const config = this.plugin.getConfig();
                        const result = await translateText(config, "Hello, this is a test message.");
                        new Notice(`✅ 连接成功！翻译结果: ${result}`);
                    } catch (error: any) {
                        new Notice(`❌ 连接失败: ${error.message}`);
                    }
                    button.setButtonText("测试");
                    button.setDisabled(false);
                })
            );

        // === Translation Settings ===
        containerEl.createEl("h3", { text: "🌐 翻译设置" });

        const sourceSetting = new Setting(containerEl)
            .setName("源语言")
            .setDesc("翻译的源语言（或选择自动检测）");

        sourceSetting.addDropdown(dropdown => {
            for (const [code, name] of LANGUAGE_OPTIONS) {
                dropdown.addOption(code, name);
            }
            return dropdown
                .setValue(this.plugin.settings.sourceLang)
                .onChange(async (value) => {
                    this.plugin.settings.sourceLang = value;
                    await this.plugin.saveSettings();
                });
        });

        const targetSetting = new Setting(containerEl)
            .setName("目标语言")
            .setDesc("翻译的目标语言");

        targetSetting.addDropdown(dropdown => {
            for (const [code, name] of LANGUAGE_OPTIONS) {
                if (code !== "auto") {
                    dropdown.addOption(code, name);
                }
            }
            return dropdown
                .setValue(this.plugin.settings.targetLang)
                .onChange(async (value) => {
                    this.plugin.settings.targetLang = value;
                    await this.plugin.saveSettings();
                });
        });

        new Setting(containerEl)
            .setName("温度")
            .setDesc("翻译的创造性程度。越低越忠实原文，越高越灵活（推荐 0.1-0.5）")
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.temperature)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.temperature = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("最大 Token 数")
            .setDesc("单次翻译的最大输出 Token 数")
            .addText(text => text
                .setValue(String(this.plugin.settings.maxTokens))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxTokens = num;
                        await this.plugin.saveSettings();
                    }
                })
                .inputEl.type = "number"
            );

        // === UI Settings ===
        containerEl.createEl("h3", { text: "🖱️ 交互设置" });

        new Setting(containerEl)
            .setName("启用悬停翻译")
            .setDesc("选中文本后自动显示翻译浮窗")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHover)
                .onChange(async (value) => {
                    this.plugin.settings.enableHover = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("悬停延迟 (毫秒)")
            .setDesc("选中文本后等待多久显示翻译浮窗（毫秒）")
            .addText(text => text
                .setValue(String(this.plugin.settings.hoverDelay))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 200) {
                        this.plugin.settings.hoverDelay = num;
                        await this.plugin.saveSettings();
                    }
                })
                .inputEl.type = "number"
            );

        new Setting(containerEl)
            .setName("全文翻译默认替换原文")
            .setDesc("启用后，全文翻译将直接替换当前文档内容（而非创建新文件）")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFullDocReplace)
                .onChange(async (value) => {
                    this.plugin.settings.enableFullDocReplace = value;
                    await this.plugin.saveSettings();
                })
            );

        // === Footer ===
        containerEl.createEl("div", {
            cls: "translator-settings-footer",
            text: "💡 提示: 你可以使用快捷键 Ctrl+Shift+T (Mac: Cmd+Shift+T) 快速翻译选中文本",
        });
    }
}
