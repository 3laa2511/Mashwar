import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../providers/phone_auth_provider.dart';

class PhoneAuthScreen extends ConsumerStatefulWidget {
  const PhoneAuthScreen({super.key});

  @override
  ConsumerState<PhoneAuthScreen> createState() => _PhoneAuthScreenState();
}

class _PhoneAuthScreenState extends ConsumerState<PhoneAuthScreen> {
  final _phoneController = TextEditingController(text: '01012345678');
  final _otpController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(phoneAuthProvider);
    final authNotifier = ref.read(phoneAuthProvider.notifier);

    ref.listen<PhoneAuthState>(phoneAuthProvider, (prev, next) {
      if (next.step == PhoneAuthStep.authenticated &&
          prev?.step != PhoneAuthStep.authenticated) {
        if (mounted) context.go('/customer');
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('تسجيل الدخول برقم الهاتف'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.secondary.withValues(alpha: 0.25)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.sms_rounded, size: 44, color: AppColors.secondary),
                  SizedBox(height: 12),
                  Text(
                    'أهلاً بك في مشوار الباجور',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'سجل دخولك برقم الموبايل المصري واستلم كود التحقق (OTP) في ثوانٍ لطلب التوصيل أو المشاوير.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: AppColors.slate600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (authState.errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: Text(
                  authState.errorMessage!,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            if (authState.step == PhoneAuthStep.enterPhone) ...[
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.8),
                  decoration: InputDecoration(
                    labelText: 'رقم الموبايل المصري',
                    helperText: 'مثال: 01012345678 — يُحول تلقائياً إلى 20+',
                    hintText: '1012345678',
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surfaceContainerLow,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.slate300, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.secondary, width: 2),
                    ),
                    prefixIcon: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('🇪🇬', style: TextStyle(fontSize: 16)),
                          SizedBox(width: 4),
                          Text(
                            '+20',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              color: AppColors.secondaryDark,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: authState.isLoading
                    ? null
                    : () => authNotifier.sendOtp(_phoneController.text),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.secondary,
                  minimumSize: const Size.fromHeight(52),
                  shape: const StadiumBorder(),
                ),
                icon: authState.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.lock_open_rounded),
                label: Text(
                  authState.isLoading
                      ? 'جاري إرسال رمز التحقق...'
                      : 'إرسال كود التحقق (OTP)',
                ),
              ),
            ] else if (authState.step == PhoneAuthStep.verifyOtp) ...[
              Text(
                'أدخل الكود المكون من ٦ أرقام المرسل إلى ${authState.normalizedPhoneE164}',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 10,
                  ),
                  decoration: InputDecoration(
                    labelText: 'رمز التحقق (OTP)',
                    hintText: '••••••',
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surfaceContainerLow,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.secondary, width: 2),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: authState.isLoading
                    ? null
                    : () => authNotifier.verifyOtpCode(_otpController.text),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.secondary,
                  minimumSize: const Size.fromHeight(52),
                  shape: const StadiumBorder(),
                ),
                child: Text(
                  authState.isLoading ? 'جاري التأكيد...' : 'تأكيد الرمز والدخول',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: authState.isLoading
                        ? null
                        : () => authNotifier.editPhoneNumber(),
                    child: const Text('تغيير رقم الهاتف'),
                  ),
                  TextButton(
                    onPressed: (authState.isLoading ||
                            authState.resendCooldownSeconds > 0)
                        ? null
                        : () => authNotifier.sendOtp(
                              authState.rawPhoneInput,
                              forceResend: true,
                            ),
                    child: Text(
                      authState.resendCooldownSeconds > 0
                          ? 'إعادة الإرسال بعد ${authState.resendCooldownSeconds} ث'
                          : 'إعادة إرسال الكود',
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => context.go('/customer'),
              child: const Text('تصفح التطبيق كضيف'),
            ),
          ],
        ),
      ),
    );
  }
}
