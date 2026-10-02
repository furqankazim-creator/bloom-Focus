import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius } from '../theme';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];
export type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type TProps = TextProps & { style?: StyleProp<TextStyle> };

export const T = {
  Eyebrow: ({ style, ...p }: TProps) => <Text {...p} style={[s.eyebrow, style]} />,
  Display: ({ style, ...p }: TProps) => <Text {...p} style={[s.display, style]} />,
  H1: ({ style, ...p }: TProps) => <Text {...p} style={[s.h1, style]} />,
  H2: ({ style, ...p }: TProps) => <Text {...p} style={[s.h2, style]} />,
  H3: ({ style, ...p }: TProps) => <Text {...p} style={[s.h3, style]} />,
  Body: ({ style, ...p }: TProps) => <Text {...p} style={[s.body, style]} />,
  Small: ({ style, ...p }: TProps) => <Text {...p} style={[s.small, style]} />,
};

export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[s.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
  selected,
  label,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  selected?: boolean;
  /** Screen-reader label; defaults to the card's text content. */
  label?: string;
}) {
  const body = [s.card, selected && s.cardSelected, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={({ pressed }) => [body, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'light' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: FeatherName;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.button,
        { backgroundColor: v.bg },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {icon && <Feather name={icon} size={20} color={v.fg} />}
      <Text style={[s.buttonLabel, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.forest, fg: colors.white },
  soft: { bg: colors.sage, fg: colors.forest },
  light: { bg: '#E8EEE4', fg: colors.forest },
  ghost: { bg: 'transparent', fg: colors.forest },
  danger: { bg: 'transparent', fg: colors.danger },
};

export function IconButton({
  icon,
  onPress,
  bg = colors.card,
  color = colors.forest,
  size = 44,
  label,
}: {
  icon: FeatherName;
  onPress?: () => void;
  bg?: string;
  color?: string;
  size?: number;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 3, backgroundColor: bg },
        s.center,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Feather name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function Avatar({
  name,
  color,
  size = 56,
  photo,
  emoji,
}: {
  name: string;
  color: string;
  size?: number;
  /** Profile picture URI; wins over the emoji and initials. */
  photo?: string | null;
  emoji?: string | null;
}) {
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor: color, overflow: 'hidden' as const };
  if (photo) return <Image source={{ uri: photo }} style={box} accessibilityLabel={`${name}'s photo`} />;
  return (
    <View style={[s.center, box]}>
      {emoji ? (
        <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.7 }}>{emoji}</Text>
      ) : (
        <Text style={{ fontFamily: font.bold, fontSize: size * 0.34, color: colors.ink }}>{initials(name)}</Text>
      )}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[s.chip, selected && { backgroundColor: colors.forest }, style]}
    >
      <Text style={[s.chipLabel, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function StatTile({
  value,
  label,
  bg,
  icon,
  style,
}: {
  value: string | number;
  label: string;
  bg: string;
  icon?: FeatherName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.stat, { backgroundColor: bg }, style]}>
      {icon && <Feather name={icon} size={20} color={colors.ink} style={{ marginBottom: 12 }} />}
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.leaf, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, value)) * 100) }}
      style={{ height, borderRadius: height, backgroundColor: '#ECEBE4', overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Notice({ icon = 'shield', text, style }: { icon?: FeatherName; text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.notice, style]}>
      <Feather name={icon} size={18} color={colors.forest} />
      <Text style={s.noticeText}>{text}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, subtitle }: { title: string; action?: string; onAction?: () => void; subtitle?: string }) {
  return (
    <View style={{ marginTop: 32, marginBottom: 14 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T.H2>{title}</T.H2>
        {action && (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={{ fontFamily: font.semibold, color: colors.forest, fontSize: 15 }}>{action}</Text>
          </Pressable>
        )}
      </View>
      {subtitle && <T.Body style={{ marginTop: 4 }}>{subtitle}</T.Body>}
    </View>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
      <View style={{ width: 44 }}>
        {onBack && <IconButton icon="arrow-left" label="Back" onPress={onBack} bg="transparent" color={colors.ink} />}
      </View>
      <T.Eyebrow style={{ marginBottom: 0 }}>{title}</T.Eyebrow>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function TaskIcon({ icon, tint, size = 52 }: { icon: string; tint: string; size?: number }) {
  return (
    <View style={[s.center, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: tint }]}>
      <MaterialCommunityIcons name={icon as MciName} size={size * 0.5} color={colors.ink} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: '#EFEEE8' }, style]} />;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontFamily: font.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 8,
  },
  display: { fontFamily: font.heavy, fontSize: 36, lineHeight: 42, color: colors.ink, letterSpacing: -1 },
  h1: { fontFamily: font.heavy, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.8 },
  h2: { fontFamily: font.bold, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  h3: { fontFamily: font.semibold, fontSize: 17, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardSelected: { borderColor: colors.forest, borderWidth: 2, backgroundColor: '#F1F5EE' },
  button: {
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  buttonLabel: { fontFamily: font.semibold, fontSize: 17 },
  chip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  stat: { flex: 1, borderRadius: radius.lg, padding: 16, minHeight: 104, justifyContent: 'flex-end' },
  statValue: { fontFamily: font.bold, fontSize: 26, color: colors.ink },
  statLabel: {
    fontFamily: font.semibold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8EEE4',
    borderRadius: radius.md,
    padding: 14,
  },
  noticeText: { flex: 1, fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.forest },
});
