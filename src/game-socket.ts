import { Game } from './game';
import { Player } from './player';

const SCORE_DEDUCTION = 10;
const BUBBLE_GENERATION_RATE = 5;
const BUBBLE_CYCLE_INTERVAL = 3000;

export function handleWebSocket(request: Request): Response {
	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];

	server.accept();

	let game: Game | null = null;
	let currentPlayerSocket: WebSocket | null = server;

	function sendBubbles() {
		if (game && currentPlayerSocket) {
			const newBubbles = game.generateBubbles(BUBBLE_GENERATION_RATE);
			const allBubbles = game.getAllBubbles();
			if (currentPlayerSocket.readyState === WebSocket.OPEN) {
				currentPlayerSocket.send(JSON.stringify({ type: 'bubble-update', bubbles: allBubbles }));
			}
		}
	}

	function checkForExpiredBubbles() {
		if (game) {
			const now = Date.now();
			let expiredBubbleCount = 0;

			game.bubbles.forEach((bubble, id) => {
				if (now - bubble.createdAt > 10000) {
					game?.bubbles.delete(id);
					expiredBubbleCount++;
				}
			});

			if (expiredBubbleCount > 0) {
				console.log(`❌ ${expiredBubbleCount} bubbles expired! Deducting score.`);
				game.player.score = Math.max(0, game.player.score - SCORE_DEDUCTION * expiredBubbleCount);
				if (currentPlayerSocket?.readyState === WebSocket.OPEN) {
					currentPlayerSocket.send(JSON.stringify({ type: 'score-update', score: game.player.score }));
				}
			}
		}
	}

	const bubbleInterval = setInterval(() => {
		if (currentPlayerSocket && currentPlayerSocket.readyState === WebSocket.OPEN) {
			currentPlayerSocket.send(JSON.stringify({ type: 'ping', message: 'Keeping connection alive.' }));
			sendBubbles();
			checkForExpiredBubbles();
		}
	}, BUBBLE_CYCLE_INTERVAL);

	server.addEventListener('message', (event) => {
		try {
			let message: string;
			if (typeof event.data === 'string') {
				message = event.data;
			} else if (event.data instanceof ArrayBuffer) {
				message = new TextDecoder().decode(event.data);
			} else {
				return;
			}

			const data = JSON.parse(message);

			if (data.type === 'join') {
				const playerId = crypto.randomUUID();
				const player = new Player(playerId, data.username, data.wallet);
				game = new Game(player);
				server.send(JSON.stringify({ type: 'welcome', message: `Welcome ${player.username}!` }));
			}
			if (data.type === 'start-game' && game) {
				game.resetGame();
				server.send(JSON.stringify({ type: 'game-started', message: 'Game has started!' }));
				sendBubbles();
			}

			if (data.type === 'pop' && game) {
				const popped = game.popBubble(data.bubbleId);
				if (popped) {
					console.log(`🎯 ${game.player.username} popped a bubble!`);
					server.send(JSON.stringify({ type: 'bubble-popped', score: game.player.score }));
				} else {
					server.send(JSON.stringify({ type: 'invalid-pop', message: 'Bubble not found!' }));
				}
			}

			if (data.type === 'missed-bubble' && game) {
				console.log(`❌ Bubble missed! Deducting ${SCORE_DEDUCTION} points.`);
				game.player.score = Math.max(0, game.player.score - SCORE_DEDUCTION);
				server.send(JSON.stringify({ type: 'score-update', score: game.player.score }));
			}

			if (game && game.player.isCheating(game.getMaxAllowedScore())) {
				game.player.score = 0;
				server.send(JSON.stringify({ type: 'cheater-detected', message: 'You have been disqualified!' }));
			}
		} catch (error) {
			console.error('❌ Invalid message received:', event.data);
		}
	});

	server.addEventListener('close', () => {
		clearInterval(bubbleInterval);
		game = null;
		currentPlayerSocket = null;
	});

	return new Response(null, { status: 101, webSocket: client });
}
