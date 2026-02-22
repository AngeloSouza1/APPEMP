import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DatePickerModal from '../components/DatePickerModal';
import { ClienteResumo, clientesApi, ProdutoResumo, produtosApi } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarMoeda } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Orcamento'>;

type OrcamentoItem = {
  id: string;
  produtoId: number | null;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
};

const toNumber = (value: string) => {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatarDataAtual = () => {
  const agora = new Date();
  const dd = String(agora.getDate()).padStart(2, '0');
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const yyyy = agora.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function OrcamentoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [loadingCadastros, setLoadingCadastros] = useState(true);

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [dataValidade, setDataValidade] = useState(formatarDataAtual());
  const [observacoes, setObservacoes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [itens, setItens] = useState<OrcamentoItem[]>([
    { id: '1', produtoId: null, descricao: '', quantidade: '1', valorUnitario: '' },
  ]);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [itemProdutoAtivoId, setItemProdutoAtivoId] = useState<string | null>(null);

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );

  useEffect(() => {
    const carregarCadastros = async () => {
      setLoadingCadastros(true);
      try {
        const [clientesResp, produtosResp] = await Promise.all([clientesApi.listar(), produtosApi.listar()]);
        setClientes(clientesResp.data || []);
        setProdutos(produtosResp.data || []);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar clientes e produtos para o orçamento.');
      } finally {
        setLoadingCadastros(false);
      }
    };
    carregarCadastros();
  }, []);

  const clienteSelecionado = useMemo(
    () => clientes.find((item) => item.id === clienteId) || null,
    [clienteId, clientes]
  );

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((item) =>
      `${item.nome} ${item.codigo_cliente}`.toLowerCase().includes(termo)
    );
  }, [buscaCliente, clientes]);

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((item) =>
      `${item.nome} ${item.codigo_produto || ''}`.toLowerCase().includes(termo)
    );
  }, [buscaProduto, produtos]);

  const totalOrcamento = useMemo(
    () =>
      itens.reduce((acc, item) => {
        return acc + toNumber(item.quantidade) * toNumber(item.valorUnitario);
      }, 0),
    [itens]
  );

  const atualizarItem = (id: string, campo: keyof OrcamentoItem, valor: string | number | null) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (campo === 'produtoId') return { ...item, produtoId: typeof valor === 'number' ? valor : null };
        return { ...item, [campo]: String(valor) };
      })
    );
  };

  const adicionarItem = () => {
    setItens((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        produtoId: null,
        descricao: '',
        quantidade: '1',
        valorUnitario: '',
      },
    ]);
  };

  const removerItem = (id: string) => {
    setItens((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const selecionarProduto = (produto: ProdutoResumo) => {
    if (!itemProdutoAtivoId) return;
    const valorPadrao = Number(produto.preco_base || 0);
    setItens((prev) =>
      prev.map((item) =>
        item.id === itemProdutoAtivoId
          ? {
              ...item,
              produtoId: produto.id,
              descricao: produto.nome,
              valorUnitario: valorPadrao > 0 ? String(valorPadrao.toFixed(2).replace('.', ',')) : item.valorUnitario,
            }
          : item
      )
    );
    setShowProdutoModal(false);
    setBuscaProduto('');
    setItemProdutoAtivoId(null);
  };

  const gerarPdf = async () => {
    const itensValidos = itens.filter((item) => item.descricao.trim() && toNumber(item.quantidade) > 0);
    if (!clienteSelecionado) {
      Alert.alert('Validação', 'Selecione um cliente do cadastro.');
      return;
    }
    if (itensValidos.length === 0) {
      Alert.alert('Validação', 'Adicione pelo menos um item válido no orçamento.');
      return;
    }

    setGerandoPdf(true);
    try {
      const rows = itensValidos
        .map((item, index) => {
          const qtd = toNumber(item.quantidade);
          const unit = toNumber(item.valorUnitario);
          const total = qtd * unit;
          return `
            <tr>
              <td style="padding:8px;border:1px solid #dbeafe;">${index + 1}</td>
              <td style="padding:8px;border:1px solid #dbeafe;">${item.descricao}</td>
              <td style="padding:8px;border:1px solid #dbeafe;text-align:right;">${qtd.toLocaleString('pt-BR')}</td>
              <td style="padding:8px;border:1px solid #dbeafe;text-align:right;">${formatarMoeda(unit)}</td>
              <td style="padding:8px;border:1px solid #dbeafe;text-align:right;font-weight:700;">${formatarMoeda(total)}</td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <html>
          <body style="font-family:Arial, sans-serif;padding:20px;color:#0f172a;">
            <h1 style="margin-bottom:4px;color:#1e40af;">Orçamento APPEMP</h1>
            <p style="margin:0 0 6px 0;"><strong>Cliente:</strong> ${clienteSelecionado.nome}</p>
            <p style="margin:0 0 6px 0;"><strong>Código:</strong> ${clienteSelecionado.codigo_cliente}</p>
            <p style="margin:0 0 14px 0;"><strong>Validade:</strong> ${dataValidade}</p>

            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#eff6ff;">
                  <th style="padding:8px;border:1px solid #dbeafe;">#</th>
                  <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Descrição</th>
                  <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Qtd</th>
                  <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Unitário</th>
                  <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <p style="margin-top:16px;font-size:18px;">
              <strong>Valor total: ${formatarMoeda(totalOrcamento)}</strong>
            </p>
            <p style="margin-top:14px;"><strong>Observações:</strong></p>
            <p style="white-space:pre-wrap;">${observacoes || '-'}</p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('PDF gerado', `Arquivo salvo em: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar orçamento em PDF',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF do orçamento.');
    } finally {
      setGerandoPdf(false);
    }
  };

  if (loadingCadastros) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Carregando clientes e produtos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>🧾</Text>
            <Text style={styles.headerTitle}>Orçamento</Text>
          </View>
          <Pressable style={styles.headerBackButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topSafeOffset + 96, paddingBottom: 24 }]}>
        <View style={styles.card}>
          <Text style={styles.label}>Cliente</Text>
          <Pressable style={styles.inputPressable} onPress={() => setShowClienteModal(true)}>
            <Text style={styles.inputPressableText}>
              {clienteSelecionado ? `${clienteSelecionado.codigo_cliente} - ${clienteSelecionado.nome}` : 'Selecionar cliente'}
            </Text>
            <Text style={styles.inputPressableChevron}>▾</Text>
          </Pressable>

          <Text style={styles.label}>Validade</Text>
          <Pressable style={styles.inputPressable} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputPressableText}>{dataValidade}</Text>
            <Text style={styles.inputPressableChevron}>▾</Text>
          </Pressable>

          <Text style={styles.label}>Itens do orçamento</Text>
          <View style={styles.itemsWrap}>
            {itens.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  <Pressable onPress={() => removerItem(item.id)} disabled={itens.length === 1}>
                    <Text style={[styles.itemRemove, itens.length === 1 && styles.itemRemoveDisabled]}>Excluir</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.inputPressable}
                  onPress={() => {
                    setItemProdutoAtivoId(item.id);
                    setShowProdutoModal(true);
                  }}
                >
                  <Text style={styles.inputPressableText}>{item.descricao || 'Selecionar produto'}</Text>
                  <Text style={styles.inputPressableChevron}>▾</Text>
                </Pressable>

                <View style={styles.itemGrid}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    value={item.quantidade}
                    onChangeText={(value) => atualizarItem(item.id, 'quantidade', value)}
                    placeholder="Qtd"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    value={item.valorUnitario}
                    onChangeText={(value) => atualizarItem(item.id, 'valorUnitario', value)}
                    placeholder="Valor unitário"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.secondaryButton} onPress={adicionarItem}>
            <Text style={styles.secondaryButtonText}>+ Adicionar item</Text>
          </Pressable>

          <Text style={styles.totalLabel}>
            Total do orçamento: <Text style={styles.totalValue}>{formatarMoeda(totalOrcamento)}</Text>
          </Text>

          <Text style={styles.label}>Observações</Text>
          <TextInput
            style={styles.textArea}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Informações adicionais para o cliente"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Pressable style={[styles.primaryButton, gerandoPdf && styles.disabledButton]} onPress={gerarPdf} disabled={gerandoPdf}>
            <Text style={styles.primaryButtonText}>{gerandoPdf ? 'Gerando PDF...' : 'Gerar PDF'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={dataValidade}
        onClose={() => setShowDatePicker(false)}
        onChange={(value) => {
          setDataValidade(value);
          setShowDatePicker(false);
        }}
        title="Validade do orçamento"
      />

      <Modal visible={showClienteModal} transparent animationType="fade" onRequestClose={() => setShowClienteModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowClienteModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecionar cliente</Text>
            <TextInput
              style={styles.modalSearch}
              value={buscaCliente}
              onChangeText={setBuscaCliente}
              placeholder="Buscar cliente"
              placeholderTextColor="#94a3b8"
            />
            <ScrollView style={styles.modalList}>
              {clientesFiltrados.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setClienteId(item.id);
                    setShowClienteModal(false);
                    setBuscaCliente('');
                  }}
                >
                  <Text style={styles.modalItemText}>{item.codigo_cliente} - {item.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowClienteModal(false)}>
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showProdutoModal} transparent animationType="fade" onRequestClose={() => setShowProdutoModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowProdutoModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecionar produto</Text>
            <TextInput
              style={styles.modalSearch}
              value={buscaProduto}
              onChangeText={setBuscaProduto}
              placeholder="Buscar produto"
              placeholderTextColor="#94a3b8"
            />
            <ScrollView style={styles.modalList}>
              {produtosFiltrados.map((item) => (
                <Pressable key={item.id} style={styles.modalItem} onPress={() => selecionarProduto(item)}>
                  <Text style={styles.modalItemText}>
                    {(item.codigo_produto ? `${item.codigo_produto} - ` : '') + item.nome}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowProdutoModal(false)}>
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e8f0' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#e2e8f0' },
  loadingText: { color: '#334155', fontWeight: '600' },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e2e8f0' },
  backgroundGlowBlue: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#93c5fd',
    opacity: 0.35,
  },
  backgroundGlowCyan: {
    position: 'absolute',
    top: 90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#67e8f9',
    opacity: 0.2,
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
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 23.1 },
  headerTitle: { color: '#0f172a', fontWeight: '800', fontSize: 24.255 },
  headerBackButton: {
    minWidth: 82,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: { color: '#1d4ed8', fontWeight: '700', fontSize: 18.48 },
  content: { paddingHorizontal: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  label: { color: '#334155', fontWeight: '700', fontSize: 13.86, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 15.015,
  },
  inputPressable: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputPressableText: { color: '#0f172a', fontSize: 15.015, flex: 1 },
  inputPressableChevron: { color: '#1d4ed8', fontWeight: '700', fontSize: 16.17 },
  itemsWrap: { gap: 8 },
  itemCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    padding: 10,
    gap: 8,
  },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 13.86 },
  itemRemove: { color: '#b91c1c', fontWeight: '700', fontSize: 12.705 },
  itemRemoveDisabled: { color: '#94a3b8' },
  itemGrid: { flexDirection: 'row', gap: 8 },
  inputHalf: { flex: 1 },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  secondaryButtonText: { color: '#1e3a8a', fontWeight: '800', fontSize: 13.86 },
  totalLabel: { marginTop: 4, color: '#334155', fontWeight: '700', fontSize: 15.015 },
  totalValue: { color: '#1d4ed8', fontWeight: '900' },
  textArea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 15.015,
    minHeight: 92,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15.015 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
  },
  modalTitle: { color: '#0f172a', fontWeight: '800', fontSize: 17.325 },
  modalSearch: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  modalList: { maxHeight: 320 },
  modalItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
  },
  modalItemText: { color: '#0f172a', fontSize: 14.4 },
  modalCloseBtn: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalCloseBtnText: { color: '#1d4ed8', fontWeight: '800', fontSize: 13.86 },
});
