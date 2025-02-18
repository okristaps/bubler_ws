import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { idlFactory } from '../defenitions/index';
import { Env } from '../src';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Buffer } from 'buffer';
import { formatTime } from '../src/utils';

interface GameSession {
	startedAt: number;
	username: string;
	seed: number;
	gameId: string;
	score: number;
	wallet: string;
	timePlayed: string;
}

export default class ICPClient {
	private agent: HttpAgent;
	private backend: any;
	private canisterId: string;
	private identity: Identity | null = null;

	constructor(env: Env, identity?: Identity) {
		this.canisterId = env.IC_CANISTER_ID;
		this.agent = new HttpAgent({ host: env.IC_HOST });

		this.identity = identity ?? this.loadIdentity(env);
		if (!this.identity) {
			throw new Error('Identity initialization failed.');
		}

		this.agent.replaceIdentity(this.identity);

		if (env.NODE_ENV === 'development') {
			this.agent.fetchRootKey().catch((err) => console.error('Failed to fetch root key:', err));
		}

		this.backend = Actor.createActor(idlFactory, {
			agent: this.agent,
			canisterId: this.canisterId,
		});
	}

	private loadIdentity(env: Env): Identity | null {
		if (!env.IC_ADMIN_IDENTITY) {
			console.error('❌ Missing IC_ADMIN_IDENTITY in environment.');
			return null;
		}

		try {
			const { secretKey } = JSON.parse(env.IC_ADMIN_IDENTITY);
			const privateKey = Buffer.from(secretKey, 'base64');
			return Ed25519KeyIdentity.fromSecretKey(privateKey);
		} catch (error) {
			console.error('❌ Failed to parse or load identity:', error);
			return null;
		}
	}

	async getLeaderboard(): Promise<any[]> {
		try {
			await this.agent.fetchRootKey();
			const leaderboard = await this.backend.getLeaderboard();
			return leaderboard.map(([gameId, wallet, username, seed, score, timePlayed]: any) => ({
				gameId,
				wallet,
				username,
				seed: seed.toString(),
				score: score.toString(),
				timePlayed,
			}));
		} catch (error) {
			console.error('❌ Failed to fetch leaderboard:', error);
			return [];
		}
	}

	async savePlayer(wallet: string, username: string): Promise<boolean> {
		if (!this.identity) {
			return false;
		}

		try {
			await this.backend.savePlayer(wallet, username);
			return true;
		} catch (error) {
			console.error('❌ Failed to save player:', error);
			return false;
		}
	}

	async startGame(wallet: string): Promise<GameSession | null> {
		if (!this.identity) {
			console.error('User identity is missing.');
			return null;
		}

		try {
			const response = await this.backend.startGame(wallet);

			if (!response || !Array.isArray(response) || response.length === 0) {
				console.error('Invalid response format or empty response.');
				return null;
			}

			const rawGameSession = response[0];

			const gameSession: GameSession = {
				startedAt: Number(rawGameSession.startedAt),
				username: rawGameSession.username,
				seed: Number(rawGameSession.seed),
				gameId: rawGameSession.gameId,
				score: Number(rawGameSession.score),
				wallet: rawGameSession.wallet,
				timePlayed: rawGameSession.timePlayed,
			};

			return gameSession;
		} catch (error) {
			console.error('Error starting game:', error);
			return null;
		}
	}

	async finishGame(gameId: string, finalScore: number, finalTimePlayed: number): Promise<GameSession | null> {
		if (!this.identity) {
			console.error('User identity is missing.');
			return null;
		}

		try {
			const response = await this.backend.finishGame(gameId, finalScore, formatTime(finalTimePlayed));

			if (!response || !Array.isArray(response) || response.length === 0) {
				console.error('Invalid response format or empty response.');
				return null;
			}

			const rawGameSession = response[0];

			const gameSession: GameSession = {
				startedAt: Number(rawGameSession.startedAt),
				username: rawGameSession.username,
				seed: Number(rawGameSession.seed),
				gameId: rawGameSession.gameId,
				score: Number(rawGameSession.score),
				wallet: rawGameSession.wallet,
				timePlayed: rawGameSession.timePlayed,
			};

			return gameSession;
		} catch (error) {
			console.error('Error finishing game:', error);
			return null;
		}
	}
}
