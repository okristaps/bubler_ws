import { Game } from './game';
import { Env } from './index';
import { Player } from './player';
import ICPClient from '../clients/icpClient';
import { formatTime } from './utils';
import { GameState } from './types';
import { ClientEvent, ServerEvent, ClientMessage } from './socket-types';

const BUBBLE_CYCLE_INTERVAL = 1000;
const GAME_UPDATE_INTERVAL = 200;
const TIME_INTERVAL = 1000;

export function handleWebSocket(request: Request, env: Env): Response {
	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];

	server.accept();

	const icpClient = new ICPClient(env);

	let game: Game | null = null;
	let currentPlayerSocket: WebSocket | null = server;
	let gameOverSent = false;

	function cleanup() {
		clearInterval(gameInterval);
		clearInterval(timeInterval);
		clearInterval(bubbleInterval);

		if (currentPlayerSocket && currentPlayerSocket.readyState === WebSocket.OPEN) {
			currentPlayerSocket.close();
		}
		game = null;
		currentPlayerSocket = null;
	}

	function onGameInterval() {
		if (!game) return;

		const now = Date.now();

		const freezeEffect = game.effects.Freeze;
		if (freezeEffect.active && now >= freezeEffect.endTime) {
			freezeEffect.active = false;
			server.send(JSON.stringify({ type: ServerEvent.FreezeEnded }));
		}

		const darknessEffect = game.effects.Darkness;
		if (darknessEffect.active && now >= darknessEffect.endTime) {
			darknessEffect.active = false;
			server.send(JSON.stringify({ type: ServerEvent.DarknessEnded }));
		}

		if (game.currentState === GameState.Playing) {
			game.checkExpiredBubbles(server);

			server.send(
				JSON.stringify({
					type: ServerEvent.GameState,
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
					type: ServerEvent.GameOver,
					finalScore: game.player.score,
					elapsedTime: formatTime(game.elapsedTime),
					timeLimit: formatTime(game.timeLimit),
				})
			);

			setTimeout(() => {
				server.close();
				cleanup();
			}, 1000);
		}
	}

	function onTimeInterval() {
		if (!game) return;
		if (game.currentState === GameState.Playing && !game.effects.Freeze.active) {
			game.ellapseTime();
			for (const bubble of game.bubbles.values()) {
				bubble.timeLivedMs += 1000;
			}
		}
	}

	function onBubbleInterval() {
		if (currentPlayerSocket && currentPlayerSocket.readyState === WebSocket.OPEN) {
			currentPlayerSocket.send(JSON.stringify({ type: ServerEvent.Ping, message: 'Keeping connection alive.' }));
			if (game && game.currentState === GameState.Playing) {
				game.generateBubbles();
			}
		}
	}

	function handleMessage(data: ClientMessage) {
		if (!game) return;

		switch (data.type) {
			case ClientEvent.Pop: {
				const popped = game.popBubble(data.bubbleId);
				if (popped) {
					if (game.effects.Freeze.active) {
						server.send(JSON.stringify({ type: ServerEvent.FreezeActive }));
					}
					if (game.effects.Darkness.active) {
						server.send(JSON.stringify({ type: ServerEvent.DarknessActive }));
					}
				}
				break;
			}

			case ClientEvent.Pause:
				game.pauseGame();
				server.send(JSON.stringify({ type: ServerEvent.GamePaused }));
				break;

			case ClientEvent.Resume:
				game.resumeGame();
				server.send(JSON.stringify({ type: ServerEvent.GameResumed }));
				break;
		}
	}

	const gameInterval = setInterval(onGameInterval, GAME_UPDATE_INTERVAL);
	const timeInterval = setInterval(onTimeInterval, TIME_INTERVAL);
	const bubbleInterval = setInterval(onBubbleInterval, BUBBLE_CYCLE_INTERVAL);

	server.addEventListener('message', (event) => {
		try {
			let messageStr: string;
			if (typeof event.data === 'string') {
				messageStr = event.data;
			} else if (event.data instanceof ArrayBuffer) {
				messageStr = new TextDecoder().decode(event.data);
			} else {
				return;
			}

			const data = JSON.parse(messageStr) as ClientMessage;

			if (data.type === ClientEvent.Join) {
				const playerId = crypto.randomUUID();
				const player = new Player(playerId, data.username, data.wallet);
				game = new Game(player, icpClient);
				game.startGame();
				return;
			}

			handleMessage(data);
		} catch (error) {
			console.error('❌ Invalid message received:', event.data);
		}
	});

	server.addEventListener('close', () => {
		cleanup();
	});

	return new Response(null, { status: 101, webSocket: client });
}
