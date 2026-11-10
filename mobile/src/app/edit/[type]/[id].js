import { useEffect, useState } from 'react';
import { Alert } from '../../../lib/dialog';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import ContentForm from '../../../components/ContentForm';
import { Banner, Form, Loading } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

const TITLES = { courses: 'Modifier le cours', exercises: "Modifier l'exercice", exams: "Modifier l'examen" };

/** /edit/courses/<id>, /edit/exercises/<id>, /edit/exams/<id> */
export default function EditContent() {
  const { type, id } = useLocalSearchParams();
  const { token } = useAuth();
  const [state, setState] = useState({ item: null, error: null });

  useEffect(() => {
    api(`/admin/${type}/${id}`, { token })
      .then((item) => setState({ item, error: null }))
      .catch((error) => setState({ item: null, error }));
  }, [type, id, token]);

  return (
    <>
      <Stack.Screen options={{ title: TITLES[type] ?? 'Modifier' }} />
      {state.error ? (
        <Form><Banner>{state.error.message}</Banner></Form>
      ) : !state.item ? (
        <Loading />
      ) : (
        <ContentForm
          type={type}
          item={state.item}
          onSaved={() => Alert.alert('Enregistré', 'Les modifications sont enregistrées.', [{ text: 'OK', onPress: () => router.back() }])}
        />
      )}
    </>
  );
}
