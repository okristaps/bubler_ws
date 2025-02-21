import { Bubble } from './types';

export enum ClientEvent {
	Join = 'join',
	Pop = 'pop',
	Pause = 'pause',
	Resume = 'resume',
}

export enum ServerEvent {
	FreezeActive = 'freeze-active',
	FreezeEnded = 'freeze-ended',
	DarknessActive = 'darkness-active',
	DarknessEnded = 'darkness-ended',
	GameState = 'game-state',
	GamePaused = 'game-paused',
	GameResumed = 'game-resumed',
	GameOver = 'game-over',
	Ping = 'ping',
}

export interface JoinMessage {
	type: ClientEvent.Join;
	username: string;
	wallet: string;
}

export interface PopMessage {
	type: ClientEvent.Pop;
	bubbleId: string;
}

export interface PauseMessage {
	type: ClientEvent.Pause;
}

export interface ResumeMessage {
	type: ClientEvent.Resume;
}

export type ClientMessage = JoinMessage | PopMessage | PauseMessage | ResumeMessage;

export interface GameStateMessage {
	type: ServerEvent.GameState;
	bubbles: Bubble[];
	score: number;
	lives: number;
	currentState: string;
	elapsedTime: string;
	timeLimit: string;
}

export type ServerMessage =
	| { type: ServerEvent.FreezeActive }
	| { type: ServerEvent.FreezeEnded }
	| { type: ServerEvent.DarknessActive }
	| { type: ServerEvent.DarknessEnded }
	| { type: ServerEvent.GamePaused }
	| { type: ServerEvent.GameResumed }
	| { type: ServerEvent.GameOver; finalScore: number; elapsedTime: string; timeLimit: string }
	| GameStateMessage
	| { type: ServerEvent.Ping; message: string };
