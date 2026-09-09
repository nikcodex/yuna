import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { logger, pink, mint, red, gray, white, purple } from '#utils/logger';
import { Collection } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Client } from "discord.js";

export class CommandLoader {
  client: any;
  slashCommands: any;
  slashCommandFiles: any;
  commandPaths: any;
  failedCommands: any;

  constructor(client: Client) {
    this.client = client;
    this.client.commands = new Collection();
    this.client.aliases = new Map();
    this.client.categories = new Map();
    this.slashCommands = new Map();
    this.slashCommandFiles = new Map();
    this.commandPaths = new Map();
    this.failedCommands = [];
  }

  async load(dirPath: any = '../commands') {
    return this.loadCommands(dirPath);
  }

  async loadCommands(dirPath: any = '../commands') {
    this.client.commands.clear();
    this.client.aliases.clear();
    this.client.categories.clear();
    this.slashCommands.clear();
    this.slashCommandFiles.clear();
    this.commandPaths.clear();
    this.failedCommands = [];

    const commandsAbsolutePath = path.join(__dirname, dirPath);

    try {
      await this._recursivelyLoadCommands(commandsAbsolutePath);
      this._finalizeSlashCommands();

      // Print clean Pink Theme summary
      if (this.failedCommands.length === 0) {
        const catCount = this.client.categories.size;
        const cmdCount = this.client.commands.size;
        const slashCount = this.slashCommandFiles.size;
        console.log(
          `${logger.formatTime()} ${pink('🌸 [Commands]')} ${mint('✔ All ' + cmdCount + ' commands loaded successfully')} ${gray(`(${catCount} categories · ${slashCount} slash)`)}`
        );
      } else {
        console.log(
          `${logger.formatTime()} ${pink('🌸 [Commands]')} ${red(`✖ Failed to load ${this.failedCommands.length} command(s):`)}`
        );
        for (const failure of this.failedCommands) {
          console.log(`   ${red('└─')} ${white(failure.file)}: ${red(failure.error)}`);
        }
        console.log(
          `${logger.formatTime()} ${pink('🌸 [Commands]')} ${mint(`✔ ${this.client.commands.size} command(s) loaded successfully`)}`
        );
      }
    } catch (error) {
      logger.error('CommandLoader', 'Failed to load commands', error);
    }
  }

  async _recursivelyLoadCommands(dirPath: any, relativePath: any = '') {
    try {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      const loadPromises = entries.map(async (entry: any) => {
        const fullPath = path.join(dirPath, entry.name);
        const currentRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          await this._recursivelyLoadCommands(fullPath, currentRelativePath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          const category = relativePath ? relativePath.split(path.sep)[0] : 'default';
          if (!this.client.categories.has(category)) {
            this.client.categories.set(category, []);
          }
          await this._loadCommandFile(fullPath, category);
        }
      });

      await Promise.all(loadPromises);
    } catch (error) {
      logger.error('CommandLoader', `Failed to read directory: ${dirPath}`, error);
    }
  }

  async _loadCommandFile(filePath: any, category: any) {
    const relName = path.relative(process.cwd(), filePath);
    try {
      const commandModule = await import(`file://${filePath}?v=${Date.now()}`);
      if (!commandModule?.default) {
        this.failedCommands.push({ file: relName, error: 'Missing default export' });
        return;
      }

      const command = commandModule.default;
      command.category = category;

      this.commandPaths.set(command.name, filePath);
      this.client.commands.set(command.name, command);

      if (command.aliases?.length > 0) {
        command.aliases.forEach((alias: any) => this.client.aliases.set(alias, command.name));
      }

      const slashData = command.slash?.data || command.slashData;
      const slashEnabled = command.slash?.enabled ?? command.enabledSlash;
      if (slashEnabled && slashData) {
        const rawName = slashData.name;
        const slashName = Array.isArray(rawName) ? rawName[1] : (rawName || command.name);
        if (slashName) {
          this.slashCommandFiles.set(slashName.toString().toLowerCase(), command);
        }
      }

      this.client.categories.get(category)?.push(command);
    } catch (error) {
      this.failedCommands.push({ file: relName, error: (error as any).message || error });
    }
  }

  _finalizeSlashCommands() {
    for (const [slashName, command] of this.slashCommandFiles.entries()) {
      const slashData = command.slash?.data || command.slashData;
      if (!slashData) continue;

      const rawName = slashData.name;
      const finalName = Array.isArray(rawName) ? rawName[1] : (rawName || slashName);

      const dataJson = typeof slashData.toJSON === 'function' ? slashData.toJSON() : {
        name: finalName.toLowerCase(),
        description: slashData.description || command.description || `${finalName} command`,
        options: slashData.options || []
      };

      dataJson.name = finalName.toLowerCase();
      this.slashCommands.set(finalName.toLowerCase(), dataJson);
    }
  }

  getSlashCommandsData() {
    return Array.from(this.slashCommands.values());
  }

  getSlashData() {
    return this.getSlashCommandsData();
  }
}

export default CommandLoader;
