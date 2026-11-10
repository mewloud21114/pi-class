import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Button({ title, onPress, variant = 'primary', loading, disabled, small, style }) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: '#fff', fg: colors.primary, border: colors.primary },
  danger: { bg: '#fff', fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Input({ label, hint, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

/** Single-select row of pills. options: [{ value, label }] */
export function Chips({ options, value, onChange, style }) {
  return (
    <View style={[styles.chips, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({ type = 'error', children }) {
  const bg = { error: colors.dangerBg, warning: colors.warningBg, success: colors.successBg }[type];
  const fg = { error: colors.danger, warning: '#8A6400', success: colors.primaryDark }[type];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Badge({ label, color = colors.primary }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Empty({ title, subtitle }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {subtitle && <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Form({ children }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;

export const styles = StyleSheet.create({
  button: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius, alignItems: 'center', borderWidth: 1.5 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: '600' },
  banner: { padding: 12, borderRadius: radius, marginBottom: 14 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
