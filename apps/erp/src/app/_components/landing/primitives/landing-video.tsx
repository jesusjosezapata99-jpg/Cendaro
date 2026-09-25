"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@cendaro/ui";

import type { MediaClip, MediaFormat } from "./video-policy";
import {
  AV1_TYPE,
  H264_TYPE,
  pickFormat,
  pickRendition,
  shouldPlayVideo,
} from "./video-policy";

interface LandingVideoProps {
  clip: MediaClip;
  /** What the recording shows, for screen readers (the video is decorative). */
  label: string;
  /** Hero: attach the video immediately instead of when it nears the viewport. */
  priority?: boolean;
  /** When false the video stays paused (e.g. inactive step of a crossfade). */
  active?: boolean;
  className?: string;
}

const PHONE_QUERY = "(max-width: 767px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Share of the frame that must be visible before playback starts. */
const PLAY_RATIO = 0.35;

interface NavigatorConnection {
  connection?: { saveData?: boolean };
}

function posterVars(format: MediaFormat): CSSProperties {
  return {
    "--poster-light": `url("${format.light.poster}")`,
    "--poster-dark": `url("${format.dark.poster}")`,
  } as CSSProperties;
}

/**
 * Product recording for the public site (PLAN-2026-09-LANDING-REDESIGN §4.5).
 *
 * - Posters are CSS backgrounds keyed to the theme class, so only the
 *   poster of the active theme (and breakpoint) is downloaded, with no JS.
 * - The `<video>` is attached after hydration, near the viewport, in the
 *   resolved theme and the smallest rendition that fits; AV1 first, H.264
 *   fallback. It fades in over the poster once it actually plays.
 * - Reduced motion or data saver keeps the poster. Offscreen, inactive or
 *   hidden-tab videos pause. Fixed aspect ratio: no layout shift.
 */
export function LandingVideo({
  clip,
  label,
  priority = false,
  active = true,
  className,
}: LandingVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { resolvedTheme } = useTheme();

  const [allowed, setAllowed] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [near, setNear] = useState(priority);
  const [visible, setVisible] = useState(priority);
  const [frameWidth, setFrameWidth] = useState(0);
  /** Key of the video element that has started playing (theme/size swaps remount). */
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Playback policy and breakpoint (client only).
  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    const saveData =
      (navigator as Navigator & NavigatorConnection).connection?.saveData ===
      true;
    const update = (): void => {
      setIsPhone(phone.matches);
      setAllowed(
        shouldPlayVideo({ prefersReducedMotion: reduced.matches, saveData }),
      );
    };
    update();
    phone.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      phone.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  // Proximity (attach) and visibility (play) from one observer.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setFrameWidth(frame.clientWidth);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setNear(true);
          setFrameWidth(entry.boundingClientRect.width);
        }
        setVisible(entry.intersectionRatio >= PLAY_RATIO);
      },
      { rootMargin: "200px 0px", threshold: [0, PLAY_RATIO] },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Play only while visible, active and the tab is shown.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = (): void => {
      if (visible && active && !document.hidden) {
        video.play().catch(() => {
          // Autoplay refused (e.g. power saving): the poster stays.
        });
      } else {
        video.pause();
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  });

  const format = pickFormat(clip, isPhone);
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const rendition =
    allowed && near && frameWidth > 0 && resolvedTheme
      ? pickRendition(
          format[theme].videos,
          frameWidth,
          typeof window === "undefined" ? 1 : window.devicePixelRatio,
        )
      : undefined;

  const videoKey = rendition
    ? `${theme}-${isPhone ? "tall" : "wide"}-${rendition.width}`
    : null;

  const wideRatio = `${clip.wide.width} / ${clip.wide.height}`;
  const tallRatio = clip.tall
    ? `${clip.tall.width} / ${clip.tall.height}`
    : wideRatio;

  return (
    <div
      ref={frameRef}
      className={cn(
        "bg-card relative w-full overflow-hidden",
        "aspect-(--ratio-tall) md:aspect-(--ratio-wide)",
        className,
      )}
      style={
        {
          "--ratio-wide": wideRatio,
          "--ratio-tall": tallRatio,
        } as CSSProperties
      }
    >
      {clip.tall ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-(image:--poster-light) bg-cover bg-top md:hidden dark:bg-(image:--poster-dark)"
          style={posterVars(clip.tall)}
        />
      ) : null}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-(image:--poster-light) bg-cover bg-top dark:bg-(image:--poster-dark)",
          clip.tall && "hidden md:block",
        )}
        style={posterVars(clip.wide)}
      />

      {rendition && videoKey ? (
        <video
          key={videoKey}
          ref={videoRef}
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload={priority ? "auto" : "metadata"}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlayingKey(videoKey)}
          className={cn(
            "absolute inset-0 size-full object-cover object-top transition-opacity duration-(--motion-media)",
            playingKey === videoKey ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={rendition.av1} type={AV1_TYPE} />
          <source src={rendition.h264} type={H264_TYPE} />
        </video>
      ) : null}

      <span className="sr-only">{label}</span>
    </div>
  );
}
