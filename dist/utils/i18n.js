import fs from "fs";
import path from "path";
// @ts-ignore
import { logger } from "./logger";
class I18nManager {
    locales = new Map();
    defaultLocale = "en-US";
    constructor() { }
    async init() {
        try {
            const localesPath = path.join(__dirname, "..", "locales");
            const files = fs.readdirSync(localesPath).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
            for (const file of files) {
                const localeCode = file.replace(/\.(ts|js)$/, "");
                const filePath = path.join(localesPath, file);
                // Dynamic import
                const localeModule = await import(filePath);
                this.locales.set(localeCode, localeModule.default);
            }
            logger.info("i18n", `Loaded ${this.locales.size} languages: ${Array.from(this.locales.keys()).join(", ")}`);
        }
        catch (error) {
            logger.error("i18n", "Failed to load locales", error);
        }
    }
    getLocales() {
        return this.locales;
    }
    getLocaleMeta(locale) {
        return this.locales.get(locale)?.meta || null;
    }
    t(locale, category, replacements = {}) {
        const targetLocale = locale || this.defaultLocale;
        let localeData = this.locales.get(targetLocale);
        // Fallback to en-US if language not found
        if (!localeData) {
            localeData = this.locales.get(this.defaultLocale);
        }
        let list = localeData?.phrases?.[category];
        // Fallback to en-US if phrase not found in target language
        if (!list || list.length === 0) {
            list = this.locales.get(this.defaultLocale)?.phrases?.[category];
        }
        // Fallback to generic error if phrase totally doesn't exist
        if (!list || list.length === 0) {
            list = this.locales.get(this.defaultLocale)?.phrases?.["errorGeneric"];
        }
        if (!list || list.length === 0)
            return "An error occurred.";
        let template = list[Math.floor(Math.random() * list.length)];
        for (const [key, value] of Object.entries(replacements)) {
            template = template.replace(new RegExp(`\\$\\{${key}\\}`, "g"), String(value));
        }
        return template;
    }
}
export const i18n = new I18nManager();
