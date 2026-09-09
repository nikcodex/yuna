export class Event {
    name;
    type;
    once;
    /**
     * Creates a new Event instance.
     * @param {EventOptions} options Event configuration options.
     */
    constructor(options = {}) {
        this.name = options.name;
        this.type = options.type || 'client';
        this.once = options.once || false;
    }
    /**
     * The logic to run when the event is emitted.
     * @param {Client | any} client The bot client instance.
     * @param {...any[]} args The arguments emitted by the event.
     */
    async execute(client, ...args) {
        throw new Error(`Event ${this.name} doesn't provide an execute method!`);
    }
}
