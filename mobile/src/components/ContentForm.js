import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, describeValidation, uploadFile } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LEVELS } from '../lib/levels';
import { Banner, Button, Card, Chips, Form, Input, Label, styles } from './ui';
import { colors } from '../lib/theme';

const LEVEL_OPTIONS = LEVELS.map((l) => ({ value: l.code, label: l.label }));
const DIFFICULTY = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: '★'.repeat(n) }));
const SESSIONS = [{ value: 'NORMALE', label: 'Normale' }, { value: 'COMPLEMENTAIRE', label: 'Complémentaire' }];
const EXAM_TYPES = ['BAC', 'BEPC', 'CONCOURS', 'MOCK'].map((v) => ({ value: v, label: v }));

/**
 * File slots per content type: upload kind, and which field of the saved item holds the key
 * (so the edit form can show what is already there).
 */
const FILE_SLOTS = {
  courses: [{ slot: 'video', kind: 'COURSE_VIDEO', label: 'Vidéo du cours', mime: 'video/*', required: true, field: 'videoRef' }],
  exercises: [
    { slot: 'pdf', kind: 'EXERCISE_PDF', label: 'Énoncé (PDF)', mime: 'application/pdf', required: true, field: 'pdfKey' },
    { slot: 'correction', kind: 'EXERCISE_PDF', label: 'Corrigé (PDF, facultatif)', mime: 'application/pdf', field: 'correctionPdfKey' },
    { slot: 'solutionVideo', kind: 'SOLUTION_VIDEO', label: 'Vidéo de correction (facultatif)', mime: 'video/*', field: null },
  ],
  exams: [
    { slot: 'paper', kind: 'EXAM_PDF', label: 'Sujet (PDF)', mime: 'application/pdf', required: true, field: 'paperPdfKey' },
    { slot: 'correction', kind: 'EXAM_PDF', label: 'Corrigé (PDF, facultatif)', mime: 'application/pdf', field: 'correctionPdfKey' },
  ],
};

