'use client';

import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  Coffee,
  Coins,
  CreditCard,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PiggyBank,
  Plane,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AccountKind } from '@/lib/types';

export const ICON_MAP: Record<string, LucideIcon> = {
  'shopping-bag': ShoppingBag,
  home: Home,
  car: Car,
  coffee: Coffee,
  'heart-pulse': HeartPulse,
  laptop: Laptop,
  plane: Plane,
  briefcase: Briefcase,
  sparkles: Sparkles,
  'trending-up': TrendingUp,
  wallet: Wallet,
  landmark: Landmark,
  'piggy-bank': PiggyBank,
  'credit-card': CreditCard,
  'arrow-left-right': ArrowLeftRight,
  'sliders-horizontal': SlidersHorizontal,
  utensils: Utensils,
  gift: Gift,
  zap: Zap,
  shield: Shield,
  coins: Coins,
  banknote: Banknote,
};

export const CATEGORY_ICON_CHOICES = [
  { key: 'shopping-bag', label: 'Zakupy' },
  { key: 'utensils', label: 'Jedzenie' },
  { key: 'coffee', label: 'Kawa' },
  { key: 'home', label: 'Dom' },
  { key: 'car', label: 'Auto' },
  { key: 'heart-pulse', label: 'Zdrowie' },
  { key: 'laptop', label: 'Tech' },
  { key: 'plane', label: 'Podróże' },
  { key: 'zap', label: 'Rachunki' },
  { key: 'gift', label: 'Prezenty' },
  { key: 'briefcase', label: 'Praca' },
  { key: 'sparkles', label: 'Dodatkowe' },
  { key: 'trending-up', label: 'Zysk' },
  { key: 'coins', label: 'Inne' },
];

export function CategoryIcon({
  name,
  className = 'w-4 h-4',
  style,
}: {
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComponent = (name && ICON_MAP[name]) || Coins;
  return <IconComponent className={className} style={style} />;
}

export function AccountKindIcon({
  kind,
  className = 'w-4 h-4',
  style,
}: {
  kind: AccountKind;
  className?: string;
  style?: React.CSSProperties;
}) {
  switch (kind) {
    case 'cash':
      return <Banknote className={className} style={style} />;
    case 'bank':
      return <Landmark className={className} style={style} />;
    case 'savings':
      return <PiggyBank className={className} style={style} />;
    case 'investment':
      return <TrendingUp className={className} style={style} />;
    case 'liability':
      return <CreditCard className={className} style={style} />;
    default:
      return <Wallet className={className} style={style} />;
  }
}

export const ACCOUNT_KIND_META: Record<
  AccountKind,
  { label: string; shortLabel: string; defaultColor: string }
> = {
  cash: { label: 'Gotówka fizyczna', shortLabel: 'Gotówka', defaultColor: '#d4af37' },
  bank: { label: 'Konto bieżące / Karta', shortLabel: 'Konto', defaultColor: '#ffffff' },
  savings: { label: 'Oszczędności', shortLabel: 'Oszczędności', defaultColor: '#3b82f6' },
  investment: { label: 'Inwestycje / Obligacje', shortLabel: 'Inwestycje', defaultColor: '#818cf8' },
  liability: { label: 'Zobowiązanie / Kredyt', shortLabel: 'Dług', defaultColor: '#f87171' },
};
