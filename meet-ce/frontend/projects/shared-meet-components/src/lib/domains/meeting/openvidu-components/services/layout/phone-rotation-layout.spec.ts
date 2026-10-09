import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LayoutCalculator } from '../../models/layout/layout-calculator.model';
import { ExtendedLayoutOptions, LayoutBox } from '../../models/layout/layout-types.model';
import { OpenViduLayoutOptions } from '../../models/layout/layout.model';
import { PlatformService } from '../platform/platform.service';
import { BaseLayoutService } from './layout.service';

const PIXEL_TOLERANCE = 0.01;
const CAMERA_RATIO = 9 / 16;

interface Size {
	width: number;
	height: number;
}

const PHONE = {
	landscapeInsideTheApp: { window: { width: 735, height: 218 }, grid: { width: 728, height: 148 } },
	wideLandscapeInsideTheApp: { window: { width: 852, height: 218 }, grid: { width: 843, height: 148 } },
	landscapeInABrowser: { window: { width: 780, height: 340 }, grid: { width: 772, height: 270 } },
	portrait: { window: { width: 360, height: 600 }, grid: { width: 356, height: 493 } }
};

class TestableLayoutService extends BaseLayoutService {
	override getOptions(): OpenViduLayoutOptions {
		return super.getOptions();
	}
}

describe('Two cameras on a phone', () => {
	const sizeWindow = ({ width, height }: Size): void => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => width });
		Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => height });
	};

	const twoCamerasOn = (phone: { window: Size; grid: Size }): LayoutBox[] => {
		sizeWindow(phone.window);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{
					provide: PlatformService,
					useValue: {
						isTouchDevice: () => true,
						isPhysicalMobileDevice: () => true,
						isPhysicalTablet: () => false
					}
				}
			]
		});

		const service = TestBed.runInInjectionContext(() => new TestableLayoutService());
		const options: ExtendedLayoutOptions = {
			...service.getOptions(),
			containerWidth: phone.grid.width,
			containerHeight: phone.grid.height
		};

		return new LayoutCalculator().calculateLayout(options, [false, false], CAMERA_RATIO).boxes;
	};

	const expectSideBySide = ([local, remote]: LayoutBox[]): void => {
		expect(remote.top).toBeCloseTo(local.top, 5);
		expect(remote.left).toBeGreaterThanOrEqual(local.left + local.width - PIXEL_TOLERANCE);
		expect(remote.width).toBeCloseTo(local.width, 5);
		expect(remote.height).toBeCloseTo(local.height, 5);
	};

	afterEach(() => {
		delete (window as unknown as Record<string, unknown>)['innerWidth'];
		delete (window as unknown as Record<string, unknown>)['innerHeight'];
	});

	it('sit side by side, each showing the whole camera, when held in landscape inside the app', () => {
		const boxes = twoCamerasOn(PHONE.landscapeInsideTheApp);

		expectSideBySide(boxes);
		expect(boxes[0].height).toBeCloseTo(PHONE.landscapeInsideTheApp.grid.height, 0);
		expect(boxes[0].height / boxes[0].width).toBeCloseTo(CAMERA_RATIO, 2);
	});

	it('keep the whole camera on a phone wide enough to count as a tablet by its width', () => {
		const boxes = twoCamerasOn(PHONE.wideLandscapeInsideTheApp);

		expectSideBySide(boxes);
		expect(boxes[0].height).toBeCloseTo(PHONE.wideLandscapeInsideTheApp.grid.height, 0);
		expect(boxes[0].height / boxes[0].width).toBeCloseTo(CAMERA_RATIO, 2);
	});

	it('sit side by side and fill the height when held in landscape in a browser', () => {
		const boxes = twoCamerasOn(PHONE.landscapeInABrowser);

		expectSideBySide(boxes);
		expect(boxes[0].height).toBeCloseTo(PHONE.landscapeInABrowser.grid.height, 0);
	});

	it('stack one above the other in portrait', () => {
		const [local, remote] = twoCamerasOn(PHONE.portrait);

		expect(remote.left).toBeCloseTo(local.left, 5);
		expect(remote.top).toBeGreaterThanOrEqual(local.top + local.height - PIXEL_TOLERANCE);
	});
});
