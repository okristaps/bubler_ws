import { Game, GameState } from './game';
import { Player } from './player';

const SCORE_DEDUCTION = 10;
const BUBBLE_GENERATION_RATE = 1;
const BUBBLE_CYCLE_INTERVAL = 1000;

export function handleWebSocket(request: Request): Response {
	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];

	server.accept();

	let game: Game | null = null;
	let currentPlayerSocket: WebSocket | null = server;

	function sendBubbles() {
		if (game && game.currentState === GameState.Playing && currentPlayerSocket) {
			game.generateBubbles(BUBBLE_GENERATION_RATE);
			const allBubbles = game.getAllBubbles();
			if (currentPlayerSocket.readyState === WebSocket.OPEN) {
				currentPlayerSocket.send(JSON.stringify({ type: 'game-state', bubbles: allBubbles, lives: game.lives, score: game.player.score }));
			}
		}
	}

	setInterval(() => {
		if (game && game.currentState === GameState.Playing) {
			game.checkExpiredBubbles(server);

			server.send(
				JSON.stringify({
					type: 'game-state',
					bubbles: game.getAllBubbles(),
					score: game.player.score,
					lives: game.lives,
				})
			);

			if (game.lives <= 0) {
				game.endGame();
				console.log(`💀 GAME OVER for ${game.player.username}`);
				server.send(JSON.stringify({ type: 'game-over', message: 'Game Over! You ran out of lives.' }));
			}
		}
	}, 100);

	const bubbleInterval = setInterval(() => {
		if (currentPlayerSocket && currentPlayerSocket.readyState === WebSocket.OPEN) {
			currentPlayerSocket.send(JSON.stringify({ type: 'ping', message: 'Keeping connection alive.' }));
			sendBubbles();
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
				console.log('player', player);
				game = new Game(player);
				game.startGame();
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
					server.send(JSON.stringify({ type: 'bubble-popped', score: game.player.score, lives: game.lives }));
				} else {
					server.send(JSON.stringify({ type: 'invalid-pop', message: 'Bubble not found!' }));
				}
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
