export const idlFactory = ({ IDL }) => {
	const Time = IDL.Int;
	const GameSession = IDL.Record({
		startedAt: Time,
		username: IDL.Text,
		seed: IDL.Nat,
		gameId: IDL.Text,
		score: IDL.Nat,
		wallet: IDL.Text,
		timePlayed: IDL.Text,
	});
	return IDL.Service({
		addAdmin: IDL.Func([IDL.Principal], [IDL.Bool], []),
		finishGame: IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [IDL.Bool], []),
		getAdmins: IDL.Func([], [IDL.Opt(IDL.Vec(IDL.Principal))], []),
		getGameSessions: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text, IDL.Nat, IDL.Nat, IDL.Text, Time))], ['query']),
		getLeaderboard: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text, IDL.Nat, IDL.Nat, IDL.Text))], ['query']),
		getPlayers: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))], ['query']),
		removeAdmin: IDL.Func([IDL.Principal], [IDL.Bool], []),
		savePlayer: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
		startGame: IDL.Func([IDL.Text], [IDL.Opt(GameSession)], []),
	});
};
export const init = ({ IDL }) => {
	return [];
};
