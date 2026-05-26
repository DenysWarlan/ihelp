import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private readonly doc = inject(DOCUMENT);
  private audioContext: any = null;

  play(): void {
    const win = this.doc.defaultView as any;
    if (!win) return;

    try {
      if (!this.audioContext) {
        const AC = win.AudioContext ?? win.webkitAudioContext;
        if (!AC) return;
        this.audioContext = new AC();
      }

      const ctx = this.audioContext;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not available — silently ignore
    }
  }
}
