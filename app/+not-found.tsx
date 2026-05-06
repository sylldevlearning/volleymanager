import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../src/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page introuvable</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Retour à l'accueil</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: palette.background },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  link: { marginTop: 16 },
  linkText: { fontSize: 15, color: palette.accentSecondary, fontFamily: 'Inter_500Medium' },
});
