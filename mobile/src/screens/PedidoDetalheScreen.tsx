import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pedidosApi, ProdutoResumo, produtosApi, trocasApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido, TrocaPedido } from '../types/pedidos';
import { formatarData, formatarMoeda } from '../utils/format';
import { marcarRelatoriosComoDesatualizados } from '../utils/relatoriosRefresh';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidoDetalhe'>;
type TrocaItemOption = {
  key: string;
  item_pedido_id: number | null;
  produto_id: number;
  produto_nome: string;
  codigo_produto: string;
  valor_unitario: number;
  quantidade: number;
  embalagem?: string;
};

const STATUS_THEME: Record<string, { bg: string; border: string; text: string; label: string }> = {
  EM_ESPERA: {
    bg: '#fff7ed',
    border: '#fed7aa',
    text: '#9a3412',
    label: 'Em espera',
  },
  CONFERIR: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
    label: 'Conferir',
  },
  EFETIVADO: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#047857',
    label: 'Efetivado',
  },
  CANCELADO: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#b91c1c',
    label: 'Cancelado',
  },
};

const formatarQuantidade = (value: number | string | null | undefined) => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return String(value ?? '');
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(numero);
};

export default function PedidoDetalheScreen({ route, navigation }: Props) {
  const { id, focus } = route.params;
  const { user } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [trocas, setTrocas] = useState<TrocaPedido[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoTroca, setSalvandoTroca] = useState(false);
  const [removendoTrocaId, setRemovendoTrocaId] = useState<number | null>(null);
  const [mostrarListaItensTroca, setMostrarListaItensTroca] = useState(false);
  const [buscaItemTroca, setBuscaItemTroca] = useState('');
  const [tipoSeletorTroca, setTipoSeletorTroca] = useState<'vinculados' | 'nao_vinculados'>('vinculados');
  const [itemTrocaSelecionado, setItemTrocaSelecionado] = useState<TrocaItemOption | null>(null);
  const [quantidadeTroca, setQuantidadeTroca] = useState('1');
  const [erro, setErro] = useState<string | null>(null);
  const [trocasSectionY, setTrocasSectionY] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fetchPedido = useCallback(async () => {
    setLoading(true);
    try {
      const [pedidoResp, trocasResp] = await Promise.all([
        pedidosApi.buscarPorId(id),
        pedidosApi.listarTrocas(id),
      ]);
      try {
        const produtosResp = await produtosApi.listar();
        setProdutos(produtosResp.data || []);
      } catch {
        setProdutos([]);
      }
      setPedido(pedidoResp.data);
      setTrocas(trocasResp.data);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar os detalhes do pedido.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPedido();
  }, [fetchPedido]);

  const statusTheme = useMemo(() => {
    if (!pedido) {
      return {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#334155',
        label: 'Sem status',
      };
    }
    return (
      STATUS_THEME[pedido.status] || {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#334155',
        label: pedido.status || 'Sem status',
      }
    );
  }, [pedido]);

  const totalItens = useMemo(() => {
    if (!pedido) return 0;
    return pedido.itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  }, [pedido]);

  const trocasDoPedido = useMemo(() => {
    if (!pedido) return [];
    return trocas.filter((troca) => Number(troca.pedido_id) === Number(pedido.id));
  }, [pedido, trocas]);

  const itensVinculadosParaTroca = useMemo(() => {
    if (!pedido) return [] as TrocaItemOption[];
    return pedido.itens.map((item, index) => ({
        key: `${item.id || item.produto_id}-${index}`,
        item_pedido_id: typeof item.id === 'number' ? item.id : null,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || `Produto ${item.produto_id}`,
        codigo_produto: item.codigo_produto || '',
        valor_unitario: Number(item.valor_unitario || 0),
        quantidade: Number(item.quantidade || 0),
        embalagem: item.embalagem || '',
      }));
  }, [pedido]);

  const itensNaoVinculadosParaTroca = useMemo(() => {
    if (!pedido) return [] as TrocaItemOption[];
    const idsVinculados = new Set(pedido.itens.map((item) => item.produto_id));
    return produtos
      .filter((produto) => !idsVinculados.has(produto.id))
      .map((produto) => ({
        key: `catalogo-${produto.id}`,
        item_pedido_id: null,
        produto_id: produto.id,
        produto_nome: produto.nome,
        codigo_produto: produto.codigo_produto || '',
        valor_unitario: Number(produto.preco_base || 0),
        quantidade: 0,
        embalagem: produto.embalagem || '',
      }));
  }, [pedido, produtos]);

  const itensTrocaFiltrados = useMemo(() => {
    const base = tipoSeletorTroca === 'nao_vinculados' ? itensNaoVinculadosParaTroca : itensVinculadosParaTroca;
    const termo = buscaItemTroca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter((item) => {
      const codigo = (item.codigo_produto || '').toLowerCase();
      const nome = (item.produto_nome || '').toLowerCase();
      const embalagem = (item.embalagem || '').toLowerCase();
      return codigo.includes(termo) || nome.includes(termo) || embalagem.includes(termo);
    });
  }, [buscaItemTroca, itensNaoVinculadosParaTroca, itensVinculadosParaTroca, tipoSeletorTroca]);

  const parseDecimal = (value: string) => {
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const adicionarTrocaPorItem = async (item: TrocaItemOption) => {
    if (!pedido) return;
    const quantidade = parseDecimal(quantidadeTroca);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade válida para a troca.');
      return;
    }

    setSalvandoTroca(true);
    try {
      await trocasApi.criar({
        pedido_id: pedido.id,
        item_pedido_id: item.item_pedido_id ?? undefined,
        produto_id: item.produto_id,
        quantidade,
        valor_troca: Number(item.valor_unitario || 0) * quantidade,
      });
      await marcarRelatoriosComoDesatualizados();
      const trocasResp = await pedidosApi.listarTrocas(pedido.id);
      setTrocas(trocasResp.data);
      setBuscaItemTroca('');
      setItemTrocaSelecionado(null);
      setQuantidadeTroca('1');
      setMostrarListaItensTroca(false);
      setTipoSeletorTroca('vinculados');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar a troca.');
    } finally {
      setSalvandoTroca(false);
    }
  };

  const excluirTroca = async (trocaId: number) => {
    if (!pedido) return;
    setRemovendoTrocaId(trocaId);
    try {
      await trocasApi.excluir(trocaId);
      await marcarRelatoriosComoDesatualizados();
      const trocasResp = await pedidosApi.listarTrocas(pedido.id);
      setTrocas(trocasResp.data);
    } catch {
      Alert.alert('Erro', 'Não foi possível excluir a troca.');
    } finally {
      setRemovendoTrocaId(null);
    }
  };

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 18;

  useEffect(() => {
    if (focus !== 'trocas' || loading || !pedido || trocasSectionY === null) return;

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(trocasSectionY - 10, 0),
        animated: true,
      });
    }, 60);

    return () => clearTimeout(timeout);
  }, [focus, loading, pedido, trocasSectionY]);

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator />
        <Text style={styles.centeredText}>Carregando pedido...</Text>
      </View>
    );
  }

  if (erro || !pedido) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorText}>{erro || 'Pedido não encontrado.'}</Text>
        <View style={styles.errorActions}>
          <Pressable style={styles.retryButton} onPress={fetchPedido}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Pedido #{pedido.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
                <Text style={[styles.statusBadgeText, { color: statusTheme.text }]}>{statusTheme.label}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.headerIconText}>{'<'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          {user?.perfil !== 'motorista' ? <Text style={styles.heroValue}>{formatarMoeda(pedido.valor_total)}</Text> : null}
          <Text style={styles.heroMetaTitle}>Pedido: #{pedido.id}</Text>
          <Text style={styles.heroMetaDate}>{formatarData(pedido.data)}</Text>
          {user?.perfil !== 'motorista' ? <Text style={styles.heroLabel}>Valor total do pedido</Text> : null}

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Itens</Text>
              <Text style={styles.kpiValue}>{pedido.itens.length}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Qtd total</Text>
              <Text style={styles.kpiValue}>{totalItens}</Text>
            </View>
          </View>
        </View>

        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Itens do pedido</Text>
          {pedido.itens.length === 0 ? (
            <Text style={styles.emptyText}>Sem itens cadastrados.</Text>
          ) : (
            pedido.itens.map((item, index) => {
              const valorItem =
                item.valor_total_item || Number(item.valor_unitario || 0) * Number(item.quantidade || 0);

              return (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.produto_nome || `Produto ${item.produto_id}`}</Text>
                    <Text style={styles.itemMeta}>
                      Qtd: {formatarQuantidade(item.quantidade)} {item.embalagem ? `- ${item.embalagem}` : ''}
                    </Text>
                    {user?.perfil !== 'motorista' ? (
                      <Text style={styles.itemMeta}>Unit.: {formatarMoeda(Number(item.valor_unitario || 0))}</Text>
                    ) : null}
                  </View>
                  {user?.perfil !== 'motorista' ? <Text style={styles.itemValue}>{formatarMoeda(valorItem)}</Text> : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.itemsCard} onLayout={(event) => setTrocasSectionY(event.nativeEvent.layout.y)}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderInfo}>
                <Text style={styles.sectionTitle}>Trocas</Text>
                <Text style={styles.sectionSubtitle}>Detalhes das trocas deste pedido</Text>
              </View>
            </View>
            {focus === 'trocas' ? (
              <View style={styles.addTrocaCard}>
                    <View style={styles.optionRow}>
                      <Pressable
                        style={[
                          styles.optionChip,
                          tipoSeletorTroca === 'vinculados' && styles.optionChipActive,
                        ]}
                        onPress={() => {
                          setTipoSeletorTroca('vinculados');
                          setItemTrocaSelecionado(null);
                          setQuantidadeTroca('1');
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            tipoSeletorTroca === 'vinculados' && styles.optionChipTextActive,
                          ]}
                        >
                          Itens do pedido
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.optionChip,
                          tipoSeletorTroca === 'nao_vinculados' && styles.optionChipActive,
                        ]}
                        onPress={() => {
                          setTipoSeletorTroca('nao_vinculados');
                          setItemTrocaSelecionado(null);
                          setQuantidadeTroca('1');
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            tipoSeletorTroca === 'nao_vinculados' && styles.optionChipTextActive,
                          ]}
                        >
                          Não vinculados
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.clientSelectorTrigger,
                        itemTrocaSelecionado && styles.clientSelectorTriggerSelected,
                        pressed && styles.selectorTriggerPressed,
                      ]}
                      onPress={() => setMostrarListaItensTroca((prev) => !prev)}
                    >
                      <View style={styles.clientSelectorInfo}>
                        <Text style={styles.clientSelectorTitle}>
                          {itemTrocaSelecionado ? itemTrocaSelecionado.produto_nome : 'Selecionar item para troca'}
                        </Text>
                        <Text style={styles.clientSelectorSubtitle}>
                          {itemTrocaSelecionado
                            ? `#${itemTrocaSelecionado.codigo_produto} • ${tipoSeletorTroca === 'nao_vinculados' ? 'Não vinculado' : 'Vinculado'}`
                            : 'Toque para buscar por nome ou código'}
                        </Text>
                      </View>
                      <Text style={styles.toggleTrocaButtonText}>{mostrarListaItensTroca ? '▴' : '▾'}</Text>
                    </Pressable>

                    {mostrarListaItensTroca ? (
                      <>
                        <TextInput
                          value={buscaItemTroca}
                          onChangeText={setBuscaItemTroca}
                          style={styles.input}
                          placeholder={
                            tipoSeletorTroca === 'nao_vinculados'
                              ? 'Buscar item não vinculado'
                              : 'Buscar item para troca'
                          }
                          placeholderTextColor="#64748b"
                        />
                        <Text style={styles.listMetaText}>{itensTrocaFiltrados.length} item(ns) encontrado(s)</Text>
                        <ScrollView style={styles.clientListScroll} nestedScrollEnabled>
                          <View style={styles.produtosTrocaList}>
                            {itensTrocaFiltrados.map((item) => (
                              <Pressable
                                key={item.key}
                                style={({ pressed }) => [
                                  styles.productSelectRow,
                                  itemTrocaSelecionado?.key === item.key && styles.productRowSelected,
                                  pressed && styles.productRowPressed,
                                ]}
                                onPress={() => {
                                  setItemTrocaSelecionado(item);
                                  setQuantidadeTroca('1');
                                  setMostrarListaItensTroca(false);
                                }}
                                disabled={salvandoTroca}
                              >
                                <View style={styles.productSelectAvatar}>
                                  <Text style={styles.productSelectAvatarText}>
                                    {(item.produto_nome || 'P').trim().charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={styles.productRowInfo}>
                                  <Text style={styles.productName}>{item.produto_nome}</Text>
                                  <Text style={styles.productMeta}>
                                    #{item.codigo_produto} • Qtd: {formatarQuantidade(item.quantidade)}
                                    {item.embalagem ? ` • ${item.embalagem}` : ''}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </>
                    ) : null}

                    {itemTrocaSelecionado ? (
                      <View style={styles.addTrocaCard}>
                        <Text style={styles.itemFieldLabel}>Quantidade da troca</Text>
                        <TextInput
                          value={quantidadeTroca}
                          onChangeText={setQuantidadeTroca}
                          style={styles.input}
                          keyboardType="decimal-pad"
                          placeholder="Ex.: 1"
                          placeholderTextColor="#64748b"
                        />
                        <Pressable
                          style={({ pressed }) => [styles.addTrocaButton, pressed && styles.addTrocaButtonPressed]}
                          onPress={() => adicionarTrocaPorItem(itemTrocaSelecionado)}
                          disabled={salvandoTroca}
                        >
                          <Text style={styles.addTrocaButtonText}>
                            {salvandoTroca ? 'Adicionando...' : 'Confirmar troca'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
            ) : null}
            {trocasDoPedido.length === 0 ? (
              <View style={styles.emptyTrocaCard}>
                <Text style={styles.emptyText}>Sem trocas registradas.</Text>
              </View>
            ) : (
              <>
                {trocasDoPedido.map((troca) => (
                  <View key={`troca-${troca.id}`} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{troca.produto_nome || troca.codigo_produto}</Text>
                      <Text style={styles.itemMeta}>Qtd: {formatarQuantidade(troca.quantidade)}</Text>
                      {troca.motivo ? <Text style={styles.itemMeta}>Motivo: {troca.motivo}</Text> : null}
                      <Text style={styles.itemMeta}>{formatarData(troca.criado_em)}</Text>
                    </View>
                    <View style={styles.trocaActionsCol}>
                      <Text style={styles.itemValue}>{formatarMoeda(Number(troca.valor_troca || 0))}</Text>
                      {focus === 'trocas' ? (
                        <Pressable
                          style={({ pressed }) => [styles.deleteTrocaButton, pressed && styles.deleteTrocaButtonPressed]}
                          onPress={() => excluirTroca(troca.id)}
                          disabled={removendoTrocaId === troca.id}
                        >
                          <Text style={styles.deleteTrocaButtonText}>
                            {removendoTrocaId === troca.id ? 'Excluindo...' : 'Excluir'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dbeafe',
    position: 'relative',
  },
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
  content: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
    gap: 10,
  },
  centeredText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13.86,
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  headerTitle: {
    fontSize: 25.41,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerIconButton: {
    minWidth: 82,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: 6,
    justifyContent: 'center',
  },
  headerIconButtonPressed: {
    opacity: 0.82,
  },
  headerIconText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 17.33,
    lineHeight: 16,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12.71,
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    gap: 8,
  },
  heroValue: {
    fontSize: 30.03,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroLabel: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
  },
  heroMetaTitle: {
    marginTop: -2,
    color: '#1e3a8a',
    fontSize: 13.86,
    fontWeight: '700',
  },
  heroMetaDate: {
    marginTop: -2,
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 10,
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '700',
  },
  kpiValue: {
    marginTop: 3,
    color: '#1e3a8a',
    fontSize: 23.1,
    fontWeight: '800',
  },
  itemsCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18.48,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  sectionSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
  },
  toggleTrocaButton: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toggleTrocaButtonPressed: {
    opacity: 0.84,
  },
  toggleTrocaInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  toggleTrocaButtonText: {
    color: '#4338ca',
    fontWeight: '700',
    fontSize: 15.02,
  },
  toggleTrocaHint: {
    color: '#6366f1',
    fontSize: 12.71,
    fontWeight: '600',
  },
  toggleTrocaChevron: {
    color: '#4338ca',
    fontWeight: '800',
    fontSize: 16.17,
  },
  addTrocaCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#f8f7ff',
    padding: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    color: '#0f172a',
    fontSize: 15.02,
  },
  itemFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemFieldSmall: {
    width: 90,
    gap: 4,
  },
  itemFieldLarge: {
    flex: 1,
    gap: 4,
  },
  itemFieldLabel: {
    color: '#334155',
    fontSize: 12.71,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  optionChipActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#818cf8',
  },
  optionChipText: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: '#4338ca',
  },
  clientSelectorTrigger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clientSelectorTriggerSelected: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  selectorTriggerPressed: {
    opacity: 0.84,
  },
  clientSelectorInfo: {
    flex: 1,
    minWidth: 0,
  },
  clientSelectorTitle: {
    color: '#0f172a',
    fontSize: 16.17,
    fontWeight: '800',
  },
  clientSelectorSubtitle: {
    marginTop: 1,
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '600',
  },
  listMetaText: {
    marginTop: -2,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
  },
  clientListScroll: {
    maxHeight: 260,
  },
  produtosTrocaList: {
    gap: 6,
  },
  productSelectRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productRowSelected: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  productRowPressed: {
    opacity: 0.84,
  },
  productSelectAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productSelectAvatarText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 15.02,
  },
  productRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13.86,
  },
  productMeta: {
    color: '#64748b',
    fontSize: 12.71,
  },
  addTrocaButton: {
    marginTop: 2,
    borderRadius: 9,
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    alignItems: 'center',
  },
  addTrocaButtonPressed: {
    opacity: 0.84,
  },
  addTrocaButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13.86,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13.86,
    fontWeight: '600',
  },
  emptyTrocaCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#f8f7ff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15.02,
  },
  itemMeta: {
    color: '#475569',
    marginTop: 2,
    fontSize: 13.86,
  },
  itemValue: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13.86,
  },
  trocaActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deleteTrocaButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteTrocaButtonPressed: {
    opacity: 0.82,
  },
  deleteTrocaButtonText: {
    color: '#b91c1c',
    fontSize: 12.71,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 13.86,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13.86,
  },
});
