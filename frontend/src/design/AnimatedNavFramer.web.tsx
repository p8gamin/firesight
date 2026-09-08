import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'expo-router';
import { motion, useScroll, useMotionValueEvent, type Variants } from 'motion/react';
import { ArrowRight, Menu } from 'lucide-react';
import { COLOR, COPY, FONT, NAV_ITEMS } from './constants';
import ShinyBrand from './ShinyBrand';
import {
  navCapsuleLink,
  navCapsuleLinks,
  navCapsuleNav,
  navCapsuleWrapper,
} from './navCapsuleStyles';

/**
 * Animated floating nav (web only).
 *
 * The framer-motion capsule nav: a frosted pill floating at the top center
 * with the five FireSight sections (Home, Map, Alerts, Locations, About),
 * plus the FireSight flame + wordmark kept at the top-left and the white
 * "Get Started" CTA kept at the top-right of the page. Scrolling down past
 * 150px collapses the pill to a small circle showing only the menu icon;
 * scrolling back up by EXPAND_SCROLL_THRESHOLD expands it again. Clicking
 * the collapsed circle expands it and smooth-scrolls back to the top of the
 * page (the hero).
 *
 * The native twin (AnimatedNavFramer.tsx) keeps the same five liquid-glass
 * pills always expanded, since native has no window scroll / backdrop blur.
 *
 * This file is raw DOM + framer-motion (not react-native-web) because the
 * effect needs window scroll and spring-animated width/transform.
 *
 * The bar is portaled to document.body: react-native-web's View wrappers set
 * position:relative + z-index:0 on every ancestor, which traps position:fixed
 * children in low stacking contexts. From inside the hero those contexts sit
 * BELOW the gallery's sticky wrapper, so the collapsed circle would be
 * covered (and unclickable) while browsing the gallery/outro sections.
 * Rendering directly under <body> keeps it above all page content.
 */

/** The five top-level sections, in order. */
const navItems = NAV_ITEMS.map((item) => ({ name: item.label, href: '#' }));

/** How far you must scroll back up before the collapsed pill re-expands. */
const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants: Variants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: 'auto',
    transition: {
      y: { type: 'spring', damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: 'spring',
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: '3rem',
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300,
      when: 'afterChildren',
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants: Variants = {
  expanded: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', damping: 15 },
  },
  collapsed: {
    opacity: 0,
    x: -20,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const collapsedIconVariants: Variants = {
  expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  collapsed: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 15,
      stiffness: 300,
      delay: 0.15,
    },
  },
};

export default function AnimatedNavFramer() {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setExpanded] = React.useState(true);

  const goSection = (name: string) => {
    // Every section is a live route. dismissTo pops back to the existing
    // route (the original hero) instead of pushing a fresh copy on top.
    if (name === 'Map') router.dismissTo('/map');
    else if (name === 'Alerts') router.dismissTo('/alerts');
    else if (name === 'Locations') router.dismissTo('/locations');
    else if (name === 'About') router.dismissTo('/about');
    else if (name === 'Home') router.dismissTo('/');
  };

  const { scrollY } = useScroll();
  const lastScrollY = React.useRef(0);
  const scrollPositionOnCollapse = React.useRef(0);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = lastScrollY.current;

    // Collapse once you scroll down past 150px; re-expand when you scroll
    // back up far enough from where the collapse happened.
    if (isExpanded && latest > previous && latest > 150) {
      setExpanded(false);
      scrollPositionOnCollapse.current = latest;
    } else if (
      !isExpanded &&
      latest < previous &&
      scrollPositionOnCollapse.current - latest > EXPAND_SCROLL_THRESHOLD
    ) {
      setExpanded(true);
    }

    lastScrollY.current = latest;
  });

  // Only render while the hero route is focused. The hero screen stays
  // mounted in the stack when /map is pushed on top; without this gate its
  // portaled brand + navbar would keep rendering over the map. Placed after
  // every hook so the hook order stays stable across route changes.
  if (pathname !== '/') return null;

  const handleNavClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
      // The collapsed circle means "back to the hero" — glide up smoothly.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const nav = (
    <>
      {/* FireSight brand — logo + wordmark inside a shiny pill button,
       * fixed at the top-left (md+). Clicking returns to the hero. */}
      <div className="cd-nav-brand" style={styles.brand}>
        <ShinyBrand />
      </div>
      {/* Get Started CTA — white flow button, fixed at the top-right (md+). */}
      <div className="cd-nav-cta" style={styles.cta}>
        <button type="button" className="cd-flowbtn">
          <ArrowRight className="cd-flowbtn-arrow cd-flowbtn-arrow-left" strokeWidth={2} />
          <span className="cd-flowbtn-text" style={{ fontFamily: FONT.interSemiBold }}>
            {COPY.nav.signUp}
          </span>
          <span className="cd-flowbtn-circle" />
          <ArrowRight className="cd-flowbtn-arrow cd-flowbtn-arrow-right" strokeWidth={2} />
        </button>
      </div>
      <div style={navCapsuleWrapper}>
        <motion.nav
          initial={{ y: -80, opacity: 0 }}
          animate={isExpanded ? 'expanded' : 'collapsed'}
          variants={containerVariants}
          whileHover={!isExpanded ? { scale: 1.1 } : {}}
          whileTap={!isExpanded ? { scale: 0.95 } : {}}
          onClick={handleNavClick}
          className={
            isExpanded
              ? 'cd-animated-nav'
              : 'cd-animated-nav cd-animated-nav-collapsed'
          }
          style={navCapsuleNav}
        >
          {/* The five section links — non-clickable while collapsed */}
          <motion.div
            className={
              isExpanded
                ? 'cd-animated-nav-links'
                : 'cd-animated-nav-links is-collapsed'
            }
            style={navCapsuleLinks}
          >
            {navItems.map((item) => (
              <motion.a
                key={item.name}
                href={item.href}
                variants={itemVariants}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  goSection(item.name);
                }}
                className="cd-animated-nav-link"
                style={navCapsuleLink}
              >
                {item.name}
              </motion.a>
            ))}
          </motion.div>

          {/* Menu icon — the only visible content once collapsed */}
          <div style={styles.collapsedIconWrap}>
            <motion.div
              variants={collapsedIconVariants}
              animate={isExpanded ? 'expanded' : 'collapsed'}
            >
              <Menu size={24} color={COLOR.white} />
            </motion.div>
          </div>
        </motion.nav>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(nav, document.body);
}

const styles: Record<string, React.CSSProperties> = {
  brand: {
    position: 'fixed',
    top: 24,
    left: 20,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cta: {
    position: 'fixed',
    top: 25,
    right: 20,
    zIndex: 50,
  },
  collapsedIconWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
};