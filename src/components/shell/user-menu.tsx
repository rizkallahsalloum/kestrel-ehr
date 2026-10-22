"use client"; // Popover, roving focus and the sessionStorage-backed auto-hide choice only exist in the browser.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Avatar, CheckIcon, ChevronDownIcon, cn } from "@/components/ui";
import { PRIVACY_IDLE_OPTIONS } from "@/features/privacy/config";
import { usePrivacy } from "@/features/privacy/components/privacy-provider";
import { getIdleSettingStore, getPrivacyStore } from "@/features/privacy/store";
import { lastPatientStore } from "./last-patient";

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []);
}

const itemClass =
  "flex min-h-control-sm w-full items-center gap-2 rounded-control px-2.5 text-left text-label text-ink hover:bg-surface-warm focus-visible:bg-surface-warm";

/**
 * Account menu (WAI-ARIA menu button). The name, role and avatar open a native popover with the
 * "Privacy auto-hide" choice and Sign out. Arrow keys, Home and End move focus; Escape closes and
 * returns focus to the trigger; Tab and outside clicks close it.
 */
export function UserMenu({
  fullName,
  roleLabel,
  initials,
  signOutAction,
}: {
  fullName: string;
  roleLabel: string;
  initials: string;
  signOutAction?: () => Promise<void>;
}) {
  const { idleMs, setIdleMs } = usePrivacy();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const groupLabelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    const menu = menuRef.current;
    if (menu?.matches(":popover-open")) menu.hidePopover();
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Which item gets focus when the menu opens: the trigger's arrow keys pick the last or checked one.
  const focusOnOpen = useRef<"first" | "last" | "checked">("first");

  const openMenu = (focus: "first" | "last" | "checked") => {
    const menu = menuRef.current;
    if (!menu || typeof menu.showPopover !== "function") return;
    focusOnOpen.current = focus;
    if (!menu.matches(":popover-open")) menu.showPopover();
  };

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    // Below the trigger, right edges aligned; measured on every open because the top bar reflows.
    const onBeforeToggle = (event: Event) => {
      const trigger = triggerRef.current;
      if ((event as ToggleEvent).newState !== "open" || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      menu.style.top = `calc(${rect.bottom}px + var(--spacing-xs))`;
      menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
    };
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (!isOpen) return;
      const all = menuItems(menu);
      const focus = focusOnOpen.current;
      focusOnOpen.current = "first";
      const target =
        focus === "last"
          ? all.at(-1)
          : focus === "checked"
            ? (all.find((item) => item.getAttribute("aria-checked") === "true") ?? all[0])
            : all[0];
      target?.focus();
    };
    const onResize = () => close(false);
    menu.addEventListener("beforetoggle", onBeforeToggle);
    menu.addEventListener("toggle", onToggle);
    window.addEventListener("resize", onResize);
    return () => {
      menu.removeEventListener("beforetoggle", onBeforeToggle);
      menu.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", onResize);
    };
  }, [close]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowUp" ? "last" : "checked");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = menuItems(menuRef.current);
    const index = all.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      all[(next + all.length) % all.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        return move(index + 1);
      case "ArrowUp":
        return move(index - 1);
      case "Home":
        return move(0);
      case "End":
        return move(all.length - 1);
      case "Escape":
        event.preventDefault();
        return close(true);
      case "Tab":
        // Focus goes back to the trigger first, so the browser's Tab continues from there.
        return close(true);
    }
  };

  const choose = (ms: number, keepOpen: boolean) => {
    setIdleMs(ms);
    if (!keepOpen) close(true);
  };

  const clearPrivacy = () => {
    getPrivacyStore().forget();
    getIdleSettingStore().clear();
    lastPatientStore.set(null);
  };

  return (
    <div className="flex items-center md:border-l md:border-line-subtle md:pl-4.5">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        popoverTarget={menuId}
        onKeyDown={onTriggerKeyDown}
        className="flex items-center gap-2.5 rounded-pill py-0.5 pr-1.5 pl-0.5 hover:bg-surface-warm xl:pl-2.5"
      >
        <span className="text-right max-xl:sr-only" data-testid="current-user">
          <span className="block text-label font-semibold whitespace-nowrap text-ink">
            {fullName}
            <span className="sr-only-inline">,</span>
          </span>{" "}
          <span className="block text-caption text-ink-secondary">
            {roleLabel}
            <span className="sr-only-inline">, account menu</span>
          </span>
        </span>
        <Avatar initials={initials} tone="ink" size="sm" />
        <ChevronDownIcon className={cn("text-ink-muted transition-transform", open && "rotate-180")} />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label="Account"
        onKeyDown={onMenuKeyDown}
        className="fixed inset-auto m-0 w-60 rounded-panel border border-line-subtle bg-surface-pure p-1.5 text-ink shadow-level-2"
      >
        <div role="group" aria-labelledby={groupLabelId}>
          <p id={groupLabelId} role="presentation" className="px-2.5 pt-1.5 pb-1 label-caps">
            Privacy auto-hide
          </p>
          {PRIVACY_IDLE_OPTIONS.map((option) => {
            const checked = option.ms === idleMs;
            return (
              <button
                key={option.ms}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                data-menu-item=""
                onClick={() => choose(option.ms, false)}
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    choose(option.ms, true);
                  }
                }}
                className={itemClass}
              >
                <span className="grid size-4 place-items-center">
                  {checked && <CheckIcon className="size-3.5 text-accent" />}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
        <div role="separator" className="my-1.5 border-t border-line-subtle" />
        <form action={signOutAction} onSubmit={clearPrivacy} role="none">
          <button
            type={signOutAction ? "submit" : "button"}
            role="menuitem"
            tabIndex={-1}
            data-menu-item=""
            onClick={signOutAction ? undefined : clearPrivacy}
            className={itemClass}
          >
            <span className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
