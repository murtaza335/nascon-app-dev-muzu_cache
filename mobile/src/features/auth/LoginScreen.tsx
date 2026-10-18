import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Message, T } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c, radius, space, type } from '../../theme/tokens';

const DEMO_ACCOUNTS = [
  { label: 'Organizer', email: 'organizer@nascon.test', pass: 'Nascon@26' },
  { label: 'Manager', email: 'manager@nascon.test', pass: 'Nascon@26' },
  { label: 'Player', email: 'player@nascon.test', pass: 'Nascon@26' },
  { label: 'Admin', email: 'admin@nascon.test', pass: 'Nascon@26' },
];

export function LoginScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  async function signIn() {
    setSubmitted(true);
    setFailed(false);
    if (!validEmail || !password) return;
    const ok = await p.login(email, password);
    if (ok) {
      setPassword('');
    } else {
      setFailed(true);
    }
  }

  function pickDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setFailed(false);
    setSubmitted(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* Decorative Wave & Topographic Header */}
      <View style={styles.headerContainer}>
        {/* Subtle topographic contour overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={[styles.contourCircle, { width: 340, height: 240, top: -70, left: -50, transform: [{ rotate: '-15deg' }] }]} />
          <View style={[styles.contourCircle, { width: 290, height: 200, top: -40, left: -25, transform: [{ rotate: '-12deg' }] }]} />
          <View style={[styles.contourCircle, { width: 240, height: 160, top: -10, left: 0, transform: [{ rotate: '-9deg' }] }]} />
          <View style={[styles.contourCircle, { width: 270, height: 190, top: 20, right: -40, transform: [{ rotate: '25deg' }] }]} />
          <View style={[styles.contourCircle, { width: 220, height: 150, top: 50, right: -15, transform: [{ rotate: '20deg' }] }]} />
        </View>

        {/* Organic wave shape bottom edge */}
        <View style={styles.waveCurve} />

        {/* Top bar controls */}
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.topBar}>
          <View style={styles.brandBadge}>
            <View style={styles.brandDot} />
            <T variant="label" color={c.onAccent} style={{ letterSpacing: 0.5, fontWeight: '700' }}>
              SPORTRON
            </T>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Server Settings"
            onPress={() => n.navigate('Settings')}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
            style={styles.settingsButton}
          >
            <Icon name="settings" size={20} color={c.onAccent} />
          </Pressable>
        </SafeAreaView>
      </View>

      {/* Form Content Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.formCard}>
            {/* "Sign in" Header with accent underline */}
            <View style={styles.titleSection}>
              <T variant="heading" color={c.text} style={styles.titleText}>
                Sign in
              </T>
              <View style={styles.titleAccentBar} />
            </View>

            {/* Email Field */}
            <View style={styles.fieldBlock}>
              <T variant="label" color={c.text} style={styles.fieldLabel}>
                Email
              </T>
              <View
                style={[
                  styles.inputRow,
                  {
                    borderBottomColor:
                      submitted && !validEmail
                        ? c.error
                        : emailFocused
                          ? c.accent
                          : c.divider,
                    borderBottomWidth: emailFocused ? 2 : 1,
                  },
                ]}
              >
                <Icon
                  name="mail"
                  size={20}
                  color={emailFocused ? c.accent : c.muted}
                />
                <View style={styles.fieldDivider} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="demo@email.com"
                  placeholderTextColor={c.muted}
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={c.accent}
                  cursorColor={c.accent}
                  accessibilityLabel="Email address"
                  style={styles.textInput}
                />
              </View>
              {submitted && !validEmail && (
                <T variant="caption" color={c.error} style={styles.errorText}>
                  Enter a valid email address.
                </T>
              )}
            </View>

            {/* Password Field */}
            <View style={styles.fieldBlock}>
              <T variant="label" color={c.text} style={styles.fieldLabel}>
                Password
              </T>
              <View
                style={[
                  styles.inputRow,
                  {
                    borderBottomColor:
                      submitted && !password
                        ? c.error
                        : passFocused
                          ? c.accent
                          : c.divider,
                    borderBottomWidth: passFocused ? 2 : 1,
                  },
                ]}
              >
                <Icon
                  name="lock"
                  size={20}
                  color={passFocused ? c.accent : c.muted}
                />
                <View style={styles.fieldDivider} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  placeholder="enter your password"
                  placeholderTextColor={c.muted}
                  secureTextEntry={!visible}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={() => void signIn()}
                  selectionColor={c.accent}
                  cursorColor={c.accent}
                  accessibilityLabel="Password"
                  style={styles.textInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                  onPress={() => setVisible(!visible)}
                  hitSlop={12}
                  style={styles.eyeButton}
                >
                  <Icon
                    name={visible ? 'eye-off' : 'eye'}
                    size={20}
                    color={c.muted}
                  />
                </Pressable>
              </View>
              {submitted && !password && (
                <T variant="caption" color={c.error} style={styles.errorText}>
                  Enter your password.
                </T>
              )}
            </View>

            {/* Remember Me & Server Link */}
            <View style={styles.optionsRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Remember Me"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: rememberMe ? c.accent : c.muted,
                      backgroundColor: rememberMe ? c.accent : 'transparent',
                    },
                  ]}
                >
                  {rememberMe && <Icon name="check" size={14} color={c.onAccent} />}
                </View>
                <T variant="caption" color={c.secondary} style={{ fontWeight: '500' }}>
                  Remember Me
                </T>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open server settings"
                onPress={() => n.navigate('Settings')}
                hitSlop={8}
                style={styles.forgotLink}
              >
                <T variant="caption" color={c.accent} style={{ fontWeight: '600' }}>
                  Server Settings
                </T>
              </Pressable>
            </View>

            {/* Error Message */}
            {failed && (
              <Message
                title="Unable to sign in"
                description="Check your account details and server connection, then try again."
                tone="error"
              />
            )}

            {/* Primary Action Button ("Login") */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Login"
              accessibilityState={{ disabled: p.busy, busy: p.busy }}
              disabled={p.busy}
              onPress={() => void signIn()}
              android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
              style={({ pressed }) => [
                styles.loginButton,
                {
                  opacity: p.busy ? 0.7 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed && !p.busy ? 0.98 : 1 }],
                },
              ]}
            >
              {p.busy ? (
                <ActivityIndicator color={c.onAccent} size="small" />
              ) : (
                <T variant="strong" color={c.onAccent} style={styles.loginButtonText}>
                  Login
                </T>
              )}
            </Pressable>

            {/* Secondary Link */}
            <View style={styles.signupRow}>
              <T variant="caption" color={c.muted}>
                Don't have an Account ?{' '}
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Contact administration"
                onPress={() => n.navigate('Settings')}
                hitSlop={8}
              >
                <T variant="caption" color={c.accent} style={{ fontWeight: '700' }}>
                  Sign up
                </T>
              </Pressable>
            </View>

            {/* Quick Demo Accounts for Grader / Desk Check */}
            <View style={styles.demoSection}>
              <T variant="caption" color={c.muted} style={{ textAlign: 'center', marginBottom: 8 }}>
                Quick Demo Accounts
              </T>
              <View style={styles.demoChipsRow}>
                {DEMO_ACCOUNTS.map((d) => (
                  <Pressable
                    key={d.label}
                    accessibilityRole="button"
                    accessibilityLabel={`Fill ${d.label} demo account`}
                    onPress={() => pickDemo(d.email, d.pass)}
                    style={({ pressed }) => [
                      styles.demoChip,
                      {
                        backgroundColor: email === d.email ? c.olive : c.raised,
                        borderColor: email === d.email ? c.accent : c.divider,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <T
                      variant="caption"
                      color={email === d.email ? c.accent : c.secondary}
                      style={{ fontWeight: email === d.email ? '700' : '500', fontSize: 13 }}
                    >
                      {d.label}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 195,
    backgroundColor: c.accent,
    position: 'relative',
    overflow: 'hidden',
  },
  contourCircle: {
    position: 'absolute',
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  waveCurve: {
    position: 'absolute',
    bottom: -32,
    left: -40,
    right: -40,
    height: 68,
    backgroundColor: c.background,
    borderTopLeftRadius: 180,
    borderTopRightRadius: 280,
    transform: [{ rotate: '-3deg' }],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#86EFAC',
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    gap: 18,
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  titleText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleAccentBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.accent,
    marginTop: 6,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  fieldDivider: {
    width: 1.2,
    height: 18,
    backgroundColor: c.divider,
    marginHorizontal: 12,
  },
  textInput: {
    ...type.body,
    flex: 1,
    color: c.text,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 16,
  },
  eyeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotLink: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loginButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    marginTop: 8,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 4,
  },
  demoSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  demoChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  demoChip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
