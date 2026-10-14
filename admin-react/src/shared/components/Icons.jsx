/**
 * Set único de íconos: lucide-react (stroke 1.75, 24 px de caja) + 3 íconos de
 * marca. Las páginas importan nombres, no SVG:
 *
 *   import { Search, Ship, WhatsAppIcon } from '../../shared/components/Icons';
 *   <Search size={16} />          16 en línea con texto · 20 en botones · 24 en vacíos
 *
 * Todos van con aria-hidden: el texto accesible lo pone el botón/enlace que los
 * contiene (`IconButton` exige `aria-label`).
 */
import { forwardRef } from 'react';
import * as L from 'lucide-react';

function icon(Base) {
  const I = forwardRef(function Icon(props, ref) {
    return <Base ref={ref} strokeWidth={1.75} aria-hidden="true" focusable="false" {...props} />;
  });
  I.displayName = Base.displayName || Base.name || 'Icon';
  return I;
}

/* Navegación y secciones */
export const Home = icon(L.House);
export const Dashboard = icon(L.LayoutDashboard);
export const Folder = icon(L.Folder);
export const FolderOpen = icon(L.FolderOpen);
export const FileText = icon(L.FileText);
export const Files = icon(L.Files);
export const File = icon(L.File);
export const FileCheck = icon(L.FileCheck);
export const FileSearch = icon(L.FileSearch);
export const FileDown = icon(L.FileDown);
export const Ship = icon(L.Ship);
export const Sailboat = icon(L.Sailboat);
export const Anchor = icon(L.Anchor);
export const Waves = icon(L.Waves);
export const MapPin = icon(L.MapPin);
export const Map = icon(L.Map);
export const Navigation = icon(L.Navigation);
export const Compass = icon(L.Compass);
export const Search = icon(L.Search);
export const ShoppingCart = icon(L.ShoppingCart);
export const Store = icon(L.Store);
export const Tag = icon(L.Tag);
export const CreditCard = icon(L.CreditCard);
export const Wallet = icon(L.Wallet);
export const Banknote = icon(L.Banknote);
export const Receipt = icon(L.Receipt);
export const CircleDollarSign = icon(L.CircleDollarSign);
export const DollarSign = icon(L.DollarSign);
export const Percent = icon(L.Percent);
export const MessageCircle = icon(L.MessageCircle);
export const MessageSquare = icon(L.MessageSquare);
export const MessageSquareText = icon(L.MessageSquareText);
export const Bell = icon(L.Bell);
export const BellOff = icon(L.BellOff);
export const LifeBuoy = icon(L.LifeBuoy);
export const CircleHelp = icon(L.CircleHelp);
export const Headset = icon(L.Headset);
export const User = icon(L.User);
export const CircleUser = icon(L.CircleUser);
export const Users = icon(L.Users);
export const UserPlus = icon(L.UserPlus);
export const Settings = icon(L.Settings);
export const SlidersHorizontal = icon(L.SlidersHorizontal);
export const Shield = icon(L.Shield);
export const ShieldCheck = icon(L.ShieldCheck);
export const Lock = icon(L.Lock);
export const KeyRound = icon(L.KeyRound);
export const Fingerprint = icon(L.Fingerprint);
export const Eye = icon(L.Eye);
export const EyeOff = icon(L.EyeOff);
export const LogOut = icon(L.LogOut);
export const LogIn = icon(L.LogIn);
export const Menu = icon(L.Menu);
export const PanelLeft = icon(L.PanelLeft);
export const Command = icon(L.Command);
export const Inbox = icon(L.Inbox);
export const Archive = icon(L.Archive);
export const Mail = icon(L.Mail);
export const MailOpen = icon(L.MailOpen);
export const Phone = icon(L.Phone);
export const PhoneCall = icon(L.PhoneCall);
export const Send = icon(L.Send);
export const Megaphone = icon(L.Megaphone);
export const Bot = icon(L.Bot);
export const Handshake = icon(L.Handshake);
export const Building2 = icon(L.Building2);
export const Briefcase = icon(L.Briefcase);
export const Globe = icon(L.Globe);
export const Flag = icon(L.Flag);
export const Languages = icon(L.Languages);

