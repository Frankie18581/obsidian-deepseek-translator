import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import type { DeepSeekTranslatorPlugin } from "../main";
import {
    DEFAULT_CONFIG,
    LANGUAGE_NAMES,
    getLanguageName,
    ProviderType,
    PROVIDER_PRESETS,
    PROVIDER_OPTIONS,
} from "./api";

export interface PluginSettings {
    apiKey: string;
    model: string;
    apiBase: string;
    provider: ProviderType;
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
    provider: "deepseek",
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

        containerEl.createEl("h2", { text: "🌐 多模型翻译 设置" });

        // === Provider & API Settings ===
        containerEl.createEl("h3", { text: "🔌 服务商设置" });

        // Provider selector
        new Setting(containerEl)
            .setName("服务商 (Provider)")
            .setDesc("选择翻译使用的 AI 服务商")
            .addDropdown(dropdown => {
                for (const opt of PROVIDER_OPTIONS) {
                    dropdown.addOption(opt.value, opt.label);
                }
                return dropdown
                    .setValue(this.plugin.settings.provider)
                    .onChange(async (value) => {
                        const newProvider = value as ProviderType;
                        const preset = PROVIDER_PRESETS[newProvider];

                        this.plugin.settings.provider = newProvider;

                        // Auto-update API base and model when switching providers
                        if (newProvider !== 'custom') {
                            this.plugin.settings.apiBase = preset.apiBase;
                            this.plugin.settings.model = preset.defaultModel;
                        }

                        await this.plugin.saveSettings();
                        // Refresh settings UI to show updated values
                        this.display();
                    });
            });

        // Model selector (dynamic based on provider)
        this.addModelSetting(containerEl);

        // API Base (advanced)
        new Setting(containerEl)
            .setName("API 地址")
            .setDesc("API 基础地址（切换服务商时自动更新，一般无需手动修改）")
            .addText(text => text
                .setPlaceholder(DEFAULT_CONFIG.apiBase)
                .setValue(this.plugin.settings.apiBase)
                .onChange(async (value) => {
                    this.plugin.settings.apiBase = value.trim() || DEFAULT_CONFIG.apiBase;
                    await this.plugin.saveSettings();
                })
            );

        // API Key (with dynamic hint based on provider)
        new Setting(containerEl)
            .setName("API Key")
            .setDesc(this.getApiKeyHint())
            .addText(text => text
                .setPlaceholder(this.getApiKeyPlaceholder())
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value.trim();
                    await this.plugin.saveSettings();
                })
                .inputEl.type = "password"
            );

        // === Test Connection ===
        new Setting(containerEl)
            .setName("测试连接")
            .setDesc(`向 ${this.getProviderDisplayName()} 发送测试翻译请求，验证 API Key 是否有效`)
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

    // ---- Helpers ----

    private addModelSetting(containerEl: HTMLElement): void {
        const preset = PROVIDER_PRESETS[this.plugin.settings.provider];
        const hasPresetModels = preset.models.length > 0;

        const setting = new Setting(containerEl)
            .setName("模型")
            .setDesc(this.getModelDescription());

        if (hasPresetModels) {
            setting.addDropdown(dropdown => {
                for (const model of preset.models) {
                    dropdown.addOption(model, model);
                }
                // Ensure current model is in the list
                const currentModel = this.plugin.settings.model;
                if (!preset.models.includes(currentModel)) {
                    dropdown.addOption(currentModel, `${currentModel} (自定义)`);
                }
                return dropdown
                    .setValue(currentModel)
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    });
            });
        } else {
            // Custom provider: free-text input
            setting.addText(text => text
                .setPlaceholder("输入模型名称，如 gpt-4o-mini")
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value.trim();
                    await this.plugin.saveSettings();
                })
            );
        }
    }

    private getApiKeyHint(): string {
        const hints: Record<ProviderType, string> = {
            deepseek: "前往 https://platform.deepseek.com/api_keys 获取",
            openai: "前往 https://platform.openai.com/api-keys 获取",
            openrouter: "前往 https://openrouter.ai/keys 获取",
            google: "前往 https://aistudio.google.com/apikey 获取",
            claude: "前往 https://console.anthropic.com/ 获取",
            grok: "前往 https://console.x.ai/ 获取",
            kimi: "前往 https://platform.moonshot.cn/ 获取",
            qwen: "前往 https://bailian.console.aliyun.com/ 获取",
            custom: "输入你的 API Key",
        };
        return hints[this.plugin.settings.provider] || "输入你的 API Key";
    }

    private getApiKeyPlaceholder(): string {
        const placeholders: Partial<Record<ProviderType, string>> = {
            deepseek: "sk-...",
            openai: "sk-...",
            openrouter: "sk-or-...",
            google: "AIza...",
            claude: "sk-ant-...",
            grok: "xai-...",
            kimi: "sk-...",
            qwen: "sk-...",
        };
        return placeholders[this.plugin.settings.provider] || "输入 API Key...";
    }

    private getModelDescription(): string {
        const preset = PROVIDER_PRESETS[this.plugin.settings.provider];
        if (preset.models.length > 0) {
            return `选择 ${preset.name} 的翻译模型`;
        }
        return `输入模型名称（${preset.name} 的自定义模型）`;
    }

    private getProviderDisplayName(): string {
        return PROVIDER_PRESETS[this.plugin.settings.provider].name;
    }
}
