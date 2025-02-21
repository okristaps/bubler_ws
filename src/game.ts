import ICPClient from '../clients/icpClient';
import { Player } from './player';
import { BUBBLE_TYPES, BubbleType, GameState } from './types';
import { getRandomBubbleType, seededRandom } from './utils';

const MAX_BUBBLES = 150;
const BUBBLE_LIFETIME_MS = 8000;
const MIN_SPEED = 3;
const MAX_SPEED = 5;
const SCORE_DEDUCTION = 100;
const LIVES_DEDUCTION = 1;
const GAME_TIME_LIMIT = 300;
const MAX_LIVES = 5;
const TIME_BONUS = 10;
const HEART_BONUS = 1;
const SPECIAL_BUBBLE_PROBABILITY = 0.1;

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
	timeLimit: number = GAME_TIME_LIMIT;
	seed: number;
	rng?: () => number;
	pausedAt?: number;
	icpClient: ICPClient;
	freezeActive: boolean = false;
	freezeEndTime: number = 0;
	freezeDurationMs: number = 10000;

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
		this.pausedAt = undefined;
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
		if (this.currentState === GameState.Paused || this.freezeActive) return;

		const now = Date.now();
		for (const [id, bubble] of this.bubbles) {
			if (now - bubble.createdAt > BUBBLE_LIFETIME_MS) {
				this.player.score = Math.max(0, this.player.score - SCORE_DEDUCTION);
				this.lives -= LIVES_DEDUCTION;
				this.bubbles.delete(id);
			}
		}
		if (this.lives <= 0) {
			this.endGame();
			server.send(
				JSON.stringify({
					type: 'game-over',
					message: 'Game Over! You ran out of lives.',
				})
			);
		}
	}

	generateBubbles() {
		if (this.currentState !== GameState.Playing || !this.rng) return [];
		if (this.freezeActive) return [];
		const baseSpawnRate = 3;
		const additionalBubbles = Math.floor(this.elapsedTime / 120);
		const bubblesToGenerate = Math.min(baseSpawnRate + additionalBubbles, MAX_BUBBLES - this.bubbles.size, 6);

		const newBubbles = [];

		for (let i = 0; i < bubblesToGenerate; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(this?.rng() * 50) + 50;
			const x = this?.rng() * 75;
			const y = 0;
			const speedMultiplier = 1 + this.elapsedTime / 500;
			const speed = (this.rng() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED) * speedMultiplier;

			let bubbleType = getRandomBubbleType(this.rng);
			if (this.rng() < SPECIAL_BUBBLE_PROBABILITY) {
				bubbleType =
					this.rng() < 0.5
						? BUBBLE_TYPES.find((b) => b.type === BubbleType.TimeBubble) ?? bubbleType
						: BUBBLE_TYPES.find((b) => b.type === BubbleType.HeartBubble) ?? bubbleType;
			}

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

	popBubble(bubbleId: string): boolean {
		if (this.bubbles.has(bubbleId) && this.currentState === GameState.Playing) {
			const bubble = this.bubbles.get(bubbleId);
			if (!bubble) return false;

			if (bubble.type === BubbleType.Freeze) {
				this.freezeActive = true;
				this.freezeEndTime = Date.now() + this.freezeDurationMs;
			} else if (bubble.type === BubbleType.TimeBubble) {
				this.timeLimit += TIME_BONUS;
			} else if (bubble.type === BubbleType.HeartBubble) {
				this.lives = Math.min(this.lives + HEART_BONUS, MAX_LIVES);
			} else {
				this.player.increaseScore(bubble.score ?? 0);
			}
			this.bubbles.delete(bubbleId);

			if (this.freezeActive && this.bubbles.size === 0) {
				this.freezeActive = false;
			}

			return true;
		}
		return false;
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
			this.pausedAt = Date.now();
		}
	}
	resumeGame() {
		if (this.currentState === GameState.Paused) {
			const pausedDuration = Date.now() - (this.pausedAt ?? Date.now());
			for (const bubble of this.bubbles.values()) {
				bubble.createdAt += pausedDuration;
			}
			this.currentState = GameState.Playing;
		}
	}

	ellapseTime() {
		if (this.currentState === GameState.Playing) {
			this.elapsedTime += 1;
		}
		if (this.elapsedTime >= this.timeLimit) {
			this.endGame();
		}
	}
}
