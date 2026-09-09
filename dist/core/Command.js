export class Command {
    name;
    description;
    usage;
    aliases;
    category;
    cooldown;
    examples;
    maintenance;
    access;
    slash;
    enabledSlash;
    slashData;
    ownerOnly;
    voiceRequired;
    sameVoiceRequired;
    playerRequired;
    playingRequired;
    /**
     * Creates a new Command instance.
     * @param {CommandOptions} options Command configuration options.
     */
    constructor(options = {}) {
        this.name = options.name;
        this.description = options.description || 'No description provided';
        this.usage = options.usage || this.name;
        this.aliases = options.aliases || [];
        this.category = options.category || 'Miscellaneous';
        this.cooldown = options.cooldown || 3;
        this.examples = options.examples || [];
        this.maintenance = options.maintenance || false;
        // Clean access object
        this.access = {
            ownerOnly: options.access?.ownerOnly ?? options.ownerOnly ?? false,
            permissions: options.access?.permissions || options.userPermissions || options.permissions || [],
            botPermissions: options.access?.botPermissions || options.botPermissions || [],
            premium: options.access?.premium ?? (options.userPrem ? 'user' : options.guildPrem ? 'guild' : options.anyPrem ? 'any' : false),
            voice: options.access?.voice ?? options.voiceRequired ?? false,
            sameVoice: options.access?.sameVoice ?? options.sameVoiceRequired ?? false,
            player: options.access?.player ?? options.playerRequired ?? false,
            playing: options.access?.playing ?? options.playingRequired ?? false
        };
        // Slash configuration
        this.slash = {
            enabled: options.slash?.enabled ?? options.enabledSlash ?? false,
            data: options.slash?.data || options.slashData || null,
            autoDefer: options.slash?.autoDefer ?? true
        };
        this.enabledSlash = this.slash.enabled;
        this.slashData = this.slash.data;
        this.ownerOnly = this.access.ownerOnly;
        this.voiceRequired = this.access.voice;
        this.sameVoiceRequired = this.access.sameVoice;
        this.playerRequired = this.access.player;
        this.playingRequired = this.access.playing;
    }
    /**
     * Lifecycle hook called before execution.
     * @param {CommandContext} ctx The execution context object.
     * @returns {Promise<boolean>} Whether execution should proceed.
     */
    async beforeExecute(ctx) {
        return true;
    }
    /**
     * The main execution logic of the command.
     * @param {CommandContext} ctx The execution context object `{ client, interaction, message, args, player, pm, guild, user, member, channel }`.
     */
    async execute(ctx) {
        throw new Error(`Command ${this.name} doesn't provide an execute method!`);
    }
    /**
     * Lifecycle hook called after successful execution.
     * @param {CommandContext} ctx The execution context object.
     */
    async afterExecute(ctx) { }
    /**
     * Lifecycle hook called when an error occurs during execution.
     * @param {CommandContext} ctx The execution context object.
     * @param {Error} error The error thrown.
     */
    async onError(ctx, error) {
        console.error(`[Command Error - ${this.name}]`, error);
    }
}
