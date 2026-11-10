import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Alert } from '../lib/dialog';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../lib/theme';
import { Button } from './ui';

function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

/**
 * Comment thread for one course: newest first, "load more", post box, delete.
 * onCountChange(delta) lets the parent keep its comment counter in sync.
 */
export default function Comments({ courseId, onCountChange }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (before) => {
    setLoading(true);
    setError(null);
    try {
      const q = before ? `?before=${encodeURIComponent(before)}` : '';
      const r = await api(`/content/courses/${courseId}/comments${q}`, { token });
      setItems((prev) => (before ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const comment = await api(`/content/courses/${courseId}/comments`, { method: 'POST', token, body: { body } });
      setItems((prev) => [comment, ...prev]);
      setDraft('');
      onCountChange?.(1);
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSending(false);
    }
  }

  const remove = (comment) =>
    Alert.alert('Supprimer ce commentaire ?', comment.body.slice(0, 80), [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/content/comments/${comment.id}`, { method: 'DELETE', token });
            setItems((prev) => prev.filter((c) => c.id !== comment.id));
            onCountChange?.(-1);
          } catch (err) {
            Alert.alert('Erreur', err.message);
          }
        },
      },
    ]);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={user.role === 'ADMIN' ? 'Répondre en tant que π-class…' : 'Écrire un commentaire…'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1000}
          style={{
            flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, maxHeight: 120, color: colors.text,
          }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          style={{ backgroundColor: colors.primary, borderRadius: 999, padding: 11, opacity: sending || !draft.trim() ? 0.5 : 1 }}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </Pressable>
      </View>

      {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
      {!loading && items.length === 0 && !error && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 12 }}>Aucun commentaire. Soyez le premier !</Text>
      )}

      {items.map((c) => (
        <View
          key={c.id}
          style={{
            backgroundColor: c.author.isAdmin ? colors.successBg : '#fff', borderRadius: radius, padding: 12, marginBottom: 8,
            borderWidth: 1, borderColor: c.author.isAdmin ? colors.primary : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: '700', color: c.author.isAdmin ? colors.primaryDark : colors.text }}>
              {c.author.isMe ? 'Vous' : c.author.name}
              {c.author.isAdmin && ' ✓'}
            </Text>
            {c.author.phone && !c.author.isAdmin && (
              <Text style={{ color: colors.muted, fontSize: 12 }}>  {c.author.phone}{c.author.level ? ` · ${c.author.level}` : ''}</Text>
            )}
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo(c.createdAt)}</Text>
            {c.canDelete && (
              <Pressable onPress={() => remove(c)} hitSlop={10} style={{ marginLeft: 10 }}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            )}
          </View>
          <Text style={{ fontSize: 15, lineHeight: 21, color: colors.text }}>{c.body}</Text>
        </View>
      ))}

      {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}
      {!loading && cursor && <Button small variant="ghost" title="Voir plus de commentaires" onPress={() => load(cursor)} />}
    </View>
  );
}
