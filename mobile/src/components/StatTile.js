import { Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';

/** Big number + label, laid out two per row. */
export default function StatTile({ label, value, hint }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: radius, padding: 14, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primaryDark }}>{value ?? '—'}</Text>
      <Text style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>{label}</Text>
      {hint && <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{hint}</Text>}
    </View>
  );
}