/* Estados y feedback */
export const Check = icon(L.Check);
export const CircleCheck = icon(L.CircleCheck);
export const BadgeCheck = icon(L.BadgeCheck);
export const TriangleAlert = icon(L.TriangleAlert);
export const CircleAlert = icon(L.CircleAlert);
export const Info = icon(L.Info);
export const CircleX = icon(L.CircleX);
export const X = icon(L.X);
export const Loader = icon(L.LoaderCircle);
export const Circle = icon(L.Circle);
export const CircleDot = icon(L.CircleDot);
export const Sparkles = icon(L.Sparkles);
export const Star = icon(L.Star);
export const Zap = icon(L.Zap);
export const Lightbulb = icon(L.Lightbulb);
export const Award = icon(L.Award);

/* Flechas y navegación fina */
export const ChevronDown = icon(L.ChevronDown);
export const ChevronUp = icon(L.ChevronUp);
export const ChevronLeft = icon(L.ChevronLeft);
export const ChevronRight = icon(L.ChevronRight);
export const ChevronsUpDown = icon(L.ChevronsUpDown);
export const ArrowLeft = icon(L.ArrowLeft);
export const ArrowRight = icon(L.ArrowRight);
export const ArrowUp = icon(L.ArrowUp);
export const ArrowDown = icon(L.ArrowDown);
export const ArrowUpRight = icon(L.ArrowUpRight);
export const ArrowUpDown = icon(L.ArrowUpDown);
export const ArrowDownUp = icon(L.ArrowDownUp);
export const CornerDownLeft = icon(L.CornerDownLeft);
export const GripVertical = icon(L.GripVertical);

/* Acciones */
export const Ellipsis = icon(L.Ellipsis);
export const EllipsisVertical = icon(L.EllipsisVertical);
export const Plus = icon(L.Plus);
export const Minus = icon(L.Minus);
export const Trash = icon(L.Trash2);
export const Pencil = icon(L.Pencil);
export const SquarePen = icon(L.SquarePen);
export const Copy = icon(L.Copy);
export const Download = icon(L.Download);
export const Upload = icon(L.Upload);
export const ExternalLink = icon(L.ExternalLink);
export const Link = icon(L.Link);
export const Link2 = icon(L.Link2);
export const Paperclip = icon(L.Paperclip);
export const Printer = icon(L.Printer);
export const RefreshCw = icon(L.RefreshCw);
export const RotateCw = icon(L.RotateCw);
export const Filter = icon(L.Filter);
export const ListFilter = icon(L.ListFilter);
export const Maximize = icon(L.Maximize2);
export const Minimize = icon(L.Minimize2);
export const Expand = icon(L.Expand);
export const ZoomIn = icon(L.ZoomIn);
export const ZoomOut = icon(L.ZoomOut);

/* Contenido */
export const Image = icon(L.Image);
export const Images = icon(L.Images);
export const Camera = icon(L.Camera);
export const Video = icon(L.Video);
export const Play = icon(L.Play);
export const Calendar = icon(L.Calendar);
export const CalendarDays = icon(L.CalendarDays);
export const Clock = icon(L.Clock);
export const Timer = icon(L.Timer);
export const History = icon(L.History);
export const Hash = icon(L.Hash);
export const Package = icon(L.Package);
export const PackageCheck = icon(L.PackageCheck);
export const Boxes = icon(L.Boxes);
export const Container = icon(L.Container);
export const Truck = icon(L.Truck);
export const Ticket = icon(L.Ticket);
export const Scale = icon(L.Scale);
export const Ruler = icon(L.Ruler);
export const Wrench = icon(L.Wrench);
export const Gauge = icon(L.Gauge);
export const TrendingUp = icon(L.TrendingUp);
export const TrendingDown = icon(L.TrendingDown);
export const ChartBar = icon(L.ChartBar);
export const ChartColumn = icon(L.ChartColumn);
export const ChartPie = icon(L.ChartPie);
export const Activity = icon(L.Activity);
export const ClipboardCheck = icon(L.ClipboardCheck);
export const ClipboardList = icon(L.ClipboardList);
export const ListChecks = icon(L.ListChecks);
export const Bookmark = icon(L.Bookmark);
export const Layers = icon(L.Layers);
export const LayoutGrid = icon(L.LayoutGrid);
export const List = icon(L.List);
export const Table = icon(L.Table);
export const Columns = icon(L.Columns3);
export const Sun = icon(L.Sun);
export const Moon = icon(L.Moon);
export const Smartphone = icon(L.Smartphone);
export const Monitor = icon(L.Monitor);
export const QrCode = icon(L.QrCode);
export const Square = icon(L.Square);
export const Hand = icon(L.Hand);

