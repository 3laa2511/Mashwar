import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:record/record.dart';

import '../data/order_chat_repository.dart';

class OrderChatScreen extends StatefulWidget {
  const OrderChatScreen({super.key, required this.orderId});
  final String orderId;

  @override
  State<OrderChatScreen> createState() => _OrderChatScreenState();
}

class _OrderChatScreenState extends State<OrderChatScreen> {
  final _repository = OrderChatRepository();
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<OrderChatMessage> _messages = [];
  String? _recordingPath;
  String? _error;
  bool _loading = true;
  bool _sending = false;
  bool _recording = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadMessages());
  }

  Future<void> _loadMessages() async {
    setState(() { _loading = true; _error = null; });
    try {
      final messages = await _repository.getMessages(widget.orderId);
      if (!mounted) return;
      setState(() { _messages = messages; _loading = false; });
    } catch (error) {
      if (!mounted) return;
      setState(() { _error = error.toString(); _loading = false; });
    }
  }

  Future<void> _sendText() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() { _sending = true; _error = null; });
    try {
      await _repository.sendText(widget.orderId, text);
      _messageController.clear();
      await _loadMessages();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleRecording() async {
    if (_recording) {
      final path = await _recorder.stop();
      if (mounted) setState(() { _recording = false; _recordingPath = path; });
      return;
    }
    try {
      if (!await _recorder.hasPermission()) {
        setState(() => _error = 'لازم تسمح باستخدام الميكروفون علشان تسجل رسالة صوتية.');
        return;
      }
      final path = await _repository.recordPath();
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
      if (mounted) setState(() { _recording = true; _recordingPath = path; _error = null; });
    } catch (error) {
      if (mounted) setState(() => _error = 'تعذر بدء التسجيل: $error');
    }
  }

  Future<void> _sendVoice() async {
    final path = _recordingPath;
    if (path == null || _sending) return;
    setState(() { _sending = true; _error = null; });
    try {
      await _repository.uploadVoiceNote(widget.orderId, path);
      setState(() => _recordingPath = null);
      await _loadMessages();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _playMessage(OrderChatMessage message) async {
    try {
      final url = message.audioUrl;
      if (url == null || url.isEmpty) {
        setState(() => _error = 'رابط تشغيل التسجيل غير متاح. حدّث المحادثة وحاول تاني.');
        return;
      }
      await _player.play(UrlSource(url));
    } catch (error) {
      if (mounted) setState(() => _error = 'تعذر تشغيل الرسالة الصوتية: $error');
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    unawaited(_recorder.dispose());
    unawaited(_player.dispose());
    _repository.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('محادثة الطلب'),
        actions: [IconButton(tooltip: 'تحديث الرسائل', onPressed: _loading ? null : _loadMessages, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Text('طلب رقم ${widget.orderId} · الرسائل متاحة لأطراف الطلب المصرح لهم فقط', style: Theme.of(context).textTheme.bodySmall),
          ),
          if (_error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Theme.of(context).colorScheme.errorContainer, borderRadius: BorderRadius.circular(12)),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.forum_outlined, size: 42),
                          SizedBox(height: 12),
                          Text('مفيش رسائل لسه', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
                          SizedBox(height: 6),
                          Text('اكتب رسالة أو ابعت تسجيل صوتي للتنسيق على الطلب.', textAlign: TextAlign.center),
                        ]),
                      ))
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(14),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          return Align(
                            alignment: AlignmentDirectional.centerStart,
                            child: Container(
                              constraints: const BoxConstraints(maxWidth: 320),
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(15)),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(message.senderLabel ?? 'مشارك في الطلب', style: Theme.of(context).textTheme.labelSmall),
                                const SizedBox(height: 5),
                                if (message.messageType == 'voice_note')
                                  OutlinedButton.icon(onPressed: () => _playMessage(message), icon: const Icon(Icons.play_arrow_rounded), label: const Text('تشغيل الرسالة الصوتية'))
                                else
                                  Text(message.textBody ?? ''),
                                const SizedBox(height: 4),
                                Text(TimeOfDay.fromDateTime(message.createdAt).format(context), style: Theme.of(context).textTheme.labelSmall),
                              ]),
                            ),
                          );
                        },
                      ),
          ),
          if (_recordingPath != null && !_recording)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Row(children: [
                const Icon(Icons.audio_file_outlined),
                const SizedBox(width: 8),
                const Expanded(child: Text('التسجيل جاهز للإرسال')),
                IconButton(tooltip: 'استمع للتسجيل', onPressed: () => _player.play(DeviceFileSource(_recordingPath!)), icon: const Icon(Icons.play_circle_outline)),
                IconButton(tooltip: 'حذف التسجيل', onPressed: () => setState(() => _recordingPath = null), icon: const Icon(Icons.delete_outline)),
                FilledButton(onPressed: _sending ? null : _sendVoice, child: Text(_sending ? 'جاري الإرسال' : 'إرسال')),
              ]),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                IconButton.filledTonal(
                  tooltip: _recording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية',
                  onPressed: _sending ? null : _toggleRecording,
                  icon: Icon(_recording ? Icons.stop_circle_outlined : Icons.mic_none_rounded),
                ),
                const SizedBox(width: 7),
                Expanded(child: TextField(
                  controller: _messageController,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(hintText: 'اكتب رسالتك...', border: OutlineInputBorder(), isDense: true),
                )),
                const SizedBox(width: 7),
                IconButton.filled(tooltip: 'إرسال الرسالة', onPressed: _sending ? null : _sendText, icon: const Icon(Icons.send_rounded)),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
