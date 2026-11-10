import { FlatList, RefreshControl } from 'react-native';
import { useContent } from '../lib/content';
import { Banner, Empty, Loading } from './ui';
import { colors } from '../lib/theme';

/** Shared list wrapper for the student tabs: loading, error, empty and pull-to-refresh. */
export default function ContentList({ select, renderItem, emptyTitle }) {
  const { data, loading, error, refresh } = useContent();
  if (!data && loading) return <Loading />;
  const items = data ? select(data) : [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item, i) => item.id ?? String(item.year ?? i)}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Banner>{error.message}</Banner> : null}
      ListEmptyComponent={!error ? <Empty title={emptyTitle} subtitle="Tirez vers le bas pour actualiser." /> : null}
    />
  );
}
