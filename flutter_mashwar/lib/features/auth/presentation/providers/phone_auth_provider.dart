import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum PhoneAuthStep {
  enterPhone,
  verifyOtp,
  authenticated,
}

class PhoneAuthState {
  final PhoneAuthStep step;
  final String rawPhoneInput;
  final String normalizedPhoneE164;
  final String? verificationId;
  final int? resendToken;
  final int resendCooldownSeconds;
  final bool isLoading;
  final String? errorMessage;
  final User? firebaseUser;

  const PhoneAuthState({
    this.step = PhoneAuthStep.enterPhone,
    this.rawPhoneInput = '',
    this.normalizedPhoneE164 = '',
    this.verificationId,
    this.resendToken,
    this.resendCooldownSeconds = 0,
    this.isLoading = false,
    this.errorMessage,
    this.firebaseUser,
  });

  PhoneAuthState copyWith({
    PhoneAuthStep? step,
    String? rawPhoneInput,
    String? normalizedPhoneE164,
    String? verificationId,
    int? resendToken,
    int? resendCooldownSeconds,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    User? firebaseUser,
    bool clearUser = false,
  }) {
    return PhoneAuthState(
      step: step ?? this.step,
      rawPhoneInput: rawPhoneInput ?? this.rawPhoneInput,
      normalizedPhoneE164: normalizedPhoneE164 ?? this.normalizedPhoneE164,
      verificationId: verificationId ?? this.verificationId,
      resendToken: resendToken ?? this.resendToken,
      resendCooldownSeconds: resendCooldownSeconds ?? this.resendCooldownSeconds,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      firebaseUser: clearUser ? null : (firebaseUser ?? this.firebaseUser),
    );
  }
}

