import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import ModuloScreen from '../screens/ModuloScreen';
import HistoricoScreen from '../screens/HistoricoScreen';
import ClientesScreen from '../screens/ClientesScreen';
import ProdutosScreen from '../screens/ProdutosScreen';
import RotasScreen from '../screens/RotasScreen';
import ClienteProdutosScreen from '../screens/ClienteProdutosScreen';
import UsuariosScreen from '../screens/UsuariosScreen';
import RemaneioScreen from '../screens/RemaneioScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import ProducaoDashboardScreen from '../screens/ProducaoDashboardScreen';
import EntregasDashboardScreen from '../screens/EntregasDashboardScreen';
import PedidoDetalheScreen from '../screens/PedidoDetalheScreen';
import PedidoEditarScreen from '../screens/PedidoEditarScreen';
import PedidoNovoScreen from '../screens/PedidoNovoScreen';
import PedidosScreen from '../screens/PedidosScreen';
import OrcamentoScreen from '../screens/OrcamentoScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Pedidos: undefined;
  Clientes: undefined;
  Produtos: undefined;
  Rotas: undefined;
  ClienteProdutos: undefined;
  Usuarios: undefined;
  Remaneio: undefined;
  Relatorios: undefined;
  ProducaoDashboard: undefined;
  EntregasDashboard: undefined;
  PedidoDetalhe: { id: number; focus?: 'trocas' };
  PedidoEditar: { id: number };
  PedidoNovo: undefined;
  Orcamento: undefined;
  Modulo: { modulo: string; titulo: string };
  Historico: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Pedidos" component={PedidosScreen} />
          <Stack.Screen name="Clientes" component={ClientesScreen} />
          <Stack.Screen name="Produtos" component={ProdutosScreen} />
          <Stack.Screen name="Rotas" component={RotasScreen} />
          <Stack.Screen name="ClienteProdutos" component={ClienteProdutosScreen} />
          <Stack.Screen name="Usuarios" component={UsuariosScreen} />
          <Stack.Screen name="Remaneio" component={RemaneioScreen} />
          <Stack.Screen name="Relatorios" component={RelatoriosScreen} />
          <Stack.Screen name="ProducaoDashboard" component={ProducaoDashboardScreen} />
          <Stack.Screen name="EntregasDashboard" component={EntregasDashboardScreen} />
          <Stack.Screen name="PedidoNovo" component={PedidoNovoScreen} />
          <Stack.Screen name="Orcamento" component={OrcamentoScreen} />
          <Stack.Screen name="PedidoDetalhe" component={PedidoDetalheScreen} />
          <Stack.Screen name="PedidoEditar" component={PedidoEditarScreen} />
          <Stack.Screen name="Modulo" component={ModuloScreen} />
          <Stack.Screen name="Historico" component={HistoricoScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
