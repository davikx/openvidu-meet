import { inject, Service } from '@angular/core';
import { BrowserStorageService } from '../../../../../shared/services/browser-storage.service';
import type { ChatMessage } from '../../models/chat.model';

export const CHAT_HISTORY_KEY = 'chatHistory';
export const CHAT_HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
export const CHAT_HISTORY_MAX_MESSAGES = 500;

interface StoredChat {
	savedAt: number;
	messages: ChatMessage[];
}

type StoredChats = Record<string, StoredChat>;

const isChatMessage = (value: unknown): value is ChatMessage => {
	const message = value as Partial<ChatMessage> | null;

	return (
		!!message &&
		typeof message.isLocal === 'boolean' &&
		typeof message.participantName === 'string' &&
		typeof message.message === 'string'
	);
};

const isStoredChat = (value: unknown): value is StoredChat => {
	const chat = value as Partial<StoredChat> | null;

	return (
		!!chat && typeof chat.savedAt === 'number' && Array.isArray(chat.messages) && chat.messages.every(isChatMessage)
	);
};

@Service()
export class ChatHistoryStore {
	private readonly storage = inject(BrowserStorageService);

	load(roomId: string): ChatMessage[] {
		const stored = this.read();
		const kept = this.withoutExpired(stored);

		if (Object.keys(kept).length !== Object.keys(stored).length) this.write(kept);

		return kept[roomId]?.messages ?? [];
	}

	save(roomId: string, messages: ChatMessage[]): void {
		const kept = this.withoutExpired(this.read());

		kept[roomId] = { savedAt: Date.now(), messages: messages.slice(-CHAT_HISTORY_MAX_MESSAGES) };
		this.write(kept);
	}

	forget(roomId: string): void {
		const kept = this.withoutExpired(this.read());

		delete kept[roomId];
		this.write(kept);
	}

	private read(): StoredChats {
		const stored = this.storage.get<unknown>(CHAT_HISTORY_KEY);

		return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as StoredChats) : {};
	}

	private write(chats: StoredChats): void {
		if (Object.keys(chats).length === 0) {
			this.storage.remove(CHAT_HISTORY_KEY);
			return;
		}

		this.storage.set(CHAT_HISTORY_KEY, chats);
	}

	private withoutExpired(chats: StoredChats): StoredChats {
		const oldest = Date.now() - CHAT_HISTORY_TTL_MS;
		const kept: StoredChats = {};

		for (const [roomId, chat] of Object.entries(chats)) {
			if (isStoredChat(chat) && chat.savedAt >= oldest) kept[roomId] = chat;
		}

		return kept;
	}
}