/// Normalizes local Egyptian phone numbers (e.g. 01012345678) into E.164 (+201012345678).
String normalizeEgyptianPhoneE164(String input) {
  final digits = input.replaceAll(RegExp(r'[^\d+]'), '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+${digits.substring(2)}';
  if (digits.startsWith('20') && digits.length >= 12) return '+$digits';
  if (digits.startsWith('0') && digits.length == 11) {
    return '+2$digits';
  }
  if (digits.length == 10 && digits.startsWith('1')) {
    return '+20$digits';
  }
  return '+20$digits';
}

final firebaseAuthStateProvider = StreamProvider<User?>((ref) {
  try {
    return FirebaseAuth.instance.authStateChanges();
  } catch (_) {
    return const Stream.empty();
  }
});

class PhoneAuthNotifier extends StateNotifier<PhoneAuthState> {
  Timer? _cooldownTimer;

  PhoneAuthNotifier() : super(const PhoneAuthState()) {
    try {
      final current = FirebaseAuth.instance.currentUser;
      if (current != null) {
        state = state.copyWith(
          step: PhoneAuthStep.authenticated,
          firebaseUser: current,
          normalizedPhoneE164: current.phoneNumber ?? '',
        );
      }
    } catch (_) {
      // Firebase not initialized in isolated widget test mode
    }
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown([int seconds = 60]) {
    _cooldownTimer?.cancel();
    state = state.copyWith(resendCooldownSeconds: seconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.resendCooldownSeconds <= 1) {
        timer.cancel();
        state = state.copyWith(resendCooldownSeconds: 0);
      } else {
        state = state.copyWith(
          resendCooldownSeconds: state.resendCooldownSeconds - 1,
        );
      }
    });
  }

  Future<void> sendOtp(String phoneInput, {bool forceResend = false}) async {
    final trimmed = phoneInput.trim();
    if (trimmed.length < 10) {
      state = state.copyWith(
        errorMessage: 'يرجى إدخال رقم هاتف مصري صحيح مكون من ١١ رقماً.',
      );
      return;
    }

    final e164 = normalizeEgyptianPhoneE164(trimmed);
    state = state.copyWith(
      rawPhoneInput: trimmed,
      normalizedPhoneE164: e164,
      isLoading: true,
      clearError: true,
    );

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: e164,
        forceResendingToken: forceResend ? state.resendToken : null,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          await _signInWithCredential(credential);
        },
        verificationFailed: (FirebaseAuthException e) {
          state = state.copyWith(
            isLoading: false,
            errorMessage: _mapPhoneAuthErrorAr(e),
          );
        },
        codeSent: (String verificationId, int? resendToken) {
          state = state.copyWith(
            step: PhoneAuthStep.verifyOtp,
            verificationId: verificationId,
            resendToken: resendToken,
            isLoading: false,
            clearError: true,
          );
          _startCooldown(60);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          state = state.copyWith(verificationId: verificationId);
        },
      );
    } catch (err) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'تعذر بدء التحقق عبر الهاتف: $err',
      );
    }
  }

  Future<bool> verifyOtpCode(String smsCode) async {
    final code = smsCode.trim();
    if (code.length < 6) {
      state = state.copyWith(errorMessage: 'يرجى إدخال رمز التحقق المكون من ٦ أرقام.');
      return false;
    }
    final verificationId = state.verificationId;
    if (verificationId == null || verificationId.isEmpty) {
      state = state.copyWith(errorMessage: 'انتهت صلاحية جلسة التحقق، أعد إرسال الرمز.');
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: code,
      );
      return await _signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _mapPhoneAuthErrorAr(e),
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'فشل التحقق من الرمز: $e',
      );
      return false;
    }
  }

  Future<bool> _signInWithCredential(AuthCredential credential) async {
    try {
      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      final user = userCred.user;
      if (user != null) {
        await _ensureUserDocument(user);
      }
      state = state.copyWith(
        step: PhoneAuthStep.authenticated,
        isLoading: false,
        firebaseUser: user,
        clearError: true,
      );
      return true;
    } on FirebaseAuthException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _mapPhoneAuthErrorAr(e),
      );
      return false;
    }
  }

  Future<void> _ensureUserDocument(User user) async {
    try {
      final db = FirebaseFirestore.instance;
      final userRef = db.collection('users').doc(user.uid);
      final snap = await userRef.get();
      if (!snap.exists) {
        await userRef.set({
          'uid': user.uid,
          'displayName': user.displayName ?? 'عميل مشوار',
          'phone': user.phoneNumber ?? state.normalizedPhoneE164,
          'role': 'customer',
          'defaultCityId': 'city_el_bagour',
          'defaultLandmark': 'ميدان المحطة - وسط الباجور',
          'cashbackBalancePiasters': 2500,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
    } catch (_) {
      // Non-fatal if offline; Firestore rules validate server timestamps on sync
    }
  }

  void editPhoneNumber() {
    _cooldownTimer?.cancel();
    state = state.copyWith(
      step: PhoneAuthStep.enterPhone,
      resendCooldownSeconds: 0,
      clearError: true,
    );
  }

  Future<void> signOut() async {
    _cooldownTimer?.cancel();
    await FirebaseAuth.instance.signOut();
    state = const PhoneAuthState(step: PhoneAuthStep.enterPhone);
  }

  String _mapPhoneAuthErrorAr(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-phone-number':
        return 'رقم الهاتف غير صالح. أدخل رقماً مصرياً صحيحاً مثل 01012345678.';
      case 'invalid-verification-code':
        return 'رمز التحقق غير صحيح. تأكد من الرسالة وحاول مرة أخرى.';
      case 'session-expired':
        return 'انتهت صلاحية الرمز. اضغط على إعادة الإرسال.';
      case 'too-many-requests':
        return 'تم تجاوز الحد المسموح مؤقتاً، حاول بعد قليل.';
      case 'operation-not-allowed':
        return 'يرجى تفعيل تسجيل الدخول برقم الهاتف (Phone) من لوحة تحكم Firebase Console.';
      default:
        return e.message ?? 'حدث خطأ أثناء التحقق برقم الهاتف.';
    }
  }
}

final phoneAuthProvider =
    StateNotifierProvider<PhoneAuthNotifier, PhoneAuthState>((ref) {
  return PhoneAuthNotifier();
});
