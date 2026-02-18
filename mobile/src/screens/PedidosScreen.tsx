import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { clientesApi, pedidosApi, rotasApi } from '../api/services';
import { API_URL } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { formatarData, formatarMoeda } from '../utils/format';
import { marcarRelatoriosComoDesatualizados } from '../utils/relatoriosRefresh';

type StatusOption = {
  value: string;
  label: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: '', label: 'Todos' },
  { value: 'EM_ESPERA', label: 'Em espera' },
  { value: 'CONFERIR', label: 'Conferir' },
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

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

export default function PedidosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [data, setData] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [rotaId, setRotaId] = useState<number | null>(null);
  const [status, setStatus] = useState('EM_ESPERA');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [clientesImagemMap, setClientesImagemMap] = useState<Record<number, string | null>>({});
  const [clientesFiltro, setClientesFiltro] = useState<Array<{ id: number; nome: string; codigo_cliente: string }>>(
    []
  );
  const [rotasFiltro, setRotasFiltro] = useState<Array<{ id: number; nome: string }>>([]);
  const [mostrarClientesFiltro, setMostrarClientesFiltro] = useState(false);
  const [buscaClienteFiltro, setBuscaClienteFiltro] = useState('');
  const [mostrarRotasFiltro, setMostrarRotasFiltro] = useState(false);
  const [buscaRotaFiltro, setBuscaRotaFiltro] = useState('');
  const [cancelandoPedidoId, setCancelandoPedidoId] = useState<number | null>(null);

  const getMensagemErro = (error: unknown) => {
    const maybeError = error as
      | (Error & { response?: { status?: number; data?: { message?: string } } })
      | undefined;
    const statusCode = maybeError?.response?.status;

    if (statusCode === 401) {
      return 'Sessão expirada. Faça login novamente.';
    }
    if (statusCode === 403) {
      return 'Acesso negado para carregar pedidos.';
    }
    if (statusCode && statusCode >= 500) {
      return 'Backend indisponível no momento. Tente novamente.';
    }

    if (maybeError?.name === 'AbortError') {
      return `Tempo de resposta excedido (${API_URL}).`;
    }

    if (maybeError?.message?.toLowerCase().includes('network request failed')) {
      return `Sem conexão com a API (${API_URL}).`;
    }

    return 'Não foi possível carregar pedidos.';
  };

  const parseDataFiltro = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    }
    return undefined;
  };

  const fetchPedidos = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await pedidosApi.listarPaginado({
          q: q.trim() || undefined,
          data: parseDataFiltro(data),
          cliente_id: clienteId || undefined,
          rota_id: rotaId || undefined,
          status: status || undefined,
          page,
          limit: 20,
        });

        setPedidos(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalRegistros(response.data.total);
        setErro(null);
      } catch (error) {
        setErro(getMensagemErro(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clienteId, data, page, q, rotaId, status]
  );

  useFocusEffect(
    useCallback(() => {
      fetchPedidos(true);
      const timer = setInterval(() => {
        fetchPedidos(true);
      }, 15000);
      return () => clearInterval(timer);
    }, [fetchPedidos])
  );

  useEffect(() => {
    const carregarClientes = async () => {
      try {
        const response = await clientesApi.listar();
        const mapa = response.data.reduce<Record<number, string | null>>((acc, cliente) => {
          acc[cliente.id] = cliente.imagem_url || null;
          return acc;
        }, {});
        setClientesImagemMap(mapa);
        setClientesFiltro(response.data.map((cliente) => ({
          id: cliente.id,
          nome: cliente.nome,
          codigo_cliente: cliente.codigo_cliente,
        })));
      } catch {
        setClientesImagemMap({});
        setClientesFiltro([]);
      }
    };

    carregarClientes();
  }, []);

  useEffect(() => {
    const carregarRotas = async () => {
      try {
        const response = await rotasApi.listar();
        setRotasFiltro(response.data);
      } catch {
        setRotasFiltro([]);
      }
    };

    carregarRotas();
  }, []);

  const statusLabel = useMemo(() => {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Todos';
  }, [status]);
  const clientesFiltrados = useMemo(() => {
    const termo = buscaClienteFiltro.trim().toLowerCase();
    if (!termo) return clientesFiltro.slice(0, 30);
    return clientesFiltro
      .filter((cliente) => `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo))
      .slice(0, 30);
  }, [buscaClienteFiltro, clientesFiltro]);
  const rotasFiltradas = useMemo(() => {
    const termo = buscaRotaFiltro.trim().toLowerCase();
    if (!termo) return rotasFiltro.slice(0, 30);
    return rotasFiltro.filter((rota) => rota.nome.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaRotaFiltro, rotasFiltro]);
  const clienteSelecionado = useMemo(
    () => clientesFiltro.find((cliente) => cliente.id === clienteId) || null,
    [clienteId, clientesFiltro]
  );
  const rotaSelecionada = useMemo(
    () => rotasFiltro.find((rota) => rota.id === rotaId) || null,
    [rotaId, rotasFiltro]
  );

  const resumoPagina = useMemo(() => {
    const totalValor = pedidos.reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0);
    return {
      totalPedidos: pedidos.length,
      totalValor,
    };
  }, [pedidos]);

  const limparFiltros = () => {
    setQ('');
    setData('');
    setClienteId(null);
    setRotaId(null);
    setStatus('EM_ESPERA');
    setBuscaClienteFiltro('');
    setBuscaRotaFiltro('');
    setMostrarClientesFiltro(false);
    setMostrarRotasFiltro(false);
    setPage(1);
  };

  const handleEditarPedido = (id: number) => {
    navigation.navigate('PedidoEditar', { id });
  };

  const handleTrocasPedido = (id: number) => {
    navigation.navigate('PedidoDetalhe', { id, focus: 'trocas' });
  };

  const handleCancelarPedido = (id: number) => {
    Alert.alert('Cancelar pedido', 'Deseja cancelar este pedido? Ele será marcado como cancelado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancelandoPedidoId(id);
            await pedidosApi.atualizarStatus(id, { status: 'CANCELADO' });
            await marcarRelatoriosComoDesatualizados();
            fetchPedidos();
          } catch {
            Alert.alert('Erro', 'Não foi possível cancelar o pedido.');
          } finally {
            setCancelandoPedidoId(null);
          }
        },
      },
    ]);
  };

  const getStatusTheme = (statusPedido: string) => {
    return (
      STATUS_THEME[statusPedido] || {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#334155',
        label: statusPedido || 'Sem status',
      }
    );
  };

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 18;

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Image
                source={require('../../assets/modulos/pedidos.png')}
                style={styles.headerTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Pedidos</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.headerAddButtonStandalone, pressed && styles.headerAddButtonPressed]}
          onPress={() => navigation.navigate('PedidoNovo')}
        >
          <Text style={styles.headerAddIcon}>+</Text>
          <Text style={styles.headerAddButtonText}>Novo Pedido</Text>
        </Pressable>
      </View>

      <View style={[styles.content, { paddingTop: topSafeOffset + 138 }]}>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pedidos na página</Text>
            <Text style={styles.kpiValue}>{resumoPagina.totalPedidos}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Valor da página</Text>
            <Text style={styles.kpiValueSmall}>{formatarMoeda(resumoPagina.totalValor)}</Text>
          </View>
        </View>

        <View style={styles.filtersCard}>
          <Pressable
            style={({ pressed }) => [styles.filtersHeaderPressable, pressed && styles.filtersHeaderPressablePressed]}
            onPress={() => setFiltrosAbertos((prev) => !prev)}
          >
            <View style={styles.filtersHeaderInfo}>
              <Text style={styles.filtersTitle}>Filtros</Text>
              <Text style={styles.filtersSubtitle}>
                Status: {statusLabel} {filtrosAbertos ? '• Toque para fechar' : '• Toque para abrir'}
              </Text>
            </View>
            <Text style={styles.filtersChevron}>{filtrosAbertos ? '▴' : '▾'}</Text>
          </Pressable>

          {filtrosAbertos ? (
            <>
              <View style={styles.filtersInputs}>
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>Busca</Text>
                  <TextInput
                    placeholder="Cliente, código ou chave"
                    placeholderTextColor="#64748b"
                    value={q}
                    onChangeText={(value) => {
                      setQ(value);
                      setPage(1);
                    }}
                    style={styles.input}
                  />
                </View>

                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>Data</Text>
                  <Pressable
                    style={({ pressed }) => [styles.input, styles.inputPressable, pressed && styles.inputPressablePressed]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.inputPressableText, !data && styles.inputPressablePlaceholder]}>
                      {data || 'dd/mm/aaaa'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.statusSection}>
                <Text style={styles.filterLabel}>Cliente</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.filterSelectorTrigger,
                    clienteSelecionado && styles.filterSelectorTriggerSelected,
                    pressed && styles.selectorTriggerPressed,
                  ]}
                  onPress={() => {
                    setMostrarClientesFiltro((prev) => !prev);
                    setMostrarRotasFiltro(false);
                  }}
                >
                  <View style={styles.filterSelectorInfo}>
                    <Text style={styles.filterSelectorTitle}>
                      {clienteSelecionado ? clienteSelecionado.nome : 'Todos os clientes'}
                    </Text>
                    <Text style={styles.filterSelectorSubtitle}>
                      {clienteSelecionado ? `#${clienteSelecionado.codigo_cliente}` : 'Toque para selecionar'}
                    </Text>
                  </View>
                  <Text style={styles.filtersChevron}>{mostrarClientesFiltro ? '▴' : '▾'}</Text>
                </Pressable>
                {mostrarClientesFiltro ? (
                  <>
                    <TextInput
                      value={buscaClienteFiltro}
                      onChangeText={setBuscaClienteFiltro}
                      style={styles.input}
                      placeholder="Buscar cliente"
                      placeholderTextColor="#64748b"
                    />
                    <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
                      <View style={styles.selectorListWrap}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.selectorRow,
                            clienteId === null && styles.selectorRowSelected,
                            pressed && styles.selectorRowPressed,
                          ]}
                          onPress={() => {
                            setClienteId(null);
                            setPage(1);
                            setMostrarClientesFiltro(false);
                            setBuscaClienteFiltro('');
                          }}
                        >
                          <Text style={[styles.selectorRowTitle, clienteId === null && styles.selectorRowTitleSelected]}>
                            Todos os clientes
                          </Text>
                        </Pressable>
                        {clientesFiltrados.map((cliente) => (
                          <Pressable
                            key={cliente.id}
                            style={({ pressed }) => [
                              styles.selectorRow,
                              clienteId === cliente.id && styles.selectorRowSelected,
                              pressed && styles.selectorRowPressed,
                            ]}
                            onPress={() => {
                              setClienteId(cliente.id);
                              setPage(1);
                              setMostrarClientesFiltro(false);
                              setBuscaClienteFiltro('');
                            }}
                          >
                            <Text
                              style={[
                                styles.selectorRowTitle,
                                clienteId === cliente.id && styles.selectorRowTitleSelected,
                              ]}
                            >
                              {cliente.nome}
                            </Text>
                            <Text style={styles.selectorRowSubtitle}>#{cliente.codigo_cliente}</Text>
                          </Pressable>
                        ))}
                        {clientesFiltrados.length === 0 ? (
                          <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
                        ) : null}
                      </View>
                    </ScrollView>
                  </>
                ) : null}
              </View>

              <View style={styles.statusSection}>
                <Text style={styles.filterLabel}>Rota</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.filterSelectorTrigger,
                    rotaSelecionada && styles.filterSelectorTriggerSelected,
                    pressed && styles.selectorTriggerPressed,
                  ]}
                  onPress={() => {
                    setMostrarRotasFiltro((prev) => !prev);
                    setMostrarClientesFiltro(false);
                  }}
                >
                  <View style={styles.filterSelectorInfo}>
                    <Text style={styles.filterSelectorTitle}>
                      {rotaSelecionada ? rotaSelecionada.nome : 'Todas as rotas'}
                    </Text>
                    <Text style={styles.filterSelectorSubtitle}>Toque para selecionar</Text>
                  </View>
                  <Text style={styles.filtersChevron}>{mostrarRotasFiltro ? '▴' : '▾'}</Text>
                </Pressable>
                {mostrarRotasFiltro ? (
                  <>
                    <TextInput
                      value={buscaRotaFiltro}
                      onChangeText={setBuscaRotaFiltro}
                      style={styles.input}
                      placeholder="Buscar rota"
                      placeholderTextColor="#64748b"
                    />
                    <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
                      <View style={styles.selectorListWrap}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.selectorRow,
                            rotaId === null && styles.selectorRowSelected,
                            pressed && styles.selectorRowPressed,
                          ]}
                          onPress={() => {
                            setRotaId(null);
                            setPage(1);
                            setMostrarRotasFiltro(false);
                            setBuscaRotaFiltro('');
                          }}
                        >
                          <Text style={[styles.selectorRowTitle, rotaId === null && styles.selectorRowTitleSelected]}>
                            Todas as rotas
                          </Text>
                        </Pressable>
                        {rotasFiltradas.map((rota) => (
                          <Pressable
                            key={rota.id}
                            style={({ pressed }) => [
                              styles.selectorRow,
                              rotaId === rota.id && styles.selectorRowSelected,
                              pressed && styles.selectorRowPressed,
                            ]}
                            onPress={() => {
                              setRotaId(rota.id);
                              setPage(1);
                              setMostrarRotasFiltro(false);
                              setBuscaRotaFiltro('');
                            }}
                          >
                            <Text
                              style={[styles.selectorRowTitle, rotaId === rota.id && styles.selectorRowTitleSelected]}
                            >
                              {rota.nome}
                            </Text>
                          </Pressable>
                        ))}
                        {rotasFiltradas.length === 0 ? (
                          <Text style={styles.emptyText}>Nenhuma rota encontrada.</Text>
                        ) : null}
                      </View>
                    </ScrollView>
                  </>
                ) : null}
              </View>

              <View style={styles.statusSection}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((option) => {
                  const active = option.value === status;
                  return (
                    <Pressable
                      key={option.value || 'ALL'}
                      onPress={() => {
                        setStatus(option.value);
                        setPage(1);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
                </View>
              </View>

              <View style={styles.filtersActions}>
                <Pressable
                  style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                  onPress={limparFiltros}
                >
                  <Text style={styles.clearButtonText}>Limpar</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
              onPress={() => fetchPedidos()}
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.totalRegistrosText}>{totalRegistros} pedido(s) encontrado(s)</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={pedidos}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPedidos(true)} />}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido encontrado.</Text>}
            renderItem={({ item }) => {
              const statusTheme = getStatusTheme(item.status);
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => navigation.navigate('PedidoDetalhe', { id: item.id })}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.clientWrap}>
                      <View style={styles.clientAvatar}>
                        {clientesImagemMap[item.cliente_id] ? (
                          <Image
                            source={{ uri: clientesImagemMap[item.cliente_id] as string }}
                            style={styles.clientAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.clientAvatarText}>
                            {(item.cliente_nome || 'C').trim().charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.client} numberOfLines={1}>
                        {item.cliente_nome}
                      </Text>
                    </View>
                    <View style={styles.badgesCol}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: statusTheme.text }]}>
                          {statusTheme.label}
                        </Text>
                      </View>
                      {(Boolean(item.tem_trocas) || Number(item.qtd_trocas || 0) > 0) ? (
                        <View style={styles.trocaBadge}>
                          <Text style={styles.trocaBadgeText}>
                            {Number(item.qtd_trocas || 0) > 0
                              ? `${item.qtd_trocas} troca(s)`
                              : 'Com trocas'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.metaStrong}>{formatarMoeda(item.valor_total)}</Text>
                  <Text style={styles.metaTitle}>Pedido: #{item.id}</Text>
                  <Text style={styles.metaDate}>{formatarData(item.data)}</Text>
                  <View style={styles.cardBottomRow}>
                    <View />
                    <Text style={styles.cardChevron}>{'>'}</Text>
                  </View>
                  <View style={styles.cardActionsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.cardActionLink, pressed && styles.cardActionLinkPressed]}
                      onPress={() => handleEditarPedido(item.id)}
                    >
                      <Text style={styles.cardActionEditText}>Editar</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.cardActionLink, pressed && styles.cardActionLinkPressed]}
                      onPress={() => handleTrocasPedido(item.id)}
                    >
                      <Text style={styles.cardActionTrocaText}>Trocas</Text>
                    </Pressable>
                    {item.status !== 'CANCELADO' ? (
                      <Pressable
                        style={({ pressed }) => [styles.cardActionLink, pressed && styles.cardActionLinkPressed]}
                        onPress={() => handleCancelarPedido(item.id)}
                      >
                        <Text style={styles.cardActionDeleteText}>
                          {cancelandoPedidoId === item.id ? 'Cancelando...' : 'Cancelar'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              style={({ pressed }) => [styles.pageBtn, page <= 1 && styles.pageBtnDisabled, pressed && styles.pageBtnPressed]}
              disabled={page <= 1}
              onPress={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Anterior</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Página {page} de {totalPages}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.pageBtn, page >= totalPages && styles.pageBtnDisabled, pressed && styles.pageBtnPressed]}
              disabled={page >= totalPages}
              onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            >
              <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>Próxima</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <DatePickerModal
        visible={showDatePicker}
        value={data}
        onChange={(value) => {
          setData(value);
          setPage(1);
        }}
        onClose={() => setShowDatePicker(false)}
        title="Filtrar por data"
      />
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
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
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
    columnGap: 10,
    marginBottom: 10,
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  headerAddButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: 6,
    justifyContent: 'center',
  },
  headerAddButtonStandalone: {
    marginTop: 8,
    marginBottom: 10,
    width: '100%',
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: 7,
    justifyContent: 'center',
  },
  headerAddButtonPressed: {
    opacity: 0.86,
  },
  headerAddIcon: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14.7,
    lineHeight: 14,
  },
  headerAddButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13.65,
  },
  headerIconButtonPressed: {
    opacity: 0.82,
  },
  headerIconText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 15.75,
    lineHeight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  headerTitleIcon: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 25.2,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: 'rgba(239,246,255,0.95)',
    padding: 10,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  kpiLabel: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 11.55,
  },
  kpiValue: {
    marginTop: 3,
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 22.05,
  },
  kpiValueSmall: {
    marginTop: 4,
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15.75,
  },
  filtersCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 10,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  filtersHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 2,
  },
  filtersHeaderPressablePressed: {
    opacity: 0.82,
  },
  filtersHeaderInfo: {
    flex: 1,
  },
  filtersTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14.7,
  },
  filtersSubtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 11.55,
  },
  filtersChevron: {
    color: '#1d4ed8',
    fontSize: 16.8,
    fontWeight: '800',
    marginLeft: 8,
  },
  filtersInputs: {
    gap: 8,
  },
  filterField: {
    gap: 5,
  },
  filterLabel: {
    color: '#334155',
    fontSize: 11.55,
    fontWeight: '700',
  },
  filterSelectorTrigger: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterSelectorTriggerSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  filterSelectorInfo: {
    flex: 1,
    minWidth: 0,
  },
  filterSelectorTitle: {
    color: '#0f172a',
    fontSize: 13.65,
    fontWeight: '700',
  },
  filterSelectorSubtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '500',
  },
  selectorTriggerPressed: {
    opacity: 0.84,
  },
  input: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    color: '#0f172a',
    fontSize: 13.65,
  },
  inputPressable: {
    minHeight: 42,
    justifyContent: 'center',
  },
  inputPressablePressed: {
    opacity: 0.85,
  },
  inputPressableText: {
    color: '#0f172a',
    fontSize: 13.65,
  },
  inputPressablePlaceholder: {
    color: '#64748b',
  },
  statusSection: {
    gap: 6,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectorListScroll: {
    maxHeight: 180,
  },
  selectorListWrap: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  selectorRow: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 1,
  },
  selectorRowSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  selectorRowPressed: {
    opacity: 0.86,
  },
  selectorRowTitle: {
    color: '#0f172a',
    fontSize: 13.65,
    fontWeight: '700',
  },
  selectorRowTitleSelected: {
    color: '#1d4ed8',
  },
  selectorRowSubtitle: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '500',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  chipText: {
    color: '#334155',
    fontSize: 12.6,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  filtersActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  clearButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12.6,
  },
  clearButtonPressed: {
    opacity: 0.85,
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  totalRegistrosText: {
    marginBottom: 8,
    color: '#475569',
    fontSize: 12.6,
    fontWeight: '700',
    textAlign: 'right',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12.6,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12.6,
  },
  retryButtonPressed: {
    opacity: 0.84,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12.6,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.07,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  clientWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    flex: 1,
    minWidth: 0,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clientAvatarImage: {
    width: '100%',
    height: '100%',
  },
  clientAvatarText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 16.8,
  },
  client: {
    fontSize: 17.85,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    minWidth: 0,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11.55,
    fontWeight: '800',
  },
  trocaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trocaBadgeText: {
    color: '#6d28d9',
    fontSize: 10.5,
    fontWeight: '800',
  },
  metaStrong: {
    marginTop: 8,
    fontSize: 16.8,
    fontWeight: '800',
    color: '#111827',
  },
  metaTitle: {
    marginTop: 3,
    color: '#1e3a8a',
    fontSize: 12.6,
    fontWeight: '700',
  },
  metaDate: {
    marginTop: 2,
    color: '#475569',
    fontSize: 12.6,
    fontWeight: '600',
  },
  meta: {
    marginTop: 3,
    color: '#475569',
    fontSize: 12.6,
  },
  cardBottomRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActionsRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  cardActionLink: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  cardActionLinkPressed: {
    opacity: 0.65,
  },
  cardActionEditText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12.6,
  },
  cardActionTrocaText: {
    color: '#6d28d9',
    fontWeight: '700',
    fontSize: 12.6,
  },
  cardActionDeleteText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 12.6,
  },
  cardChevron: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 13.65,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 2,
  },
  pageBtn: {
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  pageBtnText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12.6,
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageBtnPressed: {
    opacity: 0.82,
  },
  pageInfo: {
    color: '#475569',
    fontSize: 12.6,
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
});
