import { Game, GameState } from './game';
import { Env } from './index';
import { Player } from './player';
import ICPClient from '../clients/icpClient';
const BUBBLE_GENERATION_RATE = 2;
const BUBBLE_CYCLE_INTERVAL = 1000;

export function handleWebSocket(request: Request, env: Env): Response {
	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];

	const icpClient = new ICPClient(env);

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

	const formatTime = (timeInSeconds: number) => {
		const minutes = Math.floor(timeInSeconds / 60);
		const seconds = Math.floor(timeInSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	setInterval(() => {
		if (game && game.currentState === GameState.Playing) {
			game.checkExpiredBubbles(server);
			server.send(
				JSON.stringify({
					type: 'game-state',
					bubbles: game.getAllBubbles(),
					score: game.player.score,
					lives: game.lives,
					currentState: game.currentState,
					elapsedTime: formatTime(game.elapsedTime),
				})
			);
		}
	}, 100);

	setInterval(() => {
		if (game && game.currentState === GameState.Playing) {
			game.ellapseTime();
		}
	}, 1000);

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
				game = new Game(player, icpClient);
				game.startGame();
			}

			if (data.type === 'pop' && game) {
				game.popBubble(data.bubbleId);
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
