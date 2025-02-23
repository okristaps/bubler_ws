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
	const allowedBubbles = hasSpecialBubble ? BUBBLE_TYPES.filter((b) => !b.special) : BUBBLE_TYPES;

	const totalProbability = allowedBubbles.reduce((sum, bubble) => sum + bubble.probability, 0);
	const roll = rng() * totalProbability;
	let cumulative = 0;

	for (const bubble of allowedBubbles) {
		cumulative += bubble.probability;
		if (roll < cumulative) {
			return bubble;
		}
	}
	return allowedBubbles[allowedBubbles.length - 1];
}

export function createDefaultEffects(): Record<EffectType, GameEffect> {
	return {
		[EffectType.Freeze]: {
			active: false,
			endTime: 0,
			durationMs: 4000,
		},
		[EffectType.Darkness]: {
			active: false,
			endTime: 0,
			durationMs: 500,
		},
	};
}
