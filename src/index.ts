import { handleWebSocket } from './game-socket';

export default {
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') === 'websocket') {
			return handleWebSocket(request);
		}
		return new Response('WebSocket Server Running!', { status: 200 });
	},
};
