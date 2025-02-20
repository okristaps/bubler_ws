import ICPClient from '../clients/icpClient';
import { Player } from './player';

export enum GameState {
	Error = 'error',
	Lobby = 'lobby',
	Playing = 'playing',
	Finished = 'finished',
	Paused = 'paused',
}

function seededRandom(seed: number) {
	let value = seed;
	return function () {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

const MAX_BUBBLES = 150;
const BUBBLE_LIFETIME_MS = 10000;
const MIN_SPEED = 3;
const MAX_SPEED = 5;
const SCORE_DEDUCTION = 100;
const LIVES_DEDUCTION = 1;
const MAX_LIVES = 5;

const BUBBLE_TYPES = [
	{ type: 'Common', score: 25, probability: 15, image: '1' },
	{ type: 'Standard', score: 45, probability: 8, image: '2' },
	{ type: 'Large', score: 45, probability: 8, image: '3' },
	{ type: 'Super', score: 45, probability: 8, image: '4' },
	{ type: 'Ultra', score: 45, probability: 8, image: '5' },
	{ type: 'Epic', score: 45, probability: 8, image: '6' },
	{ type: 'Legendary', score: 45, probability: 8, image: '7' },
	{ type: 'Mythic', score: 70, probability: 8, image: '8' },
	{ type: 'Godlike', score: 45, probability: 8, image: '9' },
	{ type: 'Impossible', score: 170, probability: 3, image: '13' },
	{ type: 'Impossible', score: 45, probability: 8, image: '10' },
	{ type: 'Impossible', score: 45, probability: 8, image: '12' },
	{ type: 'Impossible', score: 45, probability: 8, image: '14' },
	{ type: 'Impossible', score: 45, probability: 8, image: '15' },
];

export class Game {
	id: string;
	player: Player;
	currentState: GameState;
	lives: number;
	gameId?: string;
	bubbles: Map<
		string,
		{ id: string; x: number; y: number; size: number; speed: number; createdAt: number; score: number; type: string; image: string }
	>;
	totalBubblesGenerated: number = 0;
	startTime: number | null = null;
	elapsedTime: number = 0;
	lastImpossibleBubbleSpawn: number = 0;
	seed: number;
	rng?: () => number;
	icpClient: ICPClient;

	constructor(player: Player, icpClient: ICPClient) {
		this.id = crypto.randomUUID();
		this.player = player;
		this.lives = MAX_LIVES;
		this.bubbles = new Map();
		this.currentState = GameState.Lobby;
		this.seed = 0;
		this.rng = undefined;
		this.icpClient = icpClient;
		this.gameId = undefined;
	}

	async startGame() {
		this.startTime = Date.now();
		this.lastImpossibleBubbleSpawn = this.startTime;
		await this.icpClient.savePlayer(this.player.wallet, this.player.username);
		const game = await this.icpClient.startGame(this.player.wallet);
		if (game?.gameId && game?.seed) {
			this.gameId = game?.gameId;
			this.seed = game?.seed;
			this.rng = seededRandom(this.seed);
			this.currentState = GameState.Playing;
		} else {
			this.currentState = GameState.Error;
		}
	}

	resetGame() {
		this.player.score = 0;
		this.lives = MAX_LIVES;
		this.bubbles.clear();
		this.totalBubblesGenerated = 0;
		this.currentState = GameState.Lobby;
		this.startTime = null;
		this.elapsedTime = 0;
		this.lastImpossibleBubbleSpawn = 0;
	}

	checkExpiredBubbles(server: WebSocket) {
		const now = Date.now();
		const expiredBubbles = [];

		for (const [id, bubble] of this.bubbles) {
			if (now - bubble.createdAt > BUBBLE_LIFETIME_MS) {
				this.player.score = Math.max(0, this.player.score - SCORE_DEDUCTION);
				this.lives -= LIVES_DEDUCTION;
				expiredBubbles.push(id);
				this.bubbles.delete(id);
			}
		}

		if (this.lives <= 0) {
			this.endGame();
			server.send(JSON.stringify({ type: 'game-over', message: 'Game Over! You ran out of lives.' }));
		}
	}

	private getRandomBubbleType(rng: () => number) {
		const rand = rng() * 100;
		let cumulativeProbability = 0;

		for (const bubbleType of BUBBLE_TYPES) {
			cumulativeProbability += bubbleType.probability;
			if (rand <= cumulativeProbability) {
				return bubbleType;
			}
		}

		return BUBBLE_TYPES[0];
	}

	generateBubbles() {
		if (this.currentState !== GameState.Playing || !this.rng) return [];

		const baseSpawnRate = 3;
		const additionalBubbles = Math.floor(this.elapsedTime / 120);
		const bubblesToGenerate = Math.min(baseSpawnRate + additionalBubbles, MAX_BUBBLES - this.bubbles.size, 6); // Hard cap at 6

		const newBubbles = [];

		for (let i = 0; i < bubblesToGenerate; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(this?.rng() * 50) + 50;
			const x = this?.rng() * 75;
			const y = 0;

			const speedMultiplier = 1 + this.elapsedTime / 500;
			const speed = (this.rng() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED) * speedMultiplier;

			const bubbleType = this.getRandomBubbleType(this.rng);

			if (!this.bubbles.has(id)) {
				const bubble = {
					id,
					x,
					y,
					size,
					speed,
					createdAt: Date.now(),
					score: bubbleType.score,
					type: bubbleType.type,
					image: bubbleType.image,
				};
				this.bubbles.set(id, bubble);
				newBubbles.push(bubble);
				this.totalBubblesGenerated++;
			}
		}

		return newBubbles;
	}

	getAllBubbles() {
		return Array.from(this.bubbles.values());
	}

	async endGame() {
		this.currentState = GameState.Finished;
		await this.icpClient.finishGame(this.gameId ?? '', this.player.score, this.elapsedTime);
	}

	pauseGame() {
		if (this.currentState === GameState.Playing) {
			this.currentState = GameState.Paused;
			this.elapsedTime += Date.now() - (this.startTime ?? 0);
			this.startTime = null;
		}
	}

	resumeGame() {
		if (this.currentState === GameState.Paused) {
			this.currentState = GameState.Playing;
			this.startTime = Date.now();
		}
	}

	popBubble(bubbleId: string): boolean {
		if (this.bubbles.has(bubbleId)) {
			const bubble = this.bubbles.get(bubbleId);
			this.player.increaseScore(bubble?.score ?? 0);
			this.bubbles.delete(bubbleId);
			return true;
		}
		return false;
	}

	ellapseTime() {
		this.elapsedTime += 1;
	}
}
