import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatePickerModal from '../components/DatePickerModal';
import {
  relatoriosApi,
  RelatorioProducaoItem,
  RelatorioProdutosPorRotaItem,
  RelatorioRotaDetalhadoItem,
  RelatorioTopClienteItem,
  RelatorioTrocaItem,
} from '../api/services';
import { RootStackParamList } from '../navigation/RootNavigator';
import { formatarData, formatarMoeda } from '../utils/format';
import { limparTimestampRefreshRelatorios, lerTimestampRefreshRelatorios } from '../utils/relatoriosRefresh';

type SubRelatorio = 'producao' | 'rotas' | 'produtos-rota' | 'top-clientes' | 'trocas';
type StatusFiltro = 'EM_ESPERA' | 'CONFERIR' | 'EFETIVADO' | 'CANCELADO';
const RELATORIOS_FILTRO_STORAGE_KEY = '@appemp:relatorios_filtro_periodo';
const RELATORIOS_RESULTADOS_STORAGE_KEY = '@appemp:relatorios_resultados';

const STATUS_OPTIONS: Array<{ value: StatusFiltro; label: string }> = [
  { value: 'EM_ESPERA', label: 'Em espera' },
  { value: 'CONFERIR', label: 'Conferir' },
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];
const STATUS_VALUES = STATUS_OPTIONS.map((item) => item.value);

const STATUS_THEME: Record<string, { bg: string; border: string; text: string; label: string }> = {
  EM_ESPERA: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'Em espera' },
  CONFERIR: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Conferir' },
  EFETIVADO: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', label: 'Efetivado' },
  CANCELADO: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Cancelado' },
};

