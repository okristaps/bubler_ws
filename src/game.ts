import { Player } from './player';

const MAX_BUBBLES = 150;
const BUBBLE_LIFETIME_MS = 10000;
const MIN_SPEED = 1;
const MAX_SPEED = 2;
const SCORE_DEDUCTION = 5;
const POINTS_PER_BUBBLE = 10;

export class Game {
	id: string;
	player: Player;
	bubbles: Map<string, { id: string; x: number; y: number; size: number; speed: number; createdAt: number }>;
	totalBubblesGenerated: number = 0;

	constructor(player: Player) {
		this.id = crypto.randomUUID();
		this.player = player;
		this.bubbles = new Map();
	}

	resetGame() {
		this.player.score = 0;
		this.bubbles.clear();
		this.totalBubblesGenerated = 0;
	}

	//

	generateBubbles(count: number) {
		const now = Date.now();
		const newBubbles = [];
		for (const [id, bubble] of this.bubbles) {
			if (now - bubble.createdAt > BUBBLE_LIFETIME_MS) {
				console.log(`❌ Bubble expired! Deducting ${SCORE_DEDUCTION} points.`);
				this.player.score = Math.max(0, this.player.score - SCORE_DEDUCTION);
				this.bubbles.delete(id);
			}
		}

		for (let i = 0; i < count; i++) {
			if (this.bubbles.size >= MAX_BUBBLES) break;

			const id = crypto.randomUUID();
			const size = Math.floor(Math.random() * 50) + 20;
			const x = Math.random() * 100;
			const y = 0;
			const speed = Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED;

			if (!this.bubbles.has(id)) {
				const bubble = { id, x, y, size, speed, createdAt: now };
				this.bubbles.set(id, bubble);
				newBubbles.push(bubble);
				this.totalBubblesGenerated++;
			}
		}

		return newBubbles;
	}

	getMaxAllowedScore(): number {
		return this.totalBubblesGenerated * POINTS_PER_BUBBLE;
	}

	popBubble(bubbleId: string): boolean {
		if (this.bubbles.has(bubbleId)) {
			this.bubbles.delete(bubbleId);
			this.player.increaseScore(POINTS_PER_BUBBLE);
			if (this.player.isCheating(this.getMaxAllowedScore())) {
				this.player.score = 0;
				return false;
			}

			return true;
		}
		return false;
	}

	getAllBubbles() {
		return Array.from(this.bubbles.values());
	}
}
