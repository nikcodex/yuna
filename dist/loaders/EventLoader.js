import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, pink, mint, red, gray, white } from '#utils/logger';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class EventLoader {
    client;
    eventsPath;
    loadedEventsCount;
    emitterCounts;
    failedEvents;
    constructor(client) {
        this.client = client;
        this.eventsPath = path.join(__dirname, '../events');
        this.loadedEventsCount = 0;
        this.emitterCounts = { client: 0, player: 0, node: 0 };
        this.failedEvents = [];
    }
    async load() {
        return this.loadEvents();
    }
    async loadEvents() {
        this.loadedEventsCount = 0;
        this.emitterCounts = { client: 0, player: 0, node: 0 };
        this.failedEvents = [];
        try {
            if (!fs.existsSync(this.eventsPath)) {
                logger.warn('EventLoader', `Events directory not found: ${this.eventsPath}`);
                return;
            }
            const eventTypes = fs.readdirSync(this.eventsPath, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
            for (const eventType of eventTypes) {
                const emitter = this.getEmitter(eventType);
                if (!emitter)
                    continue;
                const typePath = path.join(this.eventsPath, eventType);
                await this.recursiveLoadEvents(typePath, emitter, eventType);
            }
            if (this.failedEvents.length === 0) {
                const countsStr = Object.entries(this.emitterCounts).filter((val) => val[1] > 0).map((val) => `${val[0]}: ${val[1]}`).join(' · ');
                console.log(`${logger.formatTime()} ${pink('🌸 [Events]')} ${mint(`✔ All ${this.loadedEventsCount} events loaded successfully`)} ${gray(`(${countsStr})`)}`);
            }
            else {
                console.log(`${logger.formatTime()} ${pink('🌸 [Events]')} ${red(`✖ Failed to load ${this.failedEvents.length} event(s):`)}`);
                for (const failure of this.failedEvents) {
                    console.log(`   ${red('└─')} ${white(failure.file)}: ${red(failure.error)}`);
                }
            }
        }
        catch (error) {
            logger.error('EventLoader', 'Failed to load events', error);
        }
    }
    getEmitter(type) {
        switch (type) {
            case 'discord':
            case 'client':
                return this.client;
            case 'player':
                return this.client.lavalink;
            case 'node':
                return this.client.lavalink?.nodeManager;
            default:
                return this.client;
        }
    }
    async recursiveLoadEvents(dirPath, emitter, rootType) {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await this.recursiveLoadEvents(fullPath, emitter, rootType);
                }
                else if (entry.isFile() && entry.name.endsWith('.ts')) {
                    await this.loadEventFile(fullPath, emitter, rootType);
                }
            }
        }
        catch (error) {
            logger.error('EventLoader', `Failed to read directory: ${dirPath}`, error);
        }
    }
    async loadEventFile(filePath, emitter, rootType) {
        const relName = path.relative(process.cwd(), filePath);
        try {
            const module = await import(`file://${filePath}?t=${Date.now()}`);
            if (!module?.default) {
                this.failedEvents.push({ file: relName, error: 'Missing default export' });
                return;
            }
            const event = module.default;
            const eventName = event.name || path.basename(filePath, '.ts');
            const once = event.once || false;
            const execute = async (...args) => {
                try {
                    await event.execute(...args, this.client);
                }
                catch (error) {
                    logger.error('EventLoader', `Error executing event ${eventName}:`, error);
                }
            };
            if (emitter) {
                if (once) {
                    emitter.once(eventName, execute);
                }
                else {
                    emitter.on(eventName, execute);
                }
            }
            this.loadedEventsCount++;
            const categoryKey = rootType === 'discord' ? 'client' : rootType;
            this.emitterCounts[categoryKey] = (this.emitterCounts[categoryKey] || 0) + 1;
        }
        catch (error) {
            this.failedEvents.push({ file: relName, error: error.message || error });
        }
    }
}
export default EventLoader;
