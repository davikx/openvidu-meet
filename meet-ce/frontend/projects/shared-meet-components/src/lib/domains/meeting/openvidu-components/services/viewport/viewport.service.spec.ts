import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlatformService } from '../platform/platform.service';
import { ViewportService } from './viewport.service';

/**
 * Which layout a participant gets is decided here: the breakpoints below pick the meeting's
 * responsive mode, and the touch checks separate a narrow desktop window from an actual phone.
 * Nothing else in the app measures the viewport.
 */
describe('ViewportService', () => {
	let platform: {
		isTouchDevice: () => boolean;
		isPhysicalMobileDevice: () => boolean;
		isPhysicalTablet: () => boolean;
	};

	const sizeViewport = (width: number, height: number): void => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => width });
		Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => height });
	};

	const createService = (): ViewportService => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				ViewportService,
				{ provide: PlatformService, useValue: platform as unknown as PlatformService }
			]
		});

		return TestBed.inject(ViewportService);
	};

	beforeEach(() => {
		platform = {
			isTouchDevice: () => false,
			isPhysicalMobileDevice: () => false,
			isPhysicalTablet: () => false
		};
	});

	afterEach(() => {
		delete (window as unknown as Record<string, unknown>)['innerWidth'];
		delete (window as unknown as Record<string, unknown>)['innerHeight'];
	});

	const sizeAt = (width: number): string => {
		sizeViewport(width, 800);
		return createService().viewportSize();
	};

	it('picks the layout from the width, at the breakpoint and just below it', () => {
		expect([sizeAt(320), sizeAt(767)]).toEqual(['mobile', 'mobile']);
		expect([sizeAt(768), sizeAt(1023)]).toEqual(['tablet', 'tablet']);
		expect([sizeAt(1024), sizeAt(1199)]).toEqual(['desktop', 'desktop']);
		expect([sizeAt(1200), sizeAt(2560)]).toEqual(['wide', 'wide']);
	});

	it('reads a wider-than-tall viewport as landscape, and a square one as portrait', () => {
		sizeViewport(1000, 600);
		expect(createService().orientation()).toBe('landscape');

		sizeViewport(600, 1000);
		expect(createService().isPortrait()).toBeTrue();

		sizeViewport(800, 800);
		expect(createService().orientation()).toBe('portrait');
	});

	// A narrow browser window on a laptop is not a phone: the layout follows the width, but the
	// touch-only affordances follow the device.
	it('separates a narrow window from a touch device of the same width', () => {
		sizeViewport(400, 800);

		expect(createService().isMobile()).toBeFalse();

		platform.isTouchDevice = () => true;

		expect(createService().isMobile()).toBeTrue();
	});

	it('reports a touch tablet as a tablet, and a desktop window as neither', () => {
		sizeViewport(800, 1000);
		platform.isTouchDevice = () => true;

		expect(createService().isTablet()).toBeTrue();

		sizeViewport(1300, 800);
		platform.isTouchDevice = () => false;
		const desktop = createService();

		expect({ tablet: desktop.isTablet(), desktop: desktop.isDesktop(), wide: desktop.isWide() }).toEqual({
			tablet: false,
			desktop: false,
			wide: true
		});
	});

	it('groups the widths the panels collapse at', () => {
		sizeViewport(767, 800);
		const narrow = createService();

		expect({ mobileView: narrow.isMobileView(), tabletDown: narrow.isTabletDown() }).toEqual({
			mobileView: true,
			tabletDown: true
		});

		sizeViewport(768, 800);
		const tablet = createService();

		expect({ mobileView: tablet.isMobileView(), tabletDown: tablet.isTabletDown() }).toEqual({
			mobileView: false,
			tabletDown: true
		});

		sizeViewport(1024, 800);

		expect(createService().isTabletDown()).toBeFalse();
	});

	it('never asks a phone held in landscape to rotate back to portrait', () => {
		platform.isPhysicalMobileDevice = () => true;
		sizeViewport(900, 400);

		expect(createService().shouldShowLandscapeWarning()).toBeFalse();
	});

	it('reads a wide and short viewport on a phone as a short landscape, and nothing else as one', () => {
		platform.isPhysicalMobileDevice = () => true;

		const shortLandscapeAt = (width: number, height: number): boolean => {
			sizeViewport(width, height);

			return createService().isShortLandscape();
		};

		expect([shortLandscapeAt(735, 218), shortLandscapeAt(780, 340), shortLandscapeAt(560, 500)]).toEqual([
			true,
			true,
			true
		]);
		expect([
			shortLandscapeAt(360, 600),
			shortLandscapeAt(360, 300),
			shortLandscapeAt(559, 300),
			shortLandscapeAt(1024, 501)
		]).toEqual([false, false, false, false]);

		platform.isPhysicalMobileDevice = () => false;

		expect(shortLandscapeAt(735, 218)).toBeFalse();
	});

	it('gathers everything a responsive template asks for into one view', () => {
		sizeViewport(1300, 800);
		platform.isTouchDevice = () => true;
		platform.isPhysicalTablet = () => true;

		expect(createService().viewportInfo()).toEqual({
			width: 1300,
			height: 800,
			size: 'wide',
			orientation: 'landscape',
			isMobile: false,
			isTablet: false,
			isDesktop: false,
			isWide: true,
			isTouchDevice: true,
			isPhysicalMobile: false,
			isPhysicalTablet: true,
			shouldShowLandscapeWarning: false
		});
	});

	it('follows the window as it is resized', async () => {
		sizeViewport(1300, 800);
		const service = createService();

		sizeViewport(600, 800);
		window.dispatchEvent(new Event('resize'));
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(service.viewportSize()).toBe('mobile');
		expect(service.viewportInfo().width).toBe(600);
	});
});
