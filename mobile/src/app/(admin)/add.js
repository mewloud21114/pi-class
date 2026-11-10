import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/dialog';
import ContentForm from '../../components/ContentForm';
import { Chips } from '../../components/ui';
import { CONTENT_TYPES } from '../../lib/contentTypes';
import { colors } from '../../lib/theme';

export default function AddContent() {
  const [type, setType] = useState('courses');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Chips options={CONTENT_TYPES} value={type} onChange={setType} style={{ paddingHorizontal: 16, paddingTop: 16, marginBottom: 0 }} />
      {/* key: a fresh form per content type */}
      <ContentForm
        key={type}
        type={type}
        onSaved={(saved) =>
          Alert.alert('Ajouté', saved.isPublished ? 'Le contenu est visible par les élèves.' : "Enregistré en brouillon. Publiez-le depuis l'onglet Contenus.")
        }
      />
    </View>
  );
}
