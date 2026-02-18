import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clientesApi, pedidosApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Pedido } from '../types/pedidos';
import { formatarData, formatarMoeda } from '../utils/format';

type Modulo = {
  key: string;
  titulo: string;
  descricao: string;
  sigla: string;
  route: 'Pedidos' | 'Clientes' | 'ClienteProdutos' | 'Produtos' | 'Rotas' | 'Remaneio' | 'Relatorios' | 'Historico' | 'Usuarios' | 'Modulo';
  imagem: ImageSourcePropType;
};

type HomeModuleNotification = 'novo' | 'atualizado';

const gerarAssinaturaPedidos = (total: number, pedidos: Pedido[]) => {
  const assinaturaItens = pedidos
    .map((pedido) =>
      [
        pedido.id,
        pedido.status || '',
        Number(pedido.valor_total || 0).toFixed(2),
        Number(pedido.qtd_trocas || 0),
        Boolean(pedido.tem_trocas) ? 1 : 0,
      ].join(':')
    )
    .join('|');
  return `${total}#${assinaturaItens}`;
};

const formatarQuantidadeEntrega = (value: number | string | null | undefined) => {
  const numero = Number(value ?? 0);
  if (!Number.isFinite(numero)) return String(value ?? '');
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
};

const MODULO_CORES: Record<
  string,
  {
    card: string;
    border: string;
    iconBg: string;
    iconBorder: string;
    title: string;
    desc: string;
  }
> = {
  pedidos: {
    card: '#eff6ff',
    border: '#bfdbfe',
    iconBg: '#dbeafe',
    iconBorder: '#93c5fd',
    title: '#1e3a8a',
    desc: '#334155',
  },
  clientes: {
    card: '#ecfeff',
    border: '#a5f3fc',
    iconBg: '#cffafe',
    iconBorder: '#67e8f9',
    title: '#0f766e',
    desc: '#334155',
  },
  'cliente-produtos': {
    card: '#f5f3ff',
    border: '#ddd6fe',
    iconBg: '#ede9fe',
    iconBorder: '#c4b5fd',
    title: '#5b21b6',
    desc: '#334155',
  },
  produtos: {
    card: '#fff7ed',
    border: '#fed7aa',
    iconBg: '#ffedd5',
    iconBorder: '#fdba74',
    title: '#9a3412',
    desc: '#44403c',
  },
  rotas: {
    card: '#ecfccb',
    border: '#bef264',
    iconBg: '#d9f99d',
    iconBorder: '#a3e635',
    title: '#3f6212',
    desc: '#3f3f46',
  },
  remaneio: {
    card: '#fff8eb',
    border: '#fcd9a5',
    iconBg: '#ffeacd',
    iconBorder: '#fbbf24',
    title: '#9a3412',
    desc: '#7c2d12',
  },
  relatorios: {
    card: '#fdf2f8',
    border: '#fbcfe8',
    iconBg: '#fce7f3',
    iconBorder: '#f9a8d4',
    title: '#9d174d',
    desc: '#4b5563',
  },
  historico: {
    card: '#f8fafc',
    border: '#cbd5e1',
    iconBg: '#e2e8f0',
    iconBorder: '#94a3b8',
    title: '#334155',
    desc: '#475569',
  },
  usuarios: {
    card: '#eef2ff',
    border: '#c7d2fe',
    iconBg: '#e0e7ff',
    iconBorder: '#a5b4fc',
    title: '#3730a3',
    desc: '#475569',
  },
  default: {
    card: '#ffffff',
    border: '#dbeafe',
    iconBg: '#dbeafe',
    iconBorder: '#bfdbfe',
    title: '#0f172a',
    desc: '#475569',
  },
};

