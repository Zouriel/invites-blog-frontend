/**
 * The designer's icons: drawn SVGs from Hugeicons, so a tool looks the same on every phone. Text symbols
 * (✉, ✿, 🗑…) were left to each device's fonts and came out as mismatched emoji or blanks.
 */
import AnchorPointIcon from '@hugeicons/core-free-icons/AnchorPointIcon';
import BracesIcon from '@hugeicons/core-free-icons/BracesIcon';
import CheckListIcon from '@hugeicons/core-free-icons/CheckListIcon';
import CircleIcon from '@hugeicons/core-free-icons/CircleIcon';
import CombineIcon from '@hugeicons/core-free-icons/CombineIcon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import DiamondIcon from '@hugeicons/core-free-icons/DiamondIcon';
import DoorIcon from '@hugeicons/core-free-icons/DoorIcon';
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import GroupItemsIcon from '@hugeicons/core-free-icons/GroupItemsIcon';
import HexagonIcon from '@hugeicons/core-free-icons/HexagonIcon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import ImageAdd02Icon from '@hugeicons/core-free-icons/ImageAdd02Icon';
import LayerBringToFrontIcon from '@hugeicons/core-free-icons/LayerBringToFrontIcon';
import LayerSendToBackIcon from '@hugeicons/core-free-icons/LayerSendToBackIcon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import Link02Icon from '@hugeicons/core-free-icons/Link02Icon';
import Link04Icon from '@hugeicons/core-free-icons/Link04Icon';
import MailOpen01Icon from '@hugeicons/core-free-icons/MailOpen01Icon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon';
import Motion02Icon from '@hugeicons/core-free-icons/Motion02Icon';
import Move01Icon from '@hugeicons/core-free-icons/Move01Icon';
import NodeRemoveIcon from '@hugeicons/core-free-icons/NodeRemoveIcon';
import PathIcon from '@hugeicons/core-free-icons/PathIcon';
import PauseIcon from '@hugeicons/core-free-icons/PauseIcon';
import PenTool01Icon from '@hugeicons/core-free-icons/PenTool01Icon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import Redo02Icon from '@hugeicons/core-free-icons/Redo02Icon';
import ScissorIcon from '@hugeicons/core-free-icons/ScissorIcon';
import ScissorRectangleIcon from '@hugeicons/core-free-icons/ScissorRectangleIcon';
import ShapesIcon from '@hugeicons/core-free-icons/ShapesIcon';
import SquareIcon from '@hugeicons/core-free-icons/SquareIcon';
import SquareLock02Icon from '@hugeicons/core-free-icons/SquareLock02Icon';
import SquareUnlock02Icon from '@hugeicons/core-free-icons/SquareUnlock02Icon';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import TShirtIcon from '@hugeicons/core-free-icons/TShirtIcon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import FitToScreenIcon from '@hugeicons/core-free-icons/FitToScreenIcon';
import TextFontIcon from '@hugeicons/core-free-icons/TextFontIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import TriangleIcon from '@hugeicons/core-free-icons/TriangleIcon';
import Undo02Icon from '@hugeicons/core-free-icons/Undo02Icon';
import UngroupItemsIcon from '@hugeicons/core-free-icons/UngroupItemsIcon';
import Unlink02Icon from '@hugeicons/core-free-icons/Unlink02Icon';
import UserMultipleIcon from '@hugeicons/core-free-icons/UserMultipleIcon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import RotateClockwiseIcon from '@hugeicons/core-free-icons/RotateClockwiseIcon';
import ArrowExpand01Icon from '@hugeicons/core-free-icons/ArrowExpand01Icon';
import Pen01Icon from '@hugeicons/core-free-icons/Pen01Icon';
import HighlighterIcon from '@hugeicons/core-free-icons/HighlighterIcon';
import PencilIcon from '@hugeicons/core-free-icons/PencilIcon';
import BrushIcon from '@hugeicons/core-free-icons/BrushIcon';
import PenTool02Icon from '@hugeicons/core-free-icons/PenTool02Icon';
import PenTool03Icon from '@hugeicons/core-free-icons/PenTool03Icon';
import EraserIcon from '@hugeicons/core-free-icons/EraserIcon';
import Eraser01Icon from '@hugeicons/core-free-icons/Eraser01Icon';
import PathfinderUniteIcon from '@hugeicons/core-free-icons/PathfinderUniteIcon';
import PathfinderMinusFrontIcon from '@hugeicons/core-free-icons/PathfinderMinusFrontIcon';
import PathfinderIntersectIcon from '@hugeicons/core-free-icons/PathfinderIntersectIcon';
import PathfinderExcludeIcon from '@hugeicons/core-free-icons/PathfinderExcludeIcon';
import EaseCurveControlPointsIcon from '@hugeicons/core-free-icons/EaseCurveControlPointsIcon';
import MagicWand01Icon from '@hugeicons/core-free-icons/MagicWand01Icon';
import TouchInteraction01Icon from '@hugeicons/core-free-icons/TouchInteraction01Icon';
import CursorRectangleSelection01Icon from '@hugeicons/core-free-icons/CursorRectangleSelection01Icon';

