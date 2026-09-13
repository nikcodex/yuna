/**
 * Type augmentations for lavalink-client.
 *
 * The library declares `TrackRequester` as an empty interface, but in practice
 * every Discord-sourced track carries the requesting user object (id, username,
 * discriminator, avatar, bot flag, etc.). Augmenting it here lets the codebase
 * access `track.requester.id` without scattering `@ts-ignore` comments.
 */
import "lavalink-client";

declare module "lavalink-client" {
  interface TrackRequester {
    id: string;
    username?: string;
    globalName?: string | null;
    discriminator?: string;
    avatar?: string | null;
    bot?: boolean;
  }
}

// Made by Nikhil Under CodeX Devs