const MODULOS: Modulo[] = [
  {
    key: 'pedidos',
    titulo: 'Pedidos',
    descricao: 'Visualize e gerencie pedidos',
    sigla: 'PD',
    route: 'Pedidos',
    imagem: require('../../assets/modulos/pedidos.png'),
  },
  {
    key: 'clientes',
    titulo: 'Clientes',
    descricao: 'Cadastro e consulta de clientes',
    sigla: 'CL',
    route: 'Clientes',
    imagem: require('../../assets/modulos/clientes.png'),
  },
  {
    key: 'cliente-produtos',
    titulo: 'Preços por Cliente',
    descricao: 'Produtos e valores por cliente',
    sigla: 'PC',
    route: 'ClienteProdutos',
    imagem: require('../../assets/modulos/precos-cliente.png'),
  },
  {
    key: 'produtos',
    titulo: 'Produtos',
    descricao: 'Cadastro e manutenção de produtos',
    sigla: 'PR',
    route: 'Produtos',
    imagem: require('../../assets/modulos/produtos.png'),
  },
  {
    key: 'rotas',
    titulo: 'Rotas',
    descricao: 'Organização das rotas de entrega',
    sigla: 'RT',
    route: 'Rotas',
    imagem: require('../../assets/modulos/rotas.png'),
  },
  {
    key: 'remaneio',
    titulo: 'Remaneio',
    descricao: 'Organize os pedidos por entrega',
    sigla: 'RM',
    route: 'Remaneio',
    imagem: require('../../assets/modulos/remaneio.png'),
  },
  {
    key: 'relatorios',
    titulo: 'Relatórios',
    descricao: 'Acompanhe produção e resultados',
    sigla: 'RL',
    route: 'Relatorios',
    imagem: require('../../assets/modulos/relatorios.png'),
  },
  {
    key: 'historico',
    titulo: 'Histórico',
    descricao: 'Consulta de extratos e movimentos',
    sigla: 'HS',
    route: 'Historico',
    imagem: require('../../assets/modulos/historico.png'),
  },
  {
    key: 'usuarios',
    titulo: 'Usuários',
    descricao: 'Controle de acessos e perfis',
    sigla: 'US',
    route: 'Usuarios',
    imagem: require('../../assets/modulos/usuarios.png'),
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const moduleColumns = 2;
  const [menuAberto, setMenuAberto] = useState(false);
  const [mostrarSobreApp, setMostrarSobreApp] = useState(false);
  const [acaoRodapeAtiva, setAcaoRodapeAtiva] = useState<'home' | 'pedidos' | 'producao' | 'relatorios'>('home');
  const [carregandoRodape, setCarregandoRodape] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(new Date());
  const [pedidosMotorista, setPedidosMotorista] = useState<Pedido[]>([]);
  const [clientesImagemMap, setClientesImagemMap] = useState<Record<number, string | null>>({});
  const [clientesLinkMap, setClientesLinkMap] = useState<Record<number, string | null>>({});
  const [carregandoDashboardMotorista, setCarregandoDashboardMotorista] = useState(false);
  const [erroDashboardMotorista, setErroDashboardMotorista] = useState<string | null>(null);
  const [notificacoesModulos, setNotificacoesModulos] = useState<{
    pedidos: HomeModuleNotification | null;
    remaneio: HomeModuleNotification | null;
  }>({
    pedidos: null,
    remaneio: null,
  });
  const homeSnapshotRef = useRef<{
    pedidosAssinatura: string;
    remaneioAssinatura: string;
    pedidosTotal: number;
    remaneioTotal: number;
  } | null>(null);
  const homeNotificacaoInicializadaRef = useRef(false);

  const carregarDashboardMotorista = useCallback(async () => {
    if (user?.perfil !== 'motorista') return;
    setCarregandoDashboardMotorista(true);
    try {
      const response = await pedidosApi.listarPaginado({
        page: 1,
        limit: 200,
        status: 'CONFERIR',
      });
      setPedidosMotorista(response.data.data);
      setErroDashboardMotorista(null);
    } catch {
      setErroDashboardMotorista('Não foi possível carregar os pedidos do motorista.');
    } finally {
      setUltimaSync(new Date());
      setCarregandoDashboardMotorista(false);
    }
  }, [user?.perfil]);

  useEffect(() => {
    if (user?.perfil !== 'motorista') return;
    carregarDashboardMotorista();
    const timer = setInterval(() => {
      carregarDashboardMotorista();
    }, 15000);
    return () => clearInterval(timer);
  }, [carregarDashboardMotorista, user?.perfil]);

  useEffect(() => {
    if (user?.perfil !== 'motorista') return;
    const carregarImagensClientes = async () => {
      try {
        const response = await clientesApi.listar();
        const mapaImagens = response.data.reduce<Record<number, string | null>>((acc, cliente) => {
          acc[cliente.id] = cliente.imagem_url || null;
          return acc;
        }, {});
        const mapaLinks = response.data.reduce<Record<number, string | null>>((acc, cliente) => {
          acc[cliente.id] = cliente.link || null;
          return acc;
        }, {});
        setClientesImagemMap(mapaImagens);
        setClientesLinkMap(mapaLinks);
      } catch {
        setClientesImagemMap({});
        setClientesLinkMap({});
      }
    };
    carregarImagensClientes();
  }, [user?.perfil]);

  const abrirLinkCliente = useCallback(async (rawLink: string) => {
    const cleaned = rawLink.trim();
    if (!cleaned) return;
    const url = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    try {
      const podeAbrir = await Linking.canOpenURL(url);
      if (!podeAbrir) {
        Alert.alert('Link inválido', 'Não foi possível abrir a localização deste cliente.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o link de localização.');
    }
  }, []);

  const carregarNotificacoesModulos = useCallback(async () => {
    if (!user || user.perfil === 'motorista') return;
    try {
      const [pedidosResp, remaneioResp] = await Promise.all([
        pedidosApi.listarPaginado({
          page: 1,
          limit: 40,
          status: 'EM_ESPERA',
        }),
        pedidosApi.listarPaginado({
          page: 1,
          limit: 40,
          status: 'CONFERIR',
        }),
      ]);

      const pedidosTotal = Number(pedidosResp.data.total || 0);
      const remaneioTotal = Number(remaneioResp.data.total || 0);
      const pedidosAssinatura = gerarAssinaturaPedidos(pedidosTotal, pedidosResp.data.data);
      const remaneioAssinatura = gerarAssinaturaPedidos(remaneioTotal, remaneioResp.data.data);

      const anterior = homeSnapshotRef.current;

      if (!homeNotificacaoInicializadaRef.current || !anterior) {
        setNotificacoesModulos({ pedidos: null, remaneio: null });
        homeNotificacaoInicializadaRef.current = true;
      } else {
        const proximaNotificacaoPedidos =
          anterior.pedidosAssinatura !== pedidosAssinatura
            ? pedidosTotal > anterior.pedidosTotal
              ? 'novo'
              : 'atualizado'
            : null;

        const proximaNotificacaoRemaneio =
          anterior.remaneioAssinatura !== remaneioAssinatura
            ? remaneioTotal > anterior.remaneioTotal
              ? 'novo'
              : 'atualizado'
            : null;

        setNotificacoesModulos((prev) => {
          return {
            pedidos: proximaNotificacaoPedidos ?? prev.pedidos,
            remaneio: proximaNotificacaoRemaneio ?? prev.remaneio,
          };
        });
      }

      homeSnapshotRef.current = {
        pedidosAssinatura,
        remaneioAssinatura,
        pedidosTotal,
        remaneioTotal,
      };
    } catch {
      // Mantém silencioso para não poluir a Home quando a API oscilar.
    } finally {
      setUltimaSync(new Date());
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user || user.perfil === 'motorista') return;
      carregarNotificacoesModulos();
      const timer = setInterval(() => {
        carregarNotificacoesModulos();
      }, 15000);
      return () => clearInterval(timer);
    }, [carregarNotificacoesModulos, user])
  );

  const modulosVisiveis = useMemo(() => {
    if (!user) return [];
    if (user.perfil === 'vendedor') return MODULOS.filter((modulo) => modulo.key === 'pedidos');
    if (user.perfil === 'motorista') return [];
    if (user.perfil === 'backoffice') return MODULOS.filter((modulo) => modulo.key !== 'usuarios');
    return MODULOS.filter((modulo) => modulo.key !== 'usuarios');
  }, [user]);

  const podeAcessarUsuarios = useMemo(() => {
    if (!user) return false;
    return user.perfil !== 'vendedor' && user.perfil !== 'motorista' && user.perfil !== 'backoffice';
  }, [user]);

  const resumoMotorista = useMemo(() => {
    const totalPedidos = pedidosMotorista.length;
    const valorTotal = pedidosMotorista.reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0);
    const pedidosComTroca = pedidosMotorista.filter(
      (pedido) => Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0
    ).length;
    const pedidosOrdenados = [...pedidosMotorista].sort((a, b) => {
      const diff = new Date(b.data).getTime() - new Date(a.data).getTime();
      if (diff !== 0) return diff;
      return b.id - a.id;
    });

    return { totalPedidos, valorTotal, pedidosComTroca, pedidosOrdenados };
  }, [pedidosMotorista]);

  const abrirModulo = (modulo: Modulo) => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    if (modulo.key === 'pedidos') {
      setNotificacoesModulos((prev) => ({ ...prev, pedidos: null }));
    }
    if (modulo.key === 'remaneio') {
      setNotificacoesModulos((prev) => ({ ...prev, remaneio: null }));
    }
    if (modulo.route === 'Pedidos') {
      navigation.navigate('Pedidos');
      return;
    }
    if (modulo.route === 'Clientes') {
      navigation.navigate('Clientes');
      return;
    }
    if (modulo.route === 'Produtos') {
      navigation.navigate('Produtos');
      return;
    }
    if (modulo.route === 'ClienteProdutos') {
      navigation.navigate('ClienteProdutos');
      return;
    }
    if (modulo.route === 'Rotas') {
      navigation.navigate('Rotas');
      return;
    }
    if (modulo.route === 'Remaneio') {
      navigation.navigate('Remaneio');
      return;
    }
    if (modulo.route === 'Relatorios') {
      navigation.navigate('Relatorios');
      return;
    }
    if (modulo.route === 'Historico') {
      navigation.navigate('Historico');
      return;
    }
    if (modulo.route === 'Usuarios') {
      navigation.navigate('Usuarios');
      return;
    }
    navigation.navigate('Modulo', { modulo: modulo.key, titulo: modulo.titulo });
  };

  const sair = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    logout();
  };

  const abrirUsuarios = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    navigation.navigate('Usuarios');
  };

  const abrirSobreApp = () => {
    setMostrarSobreApp(true);
  };

  const irParaNovoPedido = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    navigation.navigate('PedidoNovo');
  };

  const irParaRelatorioProducao = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    navigation.navigate('ProducaoDashboard');
  };

  const irParaInicio = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
  };

  const irParaRelatorios = () => {
    setMenuAberto(false);
    setMostrarSobreApp(false);
    navigation.navigate('EntregasDashboard');
  };

  const acoesRodape = [
    {
      key: 'home',
      label: 'Visão Geral',
      imagem: require('../../assets/modulos/pagina-principal1.png'),
      onPress: irParaInicio,
    },
    {
      key: 'pedidos',
      label: 'Adicionar',
      imagem: require('../../assets/modulos/adicionar-pedido.png'),
      onPress: irParaNovoPedido,
    },
    {
      key: 'producao',
      label: 'Produção',
      imagem: require('../../assets/modulos/doce.png'),
      onPress: irParaRelatorioProducao,
    },
    {
      key: 'relatorios',
      label: 'Entregas',
      imagem: require('../../assets/modulos/relatorio-rotas1.png'),
      onPress: irParaRelatorios,
    },
  ] as const;

  const executarAcaoRodape = (acao: (typeof acoesRodape)[number]) => {
    if (carregandoRodape) return;
    setAcaoRodapeAtiva(acao.key);
    setCarregandoRodape(true);
    setTimeout(() => {
      acao.onPress();
      setCarregandoRodape(false);
    }, 700);
  };

  const toggleMenu = () => {
    setMenuAberto((prev) => {
      const proximo = !prev;
      if (!proximo) setMostrarSobreApp(false);
      return proximo;
    });
  };

  const ambiente = process.env.EXPO_PUBLIC_APP_ENV || 'Produção';
  const versao = 'v0.1.1';
  const build = `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(
    new Date().getDate()
  ).padStart(2, '0')}`;
  const statusApi = user?.perfil === 'motorista' && erroDashboardMotorista ? 'Offline' : 'Online';
  const ultimaSyncTexto = ultimaSync
    ? `${String(ultimaSync.getHours()).padStart(2, '0')}:${String(ultimaSync.getMinutes()).padStart(2, '0')}`
    : '--:--';

  const telaPequena = height <= 760;
  const telaGrande = height >= 900;

  const ajuste = {
    appBarMarginBottom: telaPequena ? 10 : 12,
    heroPaddingVertical: telaPequena ? 9 : telaGrande ? 12 : 11,
    heroMarginBottom: telaPequena ? 6 : 8,
    heroTitleSize: telaPequena ? 15 : 16,
    heroTextSize: telaPequena ? 11 : 12,
    heroTextMarginTop: telaPequena ? 2 : 3,
    modulesHeaderMarginBottom: telaPequena ? 5 : 6,
    sectionTitleSize: telaPequena ? 17 : 18,
    modulesListPaddingBottom: telaPequena ? 4 : telaGrande ? 10 : 6,
    modulesListRowGap: telaPequena ? 4 : telaGrande ? 6 : 5,
    moduleRowGap: telaPequena ? 5 : 6,
    moduleCardPadding: telaPequena ? 11 : telaGrande ? 14 : 13,
    moduleCardMarginBottom: telaPequena ? 4 : 5,
    moduleCardMinHeight: telaPequena ? 116 : telaGrande ? 136 : 128,
    moduleTopGap: telaPequena ? 9 : 10,
    moduleTopMarginBottom: telaPequena ? 7 : 9,
    moduleIconSize: telaPequena ? 50 : telaGrande ? 58 : 54,
    moduleIconImageSize: telaPequena ? 34 : telaGrande ? 40 : 38,
    moduleTitleSize: telaPequena ? 15 : 16,
    moduleTitleLineHeight: telaPequena ? 19 : 20,
    moduleDescSize: telaPequena ? 12 : 13,
    moduleDescLineHeight: telaPequena ? 16 : 17,
    footerPaddingVertical: telaPequena ? 8 : 10,
    footerMarginTop: telaPequena ? 1 : 2,
    footerButtonSize: telaPequena ? 11 : 12,
    footerIconSize: telaPequena ? 20 : 22,
  } as const;

  const rodapeAcoes = (
    <View
      style={[
        styles.footerCard,
        {
          paddingTop: ajuste.footerPaddingVertical,
          paddingBottom: ajuste.footerPaddingVertical + Math.max(insets.bottom, 6),
          marginTop: ajuste.footerMarginTop,
        },
      ]}
    >
      <View style={styles.footerActionsRow}>
        {acoesRodape.map((acao) => {
          const ativo = acaoRodapeAtiva === acao.key;
          return (
          <Pressable
            key={acao.key}
            style={[styles.footerActionItem, ativo && styles.footerActionItemActive]}
            onPress={() => executarAcaoRodape(acao)}
            disabled={carregandoRodape}
          >
            <Image
              source={acao.imagem}
              style={[
                styles.footerActionImage,
                ativo && styles.footerActionImageActive,
                { width: ajuste.footerIconSize + 4, height: ajuste.footerIconSize + 4 },
              ]}
              resizeMode="contain"
            />
            <Text
              style={[styles.footerActionText, ativo && styles.footerActionTextActive, { fontSize: ajuste.footerButtonSize }]}
            >
              {acao.label}
            </Text>
            <View style={[styles.footerActionDot, ativo && styles.footerActionDotActive]} />
          </Pressable>
          );
        })}
      </View>
    </View>
  );

  const topSafeOffset = Math.max(
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20,
    insets.top + 10
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <View style={[styles.content, { paddingTop: topSafeOffset }]}>
        <View style={[styles.appBar, { marginBottom: ajuste.appBarMarginBottom }]}>
          <View style={styles.appBarLeft}>
            <View style={styles.avatar}>
              {user?.imagem_url ? (
                <Image source={{ uri: user.imagem_url }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{(user?.nome || 'U').trim().charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerEyebrow}>APPEMP</Text>
              <Text style={styles.headerTitle}>{user?.nome || 'Usuário'}</Text>
              <Text style={styles.headerSubtitle}>Perfil: {user?.perfil || '-'}</Text>
            </View>
          </View>
          <View style={styles.menuWrap}>
            <Pressable style={styles.menuButton} onPress={toggleMenu}>
              <View style={styles.menuIcon} aria-hidden>
                <View style={styles.menuIconLine} />
                <View style={styles.menuIconLine} />
                <View style={styles.menuIconLine} />
              </View>
            </Pressable>
            {menuAberto ? (
              <View style={styles.menuDropdown}>
                {podeAcessarUsuarios ? (
                  <Pressable style={styles.menuLink} onPress={abrirUsuarios}>
                    <View style={styles.menuLinkIconWrap}>
                      <Text style={styles.menuLinkIcon}>👥</Text>
                    </View>
                    <Text style={styles.menuLinkText}>Usuários</Text>
                    <Text style={styles.menuLinkChevron}>{'▸'}</Text>
                  </Pressable>
                ) : null}
                {user?.perfil !== 'motorista' ? (
                  <Pressable
                    style={[styles.menuLink, mostrarSobreApp && styles.menuLinkActive]}
                    onPress={abrirSobreApp}
                  >
                    <View style={styles.menuLinkIconWrap}>
                      <Text style={styles.menuLinkIcon}>ℹ️</Text>
                    </View>
                    <Text style={styles.menuLinkText}>Sobre App</Text>
                    <Text style={styles.menuLinkChevron}>{'▸'}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.menuLinkDanger} onPress={sair}>
                  <View style={styles.menuLinkDangerIconWrap}>
                    <Text style={styles.menuLinkDangerIcon}>↩</Text>
                  </View>
                  <Text style={styles.menuLinkDangerText}>Sair</Text>
                  <Text style={styles.menuLinkDangerChevron}>{'▸'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {user?.perfil === 'motorista' ? (
          <View style={styles.driverLayout}>
            <ScrollView contentContainerStyle={styles.driverContent}>
              <View style={styles.driverBanner}>
                <Text style={styles.driverBannerText}>Dashboard do motorista (status Conferir)</Text>
              </View>

              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, styles.kpiBlue]}>
                  <Text style={styles.kpiLabel}>Pedidos</Text>
                  <Text style={styles.kpiValue}>{resumoMotorista.totalPedidos}</Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiViolet]}>
                  <Text style={styles.kpiLabel}>Com troca</Text>
                  <Text style={styles.kpiValue}>{resumoMotorista.pedidosComTroca}</Text>
                </View>
              </View>

              {carregandoDashboardMotorista ? (
                <View style={styles.centerCard}>
                  <ActivityIndicator />
                </View>
              ) : erroDashboardMotorista ? (
                <View style={styles.centerCard}>
                  <Text style={styles.errorText}>{erroDashboardMotorista}</Text>
                  <Pressable style={styles.retryButton} onPress={carregarDashboardMotorista}>
                    <Text style={styles.retryButtonText}>Atualizar</Text>
                  </Pressable>
                </View>
              ) : resumoMotorista.pedidosOrdenados.length === 0 ? (
                <View style={styles.centerCard}>
                  <Text style={styles.emptyText}>Nenhum pedido no remaneio para entrega.</Text>
                </View>
              ) : (
                <View style={styles.listCard}>
                  <Text style={styles.sectionTitle}>Pedidos para Entregar</Text>
                  {resumoMotorista.pedidosOrdenados.map((pedido, index) => (
                    <Pressable
                      key={`pedido-${pedido.id}`}
                      style={styles.deliveryItem}
                      onPress={() => navigation.navigate('PedidoDetalhe', { id: pedido.id })}
                    >
                      <View style={styles.deliveryOrderBadge}>
                        <Text style={styles.deliveryOrderBadgeText}>{index + 1}</Text>
                      </View>
                      {(Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0) ? (
                        <View style={styles.deliveryTrocaBadge}>
                          <Text style={styles.deliveryTrocaBadgeText}>Tem trocas</Text>
                        </View>
                      ) : null}
                      <View style={styles.deliveryHeader}>
                        <View style={styles.deliveryClientRow}>
                          <View style={styles.deliveryClientAvatar}>
                            {pedido.cliente_id && clientesImagemMap[pedido.cliente_id] ? (
                              <Image
                                source={{ uri: clientesImagemMap[pedido.cliente_id] as string }}
                                style={styles.deliveryClientAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.deliveryClientAvatarFallback}>
                                <Text style={styles.deliveryClientAvatarFallbackText}>
                                  {(pedido.cliente_nome || 'C').trim().charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.deliveryClient}>{pedido.cliente_nome}</Text>
                        </View>
                      </View>
                      <Text style={styles.deliveryMeta}>
                        {formatarData(pedido.data)} • <Text style={styles.deliveryMetaValue}>{formatarMoeda(pedido.valor_total)}</Text>
                      </Text>
                      <View style={styles.itemsList}>
                        {pedido.itens?.slice(0, 3).map((item, idx) => (
                          <View key={`${pedido.id}-${item.produto_id}-${idx}`} style={styles.itemRow}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.produto_nome || item.codigo_produto || `Produto ${item.produto_id}`}
                            </Text>
                            <Text style={styles.itemQty}>
                              {formatarQuantidadeEntrega(item.quantidade)} {item.embalagem || ''}
                            </Text>
                          </View>
                        ))}
                        {(pedido.itens?.length || 0) > 3 ? (
                          <Text style={styles.itemMore}>+ {pedido.itens.length - 3} item(ns)</Text>
                        ) : null}
                      </View>
                      {pedido.cliente_id && clientesLinkMap[pedido.cliente_id] ? (
                        <Pressable
                          style={styles.locationLinkWrap}
                          onPress={(event) => {
                            event.stopPropagation();
                            abrirLinkCliente(clientesLinkMap[pedido.cliente_id] as string);
                          }}
                        >
                          <Text style={styles.locationLinkIcon}>📍</Text>
                          <Text style={styles.locationLinkText}>Abrir localização</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        ) : (
          <FlatList
            key={`modules-${moduleColumns}-${user?.perfil ?? 'anon'}`}
            data={modulosVisiveis}
            numColumns={moduleColumns}
            scrollEnabled={false}
            keyExtractor={(item) => item.key}
            contentContainerStyle={[
              styles.modulesList,
              {
                paddingBottom: ajuste.modulesListPaddingBottom,
                rowGap: ajuste.modulesListRowGap,
              },
            ]}
            columnWrapperStyle={[styles.moduleRow, { columnGap: ajuste.moduleRowGap }]}
            ListFooterComponentStyle={styles.modulesFooter}
            renderItem={({ item }) => {
              const tema = MODULO_CORES[item.key] ?? MODULO_CORES.default;
              const isRemaneio = item.key === 'remaneio';
              const isRelatorios = item.key === 'relatorios';
              const notificacaoModulo =
                item.key === 'pedidos'
                  ? notificacoesModulos.pedidos
                  : item.key === 'remaneio'
                    ? notificacoesModulos.remaneio
                    : null;
              return (
              <Pressable
                style={[
                  styles.moduleCard,
                  isRemaneio && styles.moduleCardHighlight,
                  isRelatorios && styles.moduleCardHighlightReports,
                  {
                    backgroundColor: tema.card,
                    borderColor: tema.border,
                    padding: ajuste.moduleCardPadding,
                    marginBottom: ajuste.moduleCardMarginBottom,
                    minHeight: ajuste.moduleCardMinHeight,
                  },
                ]}
                onPress={() => abrirModulo(item)}
              >
                {notificacaoModulo ? (
                  <View
                    style={[
                      styles.moduleNotifBadgeFloating,
                      notificacaoModulo === 'novo' ? styles.moduleNotifBadgeNew : styles.moduleNotifBadgeUpdated,
                    ]}
                  >
                    <Text
                      style={[
                        styles.moduleNotifBadgeText,
                        notificacaoModulo === 'novo'
                          ? styles.moduleNotifBadgeTextNew
                          : styles.moduleNotifBadgeTextUpdated,
                      ]}
                    >
                      {notificacaoModulo === 'novo' ? 'Novo' : 'Atualizado'}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.moduleTopRow,
                    { columnGap: ajuste.moduleTopGap, marginBottom: ajuste.moduleTopMarginBottom },
                  ]}
                >
                  <View
                    style={[
                      styles.moduleIconWrap,
                      isRemaneio && styles.moduleIconWrapHighlight,
                      isRelatorios && styles.moduleIconWrapHighlightReports,
                      {
                        backgroundColor: tema.iconBg,
                        borderColor: tema.iconBorder,
                        width: ajuste.moduleIconSize,
                        height: ajuste.moduleIconSize,
                      },
                    ]}
                  >
                    <Image
                      source={item.imagem}
                      style={[
                        styles.moduleIconImage,
                        isRemaneio && styles.moduleIconImageHighlight,
                        isRelatorios && styles.moduleIconImageHighlightReports,
                        { width: ajuste.moduleIconImageSize, height: ajuste.moduleIconImageSize },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                  <Text
                    style={[
                      styles.moduleTitle,
                      { color: tema.title, fontSize: ajuste.moduleTitleSize, lineHeight: ajuste.moduleTitleLineHeight },
                    ]}
                  >
                    {item.titulo}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.moduleDesc,
                    { color: tema.desc, fontSize: ajuste.moduleDescSize, lineHeight: ajuste.moduleDescLineHeight },
                  ]}
                >
                  {item.descricao}
                </Text>
              </Pressable>
            );
            }}
            ListHeaderComponent={
              <View style={styles.modulesHeaderWrap}>
                <View
                  style={[
                    styles.modulesHero,
                    { paddingVertical: ajuste.heroPaddingVertical, marginBottom: ajuste.heroMarginBottom },
                  ]}
                >
                  <Text style={[styles.modulesHeroTitle, { fontSize: ajuste.heroTitleSize }]}>Módulos do Sistema</Text>
                  <Text
                    style={[
                      styles.modulesHeroText,
                      { fontSize: ajuste.heroTextSize, marginTop: ajuste.heroTextMarginTop },
                    ]}
                  >
                    Acesse rapidamente as principais áreas do app.
                  </Text>
                </View>
                <View style={[styles.modulesHeader, { marginBottom: ajuste.modulesHeaderMarginBottom }]}>
                  <Text style={[styles.sectionTitle, { fontSize: ajuste.sectionTitleSize }]}>Acessos Rápidos</Text>
                  <Text style={styles.modulesCount}>{modulosVisiveis.length} módulos</Text>
                </View>
              </View>
            }
            ListFooterComponent={rodapeAcoes}
          />
        )}
      </View>
      <Modal transparent visible={mostrarSobreApp} animationType="fade" onRequestClose={() => setMostrarSobreApp(false)}>
        <View style={styles.loadingOverlay}>
          <View style={styles.aboutModalCard}>
            <View style={styles.aboutModalHeader}>
              <Text style={styles.aboutModalTitle}>Sobre App</Text>
              <Pressable style={styles.aboutModalClose} onPress={() => setMostrarSobreApp(false)}>
                <Text style={styles.aboutModalCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.aboutModalBody}>
              <Text style={styles.menuAboutText}>
                Ambiente: <Text style={styles.menuAboutValue}>{ambiente}</Text>
              </Text>
              <Text style={styles.menuAboutText}>
                Versão: <Text style={styles.menuAboutValue}>{versao}</Text>
              </Text>
              <Text style={styles.menuAboutText}>
                Build: <Text style={styles.menuAboutValue}>{build}</Text>
              </Text>
              <Text style={styles.menuAboutText}>
                API:{' '}
                <Text style={statusApi === 'Online' ? styles.menuAboutOk : styles.menuAboutOffline}>
                  {statusApi}
                </Text>
              </Text>
              <Text style={styles.menuAboutText}>
                Última sync: <Text style={styles.menuAboutValue}>{ultimaSyncTexto}</Text>
              </Text>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={carregandoRodape} animationType="fade">
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
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  appBar: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    columnGap: 12,
    zIndex: 5,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    flex: 1,
  },
  modulesHeaderWrap: {
    width: '100%',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 19,
  },
  headerInfo: {
    flex: 1,
  },
  headerEyebrow: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  headerSubtitle: {
    color: '#334155',
    marginTop: 1,
    fontSize: 12,
  },
  menuWrap: {
    position: 'relative',
  },
  menuButton: {
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    width: 16,
    rowGap: 3,
  },
  menuIconLine: {
    width: '100%',
    height: 2,
    borderRadius: 99,
    backgroundColor: '#3730a3',
  },
  menuDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 188,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  menuLinkDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  menuLinkDangerIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuLinkDangerIcon: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: '800',
  },
  menuLinkDangerText: {
    color: '#9f1239',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  menuLinkDangerChevron: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '800',
  },
  menuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 6,
  },
  menuLinkActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#bfdbfe',
  },
  menuLinkIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuLinkIcon: {
    fontSize: 12,
  },
  menuLinkText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  menuLinkChevron: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  aboutModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  aboutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutModalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  aboutModalClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutModalCloseText: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  aboutModalBody: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    rowGap: 2,
  },
  menuAboutCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
    rowGap: 2,
  },
  menuAboutText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  menuAboutValue: {
    color: '#0f172a',
    fontWeight: '700',
  },
  menuAboutOk: {
    color: '#15803d',
    fontWeight: '700',
  },
  menuAboutOffline: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  modulesHero: {
    backgroundColor: 'rgba(30,64,175,0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  modulesHeroTitle: {
    color: '#eff6ff',
    fontSize: 16,
    fontWeight: '800',
  },
  modulesHeroText: {
    color: '#dbeafe',
    marginTop: 3,
    fontSize: 12,
  },
  modulesHeader: {
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modulesCount: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  modulesList: {
    paddingBottom: 6,
    rowGap: 5,
  },
  modulesFooter: {
    marginTop: 2,
  },
  moduleRow: {
    columnGap: 6,
  },
  moduleCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 5,
    minHeight: 118,
    position: 'relative',
  },
  moduleCardHighlight: {
    shadowColor: '#b45309',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  moduleCardHighlightReports: {
    shadowColor: '#9d174d',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  moduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 9,
    marginBottom: 8,
  },
  moduleIconWrap: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  moduleIconWrapHighlight: {
    borderWidth: 1.3,
  },
  moduleIconWrapHighlightReports: {
    borderWidth: 1.3,
  },
  moduleIconImage: {
    width: 36,
    height: 36,
  },
  moduleIconImageHighlight: {
    transform: [{ scale: 1.08 }],
  },
  moduleIconImageHighlightReports: {
    transform: [{ scale: 1.06 }],
  },
  moduleTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  moduleNotifBadgeFloating: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 3,
  },
  moduleNotifBadgeNew: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },
  moduleNotifBadgeUpdated: {
    borderColor: '#93c5fd',
    backgroundColor: '#dbeafe',
  },
  moduleNotifBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  moduleNotifBadgeTextNew: {
    color: '#166534',
  },
  moduleNotifBadgeTextUpdated: {
    color: '#1d4ed8',
  },
  moduleDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverLayout: {
    flex: 1,
  },
  driverContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 6,
  },
  driverBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 10,
  },
  driverBannerText: {
    color: '#1e3a8a',
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  kpiBlue: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  kpiViolet: {
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
  },
  kpiFull: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  kpiLabel: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  kpiValue: {
    marginTop: 2,
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 22,
  },
  footerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 9,
    paddingVertical: 9,
    marginTop: 2,
    marginBottom: 0,
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
  footerActionText: {
    color: '#1e3a8a',
    fontWeight: '700',
    textAlign: 'center',
  },
  footerActionTextActive: {
    color: '#1e40af',
    fontWeight: '800',
  },
  footerActionImage: {
    opacity: 0.9,
  },
  footerActionImageActive: {
    opacity: 1,
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
  centerCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyText: {
    color: '#475569',
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    gap: 10,
  },
  deliveryItem: {
    position: 'relative',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef6ff',
    padding: 10,
    paddingTop: 18,
    gap: 4,
  },
  deliveryOrderBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 1,
    zIndex: 2,
  },
  deliveryOrderBadgeText: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '900',
  },
  deliveryTrocaBadge: {
    position: 'absolute',
    top: 32,
    right: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fb7185',
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 7,
    paddingVertical: 1,
    zIndex: 2,
  },
  deliveryTrocaBadgeText: {
    color: '#be123c',
    fontSize: 10,
    fontWeight: '900',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  deliveryClientRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  deliveryClientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#e2e8f0',
  },
  deliveryClientAvatarImage: {
    width: '100%',
    height: '100%',
  },
  deliveryClientAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryClientAvatarFallbackText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 13,
  },
  deliveryClient: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
  },
  deliveryId: {
    color: '#334155',
    fontWeight: '700',
  },
  deliveryMeta: {
    color: '#475569',
    fontSize: 12,
  },
  deliveryMetaValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  itemsList: {
    marginTop: 6,
    gap: 6,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  itemName: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '700',
  },
  itemQty: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  itemMore: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  locationLinkWrap: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationLinkIcon: {
    fontSize: 12,
    lineHeight: 14,
  },
  locationLinkText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 13,
  },
});
