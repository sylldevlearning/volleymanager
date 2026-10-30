import { StyleSheet, Text, View } from 'react-native';
import type { ExportDoc } from '../../features/tournament/exportDoc';

/** The exported document as a native view: preview, and the image that is shared. Light, like the PDF. */
export function ExportView({ doc }: { doc: ExportDoc }) {
  return (
    <View style={styles.page} collapsable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{doc.title}</Text>
        {doc.subtitle !== '' && <Text style={styles.subtitle}>{doc.subtitle}</Text>}
        <Text style={styles.contentTitle}>{doc.contentTitle}</Text>
      </View>

      {doc.blocks.map((block, i) => {
        if (block.kind === 'note') return <Text key={i} style={styles.note}>{block.text}</Text>;
        if (block.kind === 'list') {
          return (
            <View key={i} style={[styles.list, block.color ? { borderLeftColor: block.color } : null]}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              {block.items.map((item, k) => <Text key={k} style={styles.item}>{k + 1}. {item}</Text>)}
            </View>
          );
        }
        return (
          <View key={i} style={styles.block}>
            {block.title && <Text style={styles.blockTitle}>{block.title}</Text>}
            <View style={[styles.row, styles.headRow]}>
              {block.columns.map((c, k) => <Text key={k} style={[styles.cell, styles.headCell, k === 0 && styles.first]}>{c}</Text>)}
            </View>
            {block.rows.map((row, r) => (
              <View key={r} style={[styles.row, r % 2 === 1 && styles.zebra]}>
                {row.map((c, k) => <Text key={k} style={[styles.cell, k === 0 && styles.first]}>{c}</Text>)}
              </View>
            ))}
          </View>
        );
      })}

      <Text style={styles.footer}>{doc.footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 16 },
  header: { borderBottomWidth: 3, borderBottomColor: '#E63946', paddingBottom: 8, marginBottom: 8 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111111' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#444444', marginTop: 2 },
  contentTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1D4ED8', marginTop: 8 },
  block: { marginTop: 12 },
  blockTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#111111', marginBottom: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DDE1E7' },
  headRow: { backgroundColor: '#EEF1F5' },
  zebra: { backgroundColor: '#F8F9FB' },
  cell: { flex: 2, fontSize: 11, fontFamily: 'Inter_400Regular', color: '#111111', paddingVertical: 4, paddingHorizontal: 3 },
  first: { flex: 1 },
  headCell: { fontFamily: 'Inter_600SemiBold', color: '#333333' },
  list: { marginTop: 12, borderLeftWidth: 5, borderLeftColor: '#1D4ED8', paddingLeft: 10 },
  item: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#111111', paddingVertical: 1 },
  note: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#444444', marginTop: 12 },
  footer: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#666666', textAlign: 'center', marginTop: 20 },
});
