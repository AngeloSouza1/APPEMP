import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatePickerModal from '../components/DatePickerModal';
import { ClienteResumo, clientesApi, pedidosApi } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { formatarData, formatarMoeda } from '../utils/format';

type StatusHistorico = 'EM_ESPERA' | 'CONFERIR' | 'EFETIVADO' | 'CANCELADO' | '';

type FiltroAplicado = {
  dataInicio?: string;
  dataFim?: string;
  clienteId?: number;
  status?: StatusHistorico;
};

const HISTORICO_FILTRO_STORAGE_KEY = '@appemp:historico_filtro';

const STATUS_OPTIONS: Array<{ value: StatusHistorico; label: string }> = [
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'EM_ESPERA', label: 'Em espera' },
  { value: 'CONFERIR', label: 'Conferir' },
  { value: 'CANCELADO', label: 'Cancelado' },
  { value: '', label: 'Todos os status' },
];

const STATUS_THEME: Record<string, { bg: string; border: string; text: string; label: string }> = {
  EM_ESPERA: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'Em espera' },
  CONFERIR: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Conferir' },
  EFETIVADO: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', label: 'Efetivado' },
  CANCELADO: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Cancelado' },
};

const brToIso = (valor: string) => {
  const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const isoData = (valor?: string) => {
  if (!valor) return '';
  return String(valor).slice(0, 10);
};

const formatarQuantidade = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(valor || 0));

