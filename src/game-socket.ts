import { Game } from './game';
import { Env } from './index';
import { Player } from './player';
import ICPClient from '../clients/icpClient';
import { formatTime } from './utils';
import { GameState, EffectType } from './types';
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
			const now = Date.now();

			const freezeEffect = game.effects[EffectType.Freeze];

			if (freezeEffect.active && now >= freezeEffect.endTime) {
				freezeEffect.active = false;
				server.send(JSON.stringify({ type: 'freeze-ended' }));
			}

			const darknessEffect = game.effects[EffectType.Darkness];
			if (darknessEffect.active && now >= darknessEffect.endTime) {
				darknessEffect.active = false;
				server.send(JSON.stringify({ type: 'darkness-ended' }));
			}

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

	const timeInterval = setInterval(() => {
		if (game && game.currentState === GameState.Playing && !game.effects[EffectType.Freeze].active) {
			game.ellapseTime();
			for (const bubble of game.bubbles.values()) {
				bubble.timeLivedMs += 1000;
			}
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
				const popped = game.popBubble(data.bubbleId);
				if (popped) {
					if (game.effects[EffectType.Freeze].active) {
						server.send(JSON.stringify({ type: 'freeze-active' }));
					}
					if (game.effects[EffectType.Darkness].active) {
						server.send(JSON.stringify({ type: 'darkness-active' }));
					}
				}
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
		clearInterval(gameInterval);
		clearInterval(timeInterval);
		game = null;
		currentPlayerSocket = null;
	});

	return new Response(null, { status: 101, webSocket: client });
}
