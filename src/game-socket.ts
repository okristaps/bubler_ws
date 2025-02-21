import { Game } from './game';
import { Env } from './index';
import { Player } from './player';
import ICPClient from '../clients/icpClient';
import { formatTime } from './utils';
import { GameState } from './types';
const BUBBLE_CYCLE_INTERVAL = 1000;

export function handleWebSocket(request: Request, env: Env): Response {
	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];

	const icpClient = new ICPClient(env);

	server.accept();

	let game: Game | null = null;
	let currentPlayerSocket: WebSocket | null = server;
	let gameOverSent = false;
	function sendBubbles() {
		if (game && game.currentState === GameState.Playing && currentPlayerSocket) {
			game.generateBubbles();
		}
	}

	const gameInterval = setInterval(() => {
		if (game) {
			if (game.currentState === GameState.Playing) {
				game.checkExpiredBubbles(server);

				server.send(
					JSON.stringify({
						type: 'game-state',
						bubbles: game.getAllBubbles(),
						score: game.player.score,
						lives: game.lives,
						currentState: game.currentState,
						elapsedTime: formatTime(game.elapsedTime),
						timeLimit: formatTime(game.timeLimit),
					})
				);
			} else if (game.currentState === GameState.Finished && !gameOverSent) {
				gameOverSent = true;
				server.send(
					JSON.stringify({
						type: 'game-over',
						finalScore: game.player.score,
						elapsedTime: formatTime(game.elapsedTime),
						timeLimit: formatTime(game.timeLimit),
					})
				);
				setTimeout(() => {
					server.close();
					clearInterval(gameInterval);
					clearInterval(bubbleInterval);
					game = null;
					currentPlayerSocket = null;
				}, 1000);
			}
		}
	}, 200);

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

			if (data.type === 'pause' && game) {
				game.pauseGame();
				server.send(JSON.stringify({ type: 'game-paused' }));
			}

			if (data.type === 'resume' && game) {
				game.resumeGame();
				server.send(JSON.stringify({ type: 'game-resumed' }));
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
