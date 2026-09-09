import { YunaClient } from '#core/YunaClient';
import { logger } from '#utils/logger';
import ErrorHandler from '#core/ErrorHandler';

const client = new YunaClient();

const main = async () => {
	try {
		await client.init();
		ErrorHandler.register(async () => {
			await client.destroy();
		});
		logger.success('Main', 'Discord bot initialized successfully');
	} catch (error: any) {
		logger.error('Main', 'Failed to initialize Discord bot', error);
		process.exit(1);
	}
};

main();

export default client;
