import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserStorageService } from '../../../../../shared/services/browser-storage.service';
import type { ChatMessage } from '../../models/chat.model';
import {
	CHAT_HISTORY_KEY,
	CHAT_HISTORY_MAX_MESSAGES,
	CHAT_HISTORY_TTL_MS,
	ChatHistoryStore
} from './chat-history.store';

class FakeBrowserStorage {
	readonly entries = new Map<string, unknown>();

	get<T>(key: string): T | null {
		return this.entries.has(key) ? (structuredClone(this.entries.get(key)) as T) : null;
	}

	set(key: string, value: unknown): void {
		this.entries.set(key, structuredClone(value));
	}

	remove(key: string): void {
		this.entries.delete(key);
	}
}

const said = (message: string, isLocal = false): ChatMessage => ({
	isLocal,
	participantName: isLocal ? 'Me' : 'Interpreter',
	message
});

describe('ChatHistoryStore', () => {
	let storage: FakeBrowserStorage;
	let store: ChatHistoryStore;

	beforeEach(() => {
		jasmine.clock().install();
		jasmine.clock().mockDate(new Date(2026, 0, 1, 10, 0, 0));
		storage = new FakeBrowserStorage();
		TestBed.configureTestingModule({
			providers: [provideZonelessChangeDetection(), { provide: BrowserStorageService, useValue: storage }]
		});
		store = TestBed.inject(ChatHistoryStore);
	});

	afterEach(() => jasmine.clock().uninstall());

	it('gives back the chat saved for a room, in order', () => {
		store.save('room-1', [said('hello'), said('hi', true)]);

		expect(store.load('room-1')).toEqual([said('hello'), said('hi', true)]);
	});

	it('has nothing for a room it never saved', () => {
		store.save('room-1', [said('hello')]);

		expect(store.load('room-2')).toEqual([]);
	});

	it('keeps the chats of different rooms apart', () => {
		store.save('room-1', [said('first room')]);
		store.save('room-2', [said('second room')]);

		expect(store.load('room-1')).toEqual([said('first room')]);
		expect(store.load('room-2')).toEqual([said('second room')]);
	});

	it('keeps only the latest messages of a very long chat', () => {
		const long = Array.from({ length: CHAT_HISTORY_MAX_MESSAGES + 20 }, (_, index) => said(`message ${index}`));

		store.save('room-1', long);

		const kept = store.load('room-1');
		expect(kept.length).toBe(CHAT_HISTORY_MAX_MESSAGES);
		expect(kept[kept.length - 1]).toEqual(said(`message ${CHAT_HISTORY_MAX_MESSAGES + 19}`));
	});

	it('forgets a chat that was last saved too long ago, and takes its text off the device', () => {
		store.save('room-1', [said('old')]);

		jasmine.clock().tick(CHAT_HISTORY_TTL_MS + 1);

		expect(store.load('room-1')).toEqual([]);
		expect(storage.entries.has(CHAT_HISTORY_KEY)).toBeFalse();
	});

	it('drops the expired chat of another room when a new one is saved', () => {
		store.save('room-1', [said('old')]);
		jasmine.clock().tick(CHAT_HISTORY_TTL_MS + 1);

		store.save('room-2', [said('new')]);

		expect(Object.keys(storage.entries.get(CHAT_HISTORY_KEY) as object)).toEqual(['room-2']);
	});

	it('forgets the chat of one room on request and keeps the others', () => {
		store.save('room-1', [said('first room')]);
		store.save('room-2', [said('second room')]);

		store.forget('room-1');

		expect(store.load('room-1')).toEqual([]);
		expect(store.load('room-2')).toEqual([said('second room')]);

		store.forget('room-2');

		expect(storage.entries.has(CHAT_HISTORY_KEY)).toBeFalse();
	});

	it('keeps a chat alive for as long as messages keep being saved', () => {
		store.save('room-1', [said('first')]);
		jasmine.clock().tick(CHAT_HISTORY_TTL_MS - 1000);
		store.save('room-1', [said('first'), said('second')]);
		jasmine.clock().tick(CHAT_HISTORY_TTL_MS - 1000);

		expect(store.load('room-1')).toEqual([said('first'), said('second')]);
	});

	it('ignores what it cannot read as a saved chat', () => {
		storage.entries.set(CHAT_HISTORY_KEY, {
			'room-1': { savedAt: Date.now(), messages: [{ message: 42 }] },
			'room-2': 'not a chat',
			'room-3': { savedAt: Date.now(), messages: [said('fine')] }
		});

		expect(store.load('room-1')).toEqual([]);
		expect(store.load('room-2')).toEqual([]);
		expect(store.load('room-3')).toEqual([said('fine')]);

		storage.entries.set(CHAT_HISTORY_KEY, ['not', 'a', 'map']);

		expect(store.load('room-1')).toEqual([]);
	});
});
