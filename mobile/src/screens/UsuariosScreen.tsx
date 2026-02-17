import { useCallback, useMemo, useState } from 'react';
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
import { UsuarioResumo, usuariosApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';

type Perfil = 'admin' | 'backoffice' | 'vendedor' | 'motorista';
type FiltroAtivo = 'todos' | 'ativos' | 'inativos';

const PERFIS: Perfil[] = ['admin', 'backoffice', 'vendedor', 'motorista'];

export default function UsuariosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<Perfil | ''>('');
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('ativos');

  const [modalNovo, setModalNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoLogin, setNovoLogin] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('vendedor');
  const [novaImagemUrl, setNovaImagemUrl] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioResumo | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPerfil, setEditPerfil] = useState<Perfil>('vendedor');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editSenha, setEditSenha] = useState('');
  const [editImagemUrl, setEditImagemUrl] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const isAdmin = user?.perfil === 'admin';
  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 18;
  const contentTopOffset = topSafeOffset + 140;

  const carregarUsuarios = useCallback(async (isRefresh = false) => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await usuariosApi.listar({
        q: busca.trim() || undefined,
        perfil: filtroPerfil || undefined,
        ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
        page: 1,
        limit: 100,
        sort_by: 'nome',
        sort_dir: 'asc',
      });
      setUsuarios(response.data.data);
      setErro(null);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) setErro('Apenas administrador pode acessar usuários.');
      else setErro(error?.response?.data?.error || 'Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [busca, filtroAtivo, filtroPerfil, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      carregarUsuarios(true);
    }, [carregarUsuarios])
  );

  const total = usuarios.length;
  const perfilLabel = useMemo(() => (filtroPerfil ? filtroPerfil : 'Todos os perfis'), [filtroPerfil]);

  const abrirEdicao = (usuario: UsuarioResumo) => {
    setUsuarioEditando(usuario);
    setEditNome(usuario.nome);
    setEditPerfil(usuario.perfil);
    setEditAtivo(Boolean(usuario.ativo));
    setEditSenha('');
    setEditImagemUrl(usuario.imagem_url || '');
    setConfirmandoExclusao(false);
  };

  const fecharNovo = () => {
    setModalNovo(false);
    setNovoNome('');
    setNovoLogin('');
    setNovaSenha('');
    setNovoPerfil('vendedor');
    setNovaImagemUrl('');
  };

  const fecharEdicao = () => {
    setUsuarioEditando(null);
    setEditNome('');
    setEditPerfil('vendedor');
    setEditAtivo(true);
    setEditSenha('');
    setEditImagemUrl('');
    setConfirmandoExclusao(false);
  };

  const criarUsuario = async () => {
    if (!novoNome.trim() || !novoLogin.trim() || !novaSenha.trim()) {
      Alert.alert('Dados obrigatórios', 'Preencha nome, login e senha.');
      return;
    }
    if (novaSenha.trim().length < 6) {
      Alert.alert('Senha inválida', 'A senha deve ter ao menos 6 caracteres.');
      return;
    }
    setSalvandoNovo(true);
    try {
      await usuariosApi.criar({
        nome: novoNome.trim(),
        login: novoLogin.trim(),
        senha: novaSenha.trim(),
        perfil: novoPerfil,
        ativo: true,
        imagem_url: novaImagemUrl.trim() || null,
      });
      fecharNovo();
      await carregarUsuarios();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível criar usuário.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  const salvarEdicao = async () => {
    if (!usuarioEditando) return;
    if (!editNome.trim()) {
      Alert.alert('Dados obrigatórios', 'Informe o nome.');
      return;
    }
    if (editSenha.trim() && editSenha.trim().length < 6) {
      Alert.alert('Senha inválida', 'A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await usuariosApi.atualizar(usuarioEditando.id, {
        nome: editNome.trim(),
        perfil: editPerfil,
        ativo: editAtivo,
        senha: editSenha.trim() || undefined,
        imagem_url: editImagemUrl.trim() || null,
      });
      fecharEdicao();
      await carregarUsuarios();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível atualizar usuário.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarBloqueio = async () => {
    if (!usuarioEditando) return;
    setProcessandoAcao(true);
    try {
      const proximoAtivo = !editAtivo;
      await usuariosApi.atualizar(usuarioEditando.id, { ativo: proximoAtivo });
      setEditAtivo(proximoAtivo);
      await carregarUsuarios();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível atualizar status.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const excluirUsuario = async () => {
    if (!usuarioEditando) return;
    setProcessandoAcao(true);
    try {
      await usuariosApi.excluir(usuarioEditando.id);
      fecharEdicao();
      await carregarUsuarios();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível excluir usuário.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerInfo}>
              <View style={styles.headerTitleRow}>
                <Image source={require('../../assets/modulos/usuarios.png')} style={styles.headerTitleIcon} />
                <Text style={styles.headerTitle}>Usuários</Text>
              </View>
            </View>
            <Pressable style={styles.headerIconButton} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.headerIconText}>{'<'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.content, { paddingTop: contentTopOffset }]}>
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Acesso restrito</Text>
            <Text style={styles.warningText}>Apenas administrador pode acessar a gestão de usuários.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Image source={require('../../assets/modulos/usuarios.png')} style={styles.headerTitleIcon} />
              <Text style={styles.headerTitle}>Usuários</Text>
            </View>
          </View>
          <Pressable style={styles.headerIconButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.headerIconText}>{'<'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.headerAddButton} onPress={() => setModalNovo(true)}>
          <Text style={styles.headerAddIcon}>+</Text>
          <Text style={styles.headerAddText}>Novo Usuário</Text>
        </Pressable>
      </View>

      <View style={[styles.content, { paddingTop: contentTopOffset }]}>
        <View style={styles.filtersCard}>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome ou login"
            placeholderTextColor="#64748b"
            style={styles.input}
          />
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Perfil: {perfilLabel}</Text>
            <View style={styles.chipsRow}>
              <Pressable
                style={[styles.chip, filtroPerfil === '' && styles.chipActive]}
                onPress={() => setFiltroPerfil('')}
              >
                <Text style={[styles.chipText, filtroPerfil === '' && styles.chipTextActive]}>Todos</Text>
              </Pressable>
              {PERFIS.map((perfil) => (
                <Pressable
                  key={perfil}
                  style={[styles.chip, filtroPerfil === perfil && styles.chipActive]}
                  onPress={() => setFiltroPerfil(perfil)}
                >
                  <Text style={[styles.chipText, filtroPerfil === perfil && styles.chipTextActive]}>{perfil}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.chipsRow}>
              {(['todos', 'ativos', 'inativos'] as const).map((status) => (
                <Pressable
                  key={status}
                  style={[styles.chip, filtroAtivo === status && styles.chipActive]}
                  onPress={() => setFiltroAtivo(status)}
                >
                  <Text style={[styles.chipText, filtroAtivo === status && styles.chipTextActive]}>
                    {status === 'todos' ? 'Todos' : status === 'ativos' ? 'Ativos' : 'Inativos'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.totalText}>{total} usuário(s)</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={() => carregarUsuarios(true)}>
            <Text style={styles.refreshButtonText}>Atualizar</Text>
          </Pressable>
        </View>

        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={[styles.listWrapper, usuarios.length >= 4 && styles.listWrapperScroll]}>
            <FlatList
              data={usuarios}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregarUsuarios(true)} />}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.card} onPress={() => abrirEdicao(item)}>
                  <View style={styles.cardTop}>
                    <View style={styles.userInfo}>
                      {item.imagem_url ? (
                        <Image source={{ uri: item.imagem_url }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>{item.nome?.trim().charAt(0).toUpperCase() || 'U'}</Text>
                        </View>
                      )}
                      <View style={styles.userTextWrap}>
                        <Text style={styles.userName}>{item.nome}</Text>
                        <Text style={styles.userLogin}>@{item.login}</Text>
                      </View>
                    </View>
                    <Text style={[styles.statusBadge, item.ativo ? styles.statusActive : styles.statusBlocked]}>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.metaText}>Perfil: {item.perfil}</Text>
                    <Text style={styles.editLink}>Editar</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <Modal visible={modalNovo} transparent animationType="fade" onRequestClose={fecharNovo}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo Usuário</Text>
            <TextInput value={novoNome} onChangeText={setNovoNome} style={styles.input} placeholder="Nome" />
            <TextInput value={novoLogin} onChangeText={setNovoLogin} style={styles.input} placeholder="Login" />
            <TextInput
              value={novaSenha}
              onChangeText={setNovaSenha}
              style={styles.input}
              placeholder="Senha (mín. 6)"
              secureTextEntry
            />
            <TextInput
              value={novaImagemUrl}
              onChangeText={setNovaImagemUrl}
              style={styles.input}
              placeholder="URL da imagem (opcional)"
            />
            <View style={styles.chipsRow}>
              {PERFIS.map((perfil) => (
                <Pressable
                  key={perfil}
                  style={[styles.chip, novoPerfil === perfil && styles.chipActive]}
                  onPress={() => setNovoPerfil(perfil)}
                >
                  <Text style={[styles.chipText, novoPerfil === perfil && styles.chipTextActive]}>{perfil}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={fecharNovo} disabled={salvandoNovo}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={criarUsuario} disabled={salvandoNovo}>
                <Text style={styles.primaryBtnText}>{salvandoNovo ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(usuarioEditando)} transparent animationType="fade" onRequestClose={fecharEdicao}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Usuário</Text>
            <Text style={styles.modalSubtitle}>{usuarioEditando?.login}</Text>
            <TextInput value={editNome} onChangeText={setEditNome} style={styles.input} placeholder="Nome" />
            <TextInput
              value={editSenha}
              onChangeText={setEditSenha}
              style={styles.input}
              placeholder="Nova senha (opcional)"
              secureTextEntry
            />
            <TextInput
              value={editImagemUrl}
              onChangeText={setEditImagemUrl}
              style={styles.input}
              placeholder="URL da imagem (opcional)"
            />
            <View style={styles.chipsRow}>
              {PERFIS.map((perfil) => (
                <Pressable
                  key={perfil}
                  style={[styles.chip, editPerfil === perfil && styles.chipActive]}
                  onPress={() => setEditPerfil(perfil)}
                >
                  <Text style={[styles.chipText, editPerfil === perfil && styles.chipTextActive]}>{perfil}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={alternarBloqueio} disabled={processandoAcao}>
                <Text style={styles.secondaryBtnText}>{editAtivo ? 'Bloquear' : 'Desbloquear'}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, styles.deleteBtn]}
                onPress={() => setConfirmandoExclusao(true)}
                disabled={processandoAcao}
              >
                <Text style={styles.deleteBtnText}>Excluir</Text>
              </Pressable>
            </View>
            {confirmandoExclusao ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>Confirmar exclusão deste usuário?</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.secondaryBtn, styles.deleteBtn]}
                    onPress={excluirUsuario}
                    disabled={processandoAcao}
                  >
                    <Text style={styles.deleteBtnText}>{processandoAcao ? 'Excluindo...' : 'Confirmar'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => setConfirmandoExclusao(false)}
                    disabled={processandoAcao}
                  >
                    <Text style={styles.secondaryBtnText}>Cancelar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={fecharEdicao} disabled={salvandoEdicao}>
                <Text style={styles.secondaryBtnText}>Fechar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={salvarEdicao} disabled={salvandoEdicao}>
                <Text style={styles.primaryBtnText}>{salvandoEdicao ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e8f0' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12 },
  content: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerInfo: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  headerTitleIcon: { width: 36, height: 36 },
  headerTitle: { fontSize: 34 / 1.5, fontWeight: '800', color: '#0f172a' },
  headerIconButton: {
    minWidth: 82,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { color: '#1e3a8a', fontWeight: '800', fontSize: 15 },
  headerAddButton: {
    width: '100%',
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  headerAddIcon: { color: '#fff', fontSize: 14, fontWeight: '800' },
  headerAddText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  filtersCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fafc',
    padding: 10,
    rowGap: 8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    color: '#0f172a',
  },
  filterRow: { rowGap: 6 },
  filterLabel: { fontSize: 12, color: '#334155', fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { borderColor: '#3b82f6', backgroundColor: '#dbeafe' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#1d4ed8' },
  refreshButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  refreshButtonText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  totalText: { fontSize: 12, color: '#334155', fontWeight: '700' },
  listContent: { paddingBottom: 12, rowGap: 8 },
  listWrapper: {
    width: '100%',
  },
  listWrapperScroll: {
    maxHeight: 420,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    padding: 10,
    rowGap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#cbd5e1' },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#334155', fontWeight: '800' },
  userTextWrap: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  userLogin: { fontSize: 12, color: '#64748b', marginTop: 1 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  statusActive: { backgroundColor: '#dcfce7', borderColor: '#86efac', color: '#166534' },
  statusBlocked: { backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  editLink: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  centered: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 12 },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 10,
    marginBottom: 8,
  },
  errorText: { color: '#b91c1c', fontWeight: '600' },
  warningCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fef9c3',
    padding: 14,
    rowGap: 6,
  },
  warningTitle: { fontSize: 17, fontWeight: '800', color: '#713f12' },
  warningText: { color: '#713f12' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#fff',
    padding: 14,
    rowGap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { color: '#64748b', marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  primaryBtn: {
    minWidth: 100,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    minWidth: 100,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#334155', fontWeight: '700' },
  deleteBtn: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  deleteBtnText: { color: '#b91c1c', fontWeight: '700' },
  confirmBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    padding: 10,
    rowGap: 8,
  },
  confirmText: { color: '#9f1239', fontWeight: '700' },
});
