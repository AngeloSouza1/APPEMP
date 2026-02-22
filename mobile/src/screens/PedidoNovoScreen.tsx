import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerModal from '../components/DatePickerModal';
import {
  clienteProdutosApi,
  arquivosApi,
  ClienteResumo,
  clientesApi,
  pedidosApi,
  ProdutoResumo,
  produtosApi,
  RotaResumo,
  rotasApi,
} from '../api/services';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarMoeda } from '../utils/format';
import { marcarRelatoriosComoDesatualizados } from '../utils/relatoriosRefresh';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidoNovo'>;

type NovoItem = {
  key: string;
  produto_id: number;
  produto_nome: string;
  codigo_produto: string;
  quantidade: string;
  valor_unitario: string;
  embalagem: string;
};

const normalizeDateForApi = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

const parseDecimal = (value: string) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const formatarDataAtual = () => {
  const agora = new Date();
  const dd = String(agora.getDate()).padStart(2, '0');
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const yyyy = agora.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function PedidoNovoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [rotaId, setRotaId] = useState<number | null>(null);
  const [data, setData] = useState(formatarDataAtual());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [usaNf, setUsaNf] = useState(false);
  const [nfImagemUrl, setNfImagemUrl] = useState('');
  const [enviandoNf, setEnviandoNf] = useState(false);
  const [precoPersonalizadoPorProduto, setPrecoPersonalizadoPorProduto] = useState<Record<number, number>>({});

  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');

  const [itens, setItens] = useState<NovoItem[]>([]);
  const [mostrarSeletorProdutos, setMostrarSeletorProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<number | null>(null);
  const [itemExpandidoKey, setItemExpandidoKey] = useState<string | null>(null);
  const [quantidadeNovoItem, setQuantidadeNovoItem] = useState('1');
  const [valorNovoItem, setValorNovoItem] = useState('');
  const [embalagemNovoItem, setEmbalagemNovoItem] = useState('');

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [carregandoTransicao, setCarregandoTransicao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const navegarComLoading = (acao: () => void) => {
    if (carregandoTransicao) return;
    setCarregandoTransicao(true);
    setTimeout(() => {
      acao();
      setCarregandoTransicao(false);
    }, 520);
  };

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [clientesResp, rotasResp, produtosResp] = await Promise.all([
          clientesApi.listar(),
          rotasApi.listar(),
          produtosApi.listar(),
        ]);
        setClientes(clientesResp.data);
        setRotas(rotasResp.data);
        setProdutos(produtosResp.data);
        setErro(null);
      } catch {
        setErro('Não foi possível carregar os dados para novo pedido.');
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, []);

  useEffect(() => {
    const carregarPrecosCliente = async () => {
      if (!clienteId) {
        setPrecoPersonalizadoPorProduto({});
        return;
      }
      try {
        const resp = await clienteProdutosApi.listarPorCliente(clienteId);
        const mapa = resp.data.reduce<Record<number, number>>((acc, item) => {
          const valor = Number(item.valor_unitario);
          if (Number.isFinite(valor)) acc[item.produto_id] = valor;
          return acc;
        }, {});
        setPrecoPersonalizadoPorProduto(mapa);
      } catch {
        setPrecoPersonalizadoPorProduto({});
      }
    };

    carregarPrecosCliente();
  }, [clienteId]);

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 30);
    return clientes
      .filter((cliente) => `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo))
      .sort((a, b) => {
        const chaveA = `${a.codigo_cliente} ${a.nome}`.toLowerCase();
        const chaveB = `${b.codigo_cliente} ${b.nome}`.toLowerCase();
        const aStarts = chaveA.startsWith(termo) ? 0 : 1;
        const bStarts = chaveB.startsWith(termo) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 30);
  }, [buscaCliente, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId) || null,
    [clienteId, clientes]
  );
  const dataValida = useMemo(() => Boolean(normalizeDateForApi(data)), [data]);
  const podeSelecionarData = Boolean(clienteSelecionado);
  const podeGerenciarItens = podeSelecionarData && dataValida;

  const rotaAtualLabel = useMemo(() => {
    if (rotaId === null) return 'Sem rota';
    return rotas.find((rota) => rota.id === rotaId)?.nome || 'Rota selecionada';
  }, [rotaId, rotas]);

  const quantidadeNoPedidoPorProduto = useMemo(() => {
    return itens.reduce<Record<number, number>>((acc, item) => {
      const qtd = parseDecimal(item.quantidade);
      acc[item.produto_id] = (acc[item.produto_id] || 0) + (Number.isFinite(qtd) ? qtd : 0);
      return acc;
    }, {});
  }, [itens]);

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    const idsNoPedido = new Set(itens.map((item) => item.produto_id));
    const base = (!termo
      ? produtos
      : produtos
      .filter((produto) => {
        const codigo = (produto.codigo_produto || '').toLowerCase();
        const nome = (produto.nome || '').toLowerCase();
        return codigo.includes(termo) || nome.includes(termo);
      }))
      .slice(0, 20);

    const jaNoPedido = produtos.filter((produto) => idsNoPedido.has(produto.id));
    return [...jaNoPedido, ...base]
      .filter((produto, index, arr) => arr.findIndex((p) => p.id === produto.id) === index)
      .slice(0, 20);
  }, [buscaProduto, itens, produtos]);

  const totalItens = useMemo(() => {
    return itens.reduce((acc, item) => {
      const qtd = parseDecimal(item.quantidade);
      const unit = parseDecimal(item.valor_unitario);
      if (!Number.isFinite(qtd) || !Number.isFinite(unit)) return acc;
      return acc + qtd * unit;
    }, 0);
  }, [itens]);
  const usarScrollItens = itens.length > 3;
  const podeCriarPedido = Boolean(clienteId) && dataValida && itens.length > 0;

  const selecionarCliente = (cliente: ClienteResumo) => {
    setClienteId(cliente.id);
    setMostrarClientes(false);
    setBuscaCliente('');
    setRotaId(cliente.rota_id ?? null);
  };

  const abrirSeletorData = () => {
    if (!podeSelecionarData) {
      Alert.alert('Selecione o cliente', 'Primeiro escolha um cliente para liberar a data.');
      return;
    }
    setShowDatePicker(true);
  };

  const selecionarProduto = (produto: ProdutoResumo) => {
    setProdutoSelecionadoId(produto.id);
    setQuantidadeNovoItem('1');
    const precoPersonalizado = precoPersonalizadoPorProduto[produto.id];
    if (Number.isFinite(precoPersonalizado)) {
      setValorNovoItem(String(precoPersonalizado));
    } else {
      setValorNovoItem(produto.preco_base !== null && produto.preco_base !== undefined ? String(produto.preco_base) : '');
    }
    setEmbalagemNovoItem(String(produto.embalagem || ''));
    setMostrarSeletorProdutos(false);
  };

  const adicionarProdutoSelecionado = () => {
    if (!produtoSelecionadoId) return;
    const produto = produtos.find((p) => p.id === produtoSelecionadoId);
    if (!produto) return;

    const quantidade = parseDecimal(quantidadeNovoItem);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade válida para inserir o item.');
      return;
    }

    const valorUnitario = parseDecimal(valorNovoItem);
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
      Alert.alert('Valor inválido', 'Informe um valor unitário válido para inserir o item.');
      return;
    }

    setItens((prev) => {
      const existente = prev.find((item) => item.produto_id === produto.id);
      if (existente) {
        return prev.map((item) => {
          if (item.produto_id !== produto.id) return item;
          const qtdAtual = parseDecimal(item.quantidade);
          const novaQtd = Number.isFinite(qtdAtual) ? qtdAtual + quantidade : quantidade;
          return { ...item, quantidade: String(novaQtd) };
        });
      }

      const key = `${produto.id}-${Date.now()}`;
      return [
        ...prev,
        {
          key,
          produto_id: produto.id,
          produto_nome: produto.nome,
          codigo_produto: produto.codigo_produto,
          quantidade: String(quantidade),
          valor_unitario: String(valorUnitario),
          embalagem: embalagemNovoItem.trim(),
        },
      ];
    });
    setItemExpandidoKey(null);

    setProdutoSelecionadoId(null);
    setQuantidadeNovoItem('1');
    setValorNovoItem('');
    setEmbalagemNovoItem('');
    setBuscaProduto('');
  };

  const atualizarItem = (key: string, field: keyof NovoItem, value: string) => {
    setItens((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const removerItem = (key: string) => {
    setItens((prev) => prev.filter((item) => item.key !== key));
    setItemExpandidoKey((atual) => (atual === key ? null : atual));
  };

  const selecionarImagemNf = () => {
    Alert.alert('Imagem da NF', 'Escolha a origem da imagem.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Galeria',
        onPress: async () => {
          const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permissao.granted) {
            Alert.alert('Permissão negada', 'Permita acesso à galeria para selecionar a imagem da NF.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          });
          if (result.canceled || !result.assets?.length) return;
          try {
            setEnviandoNf(true);
            const url = await arquivosApi.uploadImagemCloudinary(result.assets[0] as any);
            setNfImagemUrl(url);
          } catch (error: any) {
            Alert.alert('Erro', error?.message || 'Não foi possível enviar a imagem da NF.');
          } finally {
            setEnviandoNf(false);
          }
        },
      },
      {
        text: 'Câmera',
        onPress: async () => {
          const permissao = await ImagePicker.requestCameraPermissionsAsync();
          if (!permissao.granted) {
            Alert.alert('Permissão negada', 'Permita acesso à câmera para capturar a imagem da NF.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          });
          if (result.canceled || !result.assets?.length) return;
          try {
            setEnviandoNf(true);
            const url = await arquivosApi.uploadImagemCloudinary(result.assets[0] as any);
            setNfImagemUrl(url);
          } catch (error: any) {
            Alert.alert('Erro', error?.message || 'Não foi possível enviar a imagem da NF.');
          } finally {
            setEnviandoNf(false);
          }
        },
      },
    ]);
  };

  const salvarPedido = async () => {
    if (!clienteId) {
      Alert.alert('Cliente obrigatório', 'Selecione um cliente para criar o pedido.');
      return;
    }

    const dataNormalizada = normalizeDateForApi(data);
    if (!dataNormalizada) {
      Alert.alert('Data inválida', 'Use DD/MM/AAAA ou AAAA-MM-DD.');
      return;
    }

    if (itens.length === 0) {
      Alert.alert('Itens obrigatórios', 'Adicione ao menos um item no pedido.');
      return;
    }

    const nfImagemNormalizada = nfImagemUrl.trim();
    if (usaNf && !nfImagemNormalizada) {
      Alert.alert('Imagem da NF', 'Informe a imagem da NF para continuar.');
      return;
    }

    const itensPayload = [] as {
      produto_id: number;
      quantidade: number;
      embalagem?: string;
      valor_unitario: number;
    }[];

    for (const item of itens) {
      const quantidade = parseDecimal(item.quantidade);
      const valorUnitario = parseDecimal(item.valor_unitario);

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        Alert.alert('Item inválido', `Quantidade inválida para ${item.produto_nome}.`);
        return;
      }

      if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
        Alert.alert('Item inválido', `Valor unitário inválido para ${item.produto_nome}.`);
        return;
      }

      itensPayload.push({
        produto_id: item.produto_id,
        quantidade,
        valor_unitario: valorUnitario,
        embalagem: item.embalagem.trim() || undefined,
      });
    }

    setSalvando(true);
    try {
      await pedidosApi.criar({
        cliente_id: clienteId,
        rota_id: rotaId,
        data: dataNormalizada,
        status: 'EM_ESPERA',
        usa_nf: usaNf,
        nf_imagem_url: usaNf ? nfImagemNormalizada : null,
        itens: itensPayload,
      });
      await marcarRelatoriosComoDesatualizados();
      Alert.alert('Sucesso', 'Pedido criado com sucesso.');
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o pedido.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator />
        <Text style={styles.centeredText}>Carregando formulário...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorText}>{erro}</Text>
        <View style={styles.errorActions}>
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

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topSafeOffset, paddingBottom: 108 + Math.max(insets.bottom, 8) },
        ]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Novo Pedido</Text>
            <Text style={styles.headerSubtitle}>Preencha os dados para criar</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Cliente</Text>
          <Pressable
            style={({ pressed }) => [
              styles.clientSelectorTrigger,
              clienteSelecionado && styles.clientSelectorTriggerSelected,
              pressed && styles.selectorTriggerPressed,
            ]}
            onPress={() => setMostrarClientes((prev) => !prev)}
          >
            <View style={styles.clientSelectorInfo}>
              <Text style={styles.clientSelectorTitle}>
                {clienteSelecionado ? clienteSelecionado.nome : 'Selecionar cliente'}
              </Text>
              <Text style={styles.clientSelectorSubtitle}>
                {clienteSelecionado ? `#${clienteSelecionado.codigo_cliente}` : 'Toque para buscar por nome ou código'}
              </Text>
            </View>
            <Text style={styles.addItemToggleIcon}>{mostrarClientes ? '▴' : '▾'}</Text>
          </Pressable>

          {mostrarClientes ? (
            <>
              <TextInput
                value={buscaCliente}
                onChangeText={setBuscaCliente}
                style={styles.input}
                placeholder="Buscar cliente"
                placeholderTextColor="#64748b"
              />
              <Text style={styles.listMetaText}>{clientesFiltrados.length} cliente(s) encontrado(s)</Text>
              <ScrollView style={styles.clientListScroll} nestedScrollEnabled>
                <View style={styles.productListWrap}>
                  {clientesFiltrados.map((cliente) => (
                    <Pressable
                      key={cliente.id}
                      style={({ pressed }) => [styles.clientRow, pressed && styles.productRowPressed]}
                      onPress={() => selecionarCliente(cliente)}
                    >
                      <View style={styles.clientAvatar}>
                        <Text style={styles.clientAvatarText}>
                          {(cliente.nome || 'C').trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{cliente.nome}</Text>
                        <Text style={styles.clientCode}>#{cliente.codigo_cliente}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {clientesFiltrados.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
                  ) : null}
                </View>
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Data</Text>
          <Pressable
            style={({ pressed }) => [
              styles.dateTrigger,
              !podeSelecionarData && styles.disabledField,
              pressed && styles.selectorTriggerPressed,
            ]}
            onPress={abrirSeletorData}
          >
            <Text style={[styles.dateFieldText, !data && styles.placeholderText]}>
              {data || 'Selecionar data'}
            </Text>
            <Text style={styles.dateFieldIcon}>▾</Text>
          </Pressable>
          <Text style={styles.dateFieldHint}>
            {podeSelecionarData ? 'Toque para selecionar no calendário' : 'Selecione o cliente para liberar a data'}
          </Text>

          {clienteId ? (
            <View style={styles.routeInfoCard}>
              <Text style={styles.routeInfoLabel}>Rota vinculada ao cliente</Text>
              <Text style={styles.routeDisplayText}>{rotaAtualLabel}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.nfToggleRow, pressed && styles.selectorTriggerPressed]}
            onPress={() =>
              setUsaNf((prev) => {
                const proximo = !prev;
                if (!proximo) setNfImagemUrl('');
                return proximo;
              })
            }
          >
            <View style={[styles.nfCheckbox, usaNf && styles.nfCheckboxChecked]}>
              {usaNf ? <Text style={styles.nfCheckboxIcon}>✓</Text> : null}
            </View>
            <Text style={styles.nfToggleText}>Usa NF</Text>
          </Pressable>

          {usaNf ? (
            <>
              <Text style={styles.fieldLabel}>Imagem da NF</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.nfUploadButton,
                  pressed && styles.selectorTriggerPressed,
                  enviandoNf && styles.saveButtonDisabled,
                ]}
                onPress={selecionarImagemNf}
                disabled={enviandoNf}
              >
                <Text style={styles.nfUploadButtonText}>
                  {enviandoNf ? 'Enviando imagem...' : nfImagemUrl ? 'Trocar imagem da NF' : 'Selecionar imagem da NF'}
                </Text>
              </Pressable>
              {nfImagemUrl ? (
                <View style={styles.nfPreviewCard}>
                  <Image source={{ uri: nfImagemUrl }} style={styles.nfPreviewImage} resizeMode="cover" />
                  <Pressable style={styles.nfRemoveButton} onPress={() => setNfImagemUrl('')}>
                    <Text style={styles.nfRemoveButtonText}>Remover imagem</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={[styles.formCard, !podeGerenciarItens && styles.disabledSectionCard]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Itens do Pedido</Text>
            <Text style={styles.sectionValue}>{formatarMoeda(totalItens)}</Text>
          </View>
          {!podeGerenciarItens ? (
            <Text style={styles.emptyText}>Selecione cliente e data para liberar os itens.</Text>
          ) : null}

          <View pointerEvents={podeGerenciarItens ? 'auto' : 'none'}>
            {podeGerenciarItens ? (
              <>
                <Text style={styles.itemFieldLabel}>Produto</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.clientSelectorTrigger,
                    produtoSelecionadoId !== null && styles.clientSelectorTriggerSelected,
                    pressed && styles.selectorTriggerPressed,
                  ]}
                  onPress={() => setMostrarSeletorProdutos((prev) => !prev)}
                >
                  <View style={styles.clientSelectorInfo}>
                    <Text style={styles.clientSelectorTitle}>
                      {produtoSelecionadoId
                        ? produtos.find((p) => p.id === produtoSelecionadoId)?.nome || 'Produto selecionado'
                        : 'Selecionar produto'}
                    </Text>
                    <Text style={styles.clientSelectorSubtitle}>
                      {produtoSelecionadoId
                        ? `#${produtos.find((p) => p.id === produtoSelecionadoId)?.codigo_produto || ''}`
                        : 'Toque para buscar por nome ou código'}
                    </Text>
                  </View>
                  <Text style={styles.addItemToggleIcon}>{mostrarSeletorProdutos ? '▴' : '▾'}</Text>
                </Pressable>

                {mostrarSeletorProdutos ? (
                  <>
                    <TextInput
                      value={buscaProduto}
                      onChangeText={setBuscaProduto}
                      style={styles.input}
                      placeholder="Buscar produto"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.listMetaText}>{produtosFiltrados.length} produto(s) encontrado(s)</Text>
                    <ScrollView style={styles.clientListScroll} nestedScrollEnabled>
                      <View style={styles.productListWrap}>
                        {produtosFiltrados.map((produto) => (
                          <Pressable
                            key={produto.id}
                            style={({ pressed }) => [
                              styles.productSelectRow,
                              produtoSelecionadoId === produto.id && styles.productRowSelected,
                              pressed && styles.productRowPressed,
                            ]}
                            onPress={() => selecionarProduto(produto)}
                          >
                            <View style={styles.productSelectAvatar}>
                              <Text style={styles.productSelectAvatarText}>
                                {(produto.nome || 'P').trim().charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.productRowInfo}>
                              <Text style={styles.productName}>{produto.nome}</Text>
                              <Text style={styles.productMeta}>
                                #{produto.codigo_produto}{' '}
                                {produto.preco_base ? `• ${formatarMoeda(produto.preco_base)}` : ''}
                              </Text>
                              {quantidadeNoPedidoPorProduto[produto.id] ? (
                                <Text style={styles.productInOrderText}>
                                  No pedido: {quantidadeNoPedidoPorProduto[produto.id]}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        ))}
                        {produtosFiltrados.length === 0 ? (
                          <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
                        ) : null}
                      </View>
                    </ScrollView>
                  </>
                ) : null}

                {produtoSelecionadoId ? (
                  <View style={styles.selectedComposer}>
                    <Text style={styles.selectedComposerTitle}>Configurar item selecionado</Text>
                    <View style={styles.itemFieldsRow}>
                      <View style={styles.itemFieldSmall}>
                        <Text style={styles.itemFieldLabel}>Qtd</Text>
                        <TextInput
                          value={quantidadeNovoItem}
                          onChangeText={setQuantidadeNovoItem}
                          style={styles.input}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.itemFieldLarge}>
                        <Text style={styles.itemFieldLabel}>Valor unitário</Text>
                        <TextInput
                          value={valorNovoItem}
                          onChangeText={setValorNovoItem}
                          style={styles.input}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.itemFieldLarge}>
                      <Text style={styles.itemFieldLabel}>Embalagem</Text>
                      <TextInput
                        value={embalagemNovoItem}
                        onChangeText={setEmbalagemNovoItem}
                        style={styles.input}
                        placeholder="Opcional"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <View style={styles.composerActions}>
                      <Pressable
                        style={({ pressed }) => [styles.cancelMiniBtn, pressed && styles.cancelMiniBtnPressed]}
                        onPress={() => setProdutoSelecionadoId(null)}
                      >
                        <Text style={styles.cancelMiniBtnText}>Limpar</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.confirmMiniBtn, pressed && styles.confirmMiniBtnPressed]}
                        onPress={adicionarProdutoSelecionado}
                      >
                        <Text style={styles.confirmMiniBtnText}>Adicionar ao pedido</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            <Text style={styles.selectedItemsLabel}>Produtos selecionados</Text>
            {itens.length === 0 ? <Text style={styles.emptyText}>Nenhum item adicionado.</Text> : null}

            <ScrollView style={usarScrollItens ? styles.itemsListScroll : undefined} nestedScrollEnabled={usarScrollItens}>
              <View style={styles.itemsListWrap}>
                {itens.map((item) => {
                  const qtd = parseDecimal(item.quantidade);
                  const unit = parseDecimal(item.valor_unitario);
                  const totalItem = Number.isFinite(qtd) && Number.isFinite(unit) ? qtd * unit : 0;
                  return (
                    <View key={item.key} style={styles.itemCard}>
                    <Pressable
                      style={({ pressed }) => [styles.itemSummaryRow, pressed && styles.productRowPressed]}
                      onPress={() => setItemExpandidoKey((atual) => (atual === item.key ? null : item.key))}
                    >
                        <View style={styles.itemSummaryInfo}>
                          <Text style={styles.itemName}>{item.produto_nome}</Text>
                          <Text style={styles.itemMeta}>
                            #{item.codigo_produto || item.produto_id} • {item.quantidade} un • {formatarMoeda(Number.isFinite(unit) ? unit : 0)}
                          </Text>
                        </View>
                        <View style={styles.itemSummaryRight}>
                          <Text style={styles.itemTotalValue}>{formatarMoeda(totalItem)}</Text>
                        <Text style={styles.addItemToggleIcon}>{itemExpandidoKey === item.key ? '▴' : '▾'}</Text>
                      </View>
                    </Pressable>
                    <View style={styles.itemSummaryActions}>
                      <Pressable onPress={() => removerItem(item.key)} style={styles.removeItemInlineBtn}>
                        <Text style={styles.removeItemInlineText}>Excluir item</Text>
                      </Pressable>
                    </View>

                    {itemExpandidoKey === item.key ? (
                      <View style={styles.itemDetailsWrap}>
                          <View style={styles.itemDataRow}>
                            <Text style={styles.itemDataLabel}>Quantidade</Text>
                            <Text style={styles.itemDataValue}>{item.quantidade}</Text>
                          </View>
                          <View style={styles.itemDataRow}>
                            <Text style={styles.itemDataLabel}>Valor unitário</Text>
                            <Text style={styles.itemDataValue}>
                              {formatarMoeda(Number.isFinite(unit) ? unit : 0)}
                            </Text>
                          </View>
                          <View style={styles.itemDataRow}>
                            <Text style={styles.itemDataLabel}>Embalagem</Text>
                            <Text style={styles.itemDataValue}>{item.embalagem || 'Não informada'}</Text>
                          </View>
                          <View style={styles.itemDataRow}>
                            <Text style={styles.itemDataLabel}>Total</Text>
                            <Text style={styles.itemDataValueStrong}>{formatarMoeda(totalItem)}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!podeCriarPedido || salvando) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={salvarPedido}
            disabled={!podeCriarPedido || salvando}
          >
            <Text style={styles.saveButtonText}>{salvando ? 'Salvando...' : 'Criar Pedido'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={[styles.footerDock, { bottom: Math.max(insets.bottom, 8) }]}>
        <View style={[styles.footerCard, { paddingBottom: 8 + Math.max(insets.bottom, 4) }]}>
          <View style={styles.footerActionsRow}>
            {[
              {
                key: 'home',
                label: 'Visão Geral',
                imagem: require('../../assets/modulos/pagina-principal1.png'),
                onPress: () => navegarComLoading(() => navigation.navigate('Home')),
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
              const ativo = acao.key === 'pedidos';
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
      <DatePickerModal
        visible={showDatePicker}
        value={data}
        onChange={setData}
        onClose={() => setShowDatePicker(false)}
        title="Selecionar data do pedido"
      />
      <Modal transparent visible={carregandoTransicao} animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
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
  content: {
    paddingHorizontal: 12,
    paddingBottom: 108,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24.26,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
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
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    gap: 9,
  },
  disabledSectionCard: {
    opacity: 0.62,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
    marginTop: 2,
  },
  nfToggleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  nfCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfCheckboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  nfCheckboxIcon: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
    lineHeight: 11,
  },
  nfToggleText: {
    color: '#1e293b',
    fontSize: 13.86,
    fontWeight: '700',
  },
  nfUploadButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfUploadButtonText: {
    color: '#1e3a8a',
    fontSize: 13.86,
    fontWeight: '700',
  },
  nfPreviewCard: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
    padding: 8,
    gap: 8,
  },
  nfPreviewImage: {
    width: '100%',
    height: 170,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  nfRemoveButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  nfRemoveButtonText: {
    color: '#b91c1c',
    fontSize: 12.71,
    fontWeight: '700',
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
  dateTrigger: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldText: {
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '700',
  },
  dateFieldIcon: {
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '700',
  },
  dateFieldHint: {
    marginTop: -4,
    color: '#64748b',
    fontSize: 12.71,
  },
  placeholderText: {
    color: '#64748b',
  },
  disabledField: {
    opacity: 0.55,
  },
  selectorTrigger: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  selectorTriggerText: {
    flex: 1,
    color: '#1d4ed8',
    fontSize: 15.02,
    fontWeight: '700',
  },
  routeInfoCard: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  routeInfoLabel: {
    color: '#475569',
    fontSize: 12.71,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  routeDisplayText: {
    color: '#1e3a8a',
    fontSize: 17.33,
    fontWeight: '800',
  },
  listMetaText: {
    marginTop: -2,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  optionChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  optionChipText: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  addItemToggleIcon: {
    color: '#1d4ed8',
    fontSize: 16.17,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 17.33,
    fontWeight: '800',
  },
  sectionValue: {
    color: '#1e40af',
    fontWeight: '800',
    fontSize: 19.64,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13.86,
    fontWeight: '600',
  },
  itemCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fef9c3',
    padding: 10,
    gap: 6,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemSummaryInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemSummaryRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    minWidth: 86,
  },
  itemSummaryActions: {
    marginTop: -2,
    alignItems: 'flex-end',
  },
  removeItemInlineBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  removeItemInlineText: {
    color: '#b91c1c',
    fontSize: 12.71,
    fontWeight: '700',
  },
  itemTotalValue: {
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '800',
  },
  itemDetailsWrap: {
    marginTop: 4,
    gap: 6,
  },
  itemDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemDataLabel: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
  },
  itemDataValue: {
    color: '#0f172a',
    fontSize: 13.86,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  itemDataValueStrong: {
    color: '#1e40af',
    fontSize: 15.02,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  itemCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#64748b',
    fontSize: 12.71,
  },
  removeItemBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeItemText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13.86,
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
  selectedItemsLabel: {
    marginTop: 6,
    marginBottom: 6,
    color: '#334155',
    fontSize: 12.71,
    fontWeight: '700',
  },
  productListWrap: {
    gap: 6,
    marginTop: 4,
  },
  itemsListWrap: {
    gap: 6,
  },
  itemsListScroll: {
    maxHeight: 340,
  },
  clientListScroll: {
    maxHeight: 260,
  },
  productRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
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
  clientRow: {
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
  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 15.02,
  },
  clientInfo: {
    flex: 1,
    minWidth: 0,
  },
  clientName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15.02,
  },
  clientCode: {
    color: '#64748b',
    fontSize: 12.71,
    marginTop: 1,
  },
  productRowSelected: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  productRowPressed: {
    opacity: 0.82,
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
  productInOrderText: {
    marginTop: 1,
    color: '#0f766e',
    fontSize: 12.71,
    fontWeight: '700',
  },
  productAddText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13.86,
  },
  selectedComposer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  selectedComposerTitle: {
    color: '#1e3a8a',
    fontSize: 13.86,
    fontWeight: '800',
  },
  composerActions: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelMiniBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cancelMiniBtnPressed: {
    opacity: 0.85,
  },
  cancelMiniBtnText: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  confirmMiniBtn: {
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  confirmMiniBtnPressed: {
    opacity: 0.85,
  },
  confirmMiniBtnText: {
    color: '#fff',
    fontSize: 13.86,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelButtonPressed: {
    opacity: 0.85,
  },
  cancelButtonText: {
    color: '#1f2937',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveButtonPressed: {
    opacity: 0.86,
  },
  saveButtonText: {
    color: '#fff',
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingCard: {
    minWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
  },
  loadingText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 15.02,
  },
});
