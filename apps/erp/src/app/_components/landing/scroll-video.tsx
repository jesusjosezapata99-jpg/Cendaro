"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface ScrollVideoProps {
  /** Path to the video file (e.g. "/videos/hero-dashboard.mp4") */
  src: string;
  /** Optional poster image shown before video loads */
  poster?: string;
  /** Additional CSS classes */
  className?: string;
  /** IntersectionObserver threshold (0-1). Default 0.4 = 40% visible triggers play */
  threshold?: number;
  /** Whether to start playing immediately (for hero / above-fold) */
  eager?: boolean;
}

/**
 * Scroll-triggered video player.
 * - Autoplays (muted) when the element enters the viewport
 * - Pauses when it leaves
 * - Shows poster image for `prefers-reduced-motion`
 * - Prevents CLS with fixed aspect-ratio
 */
export function ScrollVideo({
  src,
  poster,
  className = "",
  threshold = 0.4,
  eager = false,
}: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced) return;

    /* Eager videos (hero) play immediately */
    if (eager) {
      video.play().catch(() => {
        /* autoplay may be blocked */
      });
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          video.play().catch(() => {
            /* autoplay may be blocked */
          });
        } else {
          video.pause();
        }
      },
      { threshold },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced, threshold, eager]);

  /* Reduced-motion: show a static poster image instead */
  if (reduced) {
    return poster ? (
      <div
        aria-hidden="true"
        className={`w-full bg-cover bg-center ${className}`}
        style={{ aspectRatio: "16/9", backgroundImage: `url(${poster})` }}
      />
    ) : (
      <div
        className={`bg-card w-full ${className}`}
        style={{ aspectRatio: "16/9" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      className={`w-full object-cover ${className}`}
      style={{ aspectRatio: "16/9" }}
      aria-hidden="true"
    />
  );
}
