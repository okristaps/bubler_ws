import { BUBBLE_TYPES } from './types';

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

export function getRandomBubbleType(rng: () => number) {
	const totalProbability = BUBBLE_TYPES.reduce((sum, bubble) => sum + bubble.probability, 0);
	const roll = rng() * totalProbability;

	// find which bubble corresponds to this roll
	let cumulative = 0;
	for (const bubble of BUBBLE_TYPES) {
		cumulative += bubble.probability;
		if (roll < cumulative) {
			return bubble;
		}
	}

	return BUBBLE_TYPES[BUBBLE_TYPES.length - 1];
}
