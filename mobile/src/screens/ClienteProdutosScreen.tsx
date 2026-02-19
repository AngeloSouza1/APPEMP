import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import {
  ClienteProduto,
  ClienteResumo,
  clienteProdutosApi,
  clientesApi,
  ProdutoResumo,
  produtosApi,
} from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarMoeda } from '../utils/format';

const parseDecimal = (value: string) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizarValorInput = (value: string) => {
  const cleaned = String(value).replace(/[^\d.,]/g, '');
  const normalized = cleaned.replace(/\./g, ',');
  const firstComma = normalized.indexOf(',');
  if (firstComma === -1) return normalized;
  const intPart = normalized.slice(0, firstComma);
  const decimalPart = normalized.slice(firstComma + 1).replace(/,/g, '').slice(0, 2);
  return `${intPart},${decimalPart}`;
};

export default function ClienteProdutosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [relacoes, setRelacoes] = useState<ClienteProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<number | null>(null);

  const [mostrarClientesFiltro, setMostrarClientesFiltro] = useState(false);
  const [buscaClienteFiltro, setBuscaClienteFiltro] = useState('');

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [valorUnitario, setValorUnitario] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const [mostrarClientesNovo, setMostrarClientesNovo] = useState(false);
  const [buscaClienteNovo, setBuscaClienteNovo] = useState('');
  const [mostrarProdutosNovo, setMostrarProdutosNovo] = useState(false);
  const [buscaProdutoNovo, setBuscaProdutoNovo] = useState('');

  const [relacaoEditando, setRelacaoEditando] = useState<ClienteProduto | null>(null);
  const [editValorUnitario, setEditValorUnitario] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const canManageCadastros = user?.perfil === 'admin' || user?.perfil === 'backoffice';

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20;
  const contentTopOffset = topSafeOffset + (canManageCadastros ? 138 : 98);

  const carregarDados = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [clientesResp, produtosResp, relacoesResp] = await Promise.all([
        clientesApi.listar(),
        produtosApi.listar(),
        clienteProdutosApi.listar(),
      ]);
      setClientes(clientesResp.data);
      setProdutos(produtosResp.data);
      setRelacoes(relacoesResp.data);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar os vínculos de preço por cliente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarDados(true);
    }, [carregarDados])
  );

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const clientesFiltradosBusca = useMemo(() => {
    const termo = buscaClienteFiltro.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 30);
    return clientes.filter((cliente) => `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaClienteFiltro, clientes]);

  const clientesFiltradosNovo = useMemo(() => {
    const termo = buscaClienteNovo.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 30);
    return clientes.filter((cliente) => `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaClienteNovo, clientes]);

  const produtosFiltradosNovo = useMemo(() => {
    const termo = buscaProdutoNovo.trim().toLowerCase();
    if (!termo) return produtos.slice(0, 30);
    return produtos
      .filter((produto) => `${produto.codigo_produto} ${produto.nome}`.toLowerCase().includes(termo))
      .slice(0, 30);
  }, [buscaProdutoNovo, produtos]);

  const clienteFiltroSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === filtroCliente) || null,
    [clientes, filtroCliente]
  );

  const clienteNovoSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId) || null,
    [clientes, clienteId]
  );

  const produtoNovoSelecionado = useMemo(
    () => produtos.find((produto) => produto.id === produtoId) || null,
    [produtos, produtoId]
  );

  const relacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return relacoes.filter((relacao) => {
      const matchCliente = !filtroCliente || relacao.cliente_id === filtroCliente;
      const matchBusca =
        !termo
        || `${relacao.codigo_cliente || ''} ${relacao.cliente_nome || ''} ${relacao.codigo_produto || ''} ${relacao.produto_nome || ''}`
          .toLowerCase()
          .includes(termo);
      return matchCliente && matchBusca;
    });
  }, [busca, filtroCliente, relacoes]);

  const relacoesAgrupadasPorCliente = useMemo(() => {
    const mapa = new Map<
      number,
      {
        cliente_id: number;
        cliente_nome: string;
        codigo_cliente: string;
        itens: ClienteProduto[];
      }
    >();

    relacoesFiltradas.forEach((relacao) => {
      const key = Number(relacao.cliente_id);
      if (!mapa.has(key)) {
        mapa.set(key, {
          cliente_id: key,
          cliente_nome: relacao.cliente_nome || 'Cliente',
          codigo_cliente: relacao.codigo_cliente || '',
          itens: [],
        });
      }
      mapa.get(key)!.itens.push(relacao);
    });

    return [...mapa.values()]
      .map((grupo) => ({
        ...grupo,
        itens: [...grupo.itens].sort((a, b) =>
          (a.produto_nome || '').localeCompare(b.produto_nome || '')
        ),
      }))
      .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome));
  }, [relacoesFiltradas]);

  const podeCriarVinculo = useMemo(() => {
    const valor = parseDecimal(valorUnitario);
    return Boolean(clienteId) && Boolean(produtoId) && Number.isFinite(valor) && valor > 0;
  }, [clienteId, produtoId, valorUnitario]);

  const abrirNovoModal = () => {
    setModalNovoAberto(true);
    setMostrarClientesNovo(false);
    setMostrarProdutosNovo(false);
    setBuscaClienteNovo('');
    setBuscaProdutoNovo('');
  };

  const fecharNovoModal = () => {
    setModalNovoAberto(false);
    setMostrarClientesNovo(false);
    setMostrarProdutosNovo(false);
    setBuscaClienteNovo('');
    setBuscaProdutoNovo('');
  };

  const criarRelacao = async () => {
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para cadastrar vínculos.');
      return;
    }
    const valorParse = parseDecimal(valorUnitario);
    const valor = Number.isFinite(valorParse) ? Number(valorParse.toFixed(2)) : NaN;
    if (!clienteId || !produtoId || !Number.isFinite(valor) || valor <= 0) {
      Alert.alert('Dados obrigatórios', 'Selecione cliente, produto e valor unitário positivo.');
      return;
    }

    setSalvandoNovo(true);
    try {
      await clienteProdutosApi.criar({
        cliente_id: clienteId,
        produto_id: produtoId,
        valor_unitario: valor,
      });
      setClienteId(null);
      setProdutoId(null);
      setValorUnitario('');
      fecharNovoModal();
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível criar o vínculo.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  const abrirEdicao = (relacao: ClienteProduto) => {
    setRelacaoEditando(relacao);
    if (relacao.valor_unitario === null || relacao.valor_unitario === undefined) {
      setEditValorUnitario('');
    } else {
      setEditValorUnitario(Number(relacao.valor_unitario).toFixed(2).replace('.', ','));
    }
    setConfirmandoExclusao(false);
  };

  const salvarEdicao = async () => {
    if (!relacaoEditando) return;
    const valorParse = parseDecimal(editValorUnitario);
    const valor = Number.isFinite(valorParse) ? Number(valorParse.toFixed(2)) : NaN;
    if (!Number.isFinite(valor) || valor < 0) {
      Alert.alert('Valor inválido', 'Informe um valor unitário válido.');
      return;
    }

    setProcessandoAcao(true);
    try {
      await clienteProdutosApi.atualizar(relacaoEditando.id, { valor_unitario: valor });
      setRelacaoEditando(null);
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível atualizar o vínculo.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const excluirRelacao = async () => {
    if (!relacaoEditando) return;
    setProcessandoAcao(true);
    try {
      await clienteProdutosApi.excluir(relacaoEditando.id);
      setRelacaoEditando(null);
      setConfirmandoExclusao(false);
      await carregarDados();
      Alert.alert('Sucesso', 'Vínculo removido com sucesso.');
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível excluir o vínculo.');
    } finally {
      setProcessandoAcao(false);
    }
  };

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
                source={require('../../assets/modulos/precos-cliente.png')}
                style={styles.headerTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Preços por Cliente</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>

        {canManageCadastros ? (
          <Pressable
            style={({ pressed }) => [styles.headerAddButtonStandalone, pressed && styles.headerAddButtonPressed]}
            onPress={abrirNovoModal}
          >
            <Text style={styles.headerAddIcon}>+</Text>
            <Text style={styles.headerAddButtonText}>Novo Vínculo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.content, { paddingTop: contentTopOffset }]}> 
        <View style={styles.filtersCard}>
          <TextInput
            placeholder="Buscar cliente/produto"
            placeholderTextColor="#64748b"
            value={busca}
            onChangeText={setBusca}
            style={styles.input}
          />

          <Pressable
            style={({ pressed }) => [
              styles.selectorTrigger,
              clienteFiltroSelecionado && styles.selectorTriggerSelected,
              pressed && styles.selectorTriggerPressed,
            ]}
            onPress={() => setMostrarClientesFiltro(true)}
          >
            <View style={styles.selectorInfo}>
              <Text style={styles.selectorTitle}>
                {clienteFiltroSelecionado ? clienteFiltroSelecionado.nome : 'Todos os clientes'}
              </Text>
              <Text style={styles.selectorSubtitle}>
                {clienteFiltroSelecionado ? `#${clienteFiltroSelecionado.codigo_cliente}` : 'Toque para filtrar por cliente'}
              </Text>
            </View>
            <Text style={styles.selectorChevron}>▾</Text>
          </Pressable>
          {clienteFiltroSelecionado ? (
            <View style={styles.filterSelectedRow}>
              <Text style={styles.filterSelectedText}>Filtro ativo: {clienteFiltroSelecionado.nome}</Text>
              <Pressable
                style={({ pressed }) => [styles.filterClearLink, pressed && styles.cardActionLinkPressed]}
                onPress={() => setFiltroCliente(null)}
              >
                <Text style={styles.filterClearLinkText}>Limpar</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.filtersFooterRow}>
            <Text style={styles.totalText}>{relacoesFiltradas.length} vínculo(s)</Text>
          </View>
        </View>

        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
              onPress={() => carregarDados()}
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={relacoesAgrupadasPorCliente}
            keyExtractor={(item) => String(item.cliente_id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum vínculo encontrado.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleGroup}>
                    <Text style={styles.cardSectionLabel}>Cliente</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.cliente_nome || 'Cliente'}
                    </Text>
                  </View>
                  <Text style={styles.cardGroupCount}>{item.itens.length} vínculo(s)</Text>
                </View>

                <View style={styles.groupItemsWrap}>
                  {item.itens.map((relacao, idx) => (
                    <View
                      key={relacao.id}
                      style={[
                        styles.groupItemRow,
                        idx < item.itens.length - 1 && styles.groupItemRowBorder,
                      ]}
                    >
                      <View style={styles.groupItemMain}>
                        <Text style={styles.cardSectionLabel}>Produto</Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                          {relacao.produto_nome || 'Produto'}
                        </Text>
                      </View>
                      <View style={styles.groupItemRight}>
                        <Text style={styles.valueLabel}>Valor unitário</Text>
                        <Text style={styles.valueText}>{formatarMoeda(relacao.valor_unitario || 0)}</Text>
                        {canManageCadastros ? (
                          <View style={styles.groupActionsRow}>
                            <Pressable
                              style={({ pressed }) => [styles.cardActionLink, pressed && styles.cardActionLinkPressed]}
                              onPress={() => abrirEdicao(relacao)}
                            >
                              <Text style={styles.cardActionEditText}>Editar</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.cardActionLink, pressed && styles.cardActionLinkPressed]}
                              onPress={() => {
                                setRelacaoEditando(relacao);
                                setConfirmandoExclusao(true);
                              }}
                            >
                              <Text style={styles.cardActionDeleteText}>Excluir</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal
        visible={mostrarClientesFiltro}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarClientesFiltro(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMostrarClientesFiltro(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filtrar cliente</Text>
                <Text style={styles.modalSubtitle}>Selecione um cliente para filtrar os vínculos.</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                onPress={() => setMostrarClientesFiltro(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              value={buscaClienteFiltro}
              onChangeText={setBuscaClienteFiltro}
              placeholder="Buscar cliente"
              placeholderTextColor="#64748b"
            />

            <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
              <View style={styles.selectorListWrap}>
                <Pressable
                  style={({ pressed }) => [
                    styles.selectorRow,
                    filtroCliente === null && styles.selectorRowSelected,
                    pressed && styles.selectorRowPressed,
                  ]}
                  onPress={() => {
                    setFiltroCliente(null);
                    setMostrarClientesFiltro(false);
                    setBuscaClienteFiltro('');
                  }}
                >
                  <Text style={[styles.selectorRowTitle, filtroCliente === null && styles.selectorRowTitleSelected]}>
                    Todos os clientes
                  </Text>
                </Pressable>
                {clientesFiltradosBusca.map((cliente) => (
                  <Pressable
                    key={cliente.id}
                    style={({ pressed }) => [
                      styles.selectorRow,
                      filtroCliente === cliente.id && styles.selectorRowSelected,
                      pressed && styles.selectorRowPressed,
                    ]}
                    onPress={() => {
                      setFiltroCliente(cliente.id);
                      setMostrarClientesFiltro(false);
                      setBuscaClienteFiltro('');
                    }}
                  >
                    <Text style={[styles.selectorRowTitle, filtroCliente === cliente.id && styles.selectorRowTitleSelected]}>
                      {cliente.nome}
                    </Text>
                    <Text style={styles.selectorRowSubtitle}>#{cliente.codigo_cliente}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalNovoAberto} transparent animationType="fade" onRequestClose={fecharNovoModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={fecharNovoModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Novo Vínculo</Text>
                <Text style={styles.modalSubtitle}>Selecione cliente, produto e valor unitário.</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                onPress={fecharNovoModal}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.formBody}>
              <Text style={styles.formLabel}>Cliente</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.selectorTrigger,
                  clienteNovoSelecionado && styles.selectorTriggerSelected,
                  pressed && styles.selectorTriggerPressed,
                ]}
                onPress={() => {
                  setMostrarClientesNovo((prev) => !prev);
                  setMostrarProdutosNovo(false);
                }}
              >
                <View style={styles.selectorInfo}>
                  <Text style={styles.selectorTitle}>{clienteNovoSelecionado ? clienteNovoSelecionado.nome : 'Selecionar cliente'}</Text>
                  <Text style={styles.selectorSubtitle}>
                    {clienteNovoSelecionado ? `#${clienteNovoSelecionado.codigo_cliente}` : 'Toque para buscar'}
                  </Text>
                </View>
                <Text style={styles.selectorChevron}>{mostrarClientesNovo ? '▴' : '▾'}</Text>
              </Pressable>

              {mostrarClientesNovo ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={buscaClienteNovo}
                    onChangeText={setBuscaClienteNovo}
                    placeholder="Buscar cliente"
                    placeholderTextColor="#64748b"
                  />
                  <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
                    <View style={styles.selectorListWrap}>
                      {clientesFiltradosNovo.map((cliente) => (
                        <Pressable
                          key={cliente.id}
                          style={({ pressed }) => [
                            styles.selectorRow,
                            clienteId === cliente.id && styles.selectorRowSelected,
                            pressed && styles.selectorRowPressed,
                          ]}
                          onPress={() => {
                            setClienteId(cliente.id);
                            setMostrarClientesNovo(false);
                            setBuscaClienteNovo('');
                          }}
                        >
                          <Text style={[styles.selectorRowTitle, clienteId === cliente.id && styles.selectorRowTitleSelected]}>
                            {cliente.nome}
                          </Text>
                          <Text style={styles.selectorRowSubtitle}>#{cliente.codigo_cliente}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : null}

              <Text style={styles.formLabel}>Produto</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.selectorTrigger,
                  produtoNovoSelecionado && styles.selectorTriggerSelected,
                  pressed && styles.selectorTriggerPressed,
                ]}
                onPress={() => {
                  setMostrarProdutosNovo((prev) => !prev);
                  setMostrarClientesNovo(false);
                }}
              >
                <View style={styles.selectorInfo}>
                  <Text style={styles.selectorTitle}>{produtoNovoSelecionado ? produtoNovoSelecionado.nome : 'Selecionar produto'}</Text>
                  <Text style={styles.selectorSubtitle}>
                    {produtoNovoSelecionado ? `#${produtoNovoSelecionado.codigo_produto}` : 'Toque para buscar'}
                  </Text>
                </View>
                <Text style={styles.selectorChevron}>{mostrarProdutosNovo ? '▴' : '▾'}</Text>
              </Pressable>

              {mostrarProdutosNovo ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={buscaProdutoNovo}
                    onChangeText={setBuscaProdutoNovo}
                    placeholder="Buscar produto"
                    placeholderTextColor="#64748b"
                  />
                  <ScrollView style={styles.selectorListScroll} nestedScrollEnabled>
                    <View style={styles.selectorListWrap}>
                      {produtosFiltradosNovo.map((produto) => (
                        <Pressable
                          key={produto.id}
                          style={({ pressed }) => [
                            styles.selectorRow,
                            produtoId === produto.id && styles.selectorRowSelected,
                            pressed && styles.selectorRowPressed,
                          ]}
                          onPress={() => {
                            setProdutoId(produto.id);
                            setMostrarProdutosNovo(false);
                            setBuscaProdutoNovo('');
                          }}
                        >
                          <Text style={[styles.selectorRowTitle, produtoId === produto.id && styles.selectorRowTitleSelected]}>
                            {produto.nome}
                          </Text>
                          <Text style={styles.selectorRowSubtitle}>#{produto.codigo_produto}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : null}

              <Text style={styles.formLabel}>Valor unitário</Text>
              <TextInput
                style={styles.input}
                value={valorUnitario}
                onChangeText={(value) => setValorUnitario(normalizarValorInput(value))}
                placeholder="0,00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={fecharNovoModal}
                disabled={salvandoNovo}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                onPress={criarRelacao}
                disabled={salvandoNovo || !podeCriarVinculo}
              >
                <Text style={styles.primaryButtonText}>{salvandoNovo ? 'Salvando...' : 'Criar vínculo'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(relacaoEditando)} transparent animationType="fade" onRequestClose={() => setRelacaoEditando(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setRelacaoEditando(null)} />
          {relacaoEditando ? (
            <View style={styles.modalCard}>
              {!confirmandoExclusao ? (
                <>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalTitle}>Editar valor</Text>
                      <Text style={styles.modalSubtitle}>{relacaoEditando.cliente_nome}</Text>
                      <Text style={styles.modalSubtitle}>{relacaoEditando.produto_nome}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                      onPress={() => setRelacaoEditando(null)}
                    >
                      <Text style={styles.closeButtonText}>×</Text>
                    </Pressable>
                  </View>

                  <View style={styles.formBody}>
                    <Text style={styles.formLabel}>Valor unitário</Text>
                    <TextInput
                      style={styles.input}
                      value={editValorUnitario}
                      onChangeText={(value) => setEditValorUnitario(normalizarValorInput(value))}
                      placeholder="0,00"
                      placeholderTextColor="#64748b"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.destructiveGhostButton,
                        styles.editActionButton,
                        pressed && styles.destructiveGhostButtonPressed,
                      ]}
                      onPress={() => setConfirmandoExclusao(true)}
                      disabled={processandoAcao}
                    >
                      <Text style={styles.destructiveGhostButtonText}>Excluir vínculo</Text>
                    </Pressable>
                  </View>

                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.editActionButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={() => setRelacaoEditando(null)}
                      disabled={processandoAcao}
                    >
                      <Text style={styles.secondaryButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryButton,
                        styles.editActionButton,
                        pressed && styles.primaryButtonPressed,
                      ]}
                      onPress={salvarEdicao}
                      disabled={processandoAcao}
                    >
                      <Text style={styles.primaryButtonText}>{processandoAcao ? 'Salvando...' : 'Salvar'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>Excluir vínculo</Text>
                    <Text style={styles.confirmText}>Remover este vínculo cliente/produto?</Text>
                  </View>
                  <View style={styles.modalActions}>
                    <Pressable
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                      onPress={() => setConfirmandoExclusao(false)}
                      disabled={processandoAcao}
                    >
                      <Text style={styles.secondaryButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.dangerButton, pressed && styles.primaryButtonPressed]}
                      onPress={excluirRelacao}
                      disabled={processandoAcao}
                    >
                      <Text style={styles.primaryButtonText}>{processandoAcao ? 'Excluindo...' : 'Excluir'}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : null}
        </View>
      </Modal>
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
    fontSize: 16.17,
    lineHeight: 14,
  },
  headerAddButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15.02,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  filtersCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  filtersFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
  selectorTrigger: {
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
  selectorTriggerSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  selectorTriggerPressed: {
    opacity: 0.84,
  },
  selectorInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectorTitle: {
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '700',
  },
  selectorSubtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '500',
  },
  selectorChevron: {
    color: '#1d4ed8',
    fontSize: 18.48,
    fontWeight: '800',
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
    fontSize: 15.02,
    fontWeight: '700',
  },
  selectorRowTitleSelected: {
    color: '#1d4ed8',
  },
  selectorRowSubtitle: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '500',
  },
  formLabel: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13.86,
  },
  totalText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13.86,
    textAlign: 'right',
  },
  filterSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  filterSelectedText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 12.71,
    fontWeight: '700',
  },
  filterClearLink: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  filterClearLinkText: {
    color: '#dc2626',
    fontSize: 13.86,
    fontWeight: '700',
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
  errorText: {
    color: '#b91c1c',
    fontSize: 13.86,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryButtonPressed: {
    opacity: 0.84,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13.86,
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
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  cardTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  cardSectionLabel: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16.17,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardGroupCount: {
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '700',
  },
  groupItemsWrap: {
    marginTop: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
  },
  groupItemRow: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
  },
  groupItemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  groupItemMain: {
    flex: 1,
    minWidth: 0,
  },
  groupItemRight: {
    width: 132,
    alignItems: 'flex-end',
  },
  groupActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  cardProductWrap: {
    marginTop: 8,
  },
  cardSubtitle: {
    color: '#334155',
    fontSize: 15.02,
    fontWeight: '700',
  },
  valueBox: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  valueLabel: {
    color: '#475569',
    fontSize: 11.55,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueText: {
    marginTop: 1,
    color: '#0f172a',
    fontSize: 17.33,
    fontWeight: '800',
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
    fontSize: 13.86,
  },
  cardActionDeleteText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13.86,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18.48,
  },
  modalSubtitle: {
    marginTop: 2,
    color: '#334155',
    fontSize: 15.02,
    fontWeight: '600',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.82,
  },
  closeButtonText: {
    color: '#1d4ed8',
    fontSize: 25.41,
    lineHeight: 22,
    fontWeight: '700',
  },
  formBody: {
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editActionButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dangerButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b91c1c',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13.86,
    fontWeight: '700',
  },
  destructiveGhostButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  destructiveGhostButtonPressed: {
    opacity: 0.82,
  },
  destructiveGhostButtonText: {
    color: '#b91c1c',
    fontSize: 13.86,
    fontWeight: '700',
  },
  confirmBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 10,
    gap: 6,
  },
  confirmTitle: {
    color: '#7f1d1d',
    fontWeight: '800',
    fontSize: 16.17,
  },
  confirmText: {
    color: '#991b1b',
    fontSize: 13.86,
    fontWeight: '600',
  },
});
