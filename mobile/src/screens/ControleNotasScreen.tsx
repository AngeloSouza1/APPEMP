import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
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

const STATUS_RANK: Record<string, number> = {
  CANCELADO: 1,
  EM_ESPERA: 2,
  CONFERIR: 3,
  EFETIVADO: 4,
};

export default function ControleNotasScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [notaSelecionada, setNotaSelecionada] = useState<string | null>(null);
  const [cardsExpandidos, setCardsExpandidos] = useState<Record<number, boolean>>({});

  const carregar = useCallback(async () => {
    try {
      const response = await pedidosApi.listarPaginado({
        page: 1,
        limit: 400,
      });
      const pedidosComNf = response.data.data.filter(
        (pedido) => Boolean(pedido.nf_imagem_url) && pedido.status !== 'CANCELADO'
      );
      const mapa = new Map<number, Pedido>();
      pedidosComNf.forEach((pedido) => {
        const atual = mapa.get(pedido.id);
        if (!atual) {
          mapa.set(pedido.id, pedido);
          return;
        }
        const atualRank = STATUS_RANK[atual.status] || 0;
        const novoRank = STATUS_RANK[pedido.status] || 0;
        if (novoRank > atualRank) {
          mapa.set(pedido.id, pedido);
          return;
        }
        if (novoRank === atualRank && !atual.nf_imagem_url && pedido.nf_imagem_url) {
          mapa.set(pedido.id, pedido);
          return;
        }
        if (novoRank === atualRank) {
          const dataAtual = new Date(atual.data).getTime();
          const dataNova = new Date(pedido.data).getTime();
          if (dataNova > dataAtual) {
            mapa.set(pedido.id, pedido);
          }
        }
      });
      const pedidosUnicos = Array.from(mapa.values()).sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime() || b.id - a.id
      );
      setPedidos(pedidosUnicos);
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

  const totalComImagem = useMemo(
    () => pedidos.filter((pedido) => Boolean(pedido.nf_imagem_url)).length,
    [pedidos]
  );

  const toggleCard = useCallback((id: number) => {
    setCardsExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderItem = ({ item }: { item: Pedido }) => {
    const statusTheme = STATUS_COLOR[item.status] || STATUS_COLOR.EM_ESPERA;
    const statusLabel = STATUS_LABEL[item.status] || item.status;
    const expandido = Boolean(cardsExpandidos[item.id]);
    return (
      <Pressable style={styles.card} onPress={() => toggleCard(item.id)}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>Pedido #{item.id}</Text>
          <View style={styles.cardTopRight}>
            <Text style={[styles.statusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border, color: statusTheme.text }]}>
              {statusLabel}
            </Text>
            <Text style={styles.expandHint}>{expandido ? '−' : '+'}</Text>
          </View>
        </View>
        <Text style={styles.cardClient}>{item.cliente_nome}</Text>
        <Text style={[styles.cardMeta, !expandido && styles.cardMetaCompact]}>
          {formatarData(item.data)} • {formatarMoeda(Number(item.valor_total || 0))}
        </Text>
        <Text style={styles.nfNumberText}>NF: {item.nf_numero ? item.nf_numero : 'Não informado'}</Text>
        {expandido ? (
          <>
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
          </>
        ) : null}
      </Pressable>
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
          <Text style={styles.summaryValue}>{pedidos.length}</Text>
          <Text style={styles.summarySub}>Somente pedidos com NF válida (não cancelados)</Text>
        </View>

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
            data={pedidos}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={onRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.centerCard}>
                <Text style={styles.emptyText}>Nenhum pedido com NF encontrado.</Text>
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
  cardTopRight: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  expandHint: { color: '#1d4ed8', fontSize: 18, fontWeight: '800' },
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
  cardMetaCompact: { marginBottom: 0 },
  nfNumberText: { color: '#0f172a', fontSize: 12.8, fontWeight: '700', marginTop: 4 },
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
