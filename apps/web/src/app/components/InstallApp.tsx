import { Button } from '@slideops/design-system';
import { Download } from '@slideops/icons';
import { useEffect, useState } from 'react';

/*
 * Offering to install the app.
 *
 * The manifest and the service worker made it installable some time ago, and
 * almost nobody found out: the browser's own prompt lives behind a menu on
 * desktop and a banner it shows on its own schedule on Android. An installable
 * app nobody is told about is the same as one that is not.
 *
 * The browser decides whether installing is possible. It fires an event when it
 * is, and that event is the only way to open the real prompt: there is no API to
 * ask for one. So this listens, shows a control only while it holds a usable
 * event, and disappears once the app is installed.
 *
 * It never renders in an already installed window, which would offer to install
 * something you are looking at.
 */

/** The event the browser fires when the app can be installed. Not in lib.dom. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Whether this window is already the installed app rather than a browser tab. */
function runningInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // The second is how iOS reports it, which does not implement display-mode.
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** A control that installs the app, shown only when that is actually possible. */
export function InstallApp() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(runningInstalled);

  useEffect(() => {
    const onAvailable = (e: Event) => {
      // Without this the browser shows its own banner on its own schedule, and
      // the app cannot decide where the offer belongs.
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onAvailable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !event) {
    return null;
  }

  const install = async () => {
    // The event is single use: once prompted it cannot be reused, so it is
    // cleared whatever the answer. Declining hides the offer until the browser
    // decides to make it again, which is the right way round.
    const pending = event;
    setEvent(null);
    try {
      await pending.prompt();
      await pending.userChoice;
    } catch {
      // A prompt the browser refused to show is not worth reporting: nothing
      // was lost and the offer will come back.
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={install} title="Install SlideOps as an app">
      <Download width={15} height={15} aria-hidden />
      Install
    </Button>
  );
}
