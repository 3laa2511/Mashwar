import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../lib/app/app.dart';

void main() {
  testWidgets('MashwarApp smoke test: mounts MaterialApp.router with ProviderScope', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MashwarApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Verify presence of title or core landmarks
    expect(find.text('الباجور، المنوفية'), findsOneWidget);
    expect(find.text('توصيل طرد أو أمانة'), findsOneWidget);
    expect(find.text('توصيل ركاب (معلق مؤقتاً)'), findsOneWidget);
  });
}
