# Yuna V2 🎵

A powerful and modern Discord Music Bot built for high-performance audio streaming.

## ✨ Features
- High-quality music playback
- Advanced audio filters (Bassboost, Nightcore, Vaporwave, etc.)
- User playlists & liked songs system
- Economy & Premium features
- Interactive modern UI

## 🏗️ Architecture
The V2 codebase has been completely restructured for better maintainability and performance:
- `src/commands/` - Command modules organized by category
- `src/events/` - Event listeners for client, player, and node events
- `src/database/` - Better-SQLite3 implementation with repository pattern (`repositories/`)
- `src/structures/` - Core class extensions (YunaClient, etc.)
- `src/ui/` - Reusable UI components and embed builders
- `src/config/` - Configuration files

## 🛠️ Tech Stack
- **Discord.js v14**
- **Lavalink v4** (via **NodeLink**)
- **better-sqlite3** for lightning-fast database operations
- **discord-hybrid-sharding** for efficient resource management

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yuna
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Rename `.env.example` to `.env` and fill in your details:
   ```env
   TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## 📚 Commands
| Category | Description |
|----------|-------------|
| 🎵 Music | Play, skip, pause, resume, queue management |
| 🎛️ Filters | Bassboost, 8D, Nightcore, Vaporwave, Karaoke |
| 📁 Playlists | Create, manage, and play custom playlists |
| 💰 Economy | Coins, daily rewards, premium purchase |
| ⚙️ Config | Setup channels, DJ roles, language |

## 👨‍💻 Credits
Coded with ❤️ by **Nikhil**

## 📄 License
This project is proprietary. All rights reserved.