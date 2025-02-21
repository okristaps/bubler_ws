import ICPClient from '../clients/icpClient';
import { Player } from './player';
import { Bubble, BUBBLE_TYPES, BubbleType, EffectType, GameEffect, GameState } from './types';
import { createDefaultEffects, getRandomBubbleType, seededRandom } from './utils';

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
const SPECIAL_BUBBLE_PROBABILITY = 0.01;

export class Game {
	id: string;
	player: Player;
	currentState: GameState;
	lives: number;
	gameId?: string;
	bubbles: Map<string, Bubble>;
	totalBubblesGenerated: number = 0;
	startTime: number | null = null;
	elapsedTime: number = 0;
	timeLimit: number = GAME_TIME_LIMIT;
	seed: number;
	rng?: () => number;
	pausedAt?: number;
	icpClient: ICPClient;
	effects: Record<EffectType, GameEffect>;

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
		this.effects = createDefaultEffects();
	}

	async startGame() {
		this.startTime = Date.now();
		await this.icpClient.savePlayer(this.player.wallet, this.player.username);

		const game = await this.icpClient.startGame(this.player.wallet);
		if (game?.gameId && game?.seed) {
			this.gameId = game.gameId;
			this.seed = game.seed;
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

		for (const key of Object.keys(this.effects) as EffectType[]) {
			this.effects[key].active = false;
			this.effects[key].endTime = 0;
		}
	}

	checkExpiredBubbles(server: WebSocket) {
		const expiredBubbles: string[] = [];

		for (const [id, bubble] of this.bubbles) {
			if (bubble.timeLivedMs >= BUBBLE_LIFETIME_MS) {
				this.player.score = Math.max(0, this.player.score - SCORE_DEDUCTION);
				this.lives -= LIVES_DEDUCTION;
				expiredBubbles.push(id);
			}
		}
		for (const bubbleId of expiredBubbles) {
			this.bubbles.delete(bubbleId);
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
		if (this.effects[EffectType.Freeze].active) return [];

		const baseSpawnRate = 3;
		const additionalBubbles = Math.floor(this.elapsedTime / 120);
		const bubblesToGenerate = Math.min(baseSpawnRate + additionalBubbles, MAX_BUBBLES - this.bubbles.size, 6);

		const newBubbles: Bubble[] = [];

		const spawnSpecial = this.rng() < SPECIAL_BUBBLE_PROBABILITY;
		let specialIndex = -1;
		if (spawnSpecial) {
			specialIndex = Math.floor(this.rng() * bubblesToGenerate);
		}

		for (let i = 0; i < bubblesToGenerate; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(this.rng() * 50) + 50;
			const x = this.rng() * 75;
			const y = 0;

			const speedMultiplier = 1 + this.elapsedTime / 500;
			const speed = (this.rng() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED) * speedMultiplier;

			let bubbleType = getRandomBubbleType(this.rng);

			if (i === specialIndex) {
				const specialTypes = [BubbleType.Freeze, BubbleType.TimeBubble, BubbleType.HeartBubble];
				const randomIndex = Math.floor(this.rng() * specialTypes.length);
				const chosenType = specialTypes[randomIndex];
				const specialBubble = BUBBLE_TYPES.find((b) => b.type === chosenType);
				if (specialBubble) {
					bubbleType = specialBubble;
				}
			}

			const bubble: Bubble = {
				id,
				x,
				y,
				size,
				speed,
				timeLivedMs: 0,
				createdAt: Date.now(),
				score: bubbleType.score,
				type: bubbleType.type,
				image: bubbleType.image,
			};

			this.bubbles.set(id, bubble);
			newBubbles.push(bubble);
		}

		return newBubbles;
	}

	popBubble(bubbleId: string): boolean {
		if (this.bubbles.has(bubbleId) && this.currentState === GameState.Playing) {
			const bubble = this.bubbles.get(bubbleId);
			if (!bubble) return false;

			switch (bubble.type) {
				case BubbleType.Freeze:
					this.activateEffect(EffectType.Freeze, 5000);
					break;
				case BubbleType.TimeBubble:
					this.timeLimit += TIME_BONUS;
					break;
				case BubbleType.HeartBubble:
					this.lives += HEART_BONUS;
					break;
				case 'Darkness':
					this.activateEffect(EffectType.Darkness, 5000);
					break;
				default:
					this.player.increaseScore(bubble.score ?? 0);
					break;
			}

			this.bubbles.delete(bubbleId);
			return true;
		}
		return false;
	}

	activateEffect(effectType: EffectType, durationMs: number) {
		const effect = this.effects[effectType];
		const now = Date.now();
		effect.active = true;
		effect.durationMs = durationMs;
		effect.endTime = now + durationMs;
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
