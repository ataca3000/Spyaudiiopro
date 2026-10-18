/**
 * Background Audio & MediaSession Keep-Alive Utility
 * 
 * Ensures that audio monitoring, recording, and processing remain active
 * even when the user switches apps, switches browser tabs, or locks their device screen.
 */

// 1-second silent WAV encoded as base64 data URI
// This silent audio loop engages the OS-level media playback pipeline
// (CoreAudio on iOS / AudioManager on Android), preventing the browser from
// freezing or suspending Web Audio contexts in the background.
const SILENT_WAV_BASE64 =
  'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP//';

export class BackgroundAudioController {
  private audioElement: HTMLAudioElement | null = null;
  private wakeLockSentinel: unknown = null;
  private isKeepAliveActive: boolean = false;
  private attachedAudioContexts: Set<AudioContext> = new Set();
  private onVisibilityChangeHandler: (() => void) | null = null;

  constructor() {
    this.setupVisibilityListeners();
  }

  /**
   * Register an AudioContext so it gets automatically resumed
   * if the browser suspends or interrupts it in the background.
   */
  public registerAudioContext(ctx: AudioContext) {
    this.attachedAudioContexts.add(ctx);

    ctx.addEventListener('statechange', () => {
      if (this.isKeepAliveActive && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
  }

  public unregisterAudioContext(ctx: AudioContext) {
    this.attachedAudioContexts.delete(ctx);
  }

  /**
   * Start background keep-alive:
   * 1. Plays inaudible silent audio loop with playsInline
   * 2. Sets up MediaSession API for OS lock-screen presence
   * 3. Requests Screen WakeLock if supported
   */
  public async startKeepAlive(options: {
    title?: string;
    artist?: string;
    isRecording?: boolean;
    onStopRequest?: () => void;
  }) {
    this.isKeepAliveActive = true;

    // 1. Silent HTML5 Audio Element Loop
    try {
      if (!this.audioElement) {
        this.audioElement = new Audio(SILENT_WAV_BASE64);
        this.audioElement.loop = true;
        this.audioElement.volume = 0.01; // inaudible
        // Important attributes for mobile background playback
        this.audioElement.setAttribute('playsinline', 'true');
        this.audioElement.setAttribute('webkit-playsinline', 'true');
      }

      await this.audioElement.play().catch((err) => {
        console.warn('Silent audio keep-alive play warning (may require user interaction):', err);
      });
    } catch (e) {
      console.warn('Audio keep-alive initialization error:', e);
    }

    // 2. Setup MediaSession API (Lock screen metadata & active audio status)
    this.updateMediaSession({
      title: options.title || (options.isRecording ? '🔴 Grabando Audio en Vivo' : '🎧 Monitoreo de Audio en Vivo'),
      artist: options.artist || 'AudioLive PWA',
      isRecording: options.isRecording,
      onStopRequest: options.onStopRequest,
    });

    // 3. Request Screen WakeLock if available (prevents accidental screen dimming during recording)
    this.requestWakeLock();

    // 4. Ensure all registered audio contexts are active
    this.resumeAllContexts();
  }

  /**
   * Update MediaSession metadata (e.g. when switching from listening to recording)
   */
  public updateMediaSession(options: {
    title?: string;
    artist?: string;
    isRecording?: boolean;
    onStopRequest?: () => void;
  }) {
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: options.title || (options.isRecording ? '🔴 Grabando Audio en Vivo' : '🎧 Monitoreo de Audio en Vivo'),
          artist: options.artist || 'AudioLive PWA',
          album: 'Amplificador & Monitoreo en Tiempo Real',
          artwork: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        });

        navigator.mediaSession.playbackState = 'playing';

        // Action handlers so the user can interact via OS lock screen
        if (options.onStopRequest) {
          navigator.mediaSession.setActionHandler('stop', () => {
            options.onStopRequest?.();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            options.onStopRequest?.();
          });
        }
      } catch (err) {
        console.warn('MediaSession setup warning:', err);
      }
    }
  }

  /**
   * Stop background keep-alive and release locks
   */
  public stopKeepAlive() {
    this.isKeepAliveActive = false;

    // Pause silent audio loop
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // ignore
      }
    }

    // Release WakeLock
    this.releaseWakeLock();

    // Clear MediaSession playback state
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('pause', null);
      } catch {
        // ignore
      }
    }
  }

  private async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        const nav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } };
        this.wakeLockSentinel = await nav.wakeLock.request('screen');
      } catch {
        // WakeLock request can fail if battery saver is on or tab is inactive; safe to ignore
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        (this.wakeLockSentinel as { release: () => Promise<void> }).release().catch(() => {});
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }

  private resumeAllContexts() {
    for (const ctx of this.attachedAudioContexts) {
      if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
        ctx.resume().catch(() => {});
      }
    }
  }

  private setupVisibilityListeners() {
    this.onVisibilityChangeHandler = () => {
      if (this.isKeepAliveActive) {
        // Whenever user comes back to the tab, or even during background transition,
        // re-verify audio context states
        this.resumeAllContexts();

        // Re-request wake lock if tab became visible again
        if (!document.hidden && !this.wakeLockSentinel) {
          this.requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', this.onVisibilityChangeHandler);
    window.addEventListener('focus', this.onVisibilityChangeHandler);
  }

  public destroy() {
    this.stopKeepAlive();
    if (this.onVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler);
      window.removeEventListener('focus', this.onVisibilityChangeHandler);
      this.onVisibilityChangeHandler = null;
    }
    this.attachedAudioContexts.clear();
  }
}

// Singleton instance
export const backgroundAudio = new BackgroundAudioController();