/* ---------------------------------------------------------------------------
   Íconos de marca (monocromos, heredan `currentColor`; `size` como lucide).
   --------------------------------------------------------------------------- */
function brand(name, children, viewBox = '0 0 24 24') {
  const B = forwardRef(function Brand({ size = 24, className, ...props }, ref) {
    return (
      <svg ref={ref} width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden="true" focusable="false" className={className} {...props}>
        {children}
      </svg>
    );
  });
  B.displayName = name;
  return B;
}

export const WhatsAppIcon = brand('WhatsAppIcon', (
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.004 2C6.49 2 2.004 6.486 2.004 12c0 1.77.464 3.5 1.345 5.02L2 22l5.1-1.33A9.96 9.96 0 0 0 12.004 22c5.514 0 10-4.486 10-10s-4.486-10-10-10zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.178-3.026.79.808-2.95-.196-.303A8.17 8.17 0 0 1 3.804 12c0-4.52 3.68-8.2 8.2-8.2 4.52 0 8.2 3.68 8.2 8.2 0 4.52-3.68 8.2-8.2 8.2z" />
));

/* WebPay (Transbank): tarjeta con la "W". */
export const WebPayIcon = brand('WebPayIcon', (
  <>
    <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-13zm2 0v13c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5z" />
    <path d="M6.6 8.5h1.7l1.2 4.6 1.3-4.6h1.7l1.3 4.6 1.2-4.6h1.7l-2.1 7h-1.7L12 10.9l-1.4 4.6H8.9l-2.3-7z" />
  </>
));

/* Mercado Pago: círculo con las dos manos simplificadas. */
export const MercadoPagoIcon = brand('MercadoPagoIcon', (
  <>
    <path d="M12 2.5C6.2 2.5 1.5 6.3 1.5 11s4.7 8.5 10.5 8.5S22.5 15.7 22.5 11 17.8 2.5 12 2.5zm0 15c-4.7 0-8.5-2.9-8.5-6.5S7.3 4.5 12 4.5s8.5 2.9 8.5 6.5-3.8 6.5-8.5 6.5z" />
    <path d="M8.2 9.2c.9-.9 2-1.5 3.1-1.5.6 0 1.1.2 1.6.5l2.4 1.9c.4.3.5.9.1 1.3-.3.4-.9.5-1.3.2l-1.9-1.4c-.2-.2-.5-.1-.7.1l-1.3 1.3c-.3.3-.3.8 0 1.1.3.3.8.3 1.1 0l.8-.8 2.1 1.6c.7.5 1.6.5 2.3 0l.5-.4v.7c0 .5-.2.9-.6 1.2l-2 1.5c-.7.5-1.6.5-2.3 0l-2.1-1.6c-.8.4-1.8.2-2.4-.5-.8-.9-.8-2.2 0-3.1l.6-.6z" />
  </>
));

/** Marca de Imporlan (casco + olas), monocroma. Para el logo del sidebar/login. */
export const ImporlanMark = brand('ImporlanMark', (
  <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 31c1 .8 2 1.5 4 1.5 3.5 0 3.5-3 7-3 2 0 3 .7 4 1.5 1 .8 2 1.5 4 1.5 3.5 0 3.5-3 7-3 2 0 3 .7 4 1.5" />
    <path d="M29 29.5A17 17 0 0 0 31.5 20L18 14 4.5 20a17 17 0 0 0 4 11.5" />
    <path d="M28 19V10a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v9" />
    <path d="M18 14v6" />
  </g>
), '0 0 36 36');
