"use client";

import { useEffect } from "react";
import { isIosLike, isPwaInstalled } from "@/lib/pwaInstall";

export default function PwaZoomPolicy() {
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;

    const originalContent = viewport.content;
    const standaloneMode = window.matchMedia("(display-mode: standalone)");
    const coarsePointer = window.matchMedia("(any-pointer: coarse)");
    const ios = isIosLike(navigator.userAgent, navigator.maxTouchPoints);
    let pinchBlockersAttached = false;

    const preventGesture = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    const updatePolicy = () => {
      const installed = isPwaInstalled(
        standaloneMode.matches,
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
      const touchDevice = navigator.maxTouchPoints > 0 || coarsePointer.matches;
      const disableZoom = installed && touchDevice;

      if (disableZoom) {
        const scalableContent = originalContent.replace(/(?:^|,)\s*(?:maximum-scale|user-scalable)\s*=[^,]*/gi, "");
        viewport.content = `${scalableContent}, maximum-scale=1, user-scalable=no`;
      } else {
        viewport.content = originalContent;
      }

      const shouldBlockIosPinch = disableZoom && ios;
      if (shouldBlockIosPinch && !pinchBlockersAttached) {
        document.addEventListener("gesturestart", preventGesture, { passive: false });
        document.addEventListener("gesturechange", preventGesture, { passive: false });
        document.addEventListener("touchmove", preventMultiTouch, { passive: false });
        pinchBlockersAttached = true;
      } else if (!shouldBlockIosPinch && pinchBlockersAttached) {
        document.removeEventListener("gesturestart", preventGesture);
        document.removeEventListener("gesturechange", preventGesture);
        document.removeEventListener("touchmove", preventMultiTouch);
        pinchBlockersAttached = false;
      }
    };

    updatePolicy();
    standaloneMode.addEventListener("change", updatePolicy);
    coarsePointer.addEventListener("change", updatePolicy);
    window.addEventListener("resize", updatePolicy);
    window.addEventListener("orientationchange", updatePolicy);

    return () => {
      standaloneMode.removeEventListener("change", updatePolicy);
      coarsePointer.removeEventListener("change", updatePolicy);
      window.removeEventListener("resize", updatePolicy);
      window.removeEventListener("orientationchange", updatePolicy);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouch);
      viewport.content = originalContent;
    };
  }, []);

  return null;
}
