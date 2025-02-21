import { BUBBLE_TYPES, EffectType, GameEffect } from './types';

export const formatTime = (timeInSeconds: number) => {
	const minutes = Math.floor(timeInSeconds / 60);
	const seconds = Math.floor(timeInSeconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function seededRandom(seed: number) {
	let value = seed;
	return function () {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

export function getRandomBubbleType(rng: () => number, hasSpecialBubble: boolean) {
	// 1) Filter out special bubbles if we already have one on the board
	const allowedBubbles = hasSpecialBubble ? BUBBLE_TYPES.filter((b) => !b.special) : BUBBLE_TYPES;

	// 2) Calculate total probability of allowed bubbles
	const totalProbability = allowedBubbles.reduce((sum, bubble) => sum + bubble.probability, 0);

	// 3) Roll a random value between [0, totalProbability)
	const roll = rng() * totalProbability;

	// 4) Iterate through allowed bubbles to find the chosen one
	let cumulative = 0;
	for (const bubble of allowedBubbles) {
		cumulative += bubble.probability;
		if (roll < cumulative) {
			return bubble;
		}
	}

	// Fallback: return the last allowed bubble if we never hit the threshold
	return allowedBubbles[allowedBubbles.length - 1];
}

export function createDefaultEffects(): Record<EffectType, GameEffect> {
	return {
		[EffectType.Freeze]: { active: false, endTime: 0, durationMs: 5000 },
		[EffectType.Darkness]: { active: false, endTime: 0, durationMs: 5000 },
	};
}
