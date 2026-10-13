import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { VideoRefreshService } from '../../openvidu-components/services/video-refresh/video-refresh.service';
import { MeetingStateService } from '../../services/meeting-state.service';
import { MeetingVideoRefreshButtonComponent } from './meeting-video-refresh-button.component';

describe('MeetingVideoRefreshButtonComponent', () => {
	let fixture: ComponentFixture<MeetingVideoRefreshButtonComponent>;
	let refreshing: WritableSignal<boolean>;
	let isAlone: WritableSignal<boolean>;
	let refresh: jasmine.Spy;

	const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('#refresh-video-button');

	beforeEach(async () => {
		refreshing = signal(false);
		isAlone = signal(false);
		refresh = jasmine.createSpy('refresh').and.resolveTo();

		await TestBed.configureTestingModule({
			imports: [MeetingVideoRefreshButtonComponent],
			providers: [
				provideZonelessChangeDetection(),
				{ provide: VideoRefreshService, useValue: { refreshing, refresh } },
				{ provide: MeetingStateService, useValue: { isAlone } },
				{
					provide: TranslateService,
					useValue: { translationsLoaded: () => 0, translate: (key: string) => key }
				}
			]
		}).compileComponents();

		fixture = TestBed.createComponent(MeetingVideoRefreshButtonComponent);
		fixture.detectChanges();
	});

	it('is there only while someone else is in the room', () => {
		expect(button()).not.toBeNull();

		isAlone.set(true);
		fixture.detectChanges();

		expect(button()).toBeNull();
	});

	it('says what it is for', () => {
		expect(button().textContent).toContain('ROOM.REFRESH_VIDEO');
	});

	it('asks for the video to be refreshed when pressed', () => {
		button().click();

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('cannot be pressed again while the video is being refreshed', () => {
		refreshing.set(true);
		fixture.detectChanges();

		expect(button().disabled).toBeTrue();

		refreshing.set(false);
		fixture.detectChanges();

		expect(button().disabled).toBeFalse();
	});

	it('shows that it is working while the video is being refreshed', () => {
		const icon = (): Element => fixture.nativeElement.querySelector('mat-icon');

		expect(icon().classList.contains('refreshing')).toBeFalse();

		refreshing.set(true);
		fixture.detectChanges();

		expect(icon().classList.contains('refreshing')).toBeTrue();
	});
});
