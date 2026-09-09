import { Player, Track } from "lavalink-client";

export class QueueManager {
  public player: Player;
  constructor(player: Player) {
    this.player = player;
  }

  get tracks() { return this.player.queue.tracks; }
  get previous() { return this.player.queue.previous; }
  get current() { return this.player.queue.current; }
  get size() { return this.player.queue.tracks.length; }
  get isEmpty() { return this.size === 0 && !this.current; }

  async add(tracks: Track | Track[], position?: number) {
    const items = Array.isArray(tracks) ? tracks : [tracks];
    return this.player.queue.add(items, position);
  }

  async remove(position: number) {
    return this.player.queue.tracks.splice(position, 1);
  }

  async move(from: number, to: number) {
    const [track] = this.tracks.splice(from, 1);
    if (track) {
      this.tracks.splice(to, 0, track);
    }
  }

  async shuffle() {
    return this.player.queue.shuffle();
  }

  async clear() {
    const clearedCount = this.tracks.length;
    this.player.queue.tracks.splice(0, clearedCount);
    return clearedCount;
  }

  async bumpToTop(start: number, end: number = start) {
    const { tracks } = this.player.queue;
    if (tracks.length === 0) return { success: false, message: "The queue is empty." };
    
    const startIndex = start - 1;
    const endIndex = end - 1;
    
    if (startIndex >= tracks.length || endIndex >= tracks.length || startIndex < 0 || endIndex < 0) {
      return { success: false, message: "Position out of range." };
    }
    
    if (startIndex === 0 && endIndex < tracks.length - 1) {
      return { success: false, message: "Tracks are already at the top." };
    }
    
    const tracksToMove = tracks.slice(startIndex, endIndex + 1);
    for (let i = endIndex; i >= startIndex; i--) tracks.splice(i, 1);
    tracks.unshift(...tracksToMove);
    return { success: true, message: `Moved **${tracksToMove.length}** track(s) to top of queue.` };
  }
}
