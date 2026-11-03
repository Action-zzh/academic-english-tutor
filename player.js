/* Lecture sequencing is separate from the SDK and UI, so it can be tested offline. */
(function (root) {
  'use strict';
  class LecturePlayer {
    constructor(options) {
      this.slides = options.slides;
      this.speak = options.speak;
      this.stopSpeech = options.stopSpeech;
      this.onChange = options.onChange || (() => {});
      this.onCue = options.onCue || (() => {});
      this.onError = options.onError || (() => {});
      this.autoAdvance = options.autoAdvance || (() => false);
      this.index = 0;
      this.cue = 0;
      this.status = 'ready';
      this._epoch = 0;
    }
    emit() { this.onChange({ index: this.index, cue: this.cue, status: this.status }); }
    pause(reason = 'paused') {
      ++this._epoch;
      this.status = reason;
      this.stopSpeech();
      this.emit();
    }
    select(index) {
      this.pause();
      this.index = Math.min(this.slides.length - 1, Math.max(0, index));
      this.cue = 0;
      this.status = 'ready';
      this.emit();
    }
    async play() {
      if (this.status === 'playing') return;
      if (this.cue >= this.slides[this.index].cues.length) this.cue = 0;
      const epoch = ++this._epoch;
      this.status = 'playing';
      this.emit();
      try {
        while (epoch === this._epoch && this.status === 'playing') {
          const cues = this.slides[this.index].cues;
          if (this.cue >= cues.length) {
            if (!this.autoAdvance() || this.index === this.slides.length - 1) {
              this.status = 'complete';
              this.emit();
              return;
            }
            this.index++;
            this.cue = 0;
            this.emit();
            continue;
          }
          const entry = cues[this.cue];
          this.onCue(entry, this.index, this.cue);
          const result = await this.speak(entry.en);
          // Cancellation never advances the cursor. Resume replays the
          // interrupted sentence rather than skipping part of the lecture.
          if (epoch !== this._epoch || this.status !== 'playing') return;
          if (result !== 'completed') throw new Error('This sentence did not finish. Please resume after checking the connection.');
          this.cue++;
          this.emit();
          // Allow duplicate SDK callback layers to drain before next request.
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      } catch (error) {
        if (epoch !== this._epoch) return;
        this.status = 'error';
        this.stopSpeech();
        this.emit();
        this.onError(error);
      }
    }
  }
  root.LecturePlayer = LecturePlayer;
})(typeof window === 'undefined' ? globalThis : window);
