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
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { sessionStorage } from '../api/storage';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';

const BG_LOGIN = require('../../assets/fundo_login_claro_reduzido_v2.png');
const LOGO = require('../../assets/processado1.png');

export default function LoginScreen() {
  const { login } = useAuth();
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brandPanel}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.logoWrap}>
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.brandTitleWrap}>
                <Text style={styles.brandTitle}>APPEMP</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>
              Acesse sua central de operações para gerenciar pedidos.
            </Text>
          </View>

          <View style={styles.card}>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            {(previewImagem || previewNome) ? (
              <View style={styles.previewCard}>
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

            <TextInput
              style={[
                styles.input,
                focusedField === 'username' && styles.inputFocused,
                usernameError && styles.inputError,
              ]}
              placeholder="Usuário"
              placeholderTextColor="#64748b"
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
            {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}

            <TextInput
              style={[
                styles.input,
                focusedField === 'password' && styles.inputFocused,
                passwordError && styles.inputError,
              ]}
              placeholder="Senha"
              placeholderTextColor="#64748b"
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
              <Text style={styles.rememberText}>Manter conectado</Text>
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
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
            </Pressable>

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
                <View style={styles.biometricIconButton}>
                  <View style={styles.biometricRingOuter}>
                    <View style={styles.biometricRingMid}>
                      <View style={styles.biometricRingInner} />
                    </View>
                  </View>
                  <Text style={styles.biometricLabel}>
                    {biometricAvailable ? 'Biometria' : 'Configurar biometria'}
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
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  bgWash: {
    ...StyleSheet.absoluteFillObject,
    // Softens the black pattern so it doesn't feel harsh.
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  bgTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandPanel: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(219,234,254,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    marginRight: 12,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 30.03,
    lineHeight: 34,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
    letterSpacing: 0.2,
    includeFontPadding: true,
    textShadowColor: 'rgba(37,99,235,0.22)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandSubtitle: {
    marginTop: 10,
    color: '#334155',
    lineHeight: 19,
    maxWidth: 320,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 20,
    paddingBottom: 28,
    minHeight: 340,
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
    fontSize: 11.55,
    letterSpacing: 1.2,
    color: '#475569',
    fontWeight: '700',
  },
  previewName: {
    marginTop: 2,
    fontSize: 18.48,
    fontWeight: '800',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: '#0f172a',
  },
  inputFocused: {
    borderColor: 'rgba(37,99,235,0.55)',
    shadowColor: 'rgba(37,99,235,0.35)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputError: {
    borderColor: 'rgba(225,29,72,0.45)',
  },
  fieldError: {
    marginTop: -6,
    color: '#be123c',
    fontSize: 13.86,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
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
    fontSize: 13.86,
    fontWeight: '900',
    lineHeight: 14,
  },
  rememberText: {
    color: '#334155',
    fontSize: 15.02,
    fontWeight: '600',
  },
  button: {
    marginTop: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e40af',
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
  },
  biometricTouchArea: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.20)',
    backgroundColor: 'rgba(239,246,255,0.48)',
  },
  biometricTouchAreaPressed: {
    backgroundColor: 'rgba(191,219,254,0.35)',
  },
  biometricIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  biometricRingOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(219,234,254,0.8)',
  },
  biometricRingMid: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(37,99,235,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricRingInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(29,78,216,0.75)',
  },
  biometricLabel: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 12.8,
  },
  formError: {
    color: '#be123c',
    backgroundColor: 'rgba(254,226,226,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.95)',
    borderRadius: 10,
    padding: 10,
    fontWeight: '700',
  },
});
