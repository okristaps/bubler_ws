import { handleWebSocket } from './game-socket';

export interface Env {
	IC_HOST: string;
	IC_CANISTER_ID: string;
	NODE_ENV: string;
	IC_ADMIN_IDENTITY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.headers.get('Upgrade') === 'websocket') {
			return handleWebSocket(request, env);
		}
		return new Response(JSON.stringify({ message: 'API Running' }), {
			headers: { 'Content-Type': 'application/json' },
			status: 200,
		});
	},
};
