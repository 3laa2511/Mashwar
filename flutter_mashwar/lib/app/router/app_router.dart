import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/customer_home/presentation/screens/customer_home_screen.dart';
import '../../features/delivery_booking/presentation/screens/booking_screen.dart';
import '../../features/order_tracking/presentation/screens/order_tracking_screen.dart';
import '../../features/order_chat/presentation/order_chat_screen.dart';
import '../../features/order_history/presentation/screens/order_history_screen.dart';
import '../../features/captain/presentation/screens/captain_dashboard_screen.dart';
import '../../features/merchant/presentation/screens/merchant_workspace_screen.dart';
import '../../features/operations/presentation/screens/operations_dashboard_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/customer',
  routes: [
    GoRoute(
      path: '/',
      redirect: (context, state) => '/customer',
    ),
    GoRoute(
      path: '/customer',
      builder: (context, state) => const CustomerHomeScreen(),
      routes: [
        GoRoute(
          path: 'book',
          builder: (context, state) => const BookingScreen(),
        ),
        GoRoute(
          path: 'order/:id',
          builder: (context, state) {
            final orderId = state.pathParameters['id'] ?? '';
            return OrderTrackingScreen(orderId: orderId);
          },
          routes: [
            GoRoute(
              path: 'chat',
              builder: (context, state) {
                final orderId = state.pathParameters['id'] ?? '';
                return OrderChatScreen(orderId: orderId);
              },
            ),
          ],
        ),
        GoRoute(
          path: 'history',
          builder: (context, state) => const OrderHistoryScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/captain',
      builder: (context, state) => const CaptainDashboardScreen(),
    ),
    GoRoute(
      path: '/merchant',
      builder: (context, state) => const MerchantWorkspaceScreen(),
    ),
    GoRoute(
      path: '/operations',
      builder: (context, state) => const OperationsDashboardScreen(),
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(title: const Text('صفحة غير موجودة')),
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('خطأ 404: المسار غير متاح'),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: () => context.go('/customer'),
            child: const Text('العودة للرئيسية'),
          ),
        ],
      ),
    ),
  ),
);
