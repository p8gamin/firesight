/**
 * ProfileButton (web only) — the top-right auth CTA of the hero nav.
 *
 * A faithful adaptation of the Emerald UI AnimatedDropdown (MIT,
 * emerald-ui.com) provided as the design reference:
 * - the outline `Button` trigger (rounded-md, h-10 px-4, text-sm
 *   font-medium, border + background, hover accent) becomes a plain
 *   <button> styled by `.fs-auth-btn` in designCss (this app ships no
 *   Tailwind/shadcn, so the reference's dark zinc tokens live in CSS);
 * - the same `useClickOutside` / `OnClickOutside` wrapper closes the menu;
 * - the same AnimatePresence panel (opacity/y/scale, 0.2s easeOut, role
 *   listbox) with the same staggered item reveal (0.03s, x: -20 → 0);
 * - the same rotating ChevronDown (0.2s easeInOut).
 *
 * Differences required by FireSight:
 * - item actions are callbacks, not links (Settings → /settings, Log Out →
 *   Supabase signOut via the shared AuthProvider);
 * - the trigger carries the signed-in avatar between the text and the
 *   chevron (order: text → profile image → dropdown arrow); signed-out
 *   users get the same button without the image;
 * - session state comes from the shared AuthProvider — no new auth code.
 */
import * as React from 'react';
import { useRouter } from 'expo-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';
import { defaultAvatarUri, googleAvatarUrl } from '../lib/userDisplay';

/** Click-outside hook from the reference component (DOM events, web only). */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

/** OnClickOutside wrapper from the reference component. */
const OnClickOutside: React.FC<{
  children: React.ReactNode;
  onClickOutside: () => void;
}> = ({ children, onClickOutside }) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, onClickOutside);
  return <div ref={wrapperRef}>{children}</div>;
};

interface DropdownAction {
  name: string;
  onSelect: () => void;
}

export default function ProfileButton() {
  const router = useRouter();
  const { session, user, signOut } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  // Remembers which Google URL failed so the default avatar takes over.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);

  const signedIn = !!session;
  const avatarUrl = signedIn ? googleAvatarUrl(user) : null;
  // Google users → their Google avatar; email/password users (and any
  // avatar URL that fails to load) → the bundled default avatar.
  const avatarSrc = !avatarUrl || failedUrl === avatarUrl ? defaultAvatarUri() : avatarUrl;

  const items: DropdownAction[] = [
    {
      name: 'Settings',
      onSelect: () => {
        setIsOpen(false);
        router.push('/settings');
      },
    },
    {
      name: 'Log Out',
      onSelect: () => {
        setIsOpen(false);
        void signOut();
      },
    },
  ];

  return (
    <OnClickOutside onClickOutside={() => setIsOpen(false)}>
      <div data-state={isOpen ? 'open' : 'closed'} style={{ position: 'relative', display: 'inline-block' }}>
        {/* Trigger — the reference's outline Button. Inner order is fixed:
            text → profile image (signed in only) → dropdown arrow. */}
        <button
          type="button"
          className="fs-auth-btn"
          aria-haspopup={signedIn ? 'listbox' : undefined}
          aria-expanded={signedIn ? isOpen : undefined}
          aria-label={signedIn ? 'Profile menu' : 'Sign in or sign up'}
          onClick={() => {
            if (signedIn) setIsOpen((v) => !v);
            else router.push('/signin');
          }}
        >
          <span>{signedIn ? 'Profile' : 'Sign In/Up'}</span>
          {signedIn && avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={20}
              height={20}
              onError={() => avatarUrl && setFailedUrl(avatarUrl)}
              className="fs-auth-btn-avatar"
            />
          ) : null}
          <motion.span
            style={{ display: 'inline-flex' }}
            animate={{ rotate: signedIn && isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronDown size={20} strokeWidth={2} />
          </motion.span>
        </button>

        <AnimatePresence>
          {signedIn && isOpen && (
            <motion.div
              role="listbox"
              aria-label="Profile actions"
              /* Reference panel: opens below the trigger, centered on it.
               left: 50% comes from .fs-auth-menu; motion composes the
               translateX(-50%) with the enter/exit transforms. */
              style={{ x: '-50%' }}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fs-auth-menu"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {items.map((item) => (
                  <motion.button
                    key={item.name}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={item.onSelect}
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    className="fs-auth-item"
                  >
                    {item.name}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OnClickOutside>
  );
}
