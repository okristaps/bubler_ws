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
