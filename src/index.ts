import { handleWebSocket } from './game-socket';

const ALLOWED_ORIGINS = [
	'https://bubler.club',
	'https://bubbler-env-game-chris-projects-e9171c8b.vercel.app',
	'https://test.redesign.bubler.club',
	'https://odincash.org',
	'https://www.odincash.org',
];

export interface Env {
	IC_HOST: string;
	IC_CANISTER_ID: string;
	NODE_ENV: string;
	IC_ADMIN_IDENTITY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get('Origin') || '';
		if (env.NODE_ENV !== 'development' && !ALLOWED_ORIGINS.includes(origin)) {
			return new Response('Forbidden', { status: 403 });
		}

		if (request.headers.get('Upgrade') === 'websocket') {
			return handleWebSocket(request, env);
		}

		return new Response(JSON.stringify({ message: 'API Running' }), {
			headers: { 'Content-Type': 'application/json' },
			status: 200,
		});
	},
};