const formatSize = (b) => (b ? (b > 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} Mo` : `${Math.ceil(b / 1024)} Ko`) : '');

function initialState(item) {
  const textStep = item?.solutions?.find((s) => s.type === 'TEXT');
  return {
    levelCode: item?.level?.code ?? null,
    title: item?.title ?? '',
    chapter: item?.chapter ?? '',
    description: item?.description ?? '',
    difficulty: item?.difficulty ?? null,
    solutionText: textStep?.body ?? '',
    year: String(item?.year ?? new Date().getFullYear()),
    session: item?.session ?? 'NORMALE',
    examType: item?.examType ?? 'BAC',
    isPublished: item?.isPublished ?? false,
    files: {},       // slot -> newly picked asset
    removed: {},     // slot -> true when an existing optional file should be dropped
  };
}

/** Does the saved item already have a file in this slot? */
function hasExisting(item, s) {
  if (!item) return false;
  if (s.slot === 'solutionVideo') return item.solutions?.some((st) => st.type === 'VIDEO');
  return Boolean(item[s.field]);
}

/**
 * Create (item = null) or edit (item = admin view of a course/exercise/exam) form.
 * Picked files are uploaded straight to storage first, then the record is saved.
 */
export default function ContentForm({ type, item, onSaved }) {
  const { token } = useAuth();
  const editing = Boolean(item);
  const [form, setForm] = useState(() => initialState(item));
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function pick(slot, mime) {
    const r = await DocumentPicker.getDocumentAsync({ type: mime, copyToCacheDirectory: true });
    if (!r.canceled) {
      setForm((f) => ({ ...f, files: { ...f.files, [slot]: r.assets[0] }, removed: { ...f.removed, [slot]: false } }));
    }
  }

  // With a new pick: cancel it (back to the current file, if any). Without: remove the current optional file.
  const dropFile = (slot) =>
    setForm((f) => {
      if (f.files[slot]) {
        const files = { ...f.files };
        delete files[slot];
        return { ...f, files };
      }
      return { ...f, removed: { ...f.removed, [slot]: true } };
    });

  function validate() {
    if (!form.levelCode) return 'Choisissez un niveau.';
    if (form.title.trim().length < 2) return 'Le titre est obligatoire.';
    if (type === 'exams' && !/^\d{4}$/.test(form.year)) return "L'année doit comporter 4 chiffres.";
    const missing = FILE_SLOTS[type].find((s) => s.required && !form.files[s.slot] && !hasExisting(item, s));
    return missing ? `Ajoutez le fichier : ${missing.label}.` : null;
  }

  async function submit() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);

    try {
      const keys = {};
      for (const s of FILE_SLOTS[type]) {
        const asset = form.files[s.slot];
        if (!asset) continue;
        setProgress(`Envoi : ${asset.name}…`);
        keys[s.slot] = await uploadFile(token, s.kind, asset);
      }

      // A file field is only sent when it changes: new key, or null to remove an optional file.
      const fileField = (slot) => (keys[slot] ? keys[slot] : form.removed[slot] ? null : undefined);
      // Empty optional text: omit on create, clear (null) on edit.
      const optional = (v) => (v.trim() ? v.trim() : editing ? null : undefined);

      setProgress('Enregistrement…');
      const common = { levelCode: form.levelCode, title: form.title.trim(), isPublished: form.isPublished };
      let body;
      if (type === 'courses') {
        body = {
          ...common,
          chapter: optional(form.chapter),
          description: optional(form.description),
          ...(keys.video && { videoProvider: 'S3', videoRef: keys.video }),
        };
      } else if (type === 'exercises') {
        const solutions = [];
        if (form.solutionText.trim()) solutions.push({ type: 'TEXT', body: form.solutionText.trim() });
        if (keys.solutionVideo) {
          solutions.push({ type: 'VIDEO', videoProvider: 'S3', videoRef: keys.solutionVideo });
        } else if (!form.removed.solutionVideo) {
          // Keep the existing video steps as they are.
          for (const st of item?.solutions ?? []) {
            if (st.type === 'VIDEO') solutions.push({ type: 'VIDEO', videoProvider: st.videoProvider, videoRef: st.videoRef });
          }
        }
        body = {
          ...common,
          chapter: optional(form.chapter),
          difficulty: form.difficulty ?? (editing ? null : undefined),
          pdfKey: fileField('pdf'),
          correctionPdfKey: fileField('correction'),
          solutions,
        };
      } else {
        body = {
          ...common, year: Number(form.year), session: form.session, examType: form.examType,
          paperPdfKey: fileField('paper'), correctionPdfKey: fileField('correction'),
        };
      }

      const saved = editing
        ? await api(`/admin/${type}/${item.id}`, { method: 'PATCH', token, body })
        : await api(`/admin/${type}`, { method: 'POST', token, body });

      if (!editing) setForm({ ...initialState(null), levelCode: form.levelCode });   // ready for the next one, same level
      onSaved?.(saved);
    } catch (err) {
      setError(err.code === 'VALIDATION_ERROR' ? describeValidation(err) : err.message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Form>
      {error && <Banner>{error}</Banner>}

      <Label>Niveau</Label>
      <Chips options={LEVEL_OPTIONS} value={form.levelCode} onChange={set('levelCode')} />
      <Input label="Titre" placeholder={type === 'exams' ? 'Bac C 2024 — Mathématiques' : 'Limites et continuité'} value={form.title} onChangeText={set('title')} />

      {type !== 'exams' && <Input label="Chapitre (facultatif)" value={form.chapter} onChangeText={set('chapter')} />}
      {type === 'courses' && <Input label="Description (facultatif)" multiline value={form.description} onChangeText={set('description')} style={[styles.input, { minHeight: 80 }]} />}

      {type === 'exercises' && (
        <>
          <Label>Difficulté</Label>
          <Chips options={DIFFICULTY} value={form.difficulty} onChange={set('difficulty')} />
          <Input label="Solution écrite (facultatif)" multiline value={form.solutionText} onChangeText={set('solutionText')} style={[styles.input, { minHeight: 100 }]} />
        </>
      )}

      {type === 'exams' && (
        <>
          <Input label="Année" keyboardType="number-pad" maxLength={4} value={form.year} onChangeText={set('year')} />
          <Label>Type</Label>
          <Chips options={EXAM_TYPES} value={form.examType} onChange={set('examType')} />
          <Label>Session</Label>
          <Chips options={SESSIONS} value={form.session} onChange={set('session')} />
        </>
      )}

      {FILE_SLOTS[type].map((s) => {
        const picked = form.files[s.slot];
        const existing = hasExisting(item, s) && !form.removed[s.slot];
        const status = picked
          ? `Nouveau : ${picked.name} · ${formatSize(picked.size)}`
          : existing ? 'Fichier actuel conservé' : form.removed[s.slot] ? 'Sera retiré à l\'enregistrement' : 'Aucun fichier choisi';
        return (
          <Card key={s.slot}>
            <Text style={styles.title}>{s.label}</Text>
            <Text style={[styles.meta, { marginBottom: 10 }]}>{status}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                small
                variant="secondary"
                title={picked || existing ? 'Remplacer' : 'Choisir un fichier'}
                onPress={() => pick(s.slot, s.mime)}
                style={{ flex: 1 }}
              />
              {/* Required files can be replaced but not removed. */}
              {(picked || (existing && !s.required)) && (
                <Button small variant="danger" title={picked ? 'Annuler' : 'Retirer'} onPress={() => dropFile(s.slot)} />
              )}
            </View>
          </Card>
        );
      })}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
        <Text style={styles.title}>{editing ? 'Publié' : 'Publier maintenant'}</Text>
        <Switch value={form.isPublished} onValueChange={set('isPublished')} trackColor={{ true: colors.primary }} />
      </View>

      {progress && <Banner type="success">{progress}</Banner>}
      <Button title={editing ? 'Enregistrer les modifications' : 'Enregistrer'} onPress={submit} loading={!!progress} />
    </Form>
  );
}
