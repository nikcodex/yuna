import { ClusterManager, HeartbeatManager } from 'discord-hybrid-sharding';
import { config } from '#config/config';
import { logger } from '#utils/logger';

const manager = new ClusterManager('./src/index.ts', {
	totalShards: 'auto',
	shardsPerClusters: 2,
	mode: 'process',
	execArgv: ['--import', 'tsx'],
	token: config.token,
	respawn: true,
});

manager.extend(
	new HeartbeatManager({
		interval: 2000,
		maxMissedHeartbeats: 5,
	})
);

manager.on('clusterCreate', (cluster: any) => {
	logger.info('ClusterManager', `Launched Cluster ${cluster.id} [${cluster.shardList.join(', ')}]`);

	cluster.on('ready', () => logger.success('ClusterManager', `Cluster ${cluster.id} Ready`));
	cluster.on('reconnecting', () => logger.warn('ClusterManager', `Cluster ${cluster.id} Reconnecting...`));
	cluster.on('death', (p: any, code: any) => logger.error('ClusterManager', `Cluster ${cluster.id} Died with exit code ${code}. Respawning...`, undefined));
	cluster.on('error', (e: any) => logger.error('ClusterManager', `Cluster ${cluster.id} Error:`, e));
});

manager.on('debug', (msg: string) => {
	if (!msg.includes('Heartbeat')) logger.debug('ClusterManager', msg);
});

let shuttingDown = false;
const shutdown = () => {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info('ClusterManager', 'Shutting down all clusters...');

	for (const [, cluster] of manager.clusters as any) {
		if (typeof cluster?.kill === 'function') {
			try {
				(cluster as any).respawn = false;
				(manager as any).options.respawn = false;
				cluster.kill();
			} catch (err) {
				logger.error('ClusterManager', `Failed to kill cluster ${cluster.id}:`, err);
			}
		}
	}

	setTimeout(() => {
		logger.warn('ClusterManager', 'Graceful shutdown deadline reached. Forcing exit.');
		process.exit(0);
	}, 5000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

manager
	.spawn({ timeout: -1 })
	.then(() => logger.info('ClusterManager', 'All clusters are being launched.'))
	.catch((error: any) => logger.error('ClusterManager', 'Error during spawn:', error));

// Made by Nikhil Under CodeX Devs
