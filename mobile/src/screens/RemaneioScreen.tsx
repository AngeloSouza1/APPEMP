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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerModal from '../components/DatePickerModal';
import { pedidosApi, RotaResumo, rotasApi } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { useAuth } from '../context/AuthContext';
import { formatarData, formatarMoeda } from '../utils/format';
import { marcarRelatoriosComoDesatualizados } from '../utils/relatoriosRefresh';

type Step = 'selecao' | 'remaneio' | 'dashboard';

const parseDataFiltro = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }
  return undefined;
};

const ordenarPedidosRemaneio = (lista: Pedido[]) =>
  [...lista].sort((a, b) => {
    const ordemA = a.ordem_remaneio ?? Number.MAX_SAFE_INTEGER;
    const ordemB = b.ordem_remaneio ?? Number.MAX_SAFE_INTEGER;
    if (ordemA !== ordemB) return ordemA - ordemB;
    const diffData = new Date(b.data).getTime() - new Date(a.data).getTime();
    if (diffData !== 0) return diffData;
    return b.id - a.id;
  });

export default function RemaneioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('selecao');
  const [pedidosSelecao, setPedidosSelecao] = useState<Pedido[]>([]);
  const [pedidosRemaneio, setPedidosRemaneio] = useState<Pedido[]>([]);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroRota, setFiltroRota] = useState<number | null>(null);
  const [data, setData] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filtrosAplicados, setFiltrosAplicados] = useState<{ q?: string; rota_id?: number; data?: string }>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [mostrarRotas, setMostrarRotas] = useState(false);
  const [buscaRota, setBuscaRota] = useState('');
  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);
  const [ordemLocalRemaneio, setOrdemLocalRemaneio] = useState<number[]>([]);
  const [stepSelecaoBloqueado, setStepSelecaoBloqueado] = useState(false);

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );
  const contentTopOffset = topSafeOffset + 98;

  const podeAcessarRemaneio =
    user?.perfil === 'admin' || user?.perfil === 'backoffice' || user?.perfil === 'motorista';

  const aplicarOrdemLocalRemaneio = useCallback(
    (lista: Pedido[]) => {
      if (ordemLocalRemaneio.length === 0) return lista;
      const porId = new Map(lista.map((pedido) => [pedido.id, pedido]));
      const usados = new Set<number>();
      const ordenados = ordemLocalRemaneio
        .map((id) => porId.get(id))
        .filter((pedido): pedido is Pedido => {
          if (!pedido) return false;
          usados.add(pedido.id);
          return true;
        });
      const restantes = lista.filter((pedido) => !usados.has(pedido.id));
      return [...ordenados, ...restantes];
    },
    [ordemLocalRemaneio]
  );

  const carregarDados = useCallback(
    async (isRefresh = false) => {
      if (!podeAcessarRemaneio) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setErro(null);
      try {
        const [rotasResp, selecaoResp, remaneioResp] = await Promise.all([
          rotasApi.listar(),
          pedidosApi.listarPaginado({
            page: 1,
            limit: 200,
            status: 'EM_ESPERA',
            ...filtrosAplicados,
          }),
          pedidosApi.listarPaginado({
            page: 1,
            limit: 200,
            status: 'CONFERIR',
            ...filtrosAplicados,
          }),
        ]);

        const listaSelecao = selecaoResp.data.data;
        const listaRemaneio = aplicarOrdemLocalRemaneio(
          ordenarPedidosRemaneio(remaneioResp.data.data)
        );

        setRotas(rotasResp.data);
        setPedidosSelecao(listaSelecao);
        setPedidosRemaneio(listaRemaneio);
      } catch {
        setErro('Não foi possível carregar os dados do remaneio.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [aplicarOrdemLocalRemaneio, filtrosAplicados, podeAcessarRemaneio]
  );

  useFocusEffect(
    useCallback(() => {
      carregarDados(true);
      const timer = setInterval(() => {
        carregarDados(true);
      }, 15000);
      return () => clearInterval(timer);
    }, [carregarDados])
  );

  useEffect(() => {
    setIdsSelecionados((prev) => prev.filter((id) => pedidosSelecao.some((pedido) => pedido.id === id)));
  }, [pedidosSelecao]);

  const hasPedidosNoRemaneio = pedidosRemaneio.length > 0;

  useEffect(() => {
    if ((step === 'remaneio' || step === 'dashboard') && !hasPedidosNoRemaneio) {
      setStep('selecao');
    }
  }, [hasPedidosNoRemaneio, step]);

  const rotaSelecionada = useMemo(
    () => rotas.find((rota) => rota.id === filtroRota) || null,
    [filtroRota, rotas]
  );

  const rotasFiltradas = useMemo(() => {
    const termo = buscaRota.trim().toLowerCase();
    if (!termo) return rotas.slice(0, 30);
    return rotas.filter((rota) => rota.nome.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaRota, rotas]);

  const totalSelecionado = useMemo(
    () =>
      pedidosSelecao
        .filter((pedido) => idsSelecionados.includes(pedido.id))
        .reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0),
    [idsSelecionados, pedidosSelecao]
  );

  const pedidosDashboard = useMemo(() => ordenarPedidosRemaneio(pedidosRemaneio), [pedidosRemaneio]);

  const resumoDashboard = useMemo(() => {
    const totalPedidos = pedidosDashboard.length;
    const valorTotal = pedidosDashboard.reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0);
    const pedidosComTroca = pedidosDashboard.filter(
      (pedido) => Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0
    ).length;
    return { totalPedidos, valorTotal, pedidosComTroca };
  }, [pedidosDashboard]);

  const aplicarFiltros = () => {
    setFiltrosAplicados({
      q: busca.trim() || undefined,
      rota_id: filtroRota || undefined,
      data: parseDataFiltro(data),
    });
    setSucesso(null);
  };

  const limparFiltros = () => {
    setBusca('');
    setFiltroRota(null);
    setData('');
    setMostrarRotas(false);
    setBuscaRota('');
    setFiltrosAplicados({});
    setSucesso(null);
  };

  const alternarSelecao = (id: number) => {
    setIdsSelecionados((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selecionarTodos = () => {
    setIdsSelecionados(pedidosSelecao.map((pedido) => pedido.id));
  };

  const limparSelecao = () => {
    setIdsSelecionados([]);
  };

  const enviarParaEntrega = async () => {
    setErro(null);
    setSucesso(null);
    const pedidosAlvo = pedidosSelecao.filter((pedido) => idsSelecionados.includes(pedido.id));
    if (pedidosAlvo.length === 0) {
      setErro('Selecione pelo menos um pedido em espera para enviar para entrega.');
      return;
    }

    setProcessando(true);
    try {
      await Promise.all(
        pedidosAlvo.map((pedido) =>
          pedidosApi.atualizarStatus(pedido.id, {
            status: 'CONFERIR',
          })
        )
      );
      await pedidosApi.atualizarOrdemRemaneio(idsSelecionados);
      await marcarRelatoriosComoDesatualizados();
      setStepSelecaoBloqueado(true);
      setIdsSelecionados([]);
      setSucesso(`${pedidosAlvo.length} pedido(s) enviado(s) para entrega.`);
      await carregarDados();
      setStep('remaneio');
    } catch {
      setErro('Não foi possível enviar os pedidos selecionados para entrega.');
    } finally {
      setProcessando(false);
    }
  };

  const retirarDoRemaneio = async (pedidoId: number) => {
    setErro(null);
    setSucesso(null);
    setProcessando(true);
    try {
      await pedidosApi.atualizarStatus(pedidoId, {
        status: 'EM_ESPERA',
      });
      await marcarRelatoriosComoDesatualizados();
      setStepSelecaoBloqueado(false);
      setSucesso(`Pedido #${pedidoId} retirado do remaneio.`);
      await carregarDados();
    } catch {
      setErro('Não foi possível retirar o pedido do remaneio.');
    } finally {
      setProcessando(false);
    }
  };

  const efetivarPedido = async (pedidoId: number) => {
    setErro(null);
    setSucesso(null);
    setProcessando(true);
    try {
      await pedidosApi.atualizarStatus(pedidoId, {
        status: 'EFETIVADO',
      });
      await marcarRelatoriosComoDesatualizados();
      setStepSelecaoBloqueado(false);
      setSucesso(`Pedido #${pedidoId} atualizado para Efetivado.`);
      await carregarDados();
    } catch {
      setErro('Não foi possível efetivar o pedido.');
    } finally {
      setProcessando(false);
    }
  };

  const confirmarRetirada = (pedidoId: number) => {
    Alert.alert(
      'Confirmar retirada',
      `Deseja realmente retirar o pedido #${pedidoId} do remaneio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, retirar',
          style: 'destructive',
          onPress: () => retirarDoRemaneio(pedidoId),
        },
      ]
    );
  };

  const confirmarEfetivacao = (pedidoId: number) => {
    Alert.alert(
      'Confirmar efetivação',
      `Deseja realmente efetivar o pedido #${pedidoId}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, efetivar',
          onPress: () => efetivarPedido(pedidoId),
        },
      ]
    );
  };

  const moverPedidoRemaneio = async (pedidoId: number, direcao: 'up' | 'down') => {
    const indiceAtual = pedidosRemaneio.findIndex((pedido) => pedido.id === pedidoId);
    if (indiceAtual < 0) return;
    const indiceDestino = direcao === 'up' ? indiceAtual - 1 : indiceAtual + 1;
    if (indiceDestino < 0 || indiceDestino >= pedidosRemaneio.length) return;

    const listaAnterior = [...pedidosRemaneio];
    const listaNova = [...pedidosRemaneio];
    const [movido] = listaNova.splice(indiceAtual, 1);
    listaNova.splice(indiceDestino, 0, movido);

    setPedidosRemaneio(listaNova);
    setOrdemLocalRemaneio(listaNova.map((pedido) => pedido.id));
    setErro(null);
    setSucesso(null);
    setProcessando(true);
    try {
      await pedidosApi.atualizarOrdemRemaneio(listaNova.map((pedido) => pedido.id));
      setSucesso('Ordem do remaneio atualizada.');
      setPedidosRemaneio(ordenarPedidosRemaneio(listaNova));
    } catch {
      setPedidosRemaneio(listaNova);
      setOrdemLocalRemaneio(listaNova.map((pedido) => pedido.id));
      setErro('Ordem atualizada localmente. Não foi possível sincronizar com o servidor.');
    } finally {
      setProcessando(false);
    }
  };

  if (!podeAcessarRemaneio) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, { paddingTop: topSafeOffset + 24 }]}>
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              Apenas usuários admin, backoffice ou motorista podem acessar o remaneio.
            </Text>
          </View>
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

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Image source={require('../../assets/modulos/remaneio.png')} style={styles.headerTitleIcon} resizeMode="contain" />
              <Text style={styles.headerTitle}>Remaneio</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.content, { paddingTop: contentTopOffset }]}>
        <View style={styles.stepsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.stepButton,
              step === 'selecao' && styles.stepButtonActive,
              stepSelecaoBloqueado && step !== 'selecao' && styles.stepButtonDisabled,
              pressed && styles.stepButtonPressed,
            ]}
            onPress={() => {
              if (!stepSelecaoBloqueado || step === 'selecao') setStep('selecao');
            }}
            disabled={stepSelecaoBloqueado && step !== 'selecao'}
          >
            <Text style={[styles.stepButtonText, step === 'selecao' && styles.stepButtonTextActive]}>Step 1</Text>
            <Text style={[styles.stepButtonSub, step === 'selecao' && styles.stepButtonTextActive]}>Seleção</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.stepButton,
              step === 'remaneio' && styles.stepButtonActive,
              !hasPedidosNoRemaneio && styles.stepButtonDisabled,
              pressed && styles.stepButtonPressed,
            ]}
            onPress={() => {
              if (hasPedidosNoRemaneio) setStep('remaneio');
            }}
            disabled={!hasPedidosNoRemaneio}
          >
            <Text style={[styles.stepButtonText, step === 'remaneio' && styles.stepButtonTextActive]}>Step 2</Text>
            <Text style={[styles.stepButtonSub, step === 'remaneio' && styles.stepButtonTextActive]}>No Remaneio</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.stepButton,
              step === 'dashboard' && styles.stepButtonActive,
              !hasPedidosNoRemaneio && styles.stepButtonDisabled,
              pressed && styles.stepButtonPressed,
            ]}
            onPress={() => {
              if (hasPedidosNoRemaneio) setStep('dashboard');
            }}
            disabled={!hasPedidosNoRemaneio}
          >
            <Text style={[styles.stepButtonText, step === 'dashboard' && styles.stepButtonTextActive]}>Step 3</Text>
            <Text style={[styles.stepButtonSub, step === 'dashboard' && styles.stepButtonTextActive]}>Dashboard</Text>
          </Pressable>
        </View>

        {step !== 'dashboard' ? (
          <View style={styles.filtersCard}>
            <Pressable
              style={({ pressed }) => [styles.filtersHeaderPressable, pressed && styles.filtersHeaderPressablePressed]}
              onPress={() => setFiltrosAbertos((prev) => !prev)}
            >
              <View style={styles.filtersHeaderInfo}>
                <Text style={styles.filtersHeaderTitle}>Filtros</Text>
                <Text style={styles.filtersHeaderSubtitle}>{filtrosAbertos ? 'Toque para fechar' : 'Toque para abrir'}</Text>
              </View>
              <Text style={styles.selectorChevron}>{filtrosAbertos ? '▴' : '▾'}</Text>
            </Pressable>

            {filtrosAbertos ? (
              <>
                <TextInput
                  placeholder="Cliente, chave ou ID"
                  placeholderTextColor="#7c2d12"
                  value={busca}
                  onChangeText={setBusca}
                  style={styles.input}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.selectorTrigger,
                    rotaSelecionada && styles.selectorTriggerSelected,
                    pressed && styles.selectorTriggerPressed,
                  ]}
                  onPress={() => setMostrarRotas((prev) => !prev)}
                >
                  <View style={styles.selectorInfo}>
                    <Text style={styles.selectorTitle}>{rotaSelecionada ? rotaSelecionada.nome : 'Todas as rotas'}</Text>
                    <Text style={styles.selectorSubtitle}>
                      {rotaSelecionada ? `Rota #${rotaSelecionada.id}` : 'Toque para filtrar por rota'}
                    </Text>
                  </View>
                  <Text style={styles.selectorChevron}>{mostrarRotas ? '▴' : '▾'}</Text>
                </Pressable>

                {mostrarRotas ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={buscaRota}
                      onChangeText={setBuscaRota}
                      placeholder="Buscar rota"
                      placeholderTextColor="#7c2d12"
                    />
                    <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
                      <View style={styles.selectorListWrap}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.selectorRow,
                            filtroRota === null && styles.selectorRowSelected,
                            pressed && styles.selectorRowPressed,
                          ]}
                          onPress={() => {
                            setFiltroRota(null);
                            setMostrarRotas(false);
                            setBuscaRota('');
                          }}
                        >
                          <Text style={[styles.selectorRowTitle, filtroRota === null && styles.selectorRowTitleSelected]}>
                            Todas as rotas
                          </Text>
                        </Pressable>
                        {rotasFiltradas.map((rota) => (
                          <Pressable
                            key={rota.id}
                            style={({ pressed }) => [
                              styles.selectorRow,
                              filtroRota === rota.id && styles.selectorRowSelected,
                              pressed && styles.selectorRowPressed,
                            ]}
                            onPress={() => {
                              setFiltroRota(rota.id);
                              setMostrarRotas(false);
                              setBuscaRota('');
                            }}
                          >
                            <Text style={[styles.selectorRowTitle, filtroRota === rota.id && styles.selectorRowTitleSelected]}>
                              {rota.nome}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.dateInputPressable, pressed && styles.selectorTriggerPressed]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dateInputText, !data && styles.dateInputPlaceholder]}>
                    {data || 'Selecionar data'}
                  </Text>
                  <Text style={styles.selectorChevron}>▾</Text>
                </Pressable>

                <View style={styles.filterActionsRow}>
                  <Pressable style={styles.secondaryButton} onPress={limparFiltros}>
                    <Text style={styles.secondaryButtonText}>Limpar</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={aplicarFiltros}>
                    <Text style={styles.primaryButtonText}>Aplicar</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        ) : null}
        {sucesso ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>{sucesso}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : step === 'selecao' ? (
          <>
            <View style={styles.selectionSummaryCard}>
              <View>
                <Text style={styles.selectionSummaryText}>
                  <Text style={styles.selectionSummaryStrong}>{idsSelecionados.length}</Text> pedido(s) selecionado(s)
                </Text>
                <Text style={styles.selectionSummaryText}>
                  Total selecionado: <Text style={styles.selectionSummaryStrong}>{formatarMoeda(totalSelecionado)}</Text>
                </Text>
              </View>
              <View style={styles.selectionActionsWrap}>
                <Pressable style={styles.summaryActionButton} onPress={selecionarTodos}>
                  <Text style={styles.summaryActionButtonText}>Selecionar todos</Text>
                </Pressable>
                <Pressable style={styles.summaryActionButton} onPress={limparSelecao}>
                  <Text style={styles.summaryActionButtonText}>Limpar seleção</Text>
                </Pressable>
                <Pressable
                  style={[styles.summaryPrimaryButton, (processando || idsSelecionados.length === 0) && styles.disabledButton]}
                  onPress={enviarParaEntrega}
                  disabled={processando || idsSelecionados.length === 0}
                >
                  <Text style={styles.summaryPrimaryButtonText}>{processando ? 'Enviando...' : 'Avançar para entrega'}</Text>
                </Pressable>
              </View>
            </View>

            <FlatList
              data={pedidosSelecao}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido em espera para os filtros aplicados.</Text>}
              renderItem={({ item }) => {
                const selecionado = idsSelecionados.includes(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.card, selecionado && styles.cardSelected, pressed && styles.cardPressed]}
                    onPress={() => alternarSelecao(item.id)}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.cliente_nome || 'Cliente'}
                      </Text>
                      <View style={styles.badgesCol}>
                        <View style={[styles.checkCircle, selecionado && styles.checkCircleSelected]}>
                          <Text style={[styles.checkCircleText, selecionado && styles.checkCircleTextSelected]}>
                            {selecionado ? '✓' : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.cardMeta}>Pedido #{item.id}</Text>
                    <Text style={styles.cardMeta}>{item.rota_nome || 'Sem rota'} • {formatarData(item.data)}</Text>
                    <Text style={styles.cardValue}>{formatarMoeda(Number(item.valor_total || 0))}</Text>
                  </Pressable>
                );
              }}
            />
          </>
        ) : step === 'remaneio' ? (
          <FlatList
            data={pedidosRemaneio}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
            ListHeaderComponent={
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>Pedidos já enviados para entrega (status Conferir).</Text>
              </View>
            }
            ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido no remaneio para os filtros aplicados.</Text>}
            renderItem={({ item, index }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.cliente_nome || 'Cliente'}
                  </Text>
                  <View style={styles.badgesCol}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>Conferir</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardMeta}>Pedido #{item.id}</Text>
                <Text style={styles.cardMeta}>{item.rota_nome || 'Sem rota'} • {formatarData(item.data)}</Text>
                <View style={styles.remaneioActionsRow}>
                  <Text style={styles.cardValue}>{formatarMoeda(Number(item.valor_total || 0))}</Text>
                  <View style={styles.remaneioButtonsWrap}>
                    <View style={styles.orderButtonsWrap}>
                      <Pressable
                        style={[styles.orderButton, (processando || index === 0) && styles.disabledButton]}
                        onPress={() => moverPedidoRemaneio(item.id, 'up')}
                        disabled={processando || index === 0}
                      >
                        <Text style={styles.orderButtonText}>↑</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.orderButton,
                          (processando || index === pedidosRemaneio.length - 1) && styles.disabledButton,
                        ]}
                        onPress={() => moverPedidoRemaneio(item.id, 'down')}
                        disabled={processando || index === pedidosRemaneio.length - 1}
                      >
                        <Text style={styles.orderButtonText}>↓</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      style={[styles.smallPrimaryButton, processando && styles.disabledButton]}
                      onPress={() => confirmarEfetivacao(item.id)}
                      disabled={processando}
                    >
                      <Text style={styles.smallPrimaryButtonText}>Efetivar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallSecondaryButton, processando && styles.disabledButton]}
                      onPress={() => confirmarRetirada(item.id)}
                      disabled={processando}
                    >
                      <Text style={styles.smallSecondaryButtonText}>Retirar</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
          >
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Dashboard dos pedidos enviados para entrega (Conferir).</Text>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Pedidos no remaneio</Text>
                <Text style={styles.kpiValue}>{resumoDashboard.totalPedidos}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Pedidos com troca</Text>
                <Text style={styles.kpiValue}>{resumoDashboard.pedidosComTroca}</Text>
              </View>
            </View>
            <View style={styles.kpiCardFull}>
              <Text style={styles.kpiLabel}>Valor total</Text>
              <Text style={styles.kpiValueMoney}>{formatarMoeda(resumoDashboard.valorTotal)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Pedidos recentes</Text>
            {pedidosDashboard.length === 0 ? (
              <Text style={styles.empty}>Nenhum pedido no remaneio.</Text>
            ) : (
              pedidosDashboard.slice(0, 20).map((item) => (
                <Pressable
                  key={`dashboard-${item.id}`}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => navigation.navigate('PedidoDetalhe', { id: item.id })}
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.cliente_nome || 'Cliente'}
                    </Text>
                    <Text style={styles.cardMeta}>#{item.id}</Text>
                  </View>
                  <Text style={styles.cardMeta}>{item.rota_nome || 'Sem rota'} • {formatarData(item.data)}</Text>
                  <Text style={styles.cardValue}>{formatarMoeda(Number(item.valor_total || 0))}</Text>
                  {(item.tem_trocas || Number(item.qtd_trocas || 0) > 0) ? (
                    <View style={styles.trocaBadge}>
                      <Text style={styles.trocaBadgeText}>{Number(item.qtd_trocas || 0)} troca(s)</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <DatePickerModal
        visible={showDatePicker}
        value={data}
        onClose={() => setShowDatePicker(false)}
        onChange={(value) => {
          setData(value);
          setShowDatePicker(false);
        }}
        title="Selecionar data"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e2e8f0',
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
    opacity: 0.32,
  },
  backgroundGlowCyan: {
    position: 'absolute',
    top: 90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#67e8f9',
    opacity: 0.22,
  },
  backgroundGlowSoft: {
    position: 'absolute',
    bottom: -120,
    left: 20,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: '#bfdbfe',
    opacity: 0.22,
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
    fontSize: 27.72,
    fontWeight: '800',
    color: '#7c2d12',
  },
  headerIconButton: {
    minWidth: 82,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonPressed: {
    opacity: 0.82,
  },
  headerIconText: {
    color: '#9a3412',
    fontWeight: '800',
    fontSize: 17.33,
    lineHeight: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  stepButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  stepButtonActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
  },
  stepButtonDisabled: {
    opacity: 0.45,
  },
  stepButtonPressed: {
    opacity: 0.84,
  },
  stepButtonText: {
    color: '#7c2d12',
    fontWeight: '800',
    fontSize: 13.86,
  },
  stepButtonSub: {
    color: '#9a3412',
    fontWeight: '600',
    fontSize: 12.71,
  },
  stepButtonTextActive: {
    color: '#9a3412',
  },
  filtersCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  filtersHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  filtersHeaderPressablePressed: {
    opacity: 0.85,
  },
  filtersHeaderInfo: {
    flex: 1,
  },
  filtersHeaderTitle: {
    color: '#7c2d12',
    fontSize: 15.02,
    fontWeight: '800',
  },
  filtersHeaderSubtitle: {
    color: '#9a3412',
    fontSize: 12.71,
    fontWeight: '500',
    marginTop: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff7ed',
    color: '#7c2d12',
    fontSize: 15.02,
  },
  selectorTrigger: {
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectorTriggerSelected: {
    borderColor: '#fb923c',
    backgroundColor: '#fff7ed',
  },
  selectorTriggerPressed: {
    opacity: 0.84,
  },
  selectorInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectorTitle: {
    color: '#7c2d12',
    fontSize: 15.02,
    fontWeight: '700',
  },
  selectorSubtitle: {
    marginTop: 1,
    color: '#9a3412',
    fontSize: 12.71,
    fontWeight: '500',
  },
  selectorChevron: {
    color: '#9a3412',
    fontSize: 18.48,
    fontWeight: '800',
  },
  selectorListScroll: {
    maxHeight: 170,
  },
  selectorListWrap: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  selectorRow: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 1,
  },
  selectorRowSelected: {
    borderColor: '#fb923c',
    backgroundColor: '#fff7ed',
  },
  selectorRowPressed: {
    opacity: 0.86,
  },
  selectorRowTitle: {
    color: '#7c2d12',
    fontSize: 15.02,
    fontWeight: '700',
  },
  selectorRowTitleSelected: {
    color: '#9a3412',
  },
  dateInputPressable: {
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    color: '#7c2d12',
    fontSize: 15.02,
    fontWeight: '700',
  },
  dateInputPlaceholder: {
    color: '#9a3412',
    fontWeight: '500',
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: '#ea580c',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13.86,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#9a3412',
    fontWeight: '800',
    fontSize: 13.86,
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13.86,
    fontWeight: '600',
  },
  successCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    padding: 10,
    marginBottom: 10,
  },
  successText: {
    color: '#047857',
    fontSize: 13.86,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fffbeb',
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  selectionSummaryText: {
    color: '#7c2d12',
    fontSize: 13.86,
    fontWeight: '600',
  },
  selectionSummaryStrong: {
    color: '#9a3412',
    fontWeight: '800',
  },
  selectionActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryActionButtonText: {
    color: '#9a3412',
    fontSize: 12.71,
    fontWeight: '700',
  },
  summaryPrimaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ea580c',
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryPrimaryButtonText: {
    color: '#fff',
    fontSize: 12.71,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  listContent: {
    paddingBottom: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#7c2d12',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    marginBottom: 8,
  },
  cardSelected: {
    borderColor: '#fb923c',
    backgroundColor: '#fff7ed',
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
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardTitle: {
    fontSize: 17.33,
    fontWeight: '800',
    color: '#7c2d12',
    flex: 1,
  },
  cardMeta: {
    marginTop: 2,
    color: '#57534e',
    fontSize: 13.86,
    fontWeight: '600',
  },
  cardValue: {
    marginTop: 6,
    color: '#7c2d12',
    fontSize: 17.33,
    fontWeight: '900',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#ea580c',
  },
  checkCircleText: {
    color: 'transparent',
    fontWeight: '900',
    fontSize: 15.02,
    lineHeight: 14,
  },
  checkCircleTextSelected: {
    color: '#fff',
  },
  infoCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 10,
    marginBottom: 8,
  },
  infoText: {
    color: '#1e3a8a',
    fontSize: 13.86,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: '#1d4ed8',
    fontSize: 12.71,
    fontWeight: '700',
  },
  remaneioActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  remaneioButtonsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderButtonsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 2,
  },
  orderButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 34,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#1d4ed8',
    fontSize: 12.71,
    fontWeight: '800',
    lineHeight: 14,
  },
  smallPrimaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 12.71,
    fontWeight: '700',
  },
  smallSecondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallSecondaryButtonText: {
    color: '#9a3412',
    fontSize: 12.71,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kpiLabel: {
    color: '#9a3412',
    fontSize: 12.71,
    fontWeight: '700',
  },
  kpiValue: {
    color: '#7c2d12',
    fontSize: 23.1,
    fontWeight: '900',
  },
  kpiCardFull: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kpiValueMoney: {
    color: '#7c2d12',
    fontSize: 20.79,
    fontWeight: '900',
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    color: '#7c2d12',
    fontSize: 16.17,
    fontWeight: '800',
  },
  trocaBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trocaBadgeText: {
    color: '#6d28d9',
    fontSize: 12.71,
    fontWeight: '700',
  },
});
