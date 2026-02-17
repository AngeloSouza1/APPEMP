import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Modulo'>;

export default function ModuloScreen({ route, navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{route.params.titulo}</Text>
        <Text style={styles.subtitle}>
          Este módulo já foi atualizado no Web e será portado para o app mobile na próxima etapa.
        </Text>
        <Text style={styles.tag}>slug: {route.params.modulo}</Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Voltar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    color: '#334155',
    lineHeight: 20,
  },
  tag: {
    color: '#1e3a8a',
    fontWeight: '600',
  },
  button: {
    marginTop: 2,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
