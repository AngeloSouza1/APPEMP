import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
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
import { ClienteResumo, clientesApi, RotaResumo, rotasApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';

type FiltroStatus = 'todos' | 'ativos' | 'bloqueados';

export default function ClientesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('ativos');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteResumo | null>(null);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [rotaNovo, setRotaNovo] = useState<number | null>(null);
  const [mostrarRotasNovo, setMostrarRotasNovo] = useState(false);
  const [buscaRotaNovo, setBuscaRotaNovo] = useState('');
  const [imagemNovo, setImagemNovo] = useState('');
  const [linkNovo, setLinkNovo] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const [clienteEditando, setClienteEditando] = useState<ClienteResumo | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const [rotaEdit, setRotaEdit] = useState<number | null>(null);
  const [mostrarRotasEdicao, setMostrarRotasEdicao] = useState(false);
  const [buscaRotaEdicao, setBuscaRotaEdicao] = useState('');
  const [imagemEdit, setImagemEdit] = useState('');
  const [linkEdit, setLinkEdit] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
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
      const [clientesResp, rotasResp] = await Promise.all([clientesApi.listar(), rotasApi.listar()]);
      setClientes(clientesResp.data);
      setRotas(rotasResp.data);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar os clientes.');
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

  const mapaRotas = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const rota of rotas) mapa.set(rota.id, rota.nome);
    return mapa;
  }, [rotas]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return clientes.filter((cliente) => {
      const matchBusca =
        !termo || `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo);
      const ativo = cliente.ativo !== false;
      const matchStatus =
        filtroStatus === 'todos' ? true : filtroStatus === 'ativos' ? ativo : !ativo;
      return matchBusca && matchStatus;
    });
  }, [busca, clientes, filtroStatus]);

  const getRotaNome = (cliente: ClienteResumo) => {
    if (!cliente.rota_id) return 'Sem rota';
    return mapaRotas.get(cliente.rota_id) || `#${cliente.rota_id}`;
  };
  const abrirLinkLocalizacao = async (rawLink?: string | null) => {
    if (!rawLink) return;
    const link = rawLink.trim();
    if (!link) return;
    const normalizado = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    try {
      const suportado = await Linking.canOpenURL(normalizado);
      if (!suportado) {
        Alert.alert('Link inválido', 'Não foi possível abrir este link.');
        return;
      }
      await Linking.openURL(normalizado);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o link de localização.');
    }
  };
  const rotasFiltradasEdicao = useMemo(() => {
    const termo = buscaRotaEdicao.trim().toLowerCase();
    if (!termo) return rotas.slice(0, 30);
    return rotas.filter((rota) => rota.nome.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaRotaEdicao, rotas]);
  const rotasFiltradasNovo = useMemo(() => {
    const termo = buscaRotaNovo.trim().toLowerCase();
    if (!termo) return rotas.slice(0, 30);
    return rotas.filter((rota) => rota.nome.toLowerCase().includes(termo)).slice(0, 30);
  }, [buscaRotaNovo, rotas]);

  const abrirEdicao = (cliente: ClienteResumo) => {
    setClienteEditando(cliente);
    setNomeEdit(cliente.nome || '');
    setRotaEdit(cliente.rota_id ?? null);
    setMostrarRotasEdicao(false);
    setBuscaRotaEdicao('');
    setImagemEdit(cliente.imagem_url || '');
    setLinkEdit(cliente.link || '');
    setConfirmandoExclusao(false);
  };
  const abrirNovoModal = () => {
    setModalNovoAberto(true);
    setMostrarRotasNovo(false);
    setBuscaRotaNovo('');
  };
  const fecharNovoModal = () => {
    setModalNovoAberto(false);
    setMostrarRotasNovo(false);
    setBuscaRotaNovo('');
  };

  const criarCliente = async () => {
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para cadastrar clientes.');
      return;
    }
    if (!nomeNovo.trim() || !rotaNovo) {
      Alert.alert('Dados obrigatórios', 'Preencha nome do cliente e rota.');
      return;
    }

    setSalvandoNovo(true);
    try {
      const codigoGerado = `CL${Date.now().toString().slice(-8)}`;
      await clientesApi.criar({
        codigo_cliente: codigoGerado,
        nome: nomeNovo.trim(),
        rota_id: rotaNovo,
        imagem_url: imagemNovo.trim() || null,
        link: linkNovo.trim() || null,
      });
      setModalNovoAberto(false);
      setNomeNovo('');
      setRotaNovo(null);
      setMostrarRotasNovo(false);
      setBuscaRotaNovo('');
      setImagemNovo('');
      setLinkNovo('');
      await carregarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o cliente.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  const salvarEdicao = async () => {
    if (!clienteEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para editar clientes.');
      return;
    }
    if (!nomeEdit.trim()) {
      Alert.alert('Dados obrigatórios', 'Informe o nome do cliente.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await clientesApi.atualizar(clienteEditando.id, {
        nome: nomeEdit.trim(),
        rota_id: rotaEdit,
        imagem_url: imagemEdit.trim() || null,
        link: linkEdit.trim() || null,
      });
      setClienteEditando(null);
      await carregarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o cliente.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarBloqueio = async () => {
    if (!clienteEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para bloquear clientes.');
      return;
    }

    setProcessandoAcao(true);
    try {
      const ativoAtual = clienteEditando.ativo !== false;
      await clientesApi.atualizar(clienteEditando.id, { ativo: !ativoAtual });
      setClienteEditando((prev) => (prev ? { ...prev, ativo: !ativoAtual } : prev));
      await carregarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status do cliente.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const excluirCliente = async () => {
    if (!clienteEditando) return;
    if (!canManageCadastros) {
      Alert.alert('Permissão', 'Você não tem permissão para excluir clientes.');
      return;
    }

    setProcessandoAcao(true);
    try {
      await clientesApi.excluir(clienteEditando.id);
      setClienteEditando(null);
      setConfirmandoExclusao(false);
      setClienteSelecionado((prev) => (prev?.id === clienteEditando.id ? null : prev));
      await carregarDados();
      Alert.alert('Sucesso', 'Cliente excluído com sucesso.');
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      Alert.alert('Erro', mensagemApi || 'Não foi possível excluir o cliente.');
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
                source={require('../../assets/modulos/clientes.png')}
                style={styles.headerTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Clientes</Text>
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
                <Text style={styles.headerAddButtonText}>Novo Cliente</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.content, { paddingTop: contentTopOffset }]}>
        <View style={styles.filtersCard}>
          <TextInput
            placeholder="Buscar por código ou nome"
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
            <Text style={styles.totalText}>{clientesFiltrados.length} cliente(s)</Text>
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
            data={clientesFiltrados}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarDados(true)} />}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum cliente encontrado.</Text>}
            renderItem={({ item }) => {
              const ativo = item.ativo !== false;
              const rotaNome = getRotaNome(item);
              const temRota = Boolean(item.rota_id);
              const cardTone = !ativo
                ? styles.cardBlocked
                : temRota
                  ? styles.cardWithRoute
                  : styles.cardNoRoute;
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, cardTone, pressed && styles.cardPressed]}
                  onPress={() => setClienteSelecionado(item)}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.clientWrap}>
                      <View style={styles.clientAvatar}>
                        {item.imagem_url ? (
                          <Image source={{ uri: item.imagem_url }} style={styles.clientAvatarImage} resizeMode="cover" />
                        ) : (
                          <Text style={styles.clientAvatarText}>{(item.nome || 'C').trim().charAt(0).toUpperCase()}</Text>
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
                    <View style={[styles.metaPill, temRota ? styles.metaPillRoute : styles.metaPillNoRoute]}>
                      <Text style={[styles.metaPillText, temRota ? styles.metaPillTextRoute : styles.metaPillTextNoRoute]}>
                        {temRota ? `Rota: ${rotaNome}` : 'Sem rota vinculada'}
                      </Text>
                    </View>
                    <View style={[styles.metaPill, item.link ? styles.metaPillLink : styles.metaPillNoLink]}>
                      <Text style={[styles.metaPillText, item.link ? styles.metaPillTextLink : styles.metaPillTextNoLink]}>
                        {item.link ? 'Com localização' : 'Sem localização'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardFooterInfo}>
                      {item.link ? (
                        <Pressable
                          style={({ pressed }) => [styles.linkPressable, pressed && styles.linkPressablePressed]}
                          onPress={(event) => {
                            event.stopPropagation();
                            abrirLinkLocalizacao(item.link);
                          }}
                        >
                          <Text style={styles.linkText} numberOfLines={1}>
                            {item.link}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.linkMuted} numberOfLines={1}>
                          Link não informado
                        </Text>
                      )}
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
        visible={Boolean(clienteSelecionado)}
        transparent
        animationType="fade"
        onRequestClose={() => setClienteSelecionado(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setClienteSelecionado(null)} />
          {clienteSelecionado ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderMain}>
                  <View style={styles.modalHeaderTextWrap}>
                    <Text style={styles.modalTitle}>Cliente #{clienteSelecionado.id}</Text>
                    <Text style={styles.modalSubtitle}>{clienteSelecionado.nome}</Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                  onPress={() => setClienteSelecionado(null)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.modalGrid}>
                <View style={[styles.modalInfoCard, styles.modalInfoCardFull, styles.modalImageCard]}>
                  <Text style={styles.modalInfoLabel}>Imagem do cliente</Text>
                  <View style={styles.modalImagePreview}>
                    {clienteSelecionado.imagem_url ? (
                      <Image
                        source={{ uri: clienteSelecionado.imagem_url }}
                        style={styles.modalImagePreviewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={require('../../assets/modulos/clientes.png')}
                        style={styles.modalImagePlaceholderIcon}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Código</Text>
                  <Text style={styles.modalInfoValue}>{clienteSelecionado.codigo_cliente}</Text>
                </View>

                <View style={styles.modalInfoCard}>
                  <Text style={styles.modalInfoLabel}>Rota</Text>
                  <Text style={styles.modalInfoValue}>{getRotaNome(clienteSelecionado)}</Text>
                </View>

                <View style={[styles.modalInfoCard, styles.modalInfoCardFull]}>
                  <Text style={styles.modalInfoLabel}>Nome completo</Text>
                  <Text style={styles.modalInfoValue}>{clienteSelecionado.nome}</Text>
                </View>

                <View style={[styles.modalInfoCard, styles.modalInfoCardFull]}>
                  <Text style={styles.modalInfoLabel}>Link de localização</Text>
                  <Text
                    style={[styles.modalInfoValue, !clienteSelecionado.link && styles.modalInfoMuted]}
                    numberOfLines={2}
                  >
                    {clienteSelecionado.link || 'Não informado'}
                  </Text>
                  {clienteSelecionado.link ? (
                    <Pressable
                      style={({ pressed }) => [styles.linkOpenButton, pressed && styles.linkOpenButtonPressed]}
                      onPress={() => abrirLinkLocalizacao(clienteSelecionado.link)}
                    >
                      <Text style={styles.linkOpenButtonText}>Abrir link</Text>
                    </Pressable>
                  ) : null}
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
                <Text style={styles.modalTitle}>Novo Cliente</Text>
                <Text style={styles.modalSubtitle}>Preencha os dados para criar um cliente.</Text>
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
                placeholder="Nome do cliente"
                placeholderTextColor="#64748b"
              />
              <Text style={styles.formLabel}>Rota</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.routeSelectorTrigger,
                  pressed && styles.routeSelectorTriggerPressed,
                  rotaNovo !== null && styles.routeSelectorTriggerSelected,
                ]}
                onPress={() => setMostrarRotasNovo((prev) => !prev)}
              >
                <View style={styles.routeSelectorInfo}>
                  <Text style={styles.routeSelectorTitle}>
                    {rotaNovo === null ? 'Selecionar rota' : mapaRotas.get(rotaNovo) || 'Rota selecionada'}
                  </Text>
                  <Text style={styles.routeSelectorSubtitle}>Toque para buscar e selecionar</Text>
                </View>
                <Text style={styles.routeSelectorChevron}>{mostrarRotasNovo ? '▴' : '▾'}</Text>
              </Pressable>
              {mostrarRotasNovo ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={buscaRotaNovo}
                    onChangeText={setBuscaRotaNovo}
                    placeholder="Buscar rota"
                    placeholderTextColor="#64748b"
                  />
                  <ScrollView style={styles.routeListScroll} nestedScrollEnabled>
                    <View style={styles.routeListWrap}>
                      {rotasFiltradasNovo.map((rota) => (
                        <Pressable
                          key={rota.id}
                          style={({ pressed }) => [
                            styles.routeRow,
                            rotaNovo === rota.id && styles.routeRowSelected,
                            pressed && styles.routeRowPressed,
                          ]}
                          onPress={() => {
                            setRotaNovo(rota.id);
                            setMostrarRotasNovo(false);
                            setBuscaRotaNovo('');
                          }}
                        >
                          <Text style={[styles.routeRowTitle, rotaNovo === rota.id && styles.routeRowTitleSelected]}>
                            {rota.nome}
                          </Text>
                        </Pressable>
                      ))}
                      {rotasFiltradasNovo.length === 0 ? (
                        <Text style={styles.routeEmptyText}>Nenhuma rota encontrada.</Text>
                      ) : null}
                    </View>
                  </ScrollView>
                </>
              ) : null}
              <TextInput
                style={styles.input}
                value={imagemNovo}
                onChangeText={setImagemNovo}
                placeholder="URL da imagem (opcional)"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                value={linkNovo}
                onChangeText={setLinkNovo}
                placeholder="Link da localização (opcional)"
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
                onPress={criarCliente}
                disabled={salvandoNovo}
              >
                <Text style={styles.primaryButtonText}>{salvandoNovo ? 'Criando...' : 'Criar Cliente'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(clienteEditando)}
        transparent
        animationType="fade"
        onRequestClose={() => setClienteEditando(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setClienteEditando(null)} />
          {clienteEditando ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Editar Cliente #{clienteEditando.id}</Text>
                  <Text style={styles.modalSubtitle}>{clienteEditando.codigo_cliente}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                  onPress={() => setClienteEditando(null)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              {!confirmandoExclusao ? (
                <>
                  <View style={styles.formBody}>
                    <Text style={styles.formLabel}>Nome do cliente</Text>
                    <TextInput
                      style={styles.input}
                      value={nomeEdit}
                      onChangeText={setNomeEdit}
                      placeholder="Nome do cliente"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.formLabel}>Rota</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.routeSelectorTrigger,
                        pressed && styles.routeSelectorTriggerPressed,
                        rotaEdit !== null && styles.routeSelectorTriggerSelected,
                      ]}
                      onPress={() => setMostrarRotasEdicao((prev) => !prev)}
                    >
                      <View style={styles.routeSelectorInfo}>
                        <Text style={styles.routeSelectorTitle}>
                          {rotaEdit === null ? 'Sem rota' : mapaRotas.get(rotaEdit) || 'Rota selecionada'}
                        </Text>
                        <Text style={styles.routeSelectorSubtitle}>Toque para selecionar a rota</Text>
                      </View>
                      <Text style={styles.routeSelectorChevron}>{mostrarRotasEdicao ? '▴' : '▾'}</Text>
                    </Pressable>

                    {mostrarRotasEdicao ? (
                      <>
                        <TextInput
                          style={styles.input}
                          value={buscaRotaEdicao}
                          onChangeText={setBuscaRotaEdicao}
                          placeholder="Buscar rota"
                          placeholderTextColor="#64748b"
                        />
                        <ScrollView style={styles.routeListScroll} nestedScrollEnabled>
                          <View style={styles.routeListWrap}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.routeRow,
                                rotaEdit === null && styles.routeRowSelected,
                                pressed && styles.routeRowPressed,
                              ]}
                              onPress={() => {
                                setRotaEdit(null);
                                setMostrarRotasEdicao(false);
                                setBuscaRotaEdicao('');
                              }}
                            >
                              <Text style={[styles.routeRowTitle, rotaEdit === null && styles.routeRowTitleSelected]}>
                                Sem rota
                              </Text>
                            </Pressable>
                            {rotasFiltradasEdicao.map((rota) => (
                              <Pressable
                                key={rota.id}
                                style={({ pressed }) => [
                                  styles.routeRow,
                                  rotaEdit === rota.id && styles.routeRowSelected,
                                  pressed && styles.routeRowPressed,
                                ]}
                                onPress={() => {
                                  setRotaEdit(rota.id);
                                  setMostrarRotasEdicao(false);
                                  setBuscaRotaEdicao('');
                                }}
                              >
                                <Text
                                  style={[styles.routeRowTitle, rotaEdit === rota.id && styles.routeRowTitleSelected]}
                                >
                                  {rota.nome}
                                </Text>
                              </Pressable>
                            ))}
                            {rotasFiltradasEdicao.length === 0 ? (
                              <Text style={styles.routeEmptyText}>Nenhuma rota encontrada.</Text>
                            ) : null}
                          </View>
                        </ScrollView>
                      </>
                    ) : null}
                    <Text style={styles.formLabel}>URL da imagem (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={imagemEdit}
                      onChangeText={setImagemEdit}
                      placeholder="URL da imagem"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                    />
                    <Text style={styles.formLabel}>Link da localização (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={linkEdit}
                      onChangeText={setLinkEdit}
                      placeholder="Link da localização"
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
                          : clienteEditando.ativo !== false
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
                      <Text style={styles.destructiveGhostButtonText}>Excluir cliente</Text>
                    </Pressable>
                  </View>

                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.editActionButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={() => setClienteEditando(null)}
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
                    <Text style={styles.confirmTitle}>Excluir cliente</Text>
                    <Text style={styles.confirmText}>Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.</Text>
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
                      onPress={excluirCliente}
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
  routeSelectorTrigger: {
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
  routeSelectorTriggerSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  routeSelectorTriggerPressed: {
    opacity: 0.84,
  },
  routeSelectorInfo: {
    flex: 1,
    minWidth: 0,
  },
  routeSelectorTitle: {
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '700',
  },
  routeSelectorSubtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '500',
  },
  routeSelectorChevron: {
    color: '#1d4ed8',
    fontSize: 18.48,
    fontWeight: '800',
  },
  routeListScroll: {
    maxHeight: 180,
  },
  routeListWrap: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  routeRow: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  routeRowSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  routeRowPressed: {
    opacity: 0.86,
  },
  routeRowTitle: {
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '700',
  },
  routeRowTitleSelected: {
    color: '#1d4ed8',
  },
  routeEmptyText: {
    color: '#64748b',
    fontSize: 13.86,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
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
  cardWithRoute: {
    backgroundColor: '#f8fbff',
    borderColor: '#bfdbfe',
  },
  cardNoRoute: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
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
  metaPillRoute: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  metaPillNoRoute: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  metaPillLink: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  metaPillNoLink: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  metaPillText: {
    fontSize: 12.71,
    fontWeight: '700',
  },
  metaPillTextRoute: {
    color: '#1d4ed8',
  },
  metaPillTextNoRoute: {
    color: '#92400e',
  },
  metaPillTextLink: {
    color: '#047857',
  },
  metaPillTextNoLink: {
    color: '#475569',
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
  linkText: {
    color: '#1d4ed8',
    fontSize: 12.71,
    fontWeight: '600',
  },
  linkPressable: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  linkPressablePressed: {
    opacity: 0.7,
  },
  linkMuted: {
    color: '#64748b',
    fontSize: 12.71,
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
  modalInfoMuted: {
    color: '#64748b',
  },
  linkOpenButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkOpenButtonPressed: {
    opacity: 0.82,
  },
  linkOpenButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13.86,
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
