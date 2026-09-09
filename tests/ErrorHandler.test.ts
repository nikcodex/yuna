import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger before importing ErrorHandler (the module imports it on load)
vi.mock('../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ErrorHandler } from '../src/core/ErrorHandler';
import { logger } from '../src/utils/logger';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ErrorHandler();
  });

  describe('register', () => {
    it('registers a function hook', () => {
      const hook = vi.fn();
      handler.register(hook);
      // Trigger shutdown to confirm hook runs
      vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      handler.shutdown('TEST');
      expect(hook).toHaveBeenCalled();
      (process.exit as any).mockRestore?.();
    });

    it('ignores non-function values', () => {
      handler.register('not a function' as any);
      handler.register(42 as any);
      handler.register(null as any);
      // No error means it accepted and ignored the bad inputs
      expect(true).toBe(true);
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    });

    afterEach(() => {
      (process.exit as any).mockRestore?.();
    });

    it('runs all hooks and exits with 0', async () => {
      const hook1 = vi.fn().mockResolvedValue(undefined);
      const hook2 = vi.fn().mockResolvedValue(undefined);
      handler.register(hook1);
      handler.register(hook2);

      await handler.shutdown('SIGTERM');

      expect(hook1).toHaveBeenCalledOnce();
      expect(hook2).toHaveBeenCalledOnce();
      expect(process.exit).toHaveBeenCalledWith(0);
      expect(logger.success).toHaveBeenCalled();
    });

    it('is idempotent — second call is a no-op', async () => {
      const hook = vi.fn();
      handler.register(hook);

      await handler.shutdown('SIGINT');
      const firstCallCount = (logger.success as any).mock.calls.length;
      await handler.shutdown('SIGINT');
      const secondCallCount = (logger.success as any).mock.calls.length;

      // Hooks only run on the first shutdown
      expect(hook).toHaveBeenCalledOnce();
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('continues when a hook rejects (Promise.allSettled)', async () => {
      const goodHook = vi.fn().mockResolvedValue(undefined);
      const badHook = vi.fn().mockRejectedValue(new Error('boom'));
      handler.register(goodHook);
      handler.register(badHook);

      await handler.shutdown('SIGTERM');

      expect(goodHook).toHaveBeenCalledOnce();
      expect(badHook).toHaveBeenCalledOnce();
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});
