import { logger } from '#utils/logger';
class ErrorHandler {
    hooks;
    isShuttingDown;
    constructor() {
        this.hooks = [];
        this.isShuttingDown = false;
        // Initialize global listeners
        process.on('uncaughtException', (error) => {
            logger.error('UncaughtException', 'A critical error occurred', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('UnhandledRejection', 'Unhandled promise rejection', reason);
        });
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }
    /**
     * Register a function to run during shutdown.
     * @param {Function} hook Cleanup function returning a Promise or void.
     */
    register(hook) {
        if (typeof hook === 'function') {
            this.hooks.push(hook);
        }
    }
    /**
     * Initiates the graceful shutdown process.
     * @param {string} signal The signal triggering the shutdown.
     */
    async shutdown(signal) {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        logger.info('ErrorHandler', `Received ${signal}, initiating graceful shutdown...`);
        // 5-second hard deadline
        const deadline = new Promise(resolve => {
            setTimeout(() => {
                logger.warn('ErrorHandler', 'Shutdown deadline reached. Forcing exit.');
                resolve('TIMEOUT');
            }, 5000);
        });
        const cleanup = Promise.allSettled(this.hooks.map(hook => hook()));
        await Promise.race([cleanup, deadline]);
        logger.success('ErrorHandler', 'Shutdown complete. Goodbye!');
        process.exit(0);
    }
}
export const errorHandler = new ErrorHandler();
export { ErrorHandler };
export default errorHandler;
