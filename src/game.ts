import { Player } from './player';

export enum GameState {
	Lobby = 'lobby',
	Playing = 'playing',
	Finished = 'finished',
	Paused = 'paused',
}

const MAX_BUBBLES = 150;
const BUBBLE_LIFETIME_MS = 10000;
const MIN_SPEED = 3;
const MAX_SPEED = 5;
const SCORE_DEDUCTION = 100;
const LIVES_DEDUCTION = 1;
const POINTS_PER_BUBBLE = 10;
const MAX_LIVES = 5;

export class Game {
	id: string;
	player: Player;
	currentState: GameState;
	lives: number;
	bubbles: Map<string, { id: string; x: number; y: number; size: number; speed: number; createdAt: number }>;
	totalBubblesGenerated: number = 0;

	constructor(player: Player) {
		this.id = crypto.randomUUID();
		this.player = player;
		this.lives = MAX_LIVES;
		this.bubbles = new Map();
		this.currentState = GameState.Lobby;
	}

	resetGame() {
		this.player.score = 0;
		this.lives = MAX_LIVES;
		this.bubbles.clear();
		this.totalBubblesGenerated = 0;
		this.currentState = GameState.Lobby;
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
		}
	}

	generateBubbles(count: number) {
		const newBubbles = [];

		for (let i = 0; i < count; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(Math.random() * 100) + 20;
			const x = Math.random() * 75;
			const y = 0;
			const speed = Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED;

			if (!this.bubbles.has(id)) {
				const bubble = { id, x, y, size, speed, createdAt: Date.now() };
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
	}

	startGame() {
		this.currentState = GameState.Playing;
	}

	getMaxAllowedScore(): number {
		return this.totalBubblesGenerated * POINTS_PER_BUBBLE;
	}

	popBubble(bubbleId: string): boolean {
		if (this.bubbles.has(bubbleId)) {
			this.bubbles.delete(bubbleId);
			this.player.increaseScore(POINTS_PER_BUBBLE);
			return true;
		}
		return false;
	}
}
