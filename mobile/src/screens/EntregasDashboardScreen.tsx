import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { relatoriosApi, RelatorioRotaDetalhadoItem } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarData, formatarMoeda } from '../utils/format';

type RotaResumoEntrega = {
  rota_id: number;
  rota_nome: string;
  total_clientes: number;
  total_pedidos: number;
  valor_total: number;
  pedidos: Array<{
    pedido_id: number;
    pedido_data: string;
    pedido_status: string;
    pedido_valor_total: number;
    cliente_nome: string;
    itens: Array<{
      item_chave: string;
      produto_nome: string;
      embalagem: string;
      quantidade: number;
      valor_total_item: number;
    }>;
  }>;
};

const agruparRotas = (rows: RelatorioRotaDetalhadoItem[]): RotaResumoEntrega[] => {
  const mapa = new Map<
    number,
    {
      rota_id: number;
      rota_nome: string;
      clientes: Set<number>;
      pedidos: Map<
        number,
        {
          pedido_id: number;
          pedido_data: string;
          pedido_status: string;
          pedido_valor_total: number;
          cliente_nome: string;
          itens: Map<
            string,
            {
              item_chave: string;
              produto_nome: string;
              embalagem: string;
              quantidade: number;
              valor_total_item: number;
            }
          >;
        }
      >;
    }
  >();

  rows.forEach((row) => {
    if (!mapa.has(row.rota_id)) {
      mapa.set(row.rota_id, {
        rota_id: row.rota_id,
        rota_nome: row.rota_nome,
        clientes: new Set<number>(),
        pedidos: new Map(),
      });
    }
    const rota = mapa.get(row.rota_id)!;
    rota.clientes.add(row.cliente_id);
    if (!rota.pedidos.has(row.pedido_id)) {
      rota.pedidos.set(row.pedido_id, {
        pedido_id: row.pedido_id,
        pedido_data: row.pedido_data,
        pedido_status: row.pedido_status,
        pedido_valor_total: Number(row.pedido_valor_total || 0),
        cliente_nome: row.cliente_nome,
        itens: new Map(),
      });
    }
    const pedido = rota.pedidos.get(row.pedido_id)!;
    if (row.produto_nome) {
      const embalagem = row.embalagem || '';
      const itemChave = row.produto_id
        ? String(row.produto_id)
        : `${row.produto_nome}|${embalagem}`;
      if (!pedido.itens.has(itemChave)) {
        pedido.itens.set(itemChave, {
          item_chave: itemChave,
          produto_nome: row.produto_nome,
          embalagem,
          quantidade: 0,
          valor_total_item: 0,
        });
      }
      const itemAtual = pedido.itens.get(itemChave)!;
      itemAtual.quantidade += Number(row.quantidade || 0);
      itemAtual.valor_total_item += Number(row.valor_total_item || 0);
    }
  });

  return [...mapa.values()]
    .map((rota) => {
      const pedidos = [...rota.pedidos.values()].sort(
        (a, b) => new Date(b.pedido_data).getTime() - new Date(a.pedido_data).getTime()
      );
      return {
        rota_id: rota.rota_id,
        rota_nome: rota.rota_nome,
        total_clientes: rota.clientes.size,
        total_pedidos: pedidos.length,
        valor_total: pedidos.reduce((acc, item) => acc + Number(item.pedido_valor_total || 0), 0),
        pedidos: pedidos.map((pedido) => ({
          ...pedido,
          itens: [...pedido.itens.values()].sort((a, b) =>
            a.produto_nome.localeCompare(b.produto_nome)
          ),
        })),
      };
    })
    .sort((a, b) => a.rota_nome.localeCompare(b.rota_nome));
};

