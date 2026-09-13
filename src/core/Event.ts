import { Client } from 'discord.js';

export interface EventOptions {
    name: string;
    type?: 'client' | 'player' | 'node' | 'voice';
    once?: boolean;
}

export class Event {
    public name: string;
    public type: 'client' | 'player' | 'node' | 'voice';
    public once: boolean;

    /**
     * Creates a new Event instance.
     * @param {EventOptions} options Event configuration options.
     */
    constructor(options: EventOptions = {} as EventOptions) {
        this.name = options.name;
        this.type = options.type || 'client';
        this.once = options.once || false;
    }

    /**
     * The logic to run when the event is emitted.
     * @param {Client | any} client The bot client instance.
     * @param {...any[]} args The arguments emitted by the event.
     */
    async execute(client: Client | any, ...args: any[]): Promise<any> {
        throw new Error(`Event ${this.name} doesn't provide an execute method!`);
    }
}

// Made by Nikhil Under CodeX Devs
