import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppRole {
  customer,
  captain,
  merchant,
  operations,
}

class RoleNotifier extends StateNotifier<AppRole> {
  RoleNotifier() : super(AppRole.customer);

  void switchRole(AppRole newRole) {
    state = newRole;
  }
}

final roleProvider = StateNotifierProvider<RoleNotifier, AppRole>((ref) {
  return RoleNotifier();
});