export default function EntregasDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rotasDetalhado, setRotasDetalhado] = useState<RelatorioRotaDetalhadoItem[]>([]);
  const [rotaExpandidaId, setRotaExpandidaId] = useState<number | null>(null);

  const carregarEntregas = async () => {
    setLoading(true);
    setErro(null);
    try {
      const response = await relatoriosApi.rotasDetalhado({ status: 'EM_ESPERA' });
      setRotasDetalhado(response.data.filter((item) => item.pedido_status === 'EM_ESPERA'));
    } catch {
      setErro('Não foi possível carregar o dashboard de entregas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEntregas();
  }, []);

  const rotasAgrupadas = useMemo(() => agruparRotas(rotasDetalhado), [rotasDetalhado]);
  const totalRotas = rotasAgrupadas.length;
  const totalPedidos = rotasAgrupadas.reduce((acc, item) => acc + item.total_pedidos, 0);
  const valorTotal = rotasAgrupadas.reduce((acc, item) => acc + item.valor_total, 0);

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 18,
    insets.top + 6
  );
  const contentTopOffset = topSafeOffset + 98;

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/modulos/relatorio-rotas1.png')} style={styles.headerIcon} resizeMode="contain" />
            <Text style={styles.headerTitle}>Dashboard Entregas</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: contentTopOffset, paddingBottom: 108 + Math.max(insets.bottom, 8) },
        ]}
      >
        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
            <Pressable style={styles.retryButton} onPress={carregarEntregas}>
              <Text style={styles.retryButtonText}>Atualizar</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Rotas</Text>
                <Text style={styles.kpiValue}>{totalRotas}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Pedidos</Text>
                <Text style={styles.kpiValue}>{totalPedidos}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Valor</Text>
                <Text style={styles.kpiValue}>{formatarMoeda(valorTotal)}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Rotas de Entrega</Text>
                <Text style={styles.sectionMeta}>{rotasAgrupadas.length} rota(s)</Text>
              </View>
              {rotasAgrupadas.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma rota encontrada.</Text>
              ) : (
                rotasAgrupadas.map((rota) => (
                  <Pressable
                    key={rota.rota_id}
                    style={styles.itemCard}
                    onPress={() => setRotaExpandidaId((prev) => (prev === rota.rota_id ? null : rota.rota_id))}
                  >
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle}>{rota.rota_nome}</Text>
                      <Text style={styles.itemValue}>{formatarMoeda(rota.valor_total)}</Text>
                    </View>
                    <Text style={styles.expandHint}>
                      {rotaExpandidaId === rota.rota_id ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </Text>
                    {rotaExpandidaId === rota.rota_id ? (
                      <View style={styles.expandBox}>
                        {rota.pedidos.slice(0, 10).map((pedido) => (
                          <View key={pedido.pedido_id} style={styles.pedidoCard}>
                            <View style={styles.pedidoHeader}>
                              <Text style={styles.pedidoTitle}>Pedido #{pedido.pedido_id}</Text>
                              <Text style={styles.pedidoStatus}>{pedido.pedido_status}</Text>
                            </View>
                            <Text style={styles.pedidoMeta}>
                              {pedido.cliente_nome} - {formatarData(pedido.pedido_data)}
                            </Text>
                            <Text style={styles.pedidoTotal}>
                              Total: {formatarMoeda(pedido.pedido_valor_total)}
                            </Text>
                            {pedido.itens.length > 0 ? (
                              <View style={styles.pedidoItensBox}>
                                {pedido.itens.map((item) => (
                                  <View key={item.item_chave} style={styles.pedidoItemRow}>
                                    <Text style={styles.pedidoItemNome}>
                                      {item.produto_nome}
                                      {item.embalagem ? ` (${item.embalagem})` : ''}
                                    </Text>
                                    <View style={styles.pedidoItemInfoRow}>
                                      <Text style={styles.pedidoItemQtd}>Qtd: {item.quantidade}</Text>
                                      <Text style={styles.pedidoItemValor}>
                                        {formatarMoeda(item.valor_total_item)}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.pedidoItemVazio}>Sem itens detalhados.</Text>
                            )}
                          </View>
                        ))}
                        {rota.pedidos.length > 10 ? (
                          <Text style={styles.expandText}>+ {rota.pedidos.length - 10} pedido(s)</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footerDock, { bottom: Math.max(insets.bottom, 8) }]}>
        <View style={[styles.footerCard, { paddingBottom: 8 + Math.max(insets.bottom, 4) }]}>
          <View style={styles.footerActionsRow}>
            {[
              {
                key: 'home',
                label: 'Visão Geral',
                imagem: require('../../assets/modulos/pagina-principal1.png'),
                onPress: () => navigation.navigate('Home'),
              },
              {
                key: 'pedidos',
                label: 'Adicionar',
                imagem: require('../../assets/modulos/adicionar-pedido.png'),
                onPress: () => navigation.navigate('PedidoNovo'),
              },
              {
                key: 'producao',
                label: 'Produção',
                imagem: require('../../assets/modulos/doce.png'),
                onPress: () => navigation.navigate('ProducaoDashboard'),
              },
              {
                key: 'relatorios',
                label: 'Entregas',
                imagem: require('../../assets/modulos/relatorio-rotas1.png'),
                onPress: () => navigation.navigate('EntregasDashboard'),
              },
            ].map((acao) => {
              const ativo = acao.key === 'relatorios';
              return (
                <Pressable
                  key={acao.key}
                  style={[styles.footerActionItem, ativo && styles.footerActionItemActive]}
                  onPress={acao.onPress}
                >
                  <Image source={acao.imagem} style={styles.footerActionImage} resizeMode="contain" />
                  <Text style={[styles.footerActionText, ativo && styles.footerActionTextActive]}>{acao.label}</Text>
                  <View style={[styles.footerActionDot, ativo && styles.footerActionDotActive]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dbeafe' },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e2e8f0',
  },
  backgroundGlowBlue: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#93c5fd',
    opacity: 0.45,
  },
  backgroundGlowCyan: {
    position: 'absolute',
    top: 90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#67e8f9',
    opacity: 0.35,
  },
  backgroundGlowSoft: {
    position: 'absolute',
    bottom: -120,
    left: 20,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: '#bfdbfe',
    opacity: 0.3,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10, flex: 1 },
  headerIcon: { width: 34, height: 34 },
  headerTitle: { fontSize: 25.41, fontWeight: '800', color: '#0f172a' },
  headerBackButton: {
    minWidth: 82,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: { color: '#1e3a8a', fontWeight: '800', fontSize: 17.33 },
  pressed: { opacity: 0.82 },
  content: { paddingHorizontal: 12, gap: 10 },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: { color: '#b91c1c', fontSize: 13.86, fontWeight: '700' },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13.86 },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13.86,
    fontWeight: '600',
    textAlign: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 10,
  },
  kpiLabel: { color: '#475569', fontSize: 13.86, fontWeight: '700' },
  kpiValue: { color: '#1e3a8a', fontSize: 17.33, fontWeight: '900', marginTop: 2 },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  sectionTitle: { color: '#0f172a', fontSize: 17.33, fontWeight: '800' },
  sectionMeta: { color: '#475569', fontSize: 13.86, fontWeight: '700' },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 9,
    gap: 4,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 8 },
  itemTitle: { flex: 1, color: '#0f172a', fontSize: 17.33, fontWeight: '900' },
  itemValue: { color: '#1d4ed8', fontSize: 17.33, fontWeight: '900' },
  itemMeta: { color: '#475569', fontSize: 13.86, fontWeight: '600' },
  expandHint: {
    marginTop: 4,
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '700',
  },
  expandBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
    paddingTop: 8,
    gap: 8,
  },
  expandText: {
    color: '#334155',
    fontSize: 12.71,
    fontWeight: '600',
  },
  expandTextStrong: {
    color: '#0f172a',
    fontWeight: '800',
  },
  pedidoCard: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  pedidoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  pedidoTitle: {
    color: '#0f172a',
    fontSize: 13.86,
    fontWeight: '800',
    flex: 1,
  },
  pedidoStatus: {
    color: '#1d4ed8',
    fontSize: 12.71,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pedidoMeta: {
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '600',
  },
  pedidoTotal: {
    color: '#0f172a',
    fontSize: 12.71,
    fontWeight: '800',
  },
  pedidoItensBox: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    gap: 6,
  },
  pedidoItemRow: {
    gap: 2,
  },
  pedidoItemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  pedidoItemNome: {
    color: '#0f172a',
    fontSize: 12.71,
    fontWeight: '700',
  },
  pedidoItemQtd: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '600',
  },
  pedidoItemValor: {
    color: '#1e40af',
    fontSize: 12.71,
    fontWeight: '800',
  },
  pedidoItemVazio: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '600',
    marginTop: 2,
  },
  footerDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
  },
  footerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 6,
  },
  footerActionItem: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 3,
  },
  footerActionItemActive: {
    backgroundColor: '#dbeafe',
  },
  footerActionImage: {
    width: 24,
    height: 24,
  },
  footerActionText: {
    color: '#1e3a8a',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 12.71,
  },
  footerActionTextActive: {
    color: '#1e40af',
    fontWeight: '800',
  },
  footerActionDot: {
    width: 16,
    height: 2,
    borderRadius: 99,
    backgroundColor: 'transparent',
    marginTop: 1,
  },
  footerActionDotActive: {
    backgroundColor: '#eff6ff',
  },
});
