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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProdutoResumo, produtosApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarMoeda } from '../utils/format';

type FiltroStatus = 'todos' | 'ativos' | 'bloqueados';

const parsePreco = (value: string) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

export default function ProdutosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('ativos');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoResumo | null>(null);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [embalagemNovo, setEmbalagemNovo] = useState('');
  const [precoNovo, setPrecoNovo] = useState('');
  const [imagemNovo, setImagemNovo] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const [produtoEditando, setProdutoEditando] = useState<ProdutoResumo | null>(null);
  const [codigoEdit, setCodigoEdit] = useState('');
  const [nomeEdit, setNomeEdit] = useState('');
  const [embalagemEdit, setEmbalagemEdit] = useState('');
  const [precoEdit, setPrecoEdit] = useState('');
  const [imagemEdit, setImagemEdit] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const canManageCadastros = user?.perfil === 'admin' || user?.perfil === 'backoffice';

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );
  const contentTopOffset = topSafeOffset + (canManageCadastros ? 138 : 98);

  const carregarDados = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await produtosApi.listar();
      setProdutos(response.data);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar os produtos.');
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

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos.filter((produto) => {
      const matchBusca =
        !termo
        || `${produto.codigo_produto} ${produto.nome} ${produto.embalagem || ''}`.toLowerCase().includes(termo);
      const ativo = produto.ativo !== false;
      const matchStatus = filtroStatus === 'todos' ? true : filtroStatus === 'ativos' ? ativo : !ativo;
      return matchBusca && matchStatus;
    });
  }, [busca, filtroStatus, produtos]);

  const abrirEdicao = (produto: ProdutoResumo) => {
    setProdutoEditando(produto);
    setCodigoEdit(produto.codigo_produto || '');
    setNomeEdit(produto.nome || '');
    setEmbalagemEdit(produto.embalagem || '');
    setPrecoEdit(produto.preco_base !== undefined && produto.preco_base !== null ? String(produto.preco_base) : '');
    setImagemEdit(produto.imagem_url || '');
    setConfirmandoExclusao(false);
  };

  const abrirNovoModal = () => setModalNovoAberto(true);
  const fecharNovoModal = () => setModalNovoAberto(false);

  const criarProduto = async () => {
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para cadastrar produtos.');
      return;
    }

    const preco = parsePreco(precoNovo);
    if (!nomeNovo.trim() || !Number.isFinite(preco) || preco <= 0) {
      Alert.alert('Dados obrigatórios', 'Preencha nome e preço base válido maior que zero.');
      return;
    }

    setSalvandoNovo(true);
    try {
      await produtosApi.criar({
        codigo_produto: `PR${Date.now().toString().slice(-8)}`,
        nome: nomeNovo.trim(),
        embalagem: embalagemNovo.trim() || null,
        preco_base: preco,
        imagem_url: imagemNovo.trim() || null,
      });

      setModalNovoAberto(false);
      setNomeNovo('');
      setEmbalagemNovo('');
      setPrecoNovo('');
      setImagemNovo('');
      await carregarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o produto.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  const salvarEdicao = async () => {
    if (!produtoEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para editar produtos.');
      return;
    }
    if (!codigoEdit.trim() || !nomeEdit.trim()) {
      Alert.alert('Dados obrigatórios', 'Preencha código e nome do produto.');
      return;
    }

    const preco = precoEdit.trim() === '' ? null : parsePreco(precoEdit);
    if (preco !== null && !Number.isFinite(preco)) {
      Alert.alert('Preço inválido', 'Informe um preço base válido.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await produtosApi.atualizar(produtoEditando.id, {
        codigo_produto: codigoEdit.trim(),
        nome: nomeEdit.trim(),
        embalagem: embalagemEdit.trim() || null,
        preco_base: preco,
        imagem_url: imagemEdit.trim() || null,
      });
      setProdutoEditando(null);
      await carregarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o produto.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarBloqueio = async () => {
    if (!produtoEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para bloquear produtos.');
      return;
    }

    setProcessandoAcao(true);
    try {
      const ativoAtual = produtoEditando.ativo !== false;
      await produtosApi.atualizar(produtoEditando.id, { ativo: !ativoAtual });
      setProdutoEditando((prev) => (prev ? { ...prev, ativo: !ativoAtual } : prev));
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível atualizar o status do produto.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const excluirProduto = async () => {
    if (!produtoEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para excluir produtos.');
      return;
    }

    setProcessandoAcao(true);
    try {
      await produtosApi.excluir(produtoEditando.id);
      setProdutoEditando(null);
      setConfirmandoExclusao(false);
      setProdutoSelecionado((prev) => (prev?.id === produtoEditando.id ? null : prev));
      await carregarDados();
      Alert.alert('Sucesso', 'Produto excluído com sucesso.');
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível excluir o produto.');
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
                source={require('../../assets/modulos/produtos.png')}
                style={styles.headerTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Produtos</Text>
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
            <Text style={styles.headerAddButtonText}>Novo Produto</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.content, { paddingTop: contentTopOffset }]}> 
        <View style={styles.filtersCard}>
          <TextInput
            placeholder="Buscar por código, nome ou embalagem"
            placeholderTextColor="#64748b"
            value={busca}
            onChangeText={setBusca}
            style={styles.input}
          />

          <View style={styles.statusRow}>
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'ativos', label: 'Ativos' },
              { key: 'bloqueados', label: 'Bloqueados' },
            ].map((item) => {
              const active = filtroStatus === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFiltroStatus(item.key as FiltroStatus)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.filtersFooterRow}>
            <Text style={styles.totalText}>{produtosFiltrados.length} produto(s)</Text>
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
            data={produtosFiltrados}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum produto encontrado.</Text>}
            renderItem={({ item }) => {
              const ativo = item.ativo !== false;
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, !ativo && styles.cardBlocked, pressed && styles.cardPressed]}
                  onPress={() => setProdutoSelecionado(item)}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.clientWrap}>
                      <View style={styles.clientAvatar}>
                        {item.imagem_url ? (
                          <Image source={{ uri: item.imagem_url }} style={styles.clientAvatarImage} resizeMode="cover" />
                        ) : (
                          <Text style={styles.clientAvatarText}>{(item.nome || 'P').trim().charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.client} numberOfLines={1}>
                        {item.nome}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, ativo ? styles.statusBadgeAtivo : styles.statusBadgeBloqueado]}>
                      <Text
                        style={[
                          styles.statusBadgeText,
                          ativo ? styles.statusBadgeTextAtivo : styles.statusBadgeTextBloqueado,
                        ]}
                      >
                        {ativo ? 'Ativo' : 'Bloqueado'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={[styles.metaPill, styles.metaPillPrice]}>
                      <Text style={[styles.metaPillText, styles.metaPillTextPrice]}>{formatarMoeda(item.preco_base || 0)}</Text>
                    </View>
                    <View style={[styles.metaPill, styles.metaPillPack]}>
                      <Text style={[styles.metaPillText, styles.metaPillTextPack]}>
                        Emb.: {item.embalagem?.trim() || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardFooterInfo}>
                      <Text style={styles.codeText} numberOfLines={1}>{item.codigo_produto}</Text>
                    </View>
                    {canManageCadastros ? (
                      <Pressable
                        style={({ pressed }) => [styles.editLink, pressed && styles.editLinkPressed]}
                        onPress={() => abrirEdicao(item)}
                      >
                        <Text style={styles.editLinkText}>Editar</Text>
                      </Pressable>
                    ) : null}
                    <Text style={styles.cardChevron}>{'>'}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <Modal
        visible={Boolean(produtoSelecionado)}
        transparent
        animationType="fade"
        onRequestClose={() => setProdutoSelecionado(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setProdutoSelecionado(null)} />
          {produtoSelecionado ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderMain}>
                  <View style={styles.modalHeaderTextWrap}>
                    <Text style={styles.modalTitle}>Produto #{produtoSelecionado.id}</Text>
                    <Text style={styles.modalSubtitle}>{produtoSelecionado.nome}</Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                  onPress={() => setProdutoSelecionado(null)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.modalGrid}>
                <View style={[styles.modalInfoCard, styles.modalInfoCardFull, styles.modalImageCard]}>
                  <Text style={styles.modalInfoLabel}>Imagem do produto</Text>
                  <View style={styles.modalImagePreview}>
                    {produtoSelecionado.imagem_url ? (
                      <Image
                        source={{ uri: produtoSelecionado.imagem_url }}
                        style={styles.modalImagePreviewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={require('../../assets/modulos/produtos.png')}
                        style={styles.modalImagePlaceholderIcon}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Código</Text>
                  <Text style={styles.modalInfoValue}>{produtoSelecionado.codigo_produto}</Text>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Status</Text>
                  <Text style={styles.modalInfoValue}>{produtoSelecionado.ativo === false ? 'Bloqueado' : 'Ativo'}</Text>
                </View>

                <View style={[styles.modalInfoCard, styles.modalInfoCardFull]}>
                  <Text style={styles.modalInfoLabel}>Nome completo</Text>
                  <Text style={styles.modalInfoValue}>{produtoSelecionado.nome}</Text>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Embalagem</Text>
                  <Text style={styles.modalInfoValue}>{produtoSelecionado.embalagem || 'N/A'}</Text>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Preço base</Text>
                  <Text style={styles.modalInfoValue}>{formatarMoeda(produtoSelecionado.preco_base || 0)}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={modalNovoAberto}
        transparent
        animationType="fade"
        onRequestClose={fecharNovoModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={fecharNovoModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Novo Produto</Text>
                <Text style={styles.modalSubtitle}>Preencha os dados para criar um produto.</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                onPress={fecharNovoModal}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.formBody}>
              <TextInput
                style={styles.input}
                value={nomeNovo}
                onChangeText={setNomeNovo}
                placeholder="Nome do produto"
                placeholderTextColor="#64748b"
              />
              <TextInput
                style={styles.input}
                value={embalagemNovo}
                onChangeText={setEmbalagemNovo}
                placeholder="Embalagem (opcional)"
                placeholderTextColor="#64748b"
              />
              <TextInput
                style={styles.input}
                value={precoNovo}
                onChangeText={setPrecoNovo}
                placeholder="Preço base"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={imagemNovo}
                onChangeText={setImagemNovo}
                placeholder="URL da imagem (opcional)"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
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
                onPress={criarProduto}
                disabled={salvandoNovo}
              >
                <Text style={styles.primaryButtonText}>{salvandoNovo ? 'Criando...' : 'Criar Produto'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(produtoEditando)}
        transparent
        animationType="fade"
        onRequestClose={() => setProdutoEditando(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setProdutoEditando(null)} />
          {produtoEditando ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Editar Produto #{produtoEditando.id}</Text>
                  <Text style={styles.modalSubtitle}>{produtoEditando.codigo_produto}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                  onPress={() => setProdutoEditando(null)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              {!confirmandoExclusao ? (
                <>
                  <View style={styles.formBody}>
                    <Text style={styles.formLabel}>Código do produto</Text>
                    <TextInput
                      style={styles.input}
                      value={codigoEdit}
                      onChangeText={setCodigoEdit}
                      placeholder="Código"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.formLabel}>Nome</Text>
                    <TextInput
                      style={styles.input}
                      value={nomeEdit}
                      onChangeText={setNomeEdit}
                      placeholder="Nome"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.formLabel}>Embalagem</Text>
                    <TextInput
                      style={styles.input}
                      value={embalagemEdit}
                      onChangeText={setEmbalagemEdit}
                      placeholder="Embalagem"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.formLabel}>Preço base</Text>
                    <TextInput
                      style={styles.input}
                      value={precoEdit}
                      onChangeText={setPrecoEdit}
                      placeholder="Preço base"
                      placeholderTextColor="#64748b"
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.formLabel}>URL da imagem (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={imagemEdit}
                      onChangeText={setImagemEdit}
                      placeholder="URL da imagem"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.editActionButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={alternarBloqueio}
                      disabled={processandoAcao || salvandoEdicao}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {processandoAcao
                          ? 'Processando...'
                          : produtoEditando.ativo !== false
                            ? 'Bloquear'
                            : 'Desbloquear'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.destructiveGhostButton,
                        styles.editActionButton,
                        pressed && styles.destructiveGhostButtonPressed,
                      ]}
                      onPress={() => setConfirmandoExclusao(true)}
                      disabled={processandoAcao || salvandoEdicao}
                    >
                      <Text style={styles.destructiveGhostButtonText}>Excluir produto</Text>
                    </Pressable>
                  </View>

                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.editActionButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={() => setProdutoEditando(null)}
                      disabled={salvandoEdicao || processandoAcao}
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
                      disabled={salvandoEdicao || processandoAcao}
                    >
                      <Text style={styles.primaryButtonText}>{salvandoEdicao ? 'Salvando...' : 'Salvar'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>Excluir produto</Text>
                    <Text style={styles.confirmText}>Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.</Text>
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
                      onPress={excluirProduto}
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
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
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
  formLabel: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13.86,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
    fontSize: 13.86,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  totalText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13.86,
    textAlign: 'right',
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
  cardBlocked: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
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
    fontSize: 18.48,
  },
  client: {
    fontSize: 19.64,
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
  statusBadgeAtivo: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusBadgeBloqueado: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statusBadgeText: {
    fontSize: 12.71,
    fontWeight: '800',
  },
  statusBadgeTextAtivo: {
    color: '#047857',
  },
  statusBadgeTextBloqueado: {
    color: '#475569',
  },
  metaRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaPillPrice: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  metaPillPack: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  metaPillText: {
    fontSize: 12.71,
    fontWeight: '700',
  },
  metaPillTextPrice: {
    color: '#1d4ed8',
  },
  metaPillTextPack: {
    color: '#9a3412',
  },
  cardFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFooterInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  codeText: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '700',
  },
  editLink: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editLinkPressed: {
    opacity: 0.7,
  },
  editLinkText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13.86,
  },
  cardChevron: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 15.02,
    marginLeft: 2,
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
  modalHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  modalHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
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
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalInfoCard: {
    width: '48.8%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  modalInfoCardFull: {
    width: '100%',
  },
  modalImageCard: {
    alignItems: 'center',
  },
  modalImagePreview: {
    marginTop: 6,
    width: 108,
    height: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalImagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  modalImagePlaceholderIcon: {
    width: 52,
    height: 52,
  },
  modalInfoLabel: {
    color: '#64748b',
    fontSize: 11.55,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInfoValue: {
    color: '#0f172a',
    fontSize: 15.02,
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
