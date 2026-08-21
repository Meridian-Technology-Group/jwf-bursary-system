"use client";

/**
 * GuardedLink — a `next/link` that asks the unsaved-changes guard first.
 *
 * The portal stepper used to render each step as a raw `<a href>`. That is a
 * full document load: the browser tears the page down and every value typed
 * since the last save goes with it (CF-19 — a completed income section and four
 * uploaded documents, lost to one sidebar click).
 *
 * This wraps `next/link` rather than replacing it with a hand-rolled
 * `router.push`, so prefetching, middleware-aware routing and modified-click
 * behaviour (⌘/ctrl/shift-click, middle-click, `target=_blank`) all stay
 * exactly as Next provides them. The only added behaviour is: when the mounted
 * section form holds unsaved edits, the default navigation is cancelled and the
 * guard's prompt takes over — it performs the navigation itself once the
 * applicant has chosen save or discard.
 *
 * Outside an `UnsavedChangesProvider` the guard is inert and this is a plain
 * `Link`.
 */

import * as React from "react";
import Link from "next/link";
import { isModifiedClick } from "@/lib/portal/unsaved-changes";
import { useUnsavedChanges } from "./unsaved-changes-context";

type GuardedLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export const GuardedLink = React.forwardRef<
  HTMLAnchorElement,
  GuardedLinkProps
>(function GuardedLink({ href, onClick, target, ...rest }, ref) {
  const { requestNavigation } = useUnsavedChanges();

  return (
    <Link
      {...rest}
      ref={ref}
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (isModifiedClick(event, target)) return;
        // `false` = the guard has taken over and will navigate itself.
        if (!requestNavigation(href)) {
          event.preventDefault();
        }
      }}
    />
  );
});
