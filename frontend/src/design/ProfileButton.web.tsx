/**
 * ProfileButton (web only) — the top-right CTA of the hero nav.
 *
 * Signed OUT → a plain pill that says "Sign In/Up" and routes to /signin.
 * Signed IN  → the same pill reads "Profile" and opens an animated dropdown
 * with two actions: Settings and Log Out.
 *
 * Dropdown adapted from the provided Emerald UI AnimatedDropdown (MIT,
 * emerald-ui.com): framer-motion open/exit + chevron rotation, staggered
 * item reveal, click-outside to close. Restyled into FireSight's dark
 * language (near-black surface, hairline borders, ember hover) instead of
 * Tailwind slate/zinc, and the generic shadcn Button is replaced with the
 * nav's existing `.cd-flowbtn` pill so the CTA reads exactly like the old
 * Get Started button. Session state comes from the shared AuthProvider.
 *
 * Item actions are callbacks (not links): Settings navigates to /settings,
 * Log Out calls Supabase signOut through the auth context.
 */
import * as React from 'react';
import { useRouter } from 'expo-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { FONT } from './constants';
import { useAuth } from '../lib/AuthProvider';
import { defaultAvatarUri, googleAvatarUrl } from '../lib/userDisplay';

interface DropdownAction {
  name: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

/** Click-outside wrapper from the reference component (DOM events, web only). */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

const OnClickOutside: React.FC<{
  children: React.ReactNode;
  onClickOutside: () => void;
}> = ({ children, onClickOutside }) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, onClickOutside);
  return (
    <div ref={wrapperRef} style={{ display: 'inline-block' }}>
      {children}
    </div>
  );
};

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

  const actions: DropdownAction[] = [
    {
      name: 'Settings',
      icon: <Settings size={15} />,
      onSelect: () => {
        setIsOpen(false);
        router.push('/settings');
      },
    },
    {
      name: 'Log Out',
      icon: <LogOut size={15} />,
      onSelect: () => {
        setIsOpen(false);
        void signOut();
      },
    },
  ];

  const trigger = (
    <button
      type="button"
      className="cd-flowbtn"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={signedIn ? 'Profile menu' : 'Sign in or sign up'}
      onClick={() => {
        if (signedIn) setIsOpen((v) => !v);
        else router.push('/signin');
      }}
    >
      {signedIn ? (
        <img
          src={avatarSrc}
          alt=""
          width={22}
          height={22}
          onError={() => avatarUrl && setFailedUrl(avatarUrl)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            objectFit: 'cover',
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
          }}
        />
      ) : null}
      <span className="cd-flowbtn-text" style={{ fontFamily: FONT.interSemiBold }}>
        {signedIn ? 'Profile' : 'Sign In/Up'}
      </span>
      {signedIn ? (
        <motion.span
          style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </motion.span>
      ) : null}
    </button>
  );

  if (!signedIn) return trigger;

  return (
    <OnClickOutside onClickOutside={() => setIsOpen(false)}>
      <div
        data-state={isOpen ? 'open' : 'closed'}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {trigger}

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="listbox"
              aria-label="Profile actions"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                zIndex: 60,
                minWidth: 180,
                overflow: 'hidden',
                borderRadius: 12,
                background: '#161B22',
                border: '1px solid #232B35',
                boxShadow: '0 18px 40px -12px rgba(0,0,0,0.65)',
              }}
            >
              {/* Signed-in identity header — grounds "Profile" to the account. */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #232B35',
                  color: '#9AA4AE',
                  fontFamily: FONT.interMedium,
                  fontSize: 12,
                  letterSpacing: 0.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                }}
              >
                {user?.email ?? 'FireSight account'}
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {actions.map((action) => (
                  <motion.button
                    key={action.name}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={action.onSelect}
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '11px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: action.name === 'Settings' ? '1px solid #232B35' : 'none',
                      color: '#F4F6F8',
                      fontFamily: FONT.interMedium,
                      fontSize: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease, color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1C232C';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ display: 'inline-flex', color: '#E8702A' }}>{action.icon}</span>
                    {action.name}
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
