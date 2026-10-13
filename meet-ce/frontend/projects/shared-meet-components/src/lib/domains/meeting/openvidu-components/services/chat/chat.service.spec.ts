import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { BrowserStorageService } from '../../../../../shared/services/browser-storage.service';
import { LoggerService } from '../../../../../shared/services/logger.service';
import { NotificationService } from '../../../../../shared/services/notification.service';
import { E2eeService } from '../e2ee/e2ee.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';
import { PanelService } from '../panel/panel.service';
import { ParticipantService } from '../participant/participant.service';
import { CHAT_HISTORY_KEY } from './chat-history.store';
import { ChatService } from './chat.service';

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

describe('ChatService (the chat of a room across pages)', () => {
	let device: FakeBrowserStorage;
	let connected: WritableSignal<boolean>;
	let roomName: string;
	let encrypted: boolean;

	const openPage = (): ChatService => {
		connected = signal(false);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{ provide: BrowserStorageService, useValue: device },
				{ provide: MeetingLiveKitService, useValue: { isConnected: connected, getRoomName: () => roomName } },
				{
					provide: E2eeService,
					useValue: {
						get isEnabled() {
							return encrypted;
						}
					}
				},
				{
					provide: ParticipantService,
					useValue: { publishData: () => Promise.resolve(), getMyName: () => 'Me' }
				},
				{ provide: PanelService, useValue: { isChatPanelOpened: () => true, togglePanel: () => {} } },
				{
					provide: NotificationService,
					useValue: { showNotification: () => 1, dismissNotification: () => {} }
				},
				{ provide: AssetsService, useValue: { chatMessageSound: '' } },
				{ provide: LoggerService, useValue: { get: () => ({ d: () => {}, w: () => {}, e: () => {} }) } }
			]
		});

		return TestBed.inject(ChatService);
	};

	const join = (room: string): void => {
		roomName = room;
		connected.set(false);
		TestBed.tick();
		connected.set(true);
		TestBed.tick();
	};

	const texts = (chat: ChatService): string[] => chat.chatMessages().map((message) => message.message);

	beforeEach(() => {
		device = new FakeBrowserStorage();
		roomName = '';
		encrypted = false;
	});

	it('shows the chat of the room again when the room is entered from a new page', async () => {
		const before = openPage();
		join('room-1');
		await before.addRemoteMessage('Good morning', 'Interpreter');
		await before.sendMessage('Code AB1234');

		const after = openPage();
		join('room-1');

		expect(after.chatMessages()).toEqual([
			{ isLocal: false, participantName: 'Interpreter', message: 'Good morning' },
			{ isLocal: true, participantName: 'Me', message: 'Code AB1234' }
		]);
	});

	it('goes on from the restored chat', async () => {
		const before = openPage();
		join('room-1');
		await before.addRemoteMessage('one', 'Interpreter');

		const after = openPage();
		join('room-1');
		await after.addRemoteMessage('two', 'Interpreter');

		expect(texts(after)).toEqual(['one', 'two']);
		expect(texts(openPageIn('room-1'))).toEqual(['one', 'two']);
	});

	it('starts empty in a room it has no chat for', async () => {
		const first = openPage();
		join('room-1');
		await first.addRemoteMessage('for room one', 'Interpreter');

		const second = openPage();
		join('room-2');

		expect(second.chatMessages()).toEqual([]);
	});

	it('does not carry the chat of one room into the next room of the same page', async () => {
		const chat = openPage();
		join('room-1');
		await chat.addRemoteMessage('for room one', 'Interpreter');

		join('room-2');
		expect(chat.chatMessages()).toEqual([]);

		await chat.addRemoteMessage('for room two', 'Interpreter');
		join('room-1');

		expect(texts(chat)).toEqual(['for room one']);
	});

	it('keeps a message that arrives before the restored chat was shown', async () => {
		const before = openPage();
		join('room-1');
		await before.addRemoteMessage('earlier', 'Interpreter');

		const after = openPage();
		roomName = 'room-1';
		connected.set(true);
		await after.addRemoteMessage('just arrived', 'Interpreter');
		TestBed.tick();

		expect(texts(after)).toEqual(['earlier', 'just arrived']);
	});

	it('keeps the chat in the page across a reconnection', async () => {
		encrypted = true;
		const chat = openPage();
		join('room-1');
		await chat.addRemoteMessage('one', 'Interpreter');

		connected.set(false);
		TestBed.tick();
		connected.set(true);
		TestBed.tick();

		expect(texts(chat)).toEqual(['one']);
	});

	it('saves nothing while it does not know the room', async () => {
		const chat = openPage();
		connected.set(true);
		TestBed.tick();
		await chat.addRemoteMessage('early', 'Interpreter');

		expect(texts(chat)).toEqual(['early']);
		expect(device.entries.has(CHAT_HISTORY_KEY)).toBeFalse();
	});

	it('forgets the chat of the room, on the device too, when asked to', async () => {
		const chat = openPage();
		join('room-1');
		await chat.addRemoteMessage('over', 'Interpreter');

		chat.forgetRoom();

		expect(chat.chatMessages()).toEqual([]);
		expect(device.entries.has(CHAT_HISTORY_KEY)).toBeFalse();
		expect(openPageIn('room-1').chatMessages()).toEqual([]);
	});

	it('does not show a stored chat in an encrypted meeting', async () => {
		const before = openPage();
		join('room-1');
		await before.addRemoteMessage('plain', 'Interpreter');

		encrypted = true;

		expect(openPageIn('room-1').chatMessages()).toEqual([]);
	});

	it('leaves nothing on the device for an encrypted meeting', async () => {
		encrypted = true;
		const before = openPage();
		join('room-1');
		await before.addRemoteMessage('secret', 'Interpreter');

		const after = openPage();
		join('room-1');

		expect(device.entries.has(CHAT_HISTORY_KEY)).toBeFalse();
		expect(after.chatMessages()).toEqual([]);
	});

	function openPageIn(room: string): ChatService {
		const chat = openPage();
		join(room);

		return chat;
	}
});
