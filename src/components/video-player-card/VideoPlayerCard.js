/**
 * VideoPlayerCard — кастомный плеер (play/pause, mute, scrub, speed 1×/1.5×/2×).
 * Figma: VideoPlayerCard `616:1409`.
 */

import "../../../styles/video-player-card.css";
import { getStrings } from "../../i18n.js";
import playIconSvg from "../../assets/video/icon-play.svg?raw";
import pauseIconSvg from "../../assets/video/icon-pause.svg?raw";
import soundIconSvg from "../../assets/video/icon-sound.svg?raw";
import muteIconSvg from "../../assets/video/icon-mute.svg?raw";
import playCompactIconSvg from "../../assets/video/icon-play-compact.svg?raw";

const PLAYBACK_RATES = [1, 1.5, 2];

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * @param {string} raw
 * @param {string} className
 * @returns {HTMLElement}
 */
function iconFromRaw(raw, className) {
  const wrap = document.createElement("span");
  wrap.className = className;
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = raw.trim();
  return wrap;
}

/**
 * @param {{
 *   src?: string;
 *   ariaLabel?: string;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   setSrc: (url: string) => void;
 *   play: () => void;
 *   pause: () => void;
 *   destroy: () => void;
 * }}
 */
export function createVideoPlayerCard(opts = {}) {
  const t = getStrings();
  let rateIndex = 0;
  let seeking = false;

  const root = document.createElement("div");
  root.className = "video-player-card";
  root.setAttribute("role", "region");
  root.setAttribute(
    "aria-label",
    opts.ariaLabel || t.videoPlayerAria || "Video",
  );

  const video = document.createElement("video");
  video.className = "video-player-card__video";
  video.playsInline = true;
  video.preload = "metadata";
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  if (opts.src) video.src = opts.src;

  const scrim = document.createElement("div");
  scrim.className = "video-player-card__scrim";
  scrim.setAttribute("aria-hidden", "true");

  const centerBtn = document.createElement("button");
  centerBtn.type = "button";
  centerBtn.className = "video-player-card__center";
  centerBtn.setAttribute(
    "aria-label",
    t.videoPlayerPlayAria || "Play",
  );
  centerBtn.append(iconFromRaw(playCompactIconSvg, "video-player-card__center-icon"));

  const progress = document.createElement("div");
  progress.className = "video-player-card__progress";
  progress.setAttribute("role", "slider");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "0");
  progress.setAttribute("aria-valuenow", "0");
  progress.setAttribute(
    "aria-label",
    t.videoPlayerSeekAria || "Seek",
  );
  progress.tabIndex = 0;

  const progressTrack = document.createElement("div");
  progressTrack.className = "video-player-card__progress-track";
  const progressPlayed = document.createElement("div");
  progressPlayed.className = "video-player-card__progress-played";
  const progressKnob = document.createElement("div");
  progressKnob.className = "video-player-card__progress-knob";
  progressTrack.append(progressPlayed, progressKnob);
  progress.append(progressTrack);

  const controls = document.createElement("div");
  controls.className = "video-player-card__controls";

  const left = document.createElement("div");
  left.className = "video-player-card__controls-left";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "video-player-card__btn";
  playBtn.setAttribute("aria-label", t.videoPlayerPlayAria || "Play");
  const playIcon = iconFromRaw(playIconSvg, "video-player-card__btn-icon");
  const pauseIcon = iconFromRaw(pauseIconSvg, "video-player-card__btn-icon");
  pauseIcon.hidden = true;
  playBtn.append(playIcon, pauseIcon);

  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.className = "video-player-card__btn";
  muteBtn.setAttribute("aria-label", t.videoPlayerMuteAria || "Mute");
  const soundIcon = iconFromRaw(soundIconSvg, "video-player-card__btn-icon");
  const muteIcon = iconFromRaw(muteIconSvg, "video-player-card__btn-icon");
  muteIcon.hidden = true;
  muteBtn.append(soundIcon, muteIcon);

  const time = document.createElement("div");
  time.className = "video-player-card__time";
  time.setAttribute("aria-hidden", "true");
  const timeCurrent = document.createElement("span");
  timeCurrent.className = "video-player-card__time-current";
  timeCurrent.textContent = "00:00";
  const timeSep = document.createElement("span");
  timeSep.className = "video-player-card__time-sep";
  timeSep.textContent = "/";
  const timeTotal = document.createElement("span");
  timeTotal.className = "video-player-card__time-total";
  timeTotal.textContent = "00:00";
  time.append(timeCurrent, timeSep, timeTotal);

  left.append(playBtn, muteBtn, time);

  const right = document.createElement("div");
  right.className = "video-player-card__controls-right";

  const speedBtn = document.createElement("button");
  speedBtn.type = "button";
  speedBtn.className = "video-player-card__speed";
  speedBtn.setAttribute(
    "aria-label",
    t.videoPlayerSpeedAria || "Playback speed",
  );
  speedBtn.textContent = "1x";

  right.append(speedBtn);
  controls.append(left, right);

  root.append(video, scrim, centerBtn, progress, controls);

  function syncPlayingUi() {
    const playing = !video.paused && !video.ended;
    root.classList.toggle("video-player-card--playing", playing);
    playIcon.hidden = playing;
    pauseIcon.hidden = !playing;
    centerBtn.hidden = playing;
    playBtn.setAttribute(
      "aria-label",
      playing
        ? t.videoPlayerPauseAria || "Pause"
        : t.videoPlayerPlayAria || "Play",
    );
    centerBtn.setAttribute(
      "aria-label",
      playing
        ? t.videoPlayerPauseAria || "Pause"
        : t.videoPlayerPlayAria || "Play",
    );
  }

  function syncMuteUi() {
    const muted = Boolean(video.muted || video.volume === 0);
    soundIcon.hidden = muted;
    muteIcon.hidden = !muted;
    muteBtn.setAttribute(
      "aria-label",
      muted
        ? t.videoPlayerUnmuteAria || "Unmute"
        : t.videoPlayerMuteAria || "Mute",
    );
  }

  function syncProgress() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const current = seeking
      ? Number(progress.dataset.seekPreview || video.currentTime || 0)
      : video.currentTime || 0;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
    progressPlayed.style.width = `${ratio * 100}%`;
    progressKnob.style.left = `${ratio * 100}%`;
    progress.setAttribute("aria-valuemax", String(Math.floor(duration)));
    progress.setAttribute("aria-valuenow", String(Math.floor(current)));
    timeCurrent.textContent = formatTime(current);
    timeTotal.textContent = formatTime(duration);
  }

  /**
   * @param {number} clientX
   */
  function seekFromClientX(clientX) {
    const rect = progressTrack.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const next = ratio * duration;
    progress.dataset.seekPreview = String(next);
    if (Number.isFinite(next)) {
      video.currentTime = next;
    }
    syncProgress();
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          /* autoplay / gesture — silent */
        });
      }
    } else {
      video.pause();
    }
  }

  function cycleSpeed() {
    rateIndex = (rateIndex + 1) % PLAYBACK_RATES.length;
    const rate = PLAYBACK_RATES[rateIndex] ?? 1;
    video.playbackRate = rate;
    speedBtn.textContent = `${rate}x`;
  }

  playBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePlay();
  });
  centerBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePlay();
  });
  muteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    video.muted = !video.muted;
    syncMuteUi();
  });
  speedBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    cycleSpeed();
  });

  video.addEventListener("click", () => {
    togglePlay();
  });
  video.addEventListener("play", syncPlayingUi);
  video.addEventListener("pause", syncPlayingUi);
  video.addEventListener("ended", () => {
    syncPlayingUi();
    syncProgress();
  });
  video.addEventListener("timeupdate", () => {
    if (!seeking) syncProgress();
  });
  video.addEventListener("loadedmetadata", syncProgress);
  video.addEventListener("durationchange", syncProgress);
  video.addEventListener("volumechange", syncMuteUi);

  progress.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    seeking = true;
    progress.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  });
  progress.addEventListener("pointermove", (event) => {
    if (!seeking) return;
    seekFromClientX(event.clientX);
  });
  function endSeek(event) {
    if (!seeking) return;
    seeking = false;
    delete progress.dataset.seekPreview;
    if (progress.hasPointerCapture?.(event.pointerId)) {
      progress.releasePointerCapture(event.pointerId);
    }
    syncProgress();
  }
  progress.addEventListener("pointerup", endSeek);
  progress.addEventListener("pointercancel", endSeek);

  progress.addEventListener("keydown", (event) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) return;
    const step = Math.max(1, duration * 0.05);
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      video.currentTime = Math.min(duration, video.currentTime + step);
      syncProgress();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - step);
      syncProgress();
    } else if (event.key === "Home") {
      event.preventDefault();
      video.currentTime = 0;
      syncProgress();
    } else if (event.key === "End") {
      event.preventDefault();
      video.currentTime = duration;
      syncProgress();
    }
  });

  syncPlayingUi();
  syncMuteUi();
  syncProgress();

  return {
    root,
    /**
     * @param {string} url
     */
    setSrc(url) {
      video.src = url;
      video.load();
      syncPlayingUi();
      syncProgress();
    },
    play() {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => undefined);
      }
    },
    pause() {
      video.pause();
    },
    destroy() {
      video.pause();
      video.removeAttribute("src");
      video.load();
      root.replaceChildren();
    },
  };
}