export type DesignerIcon = typeof TextFontIcon;

/**
 * `hugeicons-icon` renders only `path` elements: a `circle` comes out as an empty path, so the circle
 * in Circle, the sun in Photo and the nib of the pen went missing. Circles are redrawn as paths.
 */
function pathsOnly(icon: DesignerIcon): DesignerIcon {
  return (icon as unknown as [string, Record<string, string>][]).map(([tag, attrs]) => {
    if (tag !== 'circle') return [tag, attrs];
    const { cx, cy, r, ...rest } = attrs;
    const x = Number(cx), y = Number(cy), rad = Number(r);
    return ['path', { ...rest, d: `M${x - rad} ${y}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0Z` }];
  }) as unknown as DesignerIcon;
}

const RAW = {
  zoomIn: PlusSignIcon,
  zoomOut: MinusSignIcon,
  fit: FitToScreenIcon,
  text: TextFontIcon,
  shape: ShapesIcon,
  photo: Image01Icon,
  picture: ImageAdd02Icon,
  rsvp: MailOpen01Icon,
  link: Link04Icon,
  dress: TShirtIcon,
  fields: BracesIcon,
  layers: Layers01Icon,
  page: File01Icon,
  check: CheckListIcon,
  done: Tick02Icon,
  group: GroupItemsIcon,
  ungroup: UngroupItemsIcon,
  duplicate: Copy01Icon,
  delete: Delete02Icon,
  edit: Edit02Icon,
  drawShape: PenTool01Icon,
  position: Move01Icon,
  motion: Motion02Icon,
  keyframe: DiamondIcon,
  visibility: UserMultipleIcon,
  front: LayerBringToFrontIcon,
  back: LayerSendToBackIcon,
  lock: SquareLock02Icon,
  unlock: SquareUnlock02Icon,
  play: PlayIcon,
  pause: PauseIcon,
  undo: Undo02Icon,
  redo: Redo02Icon,
  more: MoreHorizontalIcon,
  menu: Menu01Icon,
  box: SquareIcon,
  circle: CircleIcon,
  triangle: TriangleIcon,
  arch: DoorIcon,
  star: StarIcon,
  polygon: HexagonIcon,
  merge: CombineIcon,
  cut: ScissorRectangleIcon,
  curve: PathIcon,
  sharp: AnchorPointIcon,
  breakPath: ScissorIcon,
  join: Link02Icon,
  close: CircleIcon,
  open: Unlink02Icon,
  deletePoint: NodeRemoveIcon,
  selectAll: CursorRectangleSelection01Icon,
  splitHandles: EaseCurveControlPointsIcon,
  goBack: ArrowLeft01Icon,
  openNew: ArrowUpRight01Icon,
  remove: Cancel01Icon,
  rotate: RotateClockwiseIcon,
  scale: ArrowExpand01Icon,
  penTool: PenTool03Icon,
  inkPen: Pen01Icon,
  marker: HighlighterIcon,
  pencil: PencilIcon,
  brush: BrushIcon,
  calligraphy: PenTool02Icon,
  eraser: EraserIcon,
  eraseWhole: Eraser01Icon,
  snapShape: MagicWand01Icon,
  fingerDraws: TouchInteraction01Icon,
  opAdd: PathfinderUniteIcon,
  opCut: PathfinderMinusFrontIcon,
  opIntersect: PathfinderIntersectIcon,
  opExclude: PathfinderExcludeIcon,
} satisfies Record<string, DesignerIcon>;

export const ICONS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, pathsOnly(v)])) as { [K in keyof typeof RAW]: DesignerIcon };