export default function HistoricoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [status, setStatus] = useState<StatusHistorico>('EFETIVADO');

  const [showDataInicio, setShowDataInicio] = useState(false);
  const [showDataFim, setShowDataFim] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [lembrarFiltro, setLembrarFiltro] = useState(false);
  const [datasExpandidas, setDatasExpandidas] = useState<Record<string, boolean>>({});
  const [expandirTodasDatas, setExpandirTodasDatas] = useState(false);
  const [headerVisivel, setHeaderVisivel] = useState(true);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const ultimoScrollY = useRef(0);

  const [filtroAplicado, setFiltroAplicado] = useState<FiltroAplicado>({});

  useEffect(() => {
    const carregarFiltroSalvo = async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORICO_FILTRO_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          lembrar?: boolean;
          dataInicio?: string;
          dataFim?: string;
          clienteId?: string;
          status?: StatusHistorico;
          filtroAplicado?: FiltroAplicado;
        };
        if (!parsed.lembrar) return;
        setLembrarFiltro(true);
        setDataInicio(parsed.dataInicio || '');
        setDataFim(parsed.dataFim || '');
        setClienteId(parsed.clienteId || '');
        setStatus(parsed.status ?? 'EFETIVADO');
        setFiltroAplicado(parsed.filtroAplicado || {});
      } catch {
        // Ignora falha de leitura local.
      }
    };
    carregarFiltroSalvo();
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [pedidosResp, clientesResp] = await Promise.all([
        pedidosApi.listarPaginado({ page: 1, limit: 500 }),
        clientesApi.listar(),
      ]);
      setPedidos(pedidosResp.data.data);
      setClientes(clientesResp.data);
    } catch {
      setErro('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const aplicarFiltro = () => {
    setErro(null);
    const inicioIso = brToIso(dataInicio);
    const fimIso = brToIso(dataFim);

    if (!inicioIso || !fimIso) {
      setErro('Informe a data inicial e a data final para visualizar o histórico.');
      return;
    }

    if (inicioIso > fimIso) {
      setErro('A data inicial não pode ser maior que a data final.');
      return;
    }

    const novoFiltro = {
      dataInicio: inicioIso,
      dataFim: fimIso,
      clienteId: clienteId ? Number(clienteId) : undefined,
      status: status || undefined,
    };
    setFiltroAplicado(novoFiltro);
    if (lembrarFiltro) {
      AsyncStorage.setItem(
        HISTORICO_FILTRO_STORAGE_KEY,
        JSON.stringify({
          lembrar: true,
          dataInicio,
          dataFim,
          clienteId,
          status,
          filtroAplicado: novoFiltro,
        })
      ).catch(() => {
        // Ignora falha de persistencia local.
      });
    }
  };

  const limparFiltro = () => {
    setDataInicio('');
    setDataFim('');
    setClienteId('');
    setStatus('EFETIVADO');
    setFiltroAplicado({});
    setErro(null);
    if (!lembrarFiltro) {
      AsyncStorage.removeItem(HISTORICO_FILTRO_STORAGE_KEY).catch(() => {
        // Ignora falha de limpeza local.
      });
    }
  };

  const toggleLembrarFiltro = () => {
    const proximo = !lembrarFiltro;
    setLembrarFiltro(proximo);
    if (!proximo) {
      AsyncStorage.removeItem(HISTORICO_FILTRO_STORAGE_KEY).catch(() => {
        // Ignora falha de limpeza local.
      });
      return;
    }
    AsyncStorage.setItem(
      HISTORICO_FILTRO_STORAGE_KEY,
      JSON.stringify({
        lembrar: true,
        dataInicio,
        dataFim,
        clienteId,
        status,
        filtroAplicado,
      })
    ).catch(() => {
      // Ignora falha de persistencia local.
    });
  };

  const extrato = useMemo(() => {
    const filtrados = pedidos.filter((pedido) => {
      const dataPedido = isoData(pedido.data);
      if (filtroAplicado.dataInicio && dataPedido < filtroAplicado.dataInicio) return false;
      if (filtroAplicado.dataFim && dataPedido > filtroAplicado.dataFim) return false;
      if (filtroAplicado.clienteId && pedido.cliente_id !== filtroAplicado.clienteId) return false;
      if (filtroAplicado.status && pedido.status !== filtroAplicado.status) return false;
      return true;
    });

    const ordenados = [...filtrados].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    let saldo = 0;
    return ordenados.map((pedido) => {
      const valorMovimento = pedido.status === 'CANCELADO' ? 0 : Number(pedido.valor_efetivado ?? pedido.valor_total ?? 0);
      saldo += valorMovimento;
      return {
        ...pedido,
        valor_movimento: valorMovimento,
        saldo_acumulado: saldo,
        data_baixa: pedido.status === 'EFETIVADO' ? pedido.data : null,
      };
    });
  }, [filtroAplicado, pedidos]);

  const resumo = useMemo(() => {
    const totalVendas = extrato.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
    const totalEfetivado = extrato
      .filter((item) => item.status === 'EFETIVADO')
      .reduce((acc, item) => acc + Number(item.valor_efetivado ?? item.valor_total ?? 0), 0);
    const saldoPeriodo = extrato.length > 0 ? Number(extrato[extrato.length - 1].saldo_acumulado || 0) : 0;
    return { totalVendas, totalEfetivado, saldoPeriodo };
  }, [extrato]);

  const extratoAgrupadoPorData = useMemo(() => {
    const mapa = new Map<string, { dataLabel: string; itens: typeof extrato }>();
    extrato.forEach((item) => {
      const chaveData = isoData(item.data);
      if (!mapa.has(chaveData)) {
        mapa.set(chaveData, { dataLabel: formatarData(item.data), itens: [] });
      }
      mapa.get(chaveData)!.itens.push(item);
    });
    return [...mapa.entries()]
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([dataKey, value]) => ({ dataKey, data: value.dataLabel, itens: value.itens }));
  }, [extrato]);

  useEffect(() => {
    if (extratoAgrupadoPorData.length === 0) {
      setDatasExpandidas({});
      return;
    }
    setDatasExpandidas(() => {
      const next: Record<string, boolean> = {};
      extratoAgrupadoPorData.forEach((grupo) => {
        next[grupo.dataKey] = expandirTodasDatas;
      });
      return next;
    });
  }, [expandirTodasDatas, extratoAgrupadoPorData]);

  const periodoAplicadoCompleto = Boolean(filtroAplicado.dataInicio && filtroAplicado.dataFim);
  const clienteSelecionado =
    clientes.find((item) => String(item.id) === clienteId)?.nome || 'Todos os clientes';

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20;
  const contentTopOffset = topSafeOffset + 96;

  useEffect(() => {
    Animated.timing(headerTranslateY, {
      toValue: headerVisivel ? 0 : -120,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [headerTranslateY, headerVisivel]);

  const onScrollHistorico = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - ultimoScrollY.current;

      if (y <= 12) {
        if (!headerVisivel) setHeaderVisivel(true);
      } else if (delta > 6 && headerVisivel) {
        setHeaderVisivel(false);
      } else if (delta < -6 && !headerVisivel) {
        setHeaderVisivel(true);
      }

      ultimoScrollY.current = y;
    },
    [headerVisivel]
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <Animated.View
        style={[
          styles.topBar,
          { paddingTop: topSafeOffset, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/modulos/historico.png')} style={styles.headerIcon} resizeMode="contain" />
            <View>
              <Text style={styles.headerTitle}>Histórico</Text>
              <Text style={styles.headerSubtitle}>Extrato de transações e saldo do período</Text>
            </View>
          </View>
          <Pressable style={styles.headerBackButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: contentTopOffset, paddingBottom: 24 }]}
        onScroll={onScrollHistorico}
        scrollEventThrottle={16}
      >
        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        ) : null}

        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            <Pressable style={styles.dateInput} onPress={() => setShowDataInicio(true)}>
              <Text style={styles.inputLabel}>Data inicial</Text>
              <Text style={styles.inputValue}>{dataInicio || 'Selecionar'}</Text>
            </Pressable>
            <Pressable style={styles.dateInput} onPress={() => setShowDataFim(true)}>
              <Text style={styles.inputLabel}>Data final</Text>
              <Text style={styles.inputValue}>{dataFim || 'Selecionar'}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.checkboxRow} onPress={toggleLembrarFiltro}>
            <View style={[styles.checkboxBox, lembrarFiltro && styles.checkboxBoxChecked]}>
              {lembrarFiltro ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>Manter dados filtrados</Text>
          </Pressable>

          <Pressable style={styles.selectorInput} onPress={() => setShowClienteModal(true)}>
            <Text style={styles.inputLabel}>Cliente</Text>
            <Text style={styles.inputValue}>{clienteSelecionado}</Text>
          </Pressable>

          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((item) => (
              <Pressable
                key={item.value || 'TODOS'}
                style={[styles.statusChip, status === item.value && styles.statusChipActive]}
                onPress={() => setStatus(item.value)}
              >
                <Text style={[styles.statusChipText, status === item.value && styles.statusChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.filterActions}>
            <Pressable style={styles.btnPrimary} onPress={aplicarFiltro}>
              <Text style={styles.btnPrimaryText}>Aplicar período</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={limparFiltro}>
              <Text style={styles.btnGhostText}>Limpar</Text>
            </Pressable>
          </View>
        </View>

        {!periodoAplicadoCompleto ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Informe data inicial e data final e toque em "Aplicar período" para visualizar o extrato.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total de vendas</Text>
                <Text style={styles.kpiValue}>{formatarMoeda(resumo.totalVendas)}</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiGreen]}>
                <Text style={styles.kpiLabel}>Total efetivado</Text>
                <Text style={styles.kpiValue}>{formatarMoeda(resumo.totalEfetivado)}</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiBlue]}>
                <Text style={styles.kpiLabel}>Saldo do período</Text>
                <Text style={styles.kpiValue}>{formatarMoeda(resumo.saldoPeriodo)}</Text>
              </View>
            </View>

            {extrato.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Nenhuma transação encontrada para o período selecionado.</Text>
              </View>
            ) : (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Lançamentos</Text>
                  <Text style={styles.sectionMeta}>{extrato.length} item(ns)</Text>
                </View>
                <Pressable
                  style={styles.expandAllRow}
                  onPress={() => setExpandirTodasDatas((prev) => !prev)}
                >
                  <View style={[styles.checkboxBox, expandirTodasDatas && styles.checkboxBoxChecked]}>
                    {expandirTodasDatas ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.expandAllLabel}>Maximizar todos os cards de data</Text>
                </Pressable>
                {extratoAgrupadoPorData.map((grupo) => {
                  const valorTotalData = grupo.itens.reduce(
                    (acc, pedido) => acc + Number(pedido.valor_total || 0),
                    0
                  );
                  const expandido = Boolean(datasExpandidas[grupo.dataKey]);
                  return (
                  <View key={grupo.dataKey} style={styles.dateGroup}>
                    <Pressable
                      style={styles.dateGroupHeader}
                      onPress={() =>
                        setDatasExpandidas((prev) => ({ ...prev, [grupo.dataKey]: !Boolean(prev[grupo.dataKey]) }))
                      }
                    >
                      <Text style={styles.dateGroupTitle}>{grupo.data}</Text>
                      <Text style={styles.dateGroupMeta}>
                        {grupo.itens.length} pedido(s) • {formatarMoeda(valorTotalData)}
                      </Text>
                      <Text style={styles.dateGroupToggle}>{expandido ? '▾' : '▸'}</Text>
                    </Pressable>
                    {expandido
                      ? grupo.itens.map((item) => {
                      const theme = STATUS_THEME[item.status] || STATUS_THEME.CONFERIR;
                      const quantidadeTotal = (item.itens || []).reduce(
                        (acc, produto) => acc + Number(produto.quantidade || 0),
                        0
                      );
                      const itensResumo = (item.itens || []).slice(0, 3).map((produto) => ({
                        nome: produto.produto_nome || produto.codigo_produto || `Produto ${produto.produto_id}`,
                        qtd: formatarQuantidade(Number(produto.quantidade || 0)),
                        valor: formatarMoeda(Number(produto.valor_total_item || 0)),
                      }));
                      return (
                        <Pressable
                          key={item.id}
                          style={styles.itemCard}
                          onPress={() => navigation.navigate('PedidoDetalhe', { id: item.id })}
                        >
                          <View style={styles.itemTop}>
                            <Text style={styles.itemSub}>Pedido #{item.id}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                              <Text style={[styles.statusBadgeText, { color: theme.text }]}>{theme.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.itemClient}>{item.cliente_nome}</Text>
                          {itensResumo.length > 0 ? (
                            <View style={styles.itensResumoBox}>
                              <Text style={styles.itensResumoTitulo}>Itens do pedido</Text>
                              {itensResumo.map((resumo, idx) => (
                                <View key={`${item.id}-${idx}`} style={styles.itensResumoRow}>
                                  <Text style={styles.itemDescricaoNome}>{resumo.nome}</Text>
                                  <Text style={styles.itemDescricaoMeta}>
                                    {resumo.qtd} • {resumo.valor}
                                  </Text>
                                </View>
                              ))}
                              {(item.itens || []).length > 3 ? (
                                <Text style={styles.itensResumoExtra}>+ {(item.itens || []).length - 3} item(ns)</Text>
                              ) : null}
                            </View>
                          ) : null}
                          <View style={styles.vendaTotalBox}>
                            <Text style={styles.vendaTotalLabel}>Valor total da venda</Text>
                            <Text style={styles.vendaTotalValue}>{formatarMoeda(Number(item.valor_total || 0))}</Text>
                          </View>
                        </Pressable>
                      );
                    })
                      : null}
                  </View>
                );
                })}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      <DatePickerModal
        visible={showDataInicio}
        value={dataInicio}
        onChange={setDataInicio}
        onClose={() => setShowDataInicio(false)}
        title="Data inicial"
      />
      <DatePickerModal
        visible={showDataFim}
        value={dataFim}
        onChange={setDataFim}
        onClose={() => setShowDataFim(false)}
        title="Data final"
      />

      <Modal visible={showClienteModal} transparent animationType="fade" onRequestClose={() => setShowClienteModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowClienteModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecionar cliente</Text>
            <ScrollView style={styles.modalList}>
              <Pressable
                style={styles.modalItem}
                onPress={() => {
                  setClienteId('');
                  setShowClienteModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Todos os clientes</Text>
              </Pressable>
              {clientes.map((cliente) => (
                <Pressable
                  key={cliente.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setClienteId(String(cliente.id));
                    setShowClienteModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{cliente.codigo_cliente} - {cliente.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowClienteModal(false)}>
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dbeafe' },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e2e8f0' },
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
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12 },
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
  headerTitle: { fontSize: 27.72, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 12.71, fontWeight: '600', color: '#64748b' },
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
  content: { paddingHorizontal: 12, gap: 10 },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: { color: '#b91c1c', fontSize: 13.86, fontWeight: '700' },
  filterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    gap: 8,
  },
  filterRow: { flexDirection: 'row', columnGap: 8 },
  dateInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 1,
  },
  selectorInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 1,
  },
  inputLabel: { color: '#64748b', fontSize: 12.71, fontWeight: '700' },
  inputValue: { color: '#0f172a', fontSize: 15.02, fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipActive: { borderColor: '#93c5fd', backgroundColor: '#dbeafe' },
  statusChipText: { color: '#475569', fontSize: 12.71, fontWeight: '700' },
  statusChipTextActive: { color: '#1e40af' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  checkboxTick: {
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '800',
    lineHeight: 14,
  },
  checkboxLabel: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  filterActions: { flexDirection: 'row', columnGap: 8 },
  btnPrimary: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  btnPrimaryText: { color: '#ffffff', fontWeight: '800', fontSize: 15.02 },
  btnGhost: {
    width: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  btnGhostText: { color: '#334155', fontWeight: '700', fontSize: 15.02 },
  kpiRow: { gap: 8 },
  kpiCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kpiGreen: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  kpiBlue: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  kpiLabel: { color: '#475569', fontSize: 12.71, fontWeight: '700' },
  kpiValue: { color: '#0f172a', fontSize: 18.48, fontWeight: '900', marginTop: 2 },
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
  },
  sectionTitle: { color: '#0f172a', fontSize: 16.17, fontWeight: '800' },
  sectionMeta: { color: '#64748b', fontSize: 12.71, fontWeight: '700' },
  expandAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginBottom: 2,
  },
  expandAllLabel: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  dateGroup: {
    gap: 6,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dateGroupTitle: {
    color: '#1e40af',
    fontSize: 15.02,
    fontWeight: '800',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  dateGroupMeta: {
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  dateGroupToggle: {
    color: '#334155',
    fontSize: 15.02,
    fontWeight: '800',
  },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 5,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  itemSub: { color: '#64748b', fontSize: 12.71, fontWeight: '600' },
  itemClient: { color: '#0f172a', fontSize: 15.02, fontWeight: '700', flex: 1 },
  itensResumoBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
  },
  itensResumoTitulo: {
    color: '#334155',
    fontSize: 11.55,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  itensResumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  itemDescricaoNome: {
    flex: 1,
    color: '#1e293b',
    fontSize: 12.71,
    fontWeight: '700',
  },
  itemDescricaoMeta: {
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '700',
  },
  itensResumoExtra: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '700',
  },
  vendaTotalBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 2,
    paddingTop: 6,
    alignItems: 'flex-end',
  },
  vendaTotalLabel: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vendaTotalValue: {
    color: '#1e40af',
    fontSize: 16.17,
    fontWeight: '900',
    marginTop: 1,
    textAlign: 'right',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11.55, fontWeight: '800' },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#64748b', fontSize: 13.86, fontWeight: '600', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
  },
  modalTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18.48 },
  modalList: { maxHeight: 340 },
  modalItem: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 6,
  },
  modalItemText: { color: '#1e293b', fontSize: 13.86, fontWeight: '600' },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseBtnText: { color: '#334155', fontWeight: '700', fontSize: 13.86 },
});
