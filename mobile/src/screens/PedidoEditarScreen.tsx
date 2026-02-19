import { useCallback, useEffect, useMemo, useState } from 'react';
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
import DatePickerModal from '../components/DatePickerModal';
import { pedidosApi, ProdutoResumo, produtosApi, RotaResumo, rotasApi } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { formatarMoeda } from '../utils/format';
import { marcarRelatoriosComoDesatualizados } from '../utils/relatoriosRefresh';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidoEditar'>;

type StatusOption = {
  value: string;
  label: string;
};

type EditableItem = {
  key: string;
  produto_id: number;
  produto_nome: string;
  codigo_produto: string;
  quantidade: string;
  valor_unitario: string;
  embalagem: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'EM_ESPERA', label: 'Em espera' },
  { value: 'CONFERIR', label: 'Conferir' },
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

const toDisplayDate = (value: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const fromIso = value.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromIso)) {
    const [yyyy, mm, dd] = fromIso.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return '';
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

const formatDecimalInput = (value: unknown, maxDecimals = 2) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '';
  const fixed = numeric.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, '');
};

const toEditableItem = (item: Pedido['itens'][number], index: number): EditableItem => ({
  key: `${item.id || item.produto_id}-${index}`,
  produto_id: item.produto_id,
  produto_nome: item.produto_nome || `Produto ${item.produto_id}`,
  codigo_produto: item.codigo_produto || '',
  quantidade: formatDecimalInput(item.quantidade, 2),
  valor_unitario: formatDecimalInput(item.valor_unitario, 2),
  embalagem: String(item.embalagem || ''),
});

