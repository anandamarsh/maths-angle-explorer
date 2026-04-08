import { expect, test } from "@playwright/test";

const BASE_URL = "http://localhost:4002";

test.describe("demo video recording", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const anchorClick = HTMLAnchorElement.prototype.click;
      Object.defineProperty(window, "__lastDownload", {
        configurable: true,
        writable: true,
        value: null,
      });
      HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
        if (this.download) {
          (window as Window & {
            __lastDownload: { download: string; href: string } | null;
          }).__lastDownload = {
            download: this.download,
            href: this.href,
          };
        }
        return anchorClick.call(this);
      };

      class FakeTrack {
        kind: string;
        enabled = true;
        readyState = "live";
        private listeners = new Map<string, Array<() => void>>();

        constructor(kind: string) {
          this.kind = kind;
        }

        stop() {
          this.readyState = "ended";
          this.dispatchEvent("ended");
        }

        addEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          current.push(listener);
          this.listeners.set(type, current);
        }

        removeEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          this.listeners.set(type, current.filter((item) => item !== listener));
        }

        dispatchEvent(type: string) {
          for (const listener of this.listeners.get(type) ?? []) listener();
        }
      }

      class FakeMediaStream {
        private videoTrack = new FakeTrack("video");
        private audioTrack = new FakeTrack("audio");

        getTracks() {
          return [this.videoTrack, this.audioTrack];
        }

        getVideoTracks() {
          return [this.videoTrack];
        }

        getAudioTracks() {
          return [this.audioTrack];
        }
      }

      class FakeMediaRecorder {
        static isTypeSupported() {
          return true;
        }

        stream: FakeMediaStream;
        state: "inactive" | "recording" = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        constructor(stream: FakeMediaStream) {
          this.stream = stream;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          if (this.state !== "recording") return;
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob(["demo-video"], { type: "video/webm" }),
          });
          this.onstop?.();
        }
      }

      Object.defineProperty(window.navigator, "mediaDevices", {
        configurable: true,
        value: {
          getDisplayMedia: async () => new FakeMediaStream(),
        },
      });

      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: FakeMediaRecorder,
      });
    });
  });

  test("runs intro to autoplay to outro and downloads a webm", async ({ page }) => {
    test.setTimeout(240000);

    await page.goto(`${BASE_URL}/?demoTestScale=0.1`);
    await page.waitForSelector("#root > *", { timeout: 15000 });

    await expect(page.locator('button[title="Record demo video"]').first()).toBeVisible();
    await page.locator('button[title="Record demo video"]').first().click();

    const introOverlay = page.getByTestId("demo-overlay-intro");
    await expect(introOverlay).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[title="Record demo video"]').first()).toBeHidden();
    await expect(page.locator('[aria-hidden="true"].rounded-full').first()).toBeVisible();

    const introFrame = page.frameLocator('iframe[title="Demo intro screen"]');
    await expect(introFrame.getByText("Angle Explorer")).toBeVisible({ timeout: 5000 });
    await expect(
      introFrame.locator("body"),
    ).toContainText("MA2-16MG / MA3-16MG", { timeout: 5000 });

    await expect(introOverlay).toBeHidden({ timeout: 20000 });

    const outroOverlay = page.getByTestId("demo-overlay-outro");
    await expect(outroOverlay).toBeVisible({ timeout: 180000 });

    await page.waitForFunction(() => {
      const value = (window as Window & {
        __lastDownload?: { download?: string } | null;
      }).__lastDownload;
      return Boolean(value?.download && /^angle-explorer-demo-.*\.webm$/.test(value.download));
    }, { timeout: 30000 });
  });
});
