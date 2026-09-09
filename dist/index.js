import { YunaClient } from '#core/YunaClient';
import { logger } from '#utils/logger';
import ErrorHandler from '#core/ErrorHandler';
const client = new YunaClient();
const main = async () => {
    try {
        await client.init();
        // @ts-ignore
        ErrorHandler.register(client);
        logger.success('Main', 'Discord bot initialized successfully');
    }
    catch (error) {
        logger.error('Main', 'Failed to initialize Discord bot', error);
        process.exit(1);
    }
};
main();
export default client;
