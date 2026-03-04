import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { sessionStorage } from '../api/storage';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';

const BG_LOGIN = require('../../assets/fundo_login_claro_reduzido_v2.png');
const LOGO = require('../../assets/processado1.png');
const BIOMETRIA_ICON = require('../../assets/biometria.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const { height, width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [previewNome, setPreviewNome] = useState<string | null>(null);
  const [previewImagem, setPreviewImagem] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const compactLayout = height < 760;
  const narrowLayout = width < 380;

  useEffect(() => {
    const loadRememberPreference = async () => {
      try {
        const stored = await sessionStorage.getRememberMePreference();
        setRememberMe(stored);

        const [hasHardware, isEnrolled, credentials] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          sessionStorage.getBiometricCredentials(),
        ]);
        setBiometricAvailable(Boolean(stored && hasHardware && isEnrolled && credentials));
      } catch {
        setBiometricAvailable(false);
      }
    };
    loadRememberPreference();
  }, []);

  useEffect(() => {
    const user = username.trim();
    if (!user) {
      setPreviewNome(null);
      setPreviewImagem(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await authApi.userPreview(user);
        setPreviewNome(response.data.nome);
        setPreviewImagem(response.data.imagem_url);
      } catch {
        setPreviewNome(null);
        setPreviewImagem(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const onSubmit = async () => {
    const user = username.trim();
    const pass = password;

    let hasError = false;
    if (!user) {
      setUsernameError('Informe o usuário.');
      hasError = true;
    }
    if (!pass) {
      setPasswordError('Informe a senha.');
      hasError = true;
    }
    if (hasError) return;

    setFormError(null);
    setLoading(true);
    try {
      await login(user, pass, rememberMe);
    } catch {
      setFormError('Não foi possível entrar. Confira usuário/senha e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onBiometricLogin = async () => {
    setFormError(null);
    setBiometricLoading(true);
    try {
      if (!rememberMe) {
        Alert.alert('Biometria', 'Ative "Manter conectado" para usar biometria.');
        return;
      }

      const [hasHardware, isEnrolled, credentials] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        sessionStorage.getBiometricCredentials(),
      ]);
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometria', 'Biometria indisponível neste aparelho.');
        return;
      }
      if (!credentials) {
        Alert.alert('Biometria', 'Faça um login com senha primeiro para habilitar.');
        return;
      }

      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Entrar com biometria',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar senha',
      });
      if (!auth.success) {
        const detail = auth.error ? ` (${auth.error})` : '';
        if (auth.error === 'user_cancel' || auth.error === 'system_cancel') return;
        Alert.alert('Biometria', `Autenticação não concluída${detail}.`);
        return;
      }

      await login(credentials.username, credentials.password, true);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      Alert.alert(
        'Biometria',
        `Não foi possível autenticar por biometria${detail ? ` (${detail})` : ''}.`
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image source={BG_LOGIN} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgWash} />
      <View style={styles.bgTopFade} />
      <View style={styles.bgBottomGlow} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, compactLayout && styles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.shell, compactLayout && styles.shellCompact]}>
          <View style={[styles.brandPanel, compactLayout && styles.brandPanelCompact]}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>Painel operacional</Text>
            </View>
            <View style={styles.brandHeaderRow}>
              <View style={[styles.logoWrap, compactLayout && styles.logoWrapCompact]}>
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.brandTitleWrap}>
                <Text style={[styles.brandTitle, compactLayout && styles.brandTitleCompact]}>APPEMP</Text>
                <Text style={[styles.brandCaption, compactLayout && styles.brandCaptionCompact]}>
                  Central de pedidos
                </Text>
              </View>
            </View>
            <Text style={[styles.brandSubtitle, compactLayout && styles.brandSubtitleCompact]}>
              Entre para acessar pedidos, rotas e a operação diária.
            </Text>
          </View>

          <View style={[styles.card, compactLayout && styles.cardCompact]}>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            {(previewImagem || previewNome) ? (
              <View style={[styles.previewCard, narrowLayout && styles.previewCardNarrow]}>
                {previewImagem ? (
                  <Image source={{ uri: previewImagem }} style={styles.previewAvatar} />
                ) : (
                  <View style={styles.previewAvatarFallback}>
                    <Text style={styles.previewAvatarText}>
                      {(previewNome || username).trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.previewTextWrap}>
                  <Text style={styles.previewKicker}>USUÁRIO IDENTIFICADO</Text>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {previewNome || username}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Usuário</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'username' && styles.inputFocused,
                  usernameError && styles.inputError,
                ]}
                placeholder="Digite seu usuário"
                placeholderTextColor="#94a3b8"
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  if (usernameError) setUsernameError(null);
                  if (formError) setFormError(null);
                }}
                autoCapitalize="none"
                autoComplete="username"
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField((prev) => (prev === 'username' ? null : prev))}
              />
            </View>
            {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Senha</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'password' && styles.inputFocused,
                  passwordError && styles.inputError,
                ]}
                placeholder="Digite sua senha"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (passwordError) setPasswordError(null);
                  if (formError) setFormError(null);
                }}
                secureTextEntry
                autoComplete="password"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
              />
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

            <Pressable
              style={styles.rememberRow}
              onPress={async () => {
                const next = !rememberMe;
                setRememberMe(next);
                await sessionStorage.setRememberMePreference(next);
                if (!next) {
                  setBiometricAvailable(false);
                  return;
                }
                try {
                  const [hasHardware, isEnrolled, credentials] = await Promise.all([
                    LocalAuthentication.hasHardwareAsync(),
                    LocalAuthentication.isEnrolledAsync(),
                    sessionStorage.getBiometricCredentials(),
                  ]);
                  setBiometricAvailable(Boolean(hasHardware && isEnrolled && credentials));
                } catch {
                  setBiometricAvailable(false);
                }
              }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <View style={styles.rememberTextWrap}>
                <Text style={styles.rememberText}>Manter conectado</Text>
                <Text style={styles.rememberHint}>Salva a sessão neste aparelho.</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onSubmit}
              disabled={loading || biometricLoading}
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && !biometricLoading && styles.buttonPressed,
                (loading || biometricLoading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </Pressable>

            <View style={styles.secondaryDivider}>
              <View style={styles.secondaryDividerLine} />
              <Text style={styles.secondaryDividerText}>Acesso rápido</Text>
              <View style={styles.secondaryDividerLine} />
            </View>

            <Pressable
              onPress={onBiometricLogin}
              disabled={loading || biometricLoading}
              accessibilityRole="button"
              accessibilityLabel="Entrar com biometria"
              style={({ pressed }) => [
                styles.biometricTouchArea,
                pressed && !loading && !biometricLoading && styles.biometricTouchAreaPressed,
                (loading || biometricLoading) && styles.buttonDisabled,
              ]}
            >
              {biometricLoading ? (
                <ActivityIndicator color="#1e40af" />
              ) : (
                <View style={styles.biometricRowButton}>
                  <View style={styles.biometricRowIconWrap}>
                    <Image source={BIOMETRIA_ICON} style={styles.biometricRowIconImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.biometricRowLabel}>
                    {biometricAvailable ? 'Entrar com biometria' : 'Configurar biometria'}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  bgWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  bgTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '36%',
    backgroundColor: 'rgba(37,99,235,0.10)',
  },
  bgBottomGlow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 70,
    height: 160,
    borderRadius: 40,
    backgroundColor: 'rgba(191,219,254,0.28)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  scrollContentCompact: {
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  shellCompact: {
    borderRadius: 20,
  },
  brandPanel: {
    backgroundColor: '#f8fbff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.16)',
    alignItems: 'flex-start',
  },
  brandPanelCompact: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    marginBottom: 12,
  },
  brandBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0ecff',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    marginRight: 14,
  },
  logoWrapCompact: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  brandTitle: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
    includeFontPadding: true,
  },
  brandTitleCompact: {
    fontSize: 24,
    lineHeight: 26,
  },
  brandCaption: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  brandCaptionCompact: {
    fontSize: 12,
  },
  brandSubtitle: {
    marginTop: 14,
    color: '#334155',
    lineHeight: 20,
    maxWidth: 320,
    fontSize: 14,
  },
  brandSubtitleCompact: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 22,
    paddingBottom: 26,
    minHeight: 360,
    gap: 14,
  },
  cardCompact: {
    minHeight: 0,
    padding: 16,
    paddingBottom: 18,
    gap: 12,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.16)',
    backgroundColor: 'rgba(239,246,255,0.86)',
    padding: 10,
  },
  previewCardNarrow: {
    padding: 9,
    gap: 10,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.20)',
  },
  previewAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.20)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    fontSize: 23.1,
    fontWeight: '900',
    color: '#0f172a',
  },
  previewTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewKicker: {
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: '#475569',
    fontWeight: '700',
  },
  previewName: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7e1ee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 15,
  },
  inputFocused: {
    borderColor: '#3b82f6',
    shadowColor: 'rgba(37,99,235,0.35)',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  inputError: {
    borderColor: 'rgba(225,29,72,0.45)',
  },
  fieldError: {
    marginTop: -8,
    marginLeft: 2,
    color: '#be123c',
    fontSize: 13,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 2,
    paddingTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1e40af',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  rememberTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rememberText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  rememberHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  button: {
    marginTop: 2,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e40af',
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonPressed: {
    backgroundColor: '#1e40af',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  secondaryDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  secondaryDividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  biometricTouchArea: {
    marginTop: -2,
    alignItems: 'stretch',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  biometricTouchAreaPressed: {
    backgroundColor: '#eef2ff',
  },
  biometricRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  biometricRowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  biometricRowIconImage: {
    width: 18,
    height: 18,
    tintColor: '#1d4ed8',
  },
  biometricRowLabel: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 15,
  },
  formError: {
    color: '#be123c',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
