export class Player {
	id: string;
	username: string;
	wallet: string;
	score: number = 0;
	bubblesPopped: number = 0;
	popTimestamps: number[] = [];

	constructor(id: string, username: string, wallet: string) {
		this.id = id;
		this.username = username;
		this.wallet = wallet;
		console.log(`🎮 New Player Created: ${username} (Wallet: ${wallet}, ID: ${id})`);
	}

	increaseScore(points: number) {
		this.score += points;
		this.bubblesPopped++;
		this.popTimestamps.push(Date.now());

		const now = Date.now();
		this.popTimestamps = this.popTimestamps.filter((t) => now - t < 60000);
	}

	isCheating(maxAllowedScore: number): boolean {
		const now = Date.now();
		if (this.score > maxAllowedScore) {
			console.log(`🚨 CHEATING DETECTED! Player ${this.username} exceeded ${maxAllowedScore} points.`);
			return true;
		}

		if (this.popTimestamps.length > 50) {
			return true;
		}

		return false;
	}
}
