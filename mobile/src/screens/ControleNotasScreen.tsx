import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pedidosApi } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { formatarData, formatarMoeda } from '../utils/format';

type FiltroStatus = '' | 'EM_ESPERA' | 'CONFERIR' | 'EFETIVADO' | 'CANCELADO';

const STATUS_LABEL: Record<string, string> = {
  EM_ESPERA: 'Em espera',
  CONFERIR: 'Conferir',
  EFETIVADO: 'Efetivado',
  CANCELADO: 'Cancelado',
};

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  EM_ESPERA: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  CONFERIR: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  EFETIVADO: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  CANCELADO: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
};

const FILTROS: Array<{ value: FiltroStatus; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'EM_ESPERA', label: 'Em espera' },
  { value: 'CONFERIR', label: 'Conferir' },
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export default function ControleNotasScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [notaSelecionada, setNotaSelecionada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const response = await pedidosApi.listarPaginado({
        page: 1,
        limit: 400,
      });
      const pedidosComNf = response.data.data.filter((pedido) => Boolean(pedido.usa_nf));
      setPedidos(pedidosComNf);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar as notas dos pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregar();
    }, [carregar])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  const pedidosFiltrados = useMemo(() => {
    if (!filtroStatus) return pedidos;
    return pedidos.filter((pedido) => pedido.status === filtroStatus);
  }, [filtroStatus, pedidos]);

  const totalComImagem = useMemo(
    () => pedidosFiltrados.filter((pedido) => Boolean(pedido.nf_imagem_url)).length,
    [pedidosFiltrados]
  );

  const renderItem = ({ item }: { item: Pedido }) => {
    const statusTheme = STATUS_COLOR[item.status] || STATUS_COLOR.EM_ESPERA;
    const statusLabel = STATUS_LABEL[item.status] || item.status;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>Pedido #{item.id}</Text>
          <Text style={[styles.statusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border, color: statusTheme.text }]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={styles.cardClient}>{item.cliente_nome}</Text>
        <Text style={styles.cardMeta}>
          {formatarData(item.data)} • {formatarMoeda(Number(item.valor_total || 0))}
        </Text>
        {item.nf_imagem_url ? (
          <Pressable style={styles.imageWrap} onPress={() => setNotaSelecionada(item.nf_imagem_url || null)}>
            <Image source={{ uri: item.nf_imagem_url }} style={styles.imageThumb} resizeMode="cover" />
            <Text style={styles.imageHint}>Toque para ampliar</Text>
          </Pressable>
        ) : (
          <View style={styles.emptyNf}>
            <Text style={styles.emptyNfText}>Sem imagem de NF anexada.</Text>
          </View>
        )}
        <Pressable style={styles.detailButton} onPress={() => navigation.navigate('PedidoDetalhe', { id: item.id })}>
          <Text style={styles.detailButtonText}>Ver pedido</Text>
        </Pressable>
      </View>
    );
  };

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />

      <View style={[styles.content, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>🧾</Text>
            <Text style={styles.headerTitle}>Controle de Notas</Text>
          </View>
          <Pressable style={styles.headerBackButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Pedidos com NF</Text>
          <Text style={styles.summaryValue}>{pedidosFiltrados.length}</Text>
          <Text style={styles.summarySub}>Com imagem anexada: {totalComImagem}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTROS.map((filtro) => {
            const ativo = filtroStatus === filtro.value;
            return (
              <Pressable
                key={filtro.value || 'all'}
                style={[styles.filterChip, ativo && styles.filterChipActive]}
                onPress={() => setFiltroStatus(filtro.value)}
              >
                <Text style={[styles.filterChipText, ativo && styles.filterChipTextActive]}>{filtro.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator />
          </View>
        ) : erro ? (
          <View style={styles.centerCard}>
            <Text style={styles.errorText}>{erro}</Text>
            <Pressable style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={pedidosFiltrados}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={onRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.centerCard}>
                <Text style={styles.emptyText}>Nenhum pedido com NF para este filtro.</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={Boolean(notaSelecionada)} transparent animationType="fade" onRequestClose={() => setNotaSelecionada(null)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            {notaSelecionada ? (
              <Image source={{ uri: notaSelecionada }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.previewClose} onPress={() => setNotaSelecionada(null)}>
              <Text style={styles.previewCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dfe7f2' },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dfe7f2',
  },
  backgroundGlowBlue: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#bcd3f7',
    opacity: 0.55,
    top: -80,
    left: -40,
  },
  backgroundGlowCyan: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#b6edf1',
    opacity: 0.45,
    top: 80,
    right: -70,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fbff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  headerIcon: { fontSize: 23 },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 24 },
  headerBackButton: {
    width: 62,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fbff',
  },
  headerBackText: { color: '#1d4ed8', fontWeight: '700', fontSize: 18 },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  summaryTitle: { color: '#334155', fontSize: 14, fontWeight: '700' },
  summaryValue: { color: '#0f172a', fontSize: 28, fontWeight: '800', marginTop: 2 },
  summarySub: { color: '#475569', fontSize: 13, fontWeight: '600', marginTop: 2 },
  filterRow: { paddingBottom: 8, columnGap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  filterChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  filterChipText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: '#1d4ed8' },
  listContent: { paddingBottom: 24, rowGap: 10 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  statusBadge: {
    fontSize: 12,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  cardClient: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginTop: 8 },
  cardMeta: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  imageWrap: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eaf2ff',
  },
  imageThumb: {
    width: '100%',
    height: 180,
  },
  imageHint: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
  emptyNf: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
  },
  emptyNfText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#eff6ff',
  },
  detailButtonText: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  centerCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  errorText: { color: '#b91c1c', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  retryButton: {
    marginTop: 10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
  },
  previewImage: { width: '100%', height: 420, borderRadius: 10, backgroundColor: '#e5e7eb' },
  previewClose: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#1d4ed8',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  previewCloseText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
