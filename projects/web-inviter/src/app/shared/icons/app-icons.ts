/**
 * The app's everyday icons: drawn SVGs from Hugeicons, one import per icon (the package barrel
 * re-exports twelve thousand modules). Text symbols (→ ✕ ✓ ✎ …) render differently on every phone —
 * as emoji, in another font, or not at all — so buttons and links use these instead.
 */
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import PenTool03Icon from '@hugeicons/core-free-icons/PenTool03Icon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon';
import SquareLock02Icon from '@hugeicons/core-free-icons/SquareLock02Icon';
import Upload04Icon from '@hugeicons/core-free-icons/Upload04Icon';
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon';
import UserMultipleIcon from '@hugeicons/core-free-icons/UserMultipleIcon';
import Xls02Icon from '@hugeicons/core-free-icons/Xls02Icon';

export type AppIcon = typeof ArrowRight01Icon;

/**
 * `hugeicons-icon` renders only `path` elements, so an icon drawn with a `circle` loses it. Circles are
 * redrawn as paths.
 */
export function pathsOnly(icon: AppIcon): AppIcon {
  return (icon as unknown as [string, Record<string, string>][]).map(([tag, attrs]) => {
    if (tag !== 'circle') return [tag, attrs];
    const { cx, cy, r, ...rest } = attrs;
    const x = Number(cx), y = Number(cy), rad = Number(r);
    return ['path', { ...rest, d: `M${x - rad} ${y}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0Z` }];
  }) as unknown as AppIcon;
}

const RAW = {
  next: ArrowRight01Icon,
  back: ArrowLeft01Icon,
  up: ArrowUp01Icon,
  down: ArrowDown01Icon,
  remove: Cancel01Icon,
  add: PlusSignIcon,
  done: Tick02Icon,
  edit: PencilEdit02Icon,
  settings: Settings02Icon,
  sparkle: SparklesIcon,
  photo: Image01Icon,
  play: PlayIcon,
  mail: Mail01Icon,
  designer: PenTool03Icon,
  // The create-event flow's choices and lists.
  guests: UserMultipleIcon,
  person: UserAdd01Icon,
  upload: Upload04Icon,
  sheet: Xls02Icon,
  link: Link01Icon,
  reply: CheckmarkCircle02Icon,
  camera: Camera01Icon,
  calendar: Calendar03Icon,
  lock: SquareLock02Icon,
} satisfies Record<string, AppIcon>;

export const APP_ICONS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, pathsOnly(v)])) as { [K in keyof typeof RAW]: AppIcon };
