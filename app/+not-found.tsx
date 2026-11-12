import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../src/components/ui/Text';
import { useThemedStyles, type AppTheme } from '../src/theme/useAppTheme';

export default function NotFoundScreen() {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Page introuvable</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Retour à l'accueil</Text>
        </Link>
      </View>
    </>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: a.background },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  link: { marginTop: 16 },
  linkText: { fontSize: 15, color: a.accentSecondary, fontFamily: 'Inter_500Medium' },
});
