import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

class OrderChatMessage {
  const OrderChatMessage({required this.id, required this.messageType, required this.createdAt, this.textBody, this.audioUrl, this.senderLabel});
  final String id;
  final String messageType;
  final DateTime createdAt;
  final String? textBody;
  final String? audioUrl;
  final String? senderLabel;

  factory OrderChatMessage.fromJson(Map<String, dynamic> json) => OrderChatMessage(
    id: json['id']?.toString() ?? '',
    messageType: json['messageType']?.toString() ?? 'text',
    createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '')?.toLocal() ?? DateTime.now(),
    textBody: json['textBody']?.toString(),
    audioUrl: json['audioUrl']?.toString(),
    senderLabel: json['senderLabel']?.toString(),
  );
}

class OrderChatRepository {
  OrderChatRepository({http.Client? client, FlutterSecureStorage? storage, String? baseUrl})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage(),
        _baseUrl = (baseUrl ?? const String.fromEnvironment('MASHWAR_API_BASE_URL')).replaceAll(RegExp(r'/+$'), '');

  final http.Client _client;
  final FlutterSecureStorage _storage;
  final String _baseUrl;

  Future<Map<String, String>> _headers({bool jsonBody = false}) async {
    if (_baseUrl.isEmpty) throw const OrderChatException('لم يتم ضبط عنوان خادم مشوار على التطبيق.');
    final token = await _storage.read(key: 'access_token');
    if (token == null || token.trim().isEmpty) {
      throw const OrderChatException('سجّل الدخول الأول علشان تقدر تستخدم محادثة الطلب.');
    }
    return {'Accept': 'application/json', 'Authorization': 'Bearer $token', if (jsonBody) 'Content-Type': 'application/json'};
  }

  Map<String, dynamic> _decode(http.Response response) {
    dynamic parsed;
    try { parsed = jsonDecode(response.body); } catch (_) { throw const OrderChatException('استجابة الخادم غير مفهومة.'); }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = parsed is Map ? parsed['error']?['message'] : null;
      throw OrderChatException(message?.toString() ?? 'تعذر تنفيذ الطلب (${response.statusCode}).');
    }
    if (parsed is Map<String, dynamic> && parsed['data'] is Map<String, dynamic>) return parsed['data'] as Map<String, dynamic>;
    if (parsed is Map<String, dynamic>) return parsed;
    throw const OrderChatException('تنسيق بيانات المحادثة غير صحيح.');
  }

  Uri _uri(String path) => Uri.parse('$_baseUrl/api/v1$path');

  Future<List<OrderChatMessage>> getMessages(String orderId) async {
    final response = await _client.get(_uri('/orders/${Uri.encodeComponent(orderId)}/messages'), headers: await _headers());
    final messages = _decode(response)['messages'];
    if (messages is! List) return const [];
    return messages.whereType<Map>().map((item) => OrderChatMessage.fromJson(Map<String, dynamic>.from(item))).toList();
  }

  Future<void> sendText(String orderId, String text) async {
    final random = Random.secure();
    final id = List<int>.generate(16, (_) => random.nextInt(256)).map((value) => value.toRadixString(16).padLeft(2, '0')).join();
    final response = await _client.post(
      _uri('/orders/${Uri.encodeComponent(orderId)}/messages'),
      headers: await _headers(jsonBody: true),
      body: jsonEncode({'clientMessageId': id, 'messageType': 'text', 'textBody': text.trim()}),
    );
    _decode(response);
  }

  Future<String> recordPath() async {
    final directory = await getTemporaryDirectory();
    return '${directory.path}/mashwar_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
  }

  Future<void> uploadVoiceNote(String orderId, String filePath) async {
    final file = File(filePath);
    if (!await file.exists()) throw const OrderChatException('ملف التسجيل مش موجود على الجهاز.');
    final size = await file.length();
    if (size <= 0 || size > 15 * 1024 * 1024) throw const OrderChatException('حجم التسجيل غير مناسب. جرّب تسجيل أقصر.');
    final encodedOrderId = Uri.encodeComponent(orderId);
    final intentResponse = await _client.post(
      _uri('/orders/$encodedOrderId/voice-notes/upload-intent'),
      headers: await _headers(jsonBody: true),
      body: jsonEncode({'fileName': file.uri.pathSegments.last, 'contentType': 'audio/mp4', 'sizeBytes': size}),
    );
    final intent = _decode(intentResponse);
    final uploadUrl = intent['uploadUrl']?.toString();
    final attachmentId = intent['attachmentId']?.toString();
    if (uploadUrl == null || attachmentId == null) throw const OrderChatException('الخادم لم يوفر رابط رفع آمن للتسجيل.');
    final parsedUrl = Uri.tryParse(uploadUrl);
    if (parsedUrl == null || parsedUrl.scheme != 'https') throw const OrderChatException('رابط رفع التسجيل غير آمن.');
    final upload = await _client.put(parsedUrl, headers: {'Content-Type': 'audio/mp4'}, body: await file.readAsBytes());
    if (upload.statusCode < 200 || upload.statusCode >= 300) throw const OrderChatException('رفع التسجيل فشل. تقدر تحاول تاني.');
    final complete = await _client.post(
      _uri('/orders/$encodedOrderId/voice-notes/complete'),
      headers: await _headers(jsonBody: true),
      body: jsonEncode({'attachmentId': attachmentId, 'fileName': file.uri.pathSegments.last, 'contentType': 'audio/mp4', 'sizeBytes': size}),
    );
    _decode(complete);
  }

  void dispose() => _client.close();
}

class OrderChatException implements Exception {
  const OrderChatException(this.message);
  final String message;
  @override
  String toString() => message;
}
