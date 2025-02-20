export enum GameState {
	Error = 'error',
	Lobby = 'lobby',
	Playing = 'playing',
	Finished = 'finished',
	Paused = 'paused',
}

export enum BubbleType {
	Common = 'Common',
	Standard = 'Standard',
	Large = 'Large',
	Super = 'Super',
	Ultra = 'Ultra',
	Epic = 'Epic',
	Legendary = 'Legendary',
	Mythic = 'Mythic',
	Godlike = 'Godlike',
	Impossible = 'Impossible',
	Rare = 'Rare',
	TimeBubble = 'Time Bubble',
	HeartBubble = 'Heart Bubble',
}

export const BUBBLE_TYPES = [
	{ type: BubbleType.Common, score: 25, probability: 15, image: '1' },
	{ type: BubbleType.Standard, score: 50, probability: 8, image: '2' },
	{ type: BubbleType.Large, score: 75, probability: 8, image: '3' },
	{ type: BubbleType.Super, score: 100, probability: 8, image: '4' },
	{ type: BubbleType.Ultra, score: 150, probability: 8, image: '5' },
	{ type: BubbleType.Epic, score: 200, probability: 8, image: '6' },
	{ type: BubbleType.Legendary, score: 300, probability: 8, image: '7' },
	{ type: BubbleType.Mythic, score: 500, probability: 8, image: '8' },
	{ type: BubbleType.Godlike, score: 750, probability: 8, image: '9' },
	{ type: BubbleType.Impossible, score: 2000, probability: 3, image: '13' }, // top g bubble
	{ type: BubbleType.Rare, score: 400, probability: 8, image: '10' },
	{ type: BubbleType.Rare, score: 400, probability: 8, image: '12' },
	{ type: BubbleType.Rare, score: 400, probability: 8, image: '14' },
	{ type: BubbleType.Rare, score: 400, probability: 8, image: '15' },
	{ type: BubbleType.TimeBubble, score: 0, probability: 3, image: 'time' },
	{ type: BubbleType.HeartBubble, score: 0, probability: 3, image: 'heart' },
];
