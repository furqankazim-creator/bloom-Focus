import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { attachRealtime } from './realtime.js';

let mongoServer;
let mongoUri = config.mongoUri;

if (process.env.BLOOM_EPHEMERAL_DB === '1') {
	const { MongoMemoryServer } = await import('mongodb-memory-server');
	mongoServer = await MongoMemoryServer.create();
	mongoUri = mongoServer.getUri('bloom-focus');
	console.warn('Using temporary demo database. All data will be lost when the server exits; never use this for real child or clinical data.');
}

try {
	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
} catch (error) {
	let hostname = '';
	let port = '27017';
	try {
		const uri = new URL(mongoUri);
		hostname = uri.hostname;
		port = uri.port || port;
	} catch {}
	const localDatabase = ['localhost', '127.0.0.1', '::1'].includes(hostname);
	console.error('Could not connect to MongoDB.');
	if (localDatabase) {
		console.error(`No MongoDB service is accepting connections at ${hostname}:${port}.`);
		console.error('Start MongoDB locally or set MONGODB_URI in server/.env to a running MongoDB database.');
	} else {
		console.error('Check MONGODB_URI in server/.env, network access, and the database credentials.');
	}
	console.error(`Details: ${error.message}`);
	await mongoServer?.stop();
	process.exitCode = 1;
	process.exit();
}
const app = createApp();
const server = http.createServer(app);
attachRealtime(server, app);
server.listen(config.port, () => console.log(`Bloom Focus API listening on :${config.port}`));

async function shutdown() {
	server.close();
	await mongoose.disconnect();
	await mongoServer?.stop();
	process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
