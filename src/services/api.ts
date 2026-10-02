import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import type { PendingAttachment } from './attachments';
import type { Child, Domain, Note, NoteCard, NoteDetails, Role } from '../types';

/** Base URL of the Express server in /server, e.g. https://api.example.com */
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const TOKEN_KEY = 'bloom.apiToken';

export const isCloudConfigured = Boolean(apiUrl);

export type CloudProfile = { id: string; role: Role; displayName: string };
export type CloudChild = {
	id: string;
	name: string;
	age: number;
	focus: Domain;
	plan: Pick<Child, 'color' | 'sessionMinutes' | 'currentMinutes' | 'rewardTheme' | 'homeSessionsPerWeek' | 'homeNote' | 'tasks'>;
};
export type CloudConversation = { parentId: string; displayName: string; lastMessageAt: string | null };

const getToken = () => AsyncStorage.getItem(TOKEN_KEY);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
	if (!apiUrl) throw new Error('Cloud messaging is not configured on this build.');
	const token = await getToken();
	const res = await fetch(apiUrl + path, {
		method,
		headers: {
			...(isForm ? {} : { 'Content-Type': 'application/json' }),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
	return data as T;
}

async function saveSession(res: { token: string; profile: CloudProfile }): Promise<CloudProfile> {
	await AsyncStorage.setItem(TOKEN_KEY, res.token);
	return res.profile;
}

export async function signInCloud(email: string, password: string): Promise<CloudProfile> {
	return saveSession(await request('POST', '/auth/login', { email, password }));
}

/** New accounts are always parents; therapists are promoted server-side by an administrator. */
export async function signUpParent(email: string, password: string, displayName: string): Promise<CloudProfile> {
	return saveSession(await request('POST', '/auth/signup', { email, password, displayName }));
}

export async function getCloudProfile(): Promise<CloudProfile | null> {
	if (!(await getToken())) return null;
	try {
		return (await request<{ profile: CloudProfile }>('GET', '/auth/me')).profile;
	} catch (err) {
		if (err instanceof Error && /sign in|session expired|account not found/i.test(err.message)) {
			await AsyncStorage.removeItem(TOKEN_KEY);
			return null;
		}
		throw err;
	}
}

export async function signOutCloud(): Promise<void> {
	await AsyncStorage.removeItem(TOKEN_KEY);
	socket?.disconnect();
	socket = null;
}

export async function syncCloudChild(child: Child): Promise<void> {
	await request('PUT', `/children/${encodeURIComponent(child.id)}`, {
		name: child.name,
		age: child.age,
		focus: child.focus,
		plan: {
			color: child.color,
			sessionMinutes: child.sessionMinutes,
			currentMinutes: child.currentMinutes,
			rewardTheme: child.rewardTheme,
			homeSessionsPerWeek: child.homeSessionsPerWeek,
			homeNote: child.homeNote,
			tasks: child.tasks,
		},
	});
}

export async function createParentInvite(childId: string): Promise<string> {
	return (await request<{ token: string }>('POST', `/children/${encodeURIComponent(childId)}/invites`)).token;
}

export async function claimParentInvite(token: string): Promise<CloudChild> {
	return (await request<{ child: CloudChild }>('POST', '/invites/claim', { token: token.trim() })).child;
}

/** Therapist only: the private parent threads for one child. */
export async function listCloudConversations(childId: string): Promise<CloudConversation[]> {
	return (await request<{ conversations: CloudConversation[] }>('GET', `/children/${encodeURIComponent(childId)}/conversations`))
		.conversations;
}

const threadPath = (childId: string, parentId: string) =>
	`/children/${encodeURIComponent(childId)}/conversations/${encodeURIComponent(parentId)}/messages`;

/** Attachment links from the server are relative and expire after an hour; refetching the thread renews them. */
const withAbsoluteLinks = (note: Note): Note => ({
	...note,
	attachments: note.attachments?.map((a) => ({ ...a, url: a.url.startsWith('/') ? apiUrl + a.url : a.url })),
});

/** Messages in the one-to-one thread between a child's therapist and one parent. */
export async function listCloudNotes(childId: string, parentId: string): Promise<Note[]> {
	return (await request<{ messages: Note[] }>('GET', threadPath(childId, parentId))).messages.map(withAbsoluteLinks);
}

export type OutgoingNote = { text: string; attachments?: PendingAttachment[]; details?: NoteDetails; card?: NoteCard };

export async function sendCloudNote(childId: string, parentId: string, { text, attachments = [], details, card }: OutgoingNote): Promise<Note> {
	if (attachments.length === 0) {
		const res = await request<{ message: Note }>('POST', threadPath(childId, parentId), { text: text.trim(), details, card });
		return withAbsoluteLinks(res.message);
	}
	const form = new FormData();
	form.append('text', text.trim());
	if (details) form.append('details', JSON.stringify(details));
	if (card) form.append('card', JSON.stringify(card));
	for (const a of attachments) {
		if (Platform.OS === 'web') {
			const blob = await (await fetch(a.uri)).blob();
			form.append('files', blob, a.name);
		} else {
			// React Native's FormData uploads a local file from { uri, name, type }.
			form.append('files', { uri: a.uri, name: a.name, type: a.mimeType } as unknown as Blob);
		}
	}
	form.append('meta', JSON.stringify(attachments.map((a) => ({ durationMs: a.durationMs }))));
	const res = await request<{ message: Note }>('POST', threadPath(childId, parentId), form);
	return withAbsoluteLinks(res.message);
}

/** Tells the other person their messages in this thread have been seen. */
export async function markCloudThreadRead(childId: string, parentId: string): Promise<void> {
	await request('POST', `${threadPath(childId, parentId).replace(/\/messages$/, '')}/read`);
}

let socket: Socket | null = null;

async function getSocket(): Promise<Socket> {
	if (!socket) {
		const token = await getToken();
		socket = io(apiUrl!, { auth: { token }, transports: ['websocket'] });
	}
	return socket;
}

/**
 * Connects the live channel as soon as a signed-in user opens the app, so the server can mark
 * incoming messages as delivered even before the conversation is opened.
 */
export async function ensureRealtime(): Promise<void> {
	if (isCloudConfigured && (await getToken())) await getSocket();
}

export type Receipt = { ids: string[]; deliveredAt: string; readAt?: string };

/** Applies a delivery/read receipt to a list of messages. */
export function applyReceipt(notes: Note[], r: Receipt): Note[] {
	const ids = new Set(r.ids);
	return notes.map((n) =>
		ids.has(n.id) ? { ...n, deliveredAt: n.deliveredAt ?? r.deliveredAt, readAt: r.readAt ?? n.readAt ?? null } : n,
	);
}

/** Live updates for one thread. The server checks access before joining. Returns an unsubscribe function. */
export function subscribeCloudNotes(
	childId: string,
	parentId: string,
	onMessage: (note: Note) => void,
	onReceipt?: (receipt: Receipt) => void,
): () => void {
	let active = true;
	let s: Socket | null = null;
	const join = () => s?.emit('thread:join', { childId, parentId });
	const handler = (note: Note & { parentId: string }) => {
		if (note.childId === childId && note.parentId === parentId) onMessage(withAbsoluteLinks(note));
	};
	void getSocket().then((sock) => {
		if (!active) return;
		s = sock;
		sock.on('message', handler);
		if (onReceipt) sock.on('receipts', onReceipt);
		sock.on('connect', join); // rejoin after reconnects
		if (sock.connected) join();
	});
	return () => {
		active = false;
		s?.emit('thread:leave', { childId, parentId });
		s?.off('message', handler);
		if (onReceipt) s?.off('receipts', onReceipt);
		s?.off('connect', join);
	};
}