const TAB_OPTIONS: Array<{
  key: SubRelatorio;
  label: string;
  icon: string;
  tone: { bg: string; border: string; text: string };
}> = [
  {
    key: 'producao',
    label: 'Produção',
    icon: 'PR',
    tone: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a' },
  },
  {
    key: 'rotas',
    label: 'Rotas',
    icon: 'RT',
    tone: { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
  },
  {
    key: 'produtos-rota',
    label: 'Produtos/Rota',
    icon: 'P/R',
    tone: { bg: '#ecfdf5', border: '#bbf7d0', text: '#065f46' },
  },
  {
    key: 'top-clientes',
    label: 'Top Clientes',
    icon: 'TOP',
    tone: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  },
  {
    key: 'trocas',
    label: 'Trocas',
    icon: 'TR',
    tone: { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
  },
];

const formatarNumero = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(valor || 0));

const parseBrToIso = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const agruparRotasDetalhado = (rows: RelatorioRotaDetalhadoItem[]) => {
  const mapa = new Map<
    number,
    {
      rota_id: number;
      rota_nome: string;
      clientes: Map<number, string>;
      pedidos: Map<number, number>;
      pedidosDetalhes: Map<
        number,
        {
          pedido_id: number;
          pedido_data: string;
          pedido_status: string;
          pedido_valor_total: number;
          cliente_nome: string;
          produtos: Map<
            string,
            {
              codigo_produto: string;
              produto_nome: string;
              embalagem?: string | null;
              quantidade: number;
              valor_total_item: number;
            }
          >;
        }
      >;
      trocas: number;
    }
  >();

  rows.forEach((row) => {
    const key = row.rota_id;
    if (!mapa.has(key)) {
      mapa.set(key, {
        rota_id: row.rota_id,
        rota_nome: row.rota_nome,
        clientes: new Map<number, string>(),
        pedidos: new Map<number, number>(),
        pedidosDetalhes: new Map(),
        trocas: 0,
      });
    }

    const item = mapa.get(key)!;
    if (!item.clientes.has(row.cliente_id)) {
      item.clientes.set(row.cliente_id, row.cliente_nome);
    }
    if (!item.pedidos.has(row.pedido_id)) {
      item.pedidos.set(row.pedido_id, Number(row.pedido_valor_total || 0));
      item.pedidosDetalhes.set(row.pedido_id, {
        pedido_id: row.pedido_id,
        pedido_data: row.pedido_data,
        pedido_status: row.pedido_status,
        pedido_valor_total: Number(row.pedido_valor_total || 0),
        cliente_nome: row.cliente_nome,
        produtos: new Map(),
      });
      item.trocas += Number(row.qtd_trocas || 0);
    }

    const pedido = item.pedidosDetalhes.get(row.pedido_id);
    if (pedido && row.produto_id && row.produto_nome) {
      const produtoKey = `${row.produto_id}`;
      const qtd = Number(row.quantidade || 0);
      const existente = pedido.produtos.get(produtoKey);
      if (existente) {
        existente.quantidade += qtd;
        existente.valor_total_item += Number(row.valor_total_item || 0);
      } else {
        pedido.produtos.set(produtoKey, {
          codigo_produto: row.codigo_produto || `#${row.produto_id}`,
          produto_nome: row.produto_nome,
          embalagem: row.embalagem || null,
          quantidade: qtd,
          valor_total_item: Number(row.valor_total_item || 0),
        });
      }
    }
  });

  return [...mapa.values()]
    .map((item) => ({
      ...item,
      total_clientes: item.clientes.size,
      total_pedidos: item.pedidos.size,
      clientes_nomes: [...item.clientes.values()].sort((a, b) => a.localeCompare(b)),
      pedidos_detalhes: [...item.pedidosDetalhes.values()].sort(
        (a, b) => new Date(b.pedido_data).getTime() - new Date(a.pedido_data).getTime()
      ),
      valor_total: [...item.pedidos.values()].reduce((acc, value) => acc + value, 0),
    }))
    .sort((a, b) => a.rota_nome.localeCompare(b.rota_nome));
};

export default function RelatoriosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [subRelatorio, setSubRelatorio] = useState<SubRelatorio>('producao');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltros, setStatusFiltros] = useState<StatusFiltro[]>(['EM_ESPERA']);
  const [showDateInicio, setShowDateInicio] = useState(false);
  const [showDateFim, setShowDateFim] = useState(false);
  const [lembrarPeriodo, setLembrarPeriodo] = useState(false);
  const [rotaExpandidaId, setRotaExpandidaId] = useState<number | null>(null);
  const [filtroAplicado, setFiltroAplicado] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const [producao, setProducao] = useState<RelatorioProducaoItem[]>([]);
  const [rotasDetalhado, setRotasDetalhado] = useState<RelatorioRotaDetalhadoItem[]>([]);
  const [produtosPorRota, setProdutosPorRota] = useState<RelatorioProdutosPorRotaItem[]>([]);
  const [topClientes, setTopClientes] = useState<RelatorioTopClienteItem[]>([]);
  const [trocas, setTrocas] = useState<RelatorioTrocaItem[]>([]);

  useEffect(() => {
    const carregarFiltroSalvo = async () => {
      try {
        const [rawFiltro, rawResultados] = await Promise.all([
          AsyncStorage.getItem(RELATORIOS_FILTRO_STORAGE_KEY),
          AsyncStorage.getItem(RELATORIOS_RESULTADOS_STORAGE_KEY),
        ]);

        if (rawFiltro) {
          const parsed = JSON.parse(rawFiltro) as {
            dataInicio?: string;
            dataFim?: string;
            statusFiltro?: StatusFiltro;
            statusFiltros?: StatusFiltro[];
            lembrar?: boolean;
          };
          if (parsed.dataInicio) setDataInicio(parsed.dataInicio);
          if (parsed.dataFim) setDataFim(parsed.dataFim);
          if (Array.isArray(parsed.statusFiltros) && parsed.statusFiltros.length > 0) {
            setStatusFiltros(parsed.statusFiltros.filter((item): item is StatusFiltro => STATUS_VALUES.includes(item)));
          } else if (parsed.statusFiltro) {
            setStatusFiltros([parsed.statusFiltro]);
          }
          setLembrarPeriodo(Boolean(parsed.lembrar));
        }

        if (rawResultados) {
          const parsedResultados = JSON.parse(rawResultados) as {
            lembrar?: boolean;
            filtroAplicado?: boolean;
            subRelatorio?: SubRelatorio;
            ultimaAtualizacao?: string | null;
            producao?: RelatorioProducaoItem[];
            rotasDetalhado?: RelatorioRotaDetalhadoItem[];
            produtosPorRota?: RelatorioProdutosPorRotaItem[];
            topClientes?: RelatorioTopClienteItem[];
            trocas?: RelatorioTrocaItem[];
          };

          if (parsedResultados.lembrar) {
            setFiltroAplicado(Boolean(parsedResultados.filtroAplicado));
            if (parsedResultados.subRelatorio) setSubRelatorio(parsedResultados.subRelatorio);
            if (parsedResultados.ultimaAtualizacao) {
              setUltimaAtualizacao(new Date(parsedResultados.ultimaAtualizacao));
            }
            setProducao(parsedResultados.producao || []);
            setRotasDetalhado(parsedResultados.rotasDetalhado || []);
            setProdutosPorRota(parsedResultados.produtosPorRota || []);
            setTopClientes(parsedResultados.topClientes || []);
            setTrocas(parsedResultados.trocas || []);
          }
        }
      } catch {
        // Ignora falha de leitura local.
      }
    };
    carregarFiltroSalvo();
  }, []);

  const salvarEstadoRelatorios = useCallback(async () => {
    await AsyncStorage.setItem(
      RELATORIOS_RESULTADOS_STORAGE_KEY,
      JSON.stringify({
        lembrar: true,
        filtroAplicado,
        subRelatorio,
        ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
        producao,
        rotasDetalhado,
        produtosPorRota,
        topClientes,
        trocas,
      })
    );
  }, [
    filtroAplicado,
    producao,
    produtosPorRota,
    rotasDetalhado,
    subRelatorio,
    topClientes,
    trocas,
    ultimaAtualizacao,
  ]);

  const removerPersistenciaRelatorios = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(RELATORIOS_FILTRO_STORAGE_KEY),
      AsyncStorage.removeItem(RELATORIOS_RESULTADOS_STORAGE_KEY),
    ]);
  }, []);

  const toggleLembrarPeriodo = useCallback(async () => {
    const proximo = !lembrarPeriodo;
    setLembrarPeriodo(proximo);
    if (!proximo) {
      removerPersistenciaRelatorios().catch(() => {
        // Ignora falha de limpeza local.
      });
      return;
    }
    await AsyncStorage.setItem(
      RELATORIOS_FILTRO_STORAGE_KEY,
        JSON.stringify({
          dataInicio,
          dataFim,
          statusFiltros,
          lembrar: true,
        })
      );
    if (filtroAplicado) {
      salvarEstadoRelatorios().catch(() => {
        // Ignora falha de persistencia local.
      });
    }
  }, [
    dataFim,
    dataInicio,
    filtroAplicado,
    lembrarPeriodo,
    removerPersistenciaRelatorios,
    salvarEstadoRelatorios,
    statusFiltros,
  ]);

  const agregarProducao = (rows: RelatorioProducaoItem[]) => {
    const mapa = new Map<string, RelatorioProducaoItem>();
    rows.forEach((item) => {
      const key = `${item.produto_id}|${item.embalagem || ''}`;
      const atual = mapa.get(key);
      if (atual) {
        atual.quantidade_total += Number(item.quantidade_total || 0);
      } else {
        mapa.set(key, { ...item, quantidade_total: Number(item.quantidade_total || 0) });
      }
    });
    return [...mapa.values()];
  };

  const agregarProdutosPorRota = (rows: RelatorioProdutosPorRotaItem[]) => {
    const mapa = new Map<string, RelatorioProdutosPorRotaItem>();
    rows.forEach((item) => {
      const key = `${item.rota_id ?? 'sem-rota'}|${item.produto_id}|${item.embalagem || ''}`;
      const atual = mapa.get(key);
      if (atual) {
        atual.quantidade_total += Number(item.quantidade_total || 0);
      } else {
        mapa.set(key, { ...item, quantidade_total: Number(item.quantidade_total || 0) });
      }
    });
    return [...mapa.values()];
  };

  const agregarTopClientes = (rows: RelatorioTopClienteItem[]) => {
    const mapa = new Map<number, RelatorioTopClienteItem>();
    rows.forEach((item) => {
      const atual = mapa.get(item.cliente_id);
      if (atual) {
        atual.total_pedidos += Number(item.total_pedidos || 0);
        atual.valor_total_vendas += Number(item.valor_total_vendas || 0);
      } else {
        mapa.set(item.cliente_id, {
          ...item,
          total_pedidos: Number(item.total_pedidos || 0),
          valor_total_vendas: Number(item.valor_total_vendas || 0),
        });
      }
    });
    return [...mapa.values()];
  };

  const agregarTrocas = (rows: RelatorioTrocaItem[]) => {
    const mapa = new Map<number, RelatorioTrocaItem>();
    rows.forEach((item) => {
      if (!mapa.has(item.troca_id)) mapa.set(item.troca_id, item);
    });
    return [...mapa.values()];
  };

  const carregarBase = useCallback(async () => {
    const inicioIso = parseBrToIso(dataInicio);
    const fimIso = parseBrToIso(dataFim);

    if (!inicioIso || !fimIso) {
      setErro('Informe data inicial e final.');
      return;
    }
    if (inicioIso > fimIso) {
      setErro('A data inicial não pode ser maior que a final.');
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const filtrosBase = {
        data_inicio: inicioIso,
        data_fim: fimIso,
      };
      const statusAplicados = statusFiltros.length > 0 ? statusFiltros : STATUS_VALUES;

      const resultadosPorStatus = await Promise.all(
        statusAplicados.map(async (status) => {
          const filtros = { ...filtrosBase, status };
          const [producaoResp, rotasResp, produtosResp, topResp, trocasResp] = await Promise.all([
            relatoriosApi.producao(filtros),
            relatoriosApi.rotasDetalhado(filtros),
            relatoriosApi.produtosPorRota(filtros),
            relatoriosApi.topClientes(filtros),
            relatoriosApi.trocas(filtros),
          ]);
          return {
            producao: producaoResp.data,
            rotas: rotasResp.data,
            produtos: produtosResp.data,
            top: topResp.data,
            trocas: trocasResp.data,
          };
        })
      );

      const producaoMerged = agregarProducao(resultadosPorStatus.flatMap((item) => item.producao));
      const rotasMerged = resultadosPorStatus.flatMap((item) => item.rotas);
      const produtosMerged = agregarProdutosPorRota(resultadosPorStatus.flatMap((item) => item.produtos));
      const topMerged = agregarTopClientes(resultadosPorStatus.flatMap((item) => item.top));
      const trocasMerged = agregarTrocas(resultadosPorStatus.flatMap((item) => item.trocas));

      setProducao(producaoMerged);
      setRotasDetalhado(rotasMerged);
      setProdutosPorRota(produtosMerged);
      setTopClientes(topMerged);
      setTrocas(trocasMerged);
      setRotaExpandidaId(null);
      setFiltroAplicado(true);
      const dataAtualizacao = new Date();
      setUltimaAtualizacao(dataAtualizacao);
      if (lembrarPeriodo) {
        await Promise.all([
          AsyncStorage.setItem(
            RELATORIOS_FILTRO_STORAGE_KEY,
            JSON.stringify({
              dataInicio,
              dataFim,
              statusFiltros,
              lembrar: true,
            })
          ),
          AsyncStorage.setItem(
            RELATORIOS_RESULTADOS_STORAGE_KEY,
            JSON.stringify({
              lembrar: true,
              filtroAplicado: true,
              subRelatorio,
              ultimaAtualizacao: dataAtualizacao.toISOString(),
              producao: producaoMerged,
              rotasDetalhado: rotasMerged,
              produtosPorRota: produtosMerged,
              topClientes: topMerged,
              trocas: trocasMerged,
            })
          ),
        ]);
      } else {
        await removerPersistenciaRelatorios();
      }
    } catch {
      setErro('Não foi possível carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, lembrarPeriodo, removerPersistenciaRelatorios, statusFiltros, subRelatorio]);

  const limparFiltro = () => {
    setDataInicio('');
    setDataFim('');
    setStatusFiltros(['EM_ESPERA']);
    setErro(null);
    setFiltroAplicado(false);
    setProducao([]);
    setRotasDetalhado([]);
    setProdutosPorRota([]);
    setTopClientes([]);
    setTrocas([]);
    setRotaExpandidaId(null);
    removerPersistenciaRelatorios().catch(() => {
      // Ignora falha de limpeza local.
    });
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const sincronizarSeHouverAlteracao = async () => {
        const timestamp = await lerTimestampRefreshRelatorios();
        if (!active || !timestamp) return;

        const inicioIso = parseBrToIso(dataInicio);
        const fimIso = parseBrToIso(dataFim);
        const temPeriodoValido = Boolean(inicioIso && fimIso);
        if (!filtroAplicado || !temPeriodoValido) return;

        await carregarBase();
        if (!active) return;
        await limparTimestampRefreshRelatorios();
      };

      sincronizarSeHouverAlteracao().catch(() => {
        // Ignora erro silencioso de sincronização automática.
      });
      return () => {
        active = false;
      };
    }, [carregarBase, dataFim, dataInicio, filtroAplicado])
  );

  useEffect(() => {
    if (!lembrarPeriodo || !filtroAplicado) return;
    salvarEstadoRelatorios().catch(() => {
      // Ignora falha de persistencia local.
    });
  }, [filtroAplicado, lembrarPeriodo, salvarEstadoRelatorios, subRelatorio]);

  const producaoOrdenada = useMemo(
    () => [...producao].sort((a, b) => Number(b.quantidade_total || 0) - Number(a.quantidade_total || 0)),
    [producao]
  );

  const trocasOrdenadas = useMemo(
    () =>
      [...trocas].sort(
        (a, b) => new Date(b.criado_em || b.pedido_data).getTime() - new Date(a.criado_em || a.pedido_data).getTime()
      ),
    [trocas]
  );

  const produtosPorRotaAgrupado = useMemo(() => {
    const mapa = new Map<string, { rota_nome: string; total_quantidade: number; itens: RelatorioProdutosPorRotaItem[] }>();
    produtosPorRota.forEach((item) => {
      const nome = item.rota_nome || 'Sem rota';
      const key = `${item.rota_id || 'sem'}-${nome}`;
      if (!mapa.has(key)) {
        mapa.set(key, { rota_nome: nome, total_quantidade: 0, itens: [] });
      }
      const grupo = mapa.get(key)!;
      grupo.total_quantidade += Number(item.quantidade_total || 0);
      grupo.itens.push(item);
    });
    return [...mapa.values()];
  }, [produtosPorRota]);

  const rotasAgrupadas = useMemo(() => agruparRotasDetalhado(rotasDetalhado), [rotasDetalhado]);
  const labelsSubRelatorio: Record<SubRelatorio, string> = {
    producao: 'Produção',
    rotas: 'Rotas',
    'produtos-rota': 'Produtos/Rota',
    'top-clientes': 'Top Clientes',
    trocas: 'Trocas',
  };
  const totalSubRelatorio = useMemo(() => {
    if (subRelatorio === 'producao') return producaoOrdenada.length;
    if (subRelatorio === 'rotas') return rotasAgrupadas.length;
    if (subRelatorio === 'produtos-rota') return produtosPorRotaAgrupado.length;
    if (subRelatorio === 'top-clientes') return topClientes.length;
    return trocasOrdenadas.length;
  }, [
    producaoOrdenada.length,
    produtosPorRotaAgrupado.length,
    rotasAgrupadas.length,
    subRelatorio,
    topClientes.length,
    trocasOrdenadas.length,
  ]);
  const abaAtivaConfig = useMemo(
    () => TAB_OPTIONS.find((item) => item.key === subRelatorio) || TAB_OPTIONS[0],
    [subRelatorio]
  );
  const resumoFiltros = `${dataInicio || '--/--/----'} até ${dataFim || '--/--/----'}`;
  const statusSelecionadosLabel = (statusFiltros.length > 0 ? statusFiltros : STATUS_VALUES)
    .map((status) => STATUS_OPTIONS.find((item) => item.value === status)?.label || status)
    .join(', ');

  const topSafeOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 20;
  const contentTopOffset = topSafeOffset + 78;
  const ultimaSyncTexto = ultimaAtualizacao
    ? `${String(ultimaAtualizacao.getHours()).padStart(2, '0')}:${String(ultimaAtualizacao.getMinutes()).padStart(2, '0')}`
    : '--:--';

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowBlue} />
      <View style={styles.backgroundGlowCyan} />
      <View style={styles.backgroundGlowSoft} />

      <View style={[styles.topBar, { paddingTop: topSafeOffset }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/modulos/relatorios.png')} style={styles.headerIcon} resizeMode="contain" />
            <Text style={styles.headerTitle}>Relatórios</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerBackText}>{'<'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: contentTopOffset }]}>
        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filtro do período</Text>
            <Text style={styles.syncBadge}>Última sync: {ultimaSyncTexto}</Text>
          </View>
          <Text style={styles.filterHint}>Selecione o período e status para atualizar os relatórios.</Text>
          <View style={styles.filterRow}>
            <Pressable style={styles.dateInput} onPress={() => setShowDateInicio(true)}>
              <Text style={styles.dateLabel}>Início</Text>
              <Text style={styles.dateValue}>{dataInicio || 'Selecionar'}</Text>
            </Pressable>
            <Pressable style={styles.dateInput} onPress={() => setShowDateFim(true)}>
              <Text style={styles.dateLabel}>Fim</Text>
              <Text style={styles.dateValue}>{dataFim || 'Selecionar'}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.checkboxRow} onPress={toggleLembrarPeriodo}>
            <View style={[styles.checkboxBox, lembrarPeriodo && styles.checkboxBoxChecked]}>
              {lembrarPeriodo ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>Lembrar data de início e fim</Text>
          </Pressable>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((status) => (
              <Pressable
                key={status.value}
                style={[styles.statusChip, statusFiltros.includes(status.value) && styles.statusChipActive]}
                onPress={() =>
                  setStatusFiltros((prev) => {
                    const existe = prev.includes(status.value);
                    if (existe && prev.length === 1) return prev;
                    if (existe) return prev.filter((item) => item !== status.value);
                    return [...prev, status.value];
                  })
                }
              >
                <Text
                  style={[styles.statusChipText, statusFiltros.includes(status.value) && styles.statusChipTextActive]}
                >
                  {status.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterActions}>
            <Pressable
              style={[
                styles.btnPrimary,
                (!dataInicio || !dataFim || loading) && styles.btnPrimaryDisabled,
              ]}
              onPress={carregarBase}
              disabled={!dataInicio || !dataFim || loading}
            >
              <Text style={styles.btnPrimaryText}>{loading ? 'Aplicando...' : 'Aplicar filtro'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={limparFiltro} disabled={loading}>
              <Text style={styles.btnGhostText}>Limpar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tabsCard}>
          <View style={styles.tabsHeader}>
            <Text style={styles.tabsTitle}>Visualização</Text>
            <Text style={[styles.tabsCount, { color: abaAtivaConfig.tone.text }]}>
              {labelsSubRelatorio[subRelatorio]}: {totalSubRelatorio}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsWrap}>
            {TAB_OPTIONS.map((aba) => (
              <Pressable
                key={aba.key}
                style={[
                  styles.tabButton,
                  subRelatorio === aba.key && {
                    borderColor: aba.tone.border,
                    backgroundColor: aba.tone.bg,
                  },
                ]}
                onPress={() => setSubRelatorio(aba.key as SubRelatorio)}
              >
                <View
                  style={[
                    styles.tabIcon,
                    subRelatorio === aba.key && {
                      borderColor: aba.tone.border,
                      backgroundColor: '#ffffff',
                    },
                  ]}
                >
                  <Text style={[styles.tabIconText, subRelatorio === aba.key && { color: aba.tone.text }]}>
                    {aba.icon}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tabText,
                    subRelatorio === aba.key && { color: aba.tone.text },
                  ]}
                >
                  {aba.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {erro ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        ) : null}

        {filtroAplicado ? (
          <View style={styles.quickInfoCard}>
            <Text style={styles.quickInfoTitle}>Consulta Atual</Text>
            <Text style={styles.quickInfoText}>{resumoFiltros}</Text>
            <Text style={styles.quickInfoText}>
              Status: {statusSelecionadosLabel}
            </Text>
          </View>
        ) : null}

        {!filtroAplicado && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Informe o período e toque em "Aplicar filtro".</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator />
          </View>
        ) : null}

        {filtroAplicado && !loading && subRelatorio === 'producao' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produção</Text>
              <Text style={styles.sectionMeta}>{producaoOrdenada.length} item(ns)</Text>
            </View>
            {producaoOrdenada.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum item encontrado para este filtro.</Text>
            ) : producaoOrdenada.map((item, index) => (
              <View key={`${item.produto_id}-${index}`} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle}>{item.produto_nome}</Text>
                  <Text style={styles.itemValue}>{formatarNumero(item.quantidade_total)}</Text>
                </View>
                {item.embalagem ? <Text style={styles.itemMeta}>{item.embalagem}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {filtroAplicado && !loading && subRelatorio === 'rotas' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Relatório de Rotas</Text>
              <Text style={styles.sectionMeta}>{rotasAgrupadas.length} registro(s)</Text>
            </View>
            {rotasAgrupadas.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma rota encontrada para este filtro.</Text>
            ) : rotasAgrupadas.map((item) => (
              <Pressable
                key={item.rota_id}
                style={styles.itemCard}
                onPress={() =>
                  setRotaExpandidaId((prev) => (prev === item.rota_id ? null : item.rota_id))
                }
              >
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle}>{item.rota_nome}</Text>
                  <Text style={styles.itemValue}>{formatarMoeda(item.valor_total)}</Text>
                </View>
                {item.trocas > 0 ? <Text style={styles.itemMeta}>Trocas: {item.trocas}</Text> : null}
                <Text style={styles.expandHint}>
                  {rotaExpandidaId === item.rota_id ? 'Ocultar detalhes' : 'Ver detalhes'}
                </Text>
                {rotaExpandidaId === item.rota_id ? (
                  <View style={styles.expandBox}>
                    <Text style={styles.expandTitle}>Pedidos</Text>
                    {item.pedidos_detalhes.slice(0, 8).map((pedido) => {
                      const theme =
                        STATUS_THEME[pedido.pedido_status] || {
                          bg: '#f1f5f9',
                          border: '#cbd5e1',
                          text: '#334155',
                          label: pedido.pedido_status || 'Sem status',
                        };
                      return (
                        <View key={pedido.pedido_id} style={styles.expandPedidoRow}>
                          <View style={styles.expandPedidoTop}>
                            <Text style={styles.expandText}>
                              #{pedido.pedido_id} - {pedido.cliente_nome}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <Text style={[styles.statusBadgeText, { color: theme.text }]}>{theme.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.expandText}>
                            {formatarData(pedido.pedido_data)} - <Text style={styles.expandTextStrong}>{formatarMoeda(pedido.pedido_valor_total)}</Text>
                          </Text>
                          {[...pedido.produtos.values()].length > 0 ? (
                            <View style={styles.expandProdutosBox}>
                              {[...pedido.produtos.values()].map((produto, produtoIndex) => (
                                <Text key={`${pedido.pedido_id}-${produto.codigo_produto}-${produtoIndex}`} style={styles.expandProdutoText}>
                                  {produto.produto_nome}
                                  {'\n'}
                                  Valor: {formatarMoeda(produto.valor_total_item)} - Qtd: {formatarNumero(produto.quantidade)}
                                  {produto.embalagem ? ` ${produto.embalagem}` : ''}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {item.pedidos_detalhes.length > 8 ? (
                      <Text style={styles.expandText}>+ {item.pedidos_detalhes.length - 8} pedido(s)</Text>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {filtroAplicado && !loading && subRelatorio === 'produtos-rota' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produtos por Rota</Text>
              <Text style={styles.sectionMeta}>{produtosPorRotaAgrupado.length} rota(s)</Text>
            </View>
            {produtosPorRotaAgrupado.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum produto por rota encontrado.</Text>
            ) : produtosPorRotaAgrupado.map((grupo, index) => (
              <View key={`${grupo.rota_nome}-${index}`} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle}>{grupo.rota_nome}</Text>
                </View>
                {grupo.itens.map((item, itemIndex) => (
                  <Text key={`${item.produto_id}-${itemIndex}`} style={styles.itemMeta}>
                    {item.produto_nome} -{' '}
                    <Text style={styles.itemMetaValueStrong}>{formatarNumero(item.quantidade_total)}</Text>
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {filtroAplicado && !loading && subRelatorio === 'top-clientes' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Clientes</Text>
              <Text style={styles.sectionMeta}>{topClientes.length} cliente(s)</Text>
            </View>
            {topClientes.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum cliente encontrado para este período.</Text>
            ) : [...topClientes]
              .sort((a, b) => Number(b.valor_total_vendas || 0) - Number(a.valor_total_vendas || 0))
              .map((item) => (
                <View key={item.cliente_id} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{item.cliente_nome}</Text>
                    <Text style={styles.itemValue}>{formatarMoeda(item.valor_total_vendas)}</Text>
                  </View>
                  <Text style={styles.itemMeta}>{item.total_pedidos} pedidos</Text>
                </View>
              ))}
          </View>
        ) : null}

        {filtroAplicado && !loading && subRelatorio === 'trocas' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trocas</Text>
              <Text style={styles.sectionMeta}>{trocasOrdenadas.length} troca(s)</Text>
            </View>
            {trocasOrdenadas.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma troca encontrada para este período.</Text>
            ) : trocasOrdenadas.map((item) => (
              <View key={item.troca_id} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle}>{item.produto_nome}</Text>
                  <Text style={styles.itemValue}>{formatarNumero(item.quantidade)}</Text>
                </View>
                <Text style={styles.itemMeta}>
                  {item.codigo_cliente} - {item.cliente_nome}
                </Text>
                <Text style={styles.itemMeta}>
                  Pedido #{item.pedido_id} - {formatarData(item.pedido_data)} - {formatarMoeda(item.valor_troca)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={showDateInicio}
        value={dataInicio}
        onChange={setDataInicio}
        onClose={() => setShowDateInicio(false)}
        title="Data inicial"
      />
      <DatePickerModal
        visible={showDateFim}
        value={dataFim}
        onChange={setDataFim}
        onClose={() => setShowDateFim(false)}
        title="Data final"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dbeafe',
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
    justifyContent: 'space-between',
    columnGap: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 32.34,
    fontWeight: '800',
    color: '#0f172a',
  },
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
  headerBackText: {
    color: '#1e3a8a',
    fontWeight: '800',
    fontSize: 17.33,
  },
  pressed: {
    opacity: 0.82,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 10,
  },
  filterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  filterTitle: {
    color: '#0f172a',
    fontSize: 16.17,
    fontWeight: '800',
  },
  syncBadge: {
    color: '#1e3a8a',
    fontSize: 12.71,
    fontWeight: '800',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  filterHint: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  dateInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateLabel: {
    color: '#64748b',
    fontSize: 12.71,
    fontWeight: '700',
  },
  dateValue: {
    color: '#0f172a',
    marginTop: 2,
    fontSize: 15.02,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  statusChipActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#dbeafe',
  },
  statusChipText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13.86,
  },
  statusChipTextActive: {
    color: '#1e3a8a',
  },
  filterActions: {
    flexDirection: 'row',
    columnGap: 8,
  },
  checkboxRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  checkboxTick: {
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '900',
    lineHeight: 13,
  },
  checkboxLabel: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '600',
  },
  btnGhost: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnGhostText: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  btnPrimary: {
    flex: 2,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnPrimaryDisabled: {
    backgroundColor: '#93c5fd',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 13.86,
    fontWeight: '800',
  },
  tabsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 6,
  },
  tabsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  tabsTitle: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  tabsCount: {
    color: '#1e3a8a',
    fontSize: 13.86,
    fontWeight: '800',
  },
  quickInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 9,
    rowGap: 2,
  },
  quickInfoTitle: {
    color: '#0f172a',
    fontSize: 13.86,
    fontWeight: '800',
  },
  quickInfoText: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
  },
  tabsWrap: {
    columnGap: 6,
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  tabIcon: {
    minWidth: 24,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabIconText: {
    color: '#475569',
    fontSize: 10.4,
    fontWeight: '800',
  },
  tabText: {
    color: '#334155',
    fontSize: 13.86,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#1e3a8a',
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
  sectionTitle: {
    color: '#0f172a',
    fontSize: 17.33,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 9,
    gap: 4,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  itemTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15.02,
    fontWeight: '800',
  },
  itemValue: {
    color: '#1d4ed8',
    fontSize: 15.02,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#475569',
    fontSize: 13.86,
    fontWeight: '600',
  },
  itemMetaValueStrong: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  itemMetaStrong: {
    color: '#0f172a',
    fontSize: 13.86,
    fontWeight: '800',
  },
  expandHint: {
    marginTop: 4,
    color: '#1d4ed8',
    fontSize: 13.86,
    fontWeight: '700',
  },
  expandBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
    paddingTop: 8,
    gap: 4,
  },
  expandTitle: {
    color: '#0f172a',
    fontSize: 13.86,
    fontWeight: '800',
    marginTop: 2,
  },
  expandText: {
    color: '#334155',
    fontSize: 12.71,
    fontWeight: '600',
  },
  expandTextStrong: {
    color: '#0f172a',
    fontWeight: '800',
  },
  expandPedidoRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  expandProdutosBox: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
    gap: 2,
  },
  expandProdutoText: {
    color: '#1e293b',
    fontSize: 12.71,
    fontWeight: '600',
  },
  expandPedidoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 11.55,
    fontWeight: '800',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13.86,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
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
});
