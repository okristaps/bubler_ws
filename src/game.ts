import { Player } from './player';

export enum GameState {
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
	{ type: 'Common', score: 5, probability: 30, image: 'bubler' },
	{ type: 'Standard', score: 10, probability: 25, image: 'ai' },
	{ type: 'Large', score: 15, probability: 20, image: 'bebts' },
	{ type: 'Super', score: 20, probability: 10, image: 'bobonbob' },
	{ type: 'Ultra', score: 30, probability: 5, image: 'cloud' },
	{ type: 'Epic', score: 50, probability: 3, image: 'dog' },
	{ type: 'Legendary', score: 100, probability: 2, image: 'omnity' },
	{ type: 'Mythic', score: 200, probability: 1, image: 'ruggy' },
	{ type: 'Godlike', score: 500, probability: 0.5, image: 'tits' },
	{ type: 'Impossible', score: 1000, probability: 0.1, image: 'bublerrich' },
];

export class Game {
	id: string;
	player: Player;
	currentState: GameState;
	lives: number;
	bubbles: Map<
		string,
		{ id: string; x: number; y: number; size: number; speed: number; createdAt: number; score: number; type: string; image: string }
	>;
	totalBubblesGenerated: number = 0;
	startTime: number | null = null;
	elapsedTime: number = 0;
	lastImpossibleBubbleSpawn: number = 0;
	seed: number;
	rng: () => number;

	constructor(player: Player, seed: number) {
		this.id = crypto.randomUUID();
		this.player = player;
		this.lives = MAX_LIVES;
		this.bubbles = new Map();
		this.currentState = GameState.Lobby;
		this.seed = seed;
		this.rng = seededRandom(seed);
	}

	startGame() {
		this.currentState = GameState.Playing;
		this.startTime = Date.now();
		this.lastImpossibleBubbleSpawn = this.startTime;
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

	generateBubbles(count: number) {
		if (this.currentState !== GameState.Playing) return [];

		const newBubbles = [];

		for (let i = 0; i < count; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(this.rng() * 100) + 100;
			const x = this.rng() * 75;
			const y = 0;
			const speed = this.rng() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED;
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

	endGame() {
		this.currentState = GameState.Finished;
		this.elapsedTime += Date.now() - (this.startTime ?? 0);
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
