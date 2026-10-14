import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AudioLines, Bike, CheckCircle2, ChevronDown, CircleHelp, Clock3, Headphones, MapPin, Mic, Package, Search, ShieldCheck, ShoppingBag, Smartphone, Store, Upload, X } from 'lucide-react';
import { ApiError, apiRequest, getApiHealth, requestVoiceUploadIntent } from './api';

type Service = 'store' | 'parcel' | 'errand';
type RecordingState = 'idle' | 'recording' | 'ready' | 'unsupported' | 'error';
type ChatMessage = { id: string; messageType: 'text' | 'voice_note'; textBody?: string; audioUrl?: string; senderLabel?: string; createdAt: string };

const serviceCards: { id: Service; title: string; detail: string; icon: typeof Package }[] = [
  { id: 'store', title: 'اطلب من محل', detail: 'محلات وخدمات قريبة منك', icon: ShoppingBag },
  { id: 'parcel', title: 'ابعت حاجة', detail: 'طرود ومستندات بأمان', icon: Package },
  { id: 'errand', title: 'اقضيلي مشوار', detail: 'اشرح لنا محتاج إيه', icon: Bike },
];

function App() {
  const [service, setService] = useState<Service>('parcel');
  const [area] = useState('الباجور');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [details, setDetails] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'info' | 'error' | 'success'>('info');
  const [busy, setBusy] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isArabic, setIsArabic] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [phone, setPhone] = useState('');
  const health = getApiHealth();
  const [chatOrderId, setChatOrderId] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<number | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const t = (ar: string, en: string) => isArabic ? ar : en;

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const startRecording = async () => {
    setNotice('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingState('unsupported');
      setNoticeKind('error');
      setNotice(t('المتصفح ده مش بيدعم التسجيل الصوتي. تقدر تكتب رسالتك بدلًا منه.', 'This browser does not support audio recording. You can type your message instead.'));
      return;
    }
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = audioStream;
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(audioStream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        setAudioFile(new File([blob], `mashwar-voice-${Date.now()}.webm`, { type }));
        setRecordingState('ready');
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
      };
      mediaRecorder.start();
      setRecordSeconds(0);
      setRecordingState('recording');
      timer.current = window.setInterval(() => setRecordSeconds(value => value + 1), 1000);
    } catch {
      setRecordingState('error');
      setNoticeKind('error');
      setNotice(t('مش قادرين نوصل للميكروفون. راجع إذن التسجيل أو اكتب رسالتك.', 'Microphone access failed. Check permission or type your message instead.'));
    }
  };

  const stopRecording = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const cancelRecording = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === 'recording') recorder.current.onstop = null;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
    setAudioFile(null);
    setRecordingState('idle');
    setRecordSeconds(0);
  };

  const sendRequest = async () => {
    setNotice('');
    if (!pickup.trim() || !dropoff.trim()) {
      setNoticeKind('error');
      setNotice(t('اكتب مكان الاستلام والتوصيل الأول.', 'Please enter pickup and drop-off locations first.'));
      return;
    }
    setBusy(true);
    try {
      // Intentionally no mock success. This endpoint must be implemented and authenticated by the trusted API.
      const result = await apiRequest<{ orderId?: string; message?: string }>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          serviceTypeId: service === 'parcel' ? 'package' : service === 'store' ? 'restaurant_store' : 'errand',
          serviceAreaCode: area,
          pickupAddress: pickup.trim(),
          dropoffAddress: dropoff.trim(),
          description: details.trim(),
        }),
      });
      setNoticeKind('success');
      setNotice(result.message ?? t('تم إرسال الطلب للخادم.', 'Request sent to the server.'));
    } catch (error) {
      setNoticeKind('error');
      setNotice(error instanceof ApiError ? error.message : t('الطلب ما اتبعتش. اتأكد من الاتصال وحاول تاني.', 'Request was not sent. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const loadConversation = async () => {
    if (!chatOrderId.trim()) { setChatNotice(t('اكتب رقم الطلب الأول.', 'Enter an order ID first.')); return; }
    setChatBusy(true); setChatNotice('');
    try {
      const response = await apiRequest<{ messages: ChatMessage[] }>('/api/v1/orders/' + encodeURIComponent(chatOrderId.trim()) + '/messages');
      setChatMessages(Array.isArray(response.messages) ? response.messages : []);
    } catch (error) {
      setChatMessages([]); setChatNotice(error instanceof ApiError ? error.message : t('المحادثة مش متاحة دلوقتي.', 'Conversation is not available right now.'));
    } finally { setChatBusy(false); }
  };

  const sendChatMessage = async () => {
    if (!chatOrderId.trim() || !chatDraft.trim()) return;
    setChatBusy(true); setChatNotice('');
    try {
      const response = await apiRequest<{ message?: ChatMessage }>('/api/v1/orders/' + encodeURIComponent(chatOrderId.trim()) + '/messages', {
        method: 'POST', body: JSON.stringify({ clientMessageId: crypto.randomUUID(), messageType: 'text', textBody: chatDraft.trim() }),
      });
      if (response.message) setChatMessages(current => [...current, response.message!]);
      setChatDraft(''); setChatNotice(t('الخادم أكد إرسال الرسالة.', 'Server confirmed the message.'));
    } catch (error) {
      setChatNotice(error instanceof ApiError ? error.message : t('الرسالة ما اتبعتتش. جرّب تاني.', 'Message was not sent. Try again.'));
    } finally { setChatBusy(false); }
  };

  const sendVoiceNote = async () => {
    if (!audioFile) return;
    setChatNotice('');
    setChatBusy(true);
    try {
      // This flow deliberately requires a real authenticated order and upload-intent API.
      const orderId = chatOrderId.trim();
      if (!orderId) throw new Error('ORDER_ID_REQUIRED');
      const intent = await requestVoiceUploadIntent(orderId, audioFile);
      const upload = await fetch(intent.uploadUrl, { method: 'PUT', headers: { 'Content-Type': audioFile.type }, body: audioFile });
      if (!upload.ok) throw new Error('VOICE_UPLOAD_FAILED');
      await apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/voice-notes/complete`, {
        method: 'POST',
        body: JSON.stringify({ attachmentId: intent.attachmentId, fileName: audioFile.name, contentType: audioFile.type, sizeBytes: audioFile.size }),
      });
      setChatNotice(t('الخادم أكد إرسال التسجيل.', 'Server confirmed the voice note.'));
      setAudioFile(null);
      setRecordingState('idle');
      await loadConversation();
    } catch (error) {
      setChatNotice(error instanceof ApiError ? error.message : error instanceof Error && error.message === 'ORDER_ID_REQUIRED' ? t('اكتب رقم الطلب الأول.', 'Enter an order ID first.') : t('التسجيل لسه ما اتبعتش. الخدمة محتاجة توصيل الـ API والتخزين الآمن.', 'Voice note was not sent. The API and private storage must be connected.'));
    } finally {
      setChatBusy(false);
    }
  };

  const submitPhone = async () => {
    setNotice('');
    if (!phone.trim()) {
      setNoticeKind('error');
      setNotice(t('اكتب رقم موبايلك.', 'Enter your mobile number.'));
      return;
    }
    setBusy(true);
    try {
      await apiRequest('/api/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone: phone.trim() }) });
      setNoticeKind('success');
      setNotice(t('لو خدمة تسجيل الدخول متوصلة، هتوصلك خطوات التحقق.', 'If authentication is connected, you will receive verification instructions.'));
    } catch (error) {
      setNoticeKind('error');
      setNotice(error instanceof ApiError ? error.message : t('تسجيل الدخول مش متوصل لسه.', 'Sign-in is not connected yet.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Mashwar home"><span className="brand-mark"><Bike size={22} /></span><span><b>مشوار</b><small>MASHWAR</small></span></a>
        <nav className="desktop-nav" aria-label={t('التنقل الرئيسي', 'Main navigation')}>
          <a href="#services">{t('الخدمات', 'Services')}</a><a href="#how">{t('إزاي بيشتغل', 'How it works')}</a><a href="#help">{t('المساعدة', 'Help')}</a>
        </nav>
        <div className="top-actions">
          <button className="lang-button" onClick={() => setIsArabic(value => !value)}>{isArabic ? 'EN' : 'عربي'} <ChevronDown size={14} /></button>
          <button className="sign-in" onClick={() => setShowSignIn(true)}>{t('دخول / حساب جديد', 'Sign in')}</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse" /> {t('مشوارك يبدأ من هنا', 'YOUR LOCAL DELIVERY PARTNER')}</div>
            <h1>{t('مشوارك،', 'Your delivery,')}<br /><em>{t('بقى أسهل.', 'made easier.')}</em></h1>
            <p>{t('ابعت طرد، اطلب من محل، أو خلّينا نقضي لك مشوار. من الموبايل أو من المتصفح، من غير ما تحتاج تنزّل تطبيق.', 'Send a parcel, order from a local store, or ask us to run an errand. Use your browser or mobile app—no install required.')}</p>
            <div className="hero-actions"><a className="primary-button" href="#order">{t('ابدأ طلبك', 'Start an order')} <ArrowLeft size={18} /></a><a className="secondary-button" href="#how">{t('اعرف أكتر', 'Learn more')}</a></div>
            <div className="trust-points"><span><ShieldCheck size={16} /> {t('طلب واضح', 'Clear orders')}</span><span><Headphones size={16} /> {t('دعم ومساعدة', 'Support')}</span><span><Smartphone size={16} /> {t('من غير تنزيل', 'No install needed')}</span></div>
          </div>
          <div className="hero-art" aria-label={t('توضيح لخدمة التوصيل', 'Delivery illustration')}>
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="delivery-card"><div className="map-line"><span /><span /><span /></div><div className="pin pin-a"><MapPin size={18} /></div><div className="pin pin-b"><Store size={18} /></div><div className="rider-illustration"><Bike size={100} strokeWidth={1.2} /></div><div className="floating-tag tag-one"><CheckCircle2 size={16} /> {t('طلبك في أمان', 'Order protected')}</div><div className="floating-tag tag-two"><Clock3 size={16} /> {t('متابعة واضحة', 'Clear updates')}</div></div>
          </div>
        </section>

        <section className="services-section" id="services">
          <div className="section-heading"><div><span className="eyebrow">{t('اختار اللي محتاجه', 'WHAT DO YOU NEED?')}</span><h2>{t('مشوار واحد، حلول كتير', 'One service, many ways')}</h2></div><span className="area-chip"><MapPin size={15} /> {area} <span className="area-note">{t('نقطة البداية', 'launch area')}</span></span></div>
          <div className="service-grid">{serviceCards.map(card => { const Icon = card.icon; return <button key={card.id} className={service === card.id ? 'service-card selected' : 'service-card'} onClick={() => setService(card.id)}><span className="service-icon"><Icon size={23} /></span><span className="service-title">{t(card.title, card.id === 'store' ? 'Order from a store' : card.id === 'parcel' ? 'Send a parcel' : 'Run an errand')}</span><span className="service-detail">{t(card.detail, card.id === 'store' ? 'Local shops and services' : card.id === 'parcel' ? 'Parcels and documents' : 'Tell us what you need')}</span><span className="service-arrow"><ArrowLeft size={16} /></span></button>; })}</div>
        </section>

        <section className="order-layout" id="order">
          <div className="order-panel">
            <div className="panel-title"><div><span className="eyebrow">{t('ابدأ من هنا', 'GET STARTED')}</span><h2>{t('تفاصيل المشوار', 'Order details')}</h2></div><span className="step-pill">01 / 02</span></div>
            <div className="field-grid">
              <label>{t('مكان الاستلام', 'Pickup location')}<span className="input-wrap"><MapPin size={17} /><input value={pickup} onChange={event => setPickup(event.target.value)} placeholder={t('اكتب العنوان أو علامة مميزة', 'Address or landmark')} /></span></label>
              <label>{t('مكان التوصيل', 'Drop-off location')}<span className="input-wrap"><MapPin size={17} /><input value={dropoff} onChange={event => setDropoff(event.target.value)} placeholder={t('رايح فين؟', 'Where should it go?')} /></span></label>
            </div>
            <label className="details-label">{t('تفاصيل إضافية (اختياري)', 'Extra details (optional)')}<textarea value={details} onChange={event => setDetails(event.target.value)} rows={3} placeholder={t('اكتب اللي محتاج تقوله للكابتن...', 'Anything the captain should know...')} /></label>
            <button className="submit-order" onClick={sendRequest} disabled={busy}>{busy ? t('جاري الاتصال...', 'Connecting...') : t('متابعة الطلب', 'Continue order')} <ArrowLeft size={18} /></button>
            {notice && <div className={`notice ${noticeKind}`} role="status">{notice}</div>}
            <p className="api-status"><span className={health === 'online' ? 'status-dot online' : 'status-dot'} />{health === 'not_configured' ? t('ربط الطلبات الفعلي بالـ API لسه مطلوب', 'Live order API connection is still required') : health === 'offline' ? t('الاتصال بالخدمة غير متاح', 'Service is unavailable') : t('عنوان الـ API مضبوط؛ حالة الخدمة تحتاج تحقق', 'API URL configured; service health needs verification')}</p>
          </div>
          <aside className="order-aside"><div className="aside-art"><div className="package-box"><Package size={46} /></div><div className="aside-route"><span /><span /><span /></div><div className="aside-pin"><MapPin size={25} /></div></div><h3>{t('خطوات بسيطة، من غير تعقيد', 'Simple steps, no fuss')}</h3><ol><li><span>1</span><div><b>{t('حدد المشوار', 'Tell us what you need')}</b><small>{t('اكتب التفاصيل أو سجّل صوتك', 'Type details or record your voice')}</small></div></li><li><span>2</span><div><b>{t('راجع السعر والتأكيد', 'Review and confirm')}</b><small>{t('السعر النهائي لازم ييجي من الخادم', 'Final pricing must come from the server')}</small></div></li><li><span>3</span><div><b>{t('تابع طلبك', 'Follow your order')}</b><small>{t('حالة الطلب ومحادثة مع الكابتن', 'Order status and captain chat')}</small></div></li></ol><div className="support-note" id="help"><CircleHelp size={19} /><span><b>{t('محتاج مساعدة؟', 'Need help?')}</b><small>{t('الدعم والمحادثة هيتاحوا بعد ربط الحسابات والـ API.', 'Support and chat require the authenticated API connection.')}</small></span></div></aside>
        </section>

        <section className="chat-section" id="chat">
          <div className="section-heading"><div><span className="eyebrow">{t('تواصل على طلبك', 'ORDER COMMUNICATION')}</span><h2>{t('رسالة أو تسجيل صوتي', 'Text or voice message')}</h2></div></div>
          <div className="chat-panel">
            <div className="chat-intro"><span className="chat-head-icon"><Headphones size={22} /></span><div><b>{t('محادثة مرتبطة بالطلب', 'Order-linked conversation')}</b><small>{t('المحادثة هتظهر بعد تسجيل الدخول والتحقق من صلاحيتك على الطلب.', 'Conversation loads only after the API verifies your access to the order.')}</small></div></div>
            <div className="chat-order-input"><label htmlFor="chat-order-id">{t('رقم الطلب', 'Order ID')}</label><div><input id="chat-order-id" value={chatOrderId} onChange={event => setChatOrderId(event.target.value)} placeholder={t('رقم الطلب اللي عايز تتابعه', 'Order ID')} /><button className="record-button" onClick={loadConversation} disabled={chatBusy}>{chatBusy ? t('جاري التحميل...', 'Loading...') : t('فتح المحادثة', 'Open chat')}</button></div></div>
            <div className="voice-box"><div className="voice-copy"><span className="voice-icon"><Mic size={20} /></span><div><b>{t('مش حابب تكتب؟', 'Prefer not to type?')}</b><small>{t('سجّل رسالة صوتية بدل الكتابة', 'Record a voice note instead')}</small></div></div><div className="record-actions">{recordingState === 'recording' ? <><span className="recording-live"><span /> {Math.floor(recordSeconds / 60).toString().padStart(2,'0')}:{(recordSeconds % 60).toString().padStart(2,'0')}</span><button className="record-button stop" onClick={stopRecording}>{t('إيقاف', 'Stop')}</button><button className="icon-button" onClick={cancelRecording} aria-label={t('إلغاء التسجيل', 'Cancel recording')}><X size={17} /></button></> : recordingState === 'ready' && audioFile ? <><span className="audio-ready"><AudioLines size={18} /> {t('التسجيل جاهز', 'Recording ready')}</span><audio controls src={URL.createObjectURL(audioFile)} /><button className="icon-button" onClick={cancelRecording} aria-label={t('حذف التسجيل', 'Discard recording')}><X size={17} /></button></> : <button className="record-button" onClick={startRecording}><Mic size={16} /> {t('ابدأ تسجيل', 'Record voice')}</button>}</div>{recordingState === 'ready' && audioFile && <button className="send-voice" disabled={busy} onClick={sendVoiceNote}><Upload size={15} /> {t('إرسال التسجيل للطلب', 'Send voice note to order')}</button>}</div>
            <div className="chat-messages" aria-live="polite">{chatMessages.length === 0 ? <div className="chat-empty"><AudioLines size={22} /><span>{t('مفيش رسائل معروضة. افتح محادثة طلب حقيقية علشان نجيب الرسائل من الخادم.', 'No messages shown. Open an authorized order conversation to load messages from the server.')}</span></div> : chatMessages.map(message => <div className="chat-message" key={message.id}><small>{message.senderLabel ?? t('مشارك في الطلب', 'Order participant')} · {new Date(message.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</small>{message.messageType === 'voice_note' && message.audioUrl ? <audio controls src={message.audioUrl} /> : message.messageType === 'voice_note' ? <span className="chat-voice-placeholder"><AudioLines size={17} /> {t('رسالة صوتية (رابط التشغيل يحتاج صلاحية من الخادم)', 'Voice note (playback requires an authorized server URL)')}</span> : <p>{message.textBody}</p>}</div>)}</div>
            <div className="chat-compose"><textarea rows={2} value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder={t('اكتب رسالتك للكابتن...', 'Write a message to the captain...')} /><button className="submit-order" disabled={chatBusy || !chatOrderId.trim() || !chatDraft.trim()} onClick={sendChatMessage}>{t('إرسال الرسالة', 'Send message')} <ArrowLeft size={17} /></button></div>
            {chatNotice && <div className="notice info" role="status">{chatNotice}</div>}
            <p className="form-hint"><ShieldCheck size={15} /> {t('الرسائل والتسجيلات مش هتظهر إلا بعد تحقق الخادم من صلاحية الوصول للطلب.', 'Messages and recordings remain hidden unless the server authorizes access to the order.')}</p>
          </div>
        </section>

        <section className="how-section" id="how"><div className="section-heading"><div><span className="eyebrow">{t('مصمم للناس', 'MADE FOR EVERYONE')}</span><h2>{t('استخدم الطريقة اللي تريحك', 'Use the way that works for you')}</h2></div></div><div className="how-grid"><div><span><Search size={22} /></span><b>{t('من المتصفح', 'From your browser')}</b><p>{t('مش لازم تنزّل التطبيق علشان تبدأ.', 'No app installation needed to get started.')}</p></div><div><span><Mic size={22} /></span><b>{t('بالصوت أو الكتابة', 'Voice or text')}</b><p>{t('اختار الطريقة الأسهل ليك، حسب دعم جهازك.', 'Choose what works for you and your device.')}</p></div><div><span><Headphones size={22} /></span><b>{t('متابعة ومساعدة', 'Updates and support')}</b><p>{t('هنعرض الحالة الحقيقية للطلب، من غير وعود وهمية.', 'Real order status, without fake progress.')}</p></div></div></section>
      </main>
      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Bike size={19} /></span><span><b>مشوار</b><small>MASHWAR</small></span></a><p>{t('من الباجور، وبنجهّز للتوسع منطقة بمنطقة.', 'Starting in El Bagour, built to expand area by area.')}</p><small>© Mashwar · {t('خدمة محلية', 'Local delivery')}</small></footer>

      {showSignIn && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowSignIn(false); }}><section className="sign-in-modal" role="dialog" aria-modal="true" aria-labelledby="sign-in-title"><button className="modal-close" onClick={() => setShowSignIn(false)} aria-label={t('إغلاق', 'Close')}><X size={19} /></button><span className="modal-mark"><Bike size={26} /></span><h2 id="sign-in-title">{t('أهلاً بيك في مشوار', 'Welcome to Mashwar')}</h2><p>{t('تسجيل الدخول برقم الموبايل هيحتاج خدمة التحقق الفعلية.', 'Phone sign-in requires the live verification service.')}</p><label>{t('رقم الموبايل', 'Mobile number')}<input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx" /></label><button className="submit-order" disabled={busy} onClick={submitPhone}>{busy ? t('جاري الإرسال...', 'Sending...') : t('متابعة', 'Continue')} <ArrowLeft size={18} /></button>{notice && <div className={`notice ${noticeKind}`} role="status">{notice}</div>}<small>{t('لن نعرض نجاح تسجيل الدخول قبل تأكيد الخادم.', 'Sign-in will not be shown as successful until the server confirms.')}</small></section></div>}
    </div>
  );
}

export default App;