export default function PedidoEditarScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [status, setStatus] = useState('EM_ESPERA');
  const [data, setData] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rotaId, setRotaId] = useState<number | null>(null);
  const [itens, setItens] = useState<EditableItem[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<number | null>(null);
  const [mostrarSeletorProdutos, setMostrarSeletorProdutos] = useState(false);
  const [itemExpandidoKey, setItemExpandidoKey] = useState<string | null>(null);
  const [quantidadeNovoItem, setQuantidadeNovoItem] = useState('1');
  const [valorNovoItem, setValorNovoItem] = useState('');
  const [embalagemNovoItem, setEmbalagemNovoItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [pedidoResp, rotasResp, produtosResp] = await Promise.all([
        pedidosApi.buscarPorId(id),
        rotasApi.listar(),
        produtosApi.listar(),
      ]);
      const pedidoData = pedidoResp.data;
      setPedido(pedidoData);
      setStatus(pedidoData.status || 'EM_ESPERA');
      setData(toDisplayDate(pedidoData.data));
      setRotaId(pedidoData.rota_id ?? null);
      setRotas(rotasResp.data);
      setProdutos(produtosResp.data || []);
      setItens((pedidoData.itens || []).map(toEditableItem));
      setErro(null);
    } catch {
      setErro('Não foi possível carregar os dados do pedido.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20;

  const rotaAtualLabel = useMemo(() => {
    if (rotaId === null) return 'Sem rota';
    return rotas.find((rota) => rota.id === rotaId)?.nome || 'Rota selecionada';
  }, [rotaId, rotas]);

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
      })
      .sort((a, b) => {
        const aCodigo = (a.codigo_produto || '').toLowerCase();
        const bCodigo = (b.codigo_produto || '').toLowerCase();
        const aNome = (a.nome || '').toLowerCase();
        const bNome = (b.nome || '').toLowerCase();
        const aStarts = aCodigo.startsWith(termo) || aNome.startsWith(termo) ? 0 : 1;
        const bStarts = bCodigo.startsWith(termo) || bNome.startsWith(termo) ? 0 : 1;
        return aStarts - bStarts;
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

  const quantidadeNoPedidoPorProduto = useMemo(() => {
    return itens.reduce<Record<number, number>>((acc, item) => {
      const qtd = parseDecimal(item.quantidade);
      acc[item.produto_id] = (acc[item.produto_id] || 0) + (Number.isFinite(qtd) ? qtd : 0);
      return acc;
    }, {});
  }, [itens]);

  const updateItemField = (key: string, field: keyof EditableItem, value: string) => {
    setItens((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const removerItem = (key: string) => {
    setItens((prev) => prev.filter((item) => item.key !== key));
    setItemExpandidoKey((atual) => (atual === key ? null : atual));
  };

  const adicionarItem = (
    produto: ProdutoResumo,
    quantidadeSelecionada: number,
    valorUnitarioSelecionado?: number,
    embalagemSelecionada?: string
  ) => {
    const qtdParaAdicionar =
      Number.isFinite(quantidadeSelecionada) && quantidadeSelecionada > 0 ? quantidadeSelecionada : 1;
    const valorNovo = Number.isFinite(valorUnitarioSelecionado as number)
      ? Number(valorUnitarioSelecionado)
      : Number(produto.preco_base ?? 0);
    const embalagemNova = (embalagemSelecionada ?? produto.embalagem ?? '').trim();

    setItens((prev) => {
      const existente = prev.find((item) => item.produto_id === produto.id);
      if (existente) {
        return prev.map((item) => {
          if (item.produto_id !== produto.id) return item;
          const qtdAtual = parseDecimal(item.quantidade);
          const novaQtd = Number.isFinite(qtdAtual) ? qtdAtual + qtdParaAdicionar : qtdParaAdicionar;
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
          quantidade: String(qtdParaAdicionar),
          valor_unitario: String(valorNovo),
          embalagem: embalagemNova,
        },
      ];
    });
    setItemExpandidoKey(null);
  };

  const selecionarProduto = (produto: ProdutoResumo) => {
    setProdutoSelecionadoId(produto.id);
    setQuantidadeNovoItem('1');
    setValorNovoItem(produto.preco_base !== null && produto.preco_base !== undefined ? String(produto.preco_base) : '');
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

    adicionarItem(produto, quantidade, valorUnitario, embalagemNovoItem);
    setBuscaProduto('');
    setProdutoSelecionadoId(null);
    setQuantidadeNovoItem('1');
    setValorNovoItem('');
    setEmbalagemNovoItem('');
  };

  const salvar = async () => {
    if (!pedido) return;
    const dataNormalizada = normalizeDateForApi(data);
    if (!dataNormalizada) {
      Alert.alert('Data inválida', 'Use DD/MM/AAAA ou AAAA-MM-DD.');
      return;
    }

    if (itens.length === 0) {
      Alert.alert('Itens obrigatórios', 'Adicione ao menos um item no pedido.');
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
      await pedidosApi.atualizar(pedido.id, {
        status,
        data: dataNormalizada,
        rota_id: rotaId,
        itens: itensPayload,
      });
      await marcarRelatoriosComoDesatualizados();
      Alert.alert('Sucesso', 'Pedido atualizado com sucesso.');
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o pedido.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator />
        <Text style={styles.centeredText}>Carregando edição...</Text>
      </View>
    );
  }

  if (erro || !pedido) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorText}>{erro || 'Pedido não encontrado.'}</Text>
        <View style={styles.errorActions}>
          <Pressable style={styles.retryButton} onPress={carregar}>
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

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topSafeOffset }]}> 
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Editar Pedido #{pedido.id}</Text>
            <Text style={styles.headerSubtitle}>{pedido.cliente_nome}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dados do Pedido</Text>
          </View>
          <Text style={styles.fieldLabel}>Data</Text>
          <Pressable
            style={({ pressed }) => [styles.dateTrigger, pressed && styles.selectorTriggerPressed]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateFieldText}>{data}</Text>
            <Text style={styles.dateFieldIcon}>▾</Text>
          </Pressable>
          <Text style={styles.fieldHint}>Toque para selecionar no calendário</Text>

          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.optionsWrap}>
            {STATUS_OPTIONS.map((option) => {
              const ativo = option.value === status;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.optionChip, ativo && styles.optionChipActive]}
                  onPress={() => setStatus(option.value)}
                >
                  <Text style={[styles.optionChipText, ativo && styles.optionChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Rota</Text>
          <View style={styles.routeInfoCard}>
            <Text style={styles.routeInfoLabel}>Rota vinculada ao cliente</Text>
            <Text style={styles.routeDisplayText}>{rotaAtualLabel}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Itens do Pedido</Text>
            <Text style={styles.sectionValue}>{formatarMoeda(totalItens)}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{itens.length} item(ns) no pedido</Text>

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
                placeholder="Buscar por nome ou código"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
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
                          #{produto.codigo_produto} {produto.preco_base ? `• ${formatarMoeda(produto.preco_base)}` : ''}
                        </Text>
                        {quantidadeNoPedidoPorProduto[produto.id] ? (
                          <Text style={styles.productInOrderText}>No pedido: {quantidadeNoPedidoPorProduto[produto.id]}</Text>
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
                  <Text style={styles.cancelMiniBtnText}>Limpar seleção</Text>
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

          <Text style={styles.itemFieldLabel}>Produtos selecionados</Text>
          {itens.length === 0 ? <Text style={styles.emptyText}>Nenhum item adicionado.</Text> : null}

          <ScrollView style={usarScrollItens ? styles.itemsListScroll : undefined} nestedScrollEnabled={usarScrollItens}>
            <View style={styles.itemsListWrap}>
              {itens.map((item) => {
                const qtd = parseDecimal(item.quantidade);
                const unit = parseDecimal(item.valor_unitario);
                const totalItem = Number.isFinite(qtd) && Number.isFinite(unit) ? qtd * unit : 0;
                const itemExpandido = itemExpandidoKey === item.key;
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
                        <Text style={styles.addItemToggleIcon}>{itemExpandido ? '▴' : '▾'}</Text>
                      </View>
                    </Pressable>

                    <View style={styles.itemActionLinksRow}>
                      <Pressable
                        style={({ pressed }) => [styles.itemActionLink, pressed && styles.itemActionLinkPressed]}
                        onPress={() => setItemExpandidoKey((atual) => (atual === item.key ? null : item.key))}
                      >
                        <Text style={styles.itemActionEditText}>{itemExpandido ? 'Fechar edição' : 'Editar'}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.itemActionLink, pressed && styles.itemActionLinkPressed]}
                        onPress={() => removerItem(item.key)}
                      >
                        <Text style={styles.itemActionDeleteText}>Excluir</Text>
                      </Pressable>
                    </View>

                    {itemExpandido ? (
                      <View style={styles.itemDetailsWrap}>
                        <View style={styles.itemFieldLarge}>
                          <Text style={styles.itemDataLabel}>Quantidade</Text>
                          <TextInput
                            value={item.quantidade}
                            onChangeText={(value) => updateItemField(item.key, 'quantidade', value)}
                            style={styles.input}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={styles.itemFieldLarge}>
                          <Text style={styles.itemDataLabel}>Valor unitário</Text>
                          <TextInput
                            value={item.valor_unitario}
                            onChangeText={(value) => updateItemField(item.key, 'valor_unitario', value)}
                            style={styles.input}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={styles.itemFieldLarge}>
                          <Text style={styles.itemDataLabel}>Embalagem</Text>
                          <TextInput
                            value={item.embalagem}
                            onChangeText={(value) => updateItemField(item.key, 'embalagem', value)}
                            style={styles.input}
                            placeholder="Opcional"
                            placeholderTextColor="#94a3b8"
                          />
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

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.saveButton, (salvando || loading) && styles.saveButtonDisabled, pressed && styles.saveButtonPressed]}
            onPress={salvar}
            disabled={salvando || loading}
          >
            <Text style={styles.saveButtonText}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DatePickerModal
        visible={showDatePicker}
        value={data}
        onChange={setData}
        onClose={() => setShowDatePicker(false)}
        title="Selecionar data do pedido"
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
    paddingHorizontal: 12,
    paddingBottom: 20,
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
  fieldLabel: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldHint: {
    marginTop: -4,
    color: '#64748b',
    fontSize: 12.71,
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
  sectionSubtitle: {
    color: '#64748b',
    fontSize: 13.86,
    marginTop: -3,
    marginBottom: 2,
  },
  sectionValue: {
    color: '#1d4ed8',
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
    borderColor: '#dbeafe',
    backgroundColor: '#f9fbff',
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
  itemTotalValue: {
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '800',
  },
  itemDetailsWrap: {
    marginTop: 4,
    gap: 6,
  },
  itemActionLinksRow: {
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  itemActionLink: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  itemActionLinkPressed: {
    opacity: 0.65,
  },
  itemActionEditText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13.86,
  },
  itemActionDeleteText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13.86,
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
  addItemToggle: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItemTogglePressed: {
    opacity: 0.84,
  },
  addItemToggleText: {
    color: '#1d4ed8',
    fontSize: 15.02,
    fontWeight: '700',
  },
  addItemToggleIcon: {
    color: '#1d4ed8',
    fontSize: 16.17,
    fontWeight: '800',
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
  selectorTriggerPressed: {
    opacity: 0.84,
  },
  selectorTriggerText: {
    flex: 1,
    color: '#1d4ed8',
    fontSize: 15.02,
    fontWeight: '700',
  },
  listMetaText: {
    marginTop: -2,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
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
  searchMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchMetaText: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
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
  productAddText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13.86,
  },
  productInOrderText: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 12.71,
    marginRight: 8,
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
});
