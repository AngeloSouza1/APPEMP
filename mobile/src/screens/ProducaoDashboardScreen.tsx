import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { produtosApi, relatoriosApi, RelatorioProducaoItem } from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';

const formatarNumero = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(valor || 0));

export default function ProducaoDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [carregandoTransicao, setCarregandoTransicao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RelatorioProducaoItem[]>([]);
  const [imagemPorProdutoId, setImagemPorProdutoId] = useState<Record<number, string>>({});

  const carregarProducao = async () => {
    setLoading(true);
    setErro(null);
    try {
      const [response, produtosResp] = await Promise.all([relatoriosApi.producao(), produtosApi.listar()]);
      setResultado(response.data);
      const imagensMap = produtosResp.data.reduce<Record<number, string>>((acc, produto) => {
        if (produto.id && produto.imagem_url) {
          acc[produto.id] = produto.imagem_url;
        }
        return acc;
      }, {});
      setImagemPorProdutoId(imagensMap);
    } catch {
      setErro('Não foi possível carregar o dashboard de produção.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProducao();
  }, []);

  const navegarComLoading = (acao: () => void) => {
    if (carregandoTransicao) return;
    setCarregandoTransicao(true);
    setTimeout(() => {
      acao();
      setCarregandoTransicao(false);
    }, 520);
  };

  const ordenado = useMemo(
    () => [...resultado].sort((a, b) => Number(b.quantidade_total || 0) - Number(a.quantidade_total || 0)),
    [resultado]
  );

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 18,
    insets.top + 6
  );
  const contentTopOffset = topSafeOffset + 98;

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/modulos/doce.png')} style={styles.headerIcon} resizeMode="contain" />
            <Text style={styles.headerTitle}>Dashboard Produção</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: contentTopOffset, paddingBottom: 108 + Math.max(insets.bottom, 8) },
        ]}
      >
        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
            <Pressable style={styles.retryButton} onPress={carregarProducao}>
              <Text style={styles.retryButtonText}>Atualizar</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Itens de Produção</Text>
              <Text style={styles.sectionMeta}>{ordenado.length} item(ns)</Text>
            </View>
            {ordenado.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum item encontrado.</Text>
            ) : (
              ordenado.map((item, index) => (
                <View key={`${item.produto_id}-${index}`} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View style={styles.itemIdentity}>
                      {imagemPorProdutoId[item.produto_id] ? (
                        <Image
                          source={{ uri: imagemPorProdutoId[item.produto_id] }}
                          style={styles.itemImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.itemImageFallback}>
                          <Image source={require('../../assets/modulos/produtos.png')} style={styles.itemImageFallbackIcon} resizeMode="contain" />
                        </View>
                      )}
                      <Text style={styles.itemTitle}>{item.produto_nome}</Text>
                    </View>
                    <Text style={styles.itemValue}>{formatarNumero(item.quantidade_total)}</Text>
                  </View>
                  {item.embalagem ? <Text style={styles.itemMeta}>{item.embalagem}</Text> : null}
                </View>
              ))
            )}
          </View>
        ) : null}
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
              const ativo = acao.key === 'producao';
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
  container: { flex: 1, backgroundColor: '#dbeafe' },
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
    justifyContent: 'space-between',
    columnGap: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10, flex: 1 },
  headerIcon: { width: 34, height: 34 },
  headerTitle: { fontSize: 27.72, fontWeight: '800', color: '#0f172a' },
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
  pressed: { opacity: 0.82 },
  content: { paddingHorizontal: 12, paddingBottom: 108, gap: 10 },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: { color: '#b91c1c', fontSize: 13.86, fontWeight: '700' },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.86,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13.86,
    fontWeight: '600',
    textAlign: 'center',
  },
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
    columnGap: 10,
  },
  sectionTitle: { color: '#0f172a', fontSize: 17.33, fontWeight: '800' },
  sectionMeta: { color: '#475569', fontSize: 13.86, fontWeight: '700' },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 9,
    gap: 4,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  itemIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#e2e8f0',
  },
  itemImageFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImageFallbackIcon: {
    width: 26,
    height: 26,
    opacity: 0.95,
  },
  itemTitle: { flex: 1, color: '#0f172a', fontSize: 16.17, fontWeight: '900' },
  itemValue: { color: '#1d4ed8', fontSize: 19.64, fontWeight: '900' },
  itemMeta: { color: '#475569', fontSize: 13.86, fontWeight: '600' },
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
