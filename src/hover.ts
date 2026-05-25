import { Notice } from "obsidian";
import { EditorView, hoverTooltip, Tooltip } from "@codemirror/view";
import type { DeepSeekTranslatorPlugin } from "../main";
import { translateText } from "./api";

/**
 * Create a CodeMirror extension that shows translation on text selection hover.
 */
export function createHoverTranslationExtension(plugin: DeepSeekTranslatorPlugin) {
    // Track whether we're currently translating
    let translating = false;
    let lastSelection = "";
    let lastTranslation = "";

    return hoverTooltip((view, pos) => {
        if (!plugin.settings.enableHover) return null;
        if (!plugin.settings.apiKey) return null;

        const selection = view.state.selection.main;

        // Only show for non-empty selections
        if (selection.empty) return null;

        const selectedText = view.state.sliceDoc(selection.from, selection.to).trim();
        if (!selectedText || selectedText.length < 2) return null;
        if (selectedText.length > 5000) return null; // Don't translate very long selections

        // If same selection, show cached result
        if (selectedText === lastSelection && lastTranslation) {
            return {
                pos: selection.from,
                end: selection.to,
                above: true,
                create(view: EditorView) {
                    const dom = document.createElement("div");
                    dom.className = "translator-tooltip";
                    const header = dom.createDiv({ cls: "translator-tooltip-header" });
                    header.createSpan({ text: "🌐 翻译" });
                    const content = dom.createDiv({ cls: "translator-tooltip-content" });
                    content.createSpan({ text: lastTranslation });
                    return { dom };
                }
            };
        }

        // Prevent concurrent translation requests
        if (translating) return null;

        // Start async translation
        translating = true;
        lastSelection = selectedText;

        return {
            pos: selection.from,
            end: selection.to,
            above: true,
            create(view: EditorView) {
                const dom = document.createElement("div");
                dom.className = "translator-tooltip";

                const header = dom.createDiv({ cls: "translator-tooltip-header" });
                header.createSpan({ text: "🌐 翻译中..." });

                const content = dom.createDiv({ cls: "translator-tooltip-content" });
                content.createDiv({ cls: "translator-tooltip-spinner" });

                // Fire and forget translation
                const config = plugin.getConfig();
                translateText(config, selectedText)
                    .then(result => {
                        lastTranslation = result;
                        content.empty();
                        content.createSpan({ text: result });
                    })
                    .catch(error => {
                        content.empty();
                        content.createSpan({
                            cls: "translator-tooltip-error",
                            text: `翻译失败: ${error.message}`
                        });
                    })
                    .finally(() => {
                        translating = false;
                    });

                return { dom };
            }
        };
    }, {
        hoverTime: plugin.settings.hoverDelay,
    });
}
