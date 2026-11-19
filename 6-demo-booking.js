export function mountBooking() {
/* ملعب الالتراس — واجهة اللاعب (ديمو) */
(function () {
  'use strict';
  var S = window.Store;
  var state = S.load();

  var selDate = S.dISO(0);
  var selHour = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- بيانات ثابتة من الإعدادات ---------- */
  $('venueAddr').textContent = state.settings.venueAddress + ' (من صفحة فيسبوك الملعب)';
  $('faqAddr').textContent = state.settings.venueAddress + ' — تليفون الملعب: ' + state.settings.venuePhone;
  // ديمو: كل أزرار التواصل معاينة محاكاة — لا تفتح واتساب ولا تتصل فعليًا
  function demoPreview(title, msgText) {
    var old = document.querySelector('.demo-overlay'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'demo-overlay';
    ov.innerHTML = '<div class="demo-modal">' +
      '<h3>🧪 ' + title + '</h3>' +
      '<div style="font-size:12px;color:var(--gold);font-weight:700">معاينة تجريبية — مفيش رسالة اتبعتت ولا مكالمة اتعملت</div>' +
      '<div class="msg">' + esc(msgText) + '</div>' +
      '<button class="btn big" id="demoCloseBtn">فهمت، اقفل</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.id === 'demoCloseBtn') ov.remove(); });
  }
  $('waBtn').href = '#';
  $('callBtn').href = '#';
  $('waBtn').addEventListener('click', function (e) {
    e.preventDefault();
    demoPreview('في النسخة الحقيقية: يفتح واتساب الملعب', 'واتساب ← ' + state.settings.venuePhone + '\n\nالرسالة: السلام عليكم، عايز أحجز في ملعب الالتراس');
  });
  $('callBtn').addEventListener('click', function (e) {
    e.preventDefault();
    demoPreview('في النسخة الحقيقية: مكالمة تليفونية', 'اتصال ← ' + state.settings.venuePhone + ' (رقم الملعب المنشور على صفحة الفيسبوك)');
  });
  $('cancelHoursTxt').textContent = S.nf.format(state.settings.cancelHours) + ' ساعات';
  $('priceChip').textContent = 'من ' + S.money(state.settings.priceDay) + ' / الساعة';

  $('pricesBox').innerHTML =
    '<div class="row"><span>الساعة صبحي (' + S.hourLabel(state.settings.openHour) + ' - ' + S.hourLabel(state.settings.nightFrom) + ')</span><b>' + S.money(state.settings.priceDay) + '</b></div>' +
    '<div class="row"><span>الساعة بالكشافات (' + S.hourLabel(state.settings.nightFrom) + ' - ' + S.hourLabel(state.settings.closeHour) + ')</span><b>' + S.money(state.settings.priceNight) + '</b></div>' +
    '<div class="row"><span>العربون (بيتحسب من سعر الساعة)</span><b>' + S.money(state.settings.deposit) + '</b></div>' +
    '<div class="row total"><span>طريقة تأكيد العربون</span><b>تحويل إنستا باي + تأكيد يدوي من الملعب</b></div>';

  /* ---------- أقرب معاد ---------- */
  function renderNearest() {
    var n = S.nextAvailable();
    $('nearestTxt').textContent = n ? n.label : 'مفيش فترات فاضية في الـ ١٤ يوم الجايين';
  }

  /* ---------- محاكاة النت ---------- */
  function renderNet() {
    var t = $('netToggle');
    t.classList.toggle('off', !state.online);
    $('netLabel').textContent = state.online ? 'النت شغال' : 'مقطوع';
    $('offlineBanner').classList.toggle('hidden', state.online);
    $('confirmBtn').disabled = !state.online;
  }
  $('netToggle').addEventListener('click', function () {
    S.setOnline(!state.online);
    state = S.state;
    renderNet();
    renderSlots();
    toast(state.online ? 'النت رجع — الحجز أونلاين متاح تاني' : 'محاكاة انقطاع النت — الحجز أونلاين واقف مؤقتًا');
  });

  /* ---------- خطوات الحجز ---------- */
  function setStep(n) {
    document.querySelectorAll('#stepsBar .step').forEach(function (s, i) {
      s.classList.toggle('on', i === n - 1);
      s.classList.toggle('done', i < n - 1);
    });
  }

  /* ---------- شريط الأيام ---------- */
  var dFmtDay = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' });
  var dFmtMon = new Intl.DateTimeFormat('ar-EG', { month: 'short' });
  var tfTime = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' });
  function renderDates() {
    var strip = $('dateStrip');
    strip.innerHTML = '';
    for (var d = 0; d < 14; d++) {
      var iso = S.dISO(d);
      var dt = new Date(iso + 'T12:00:00');
      var btn = document.createElement('button');
      btn.className = 'day-pill' + (iso === selDate ? ' sel' : '');
      btn.innerHTML = '<span class="dw">' + (d === 0 ? 'النهارده' : d === 1 ? 'بكرة' : dFmtDay.format(dt)) + '</span>' +
        '<span class="dn">' + S.nf.format(dt.getDate()) + '</span>' +
        '<span class="dm">' + dFmtMon.format(dt) + '</span>';
      (function (i) {
        btn.addEventListener('click', function () { selDate = i; selHour = null; renderDates(); renderSlots(); hideForm(); setStep(2); });
      })(iso);
      strip.appendChild(btn);
    }
  }

  /* ---------- شبكة الفترات ---------- */
  function renderSlots() {
    var grid = $('slotGrid');
    grid.innerHTML = '';
    S.slotsFor(selDate).forEach(function (sl) {
      var b = document.createElement('button');
      var cls = 'slot ' + sl.status + (sl.past ? ' past' : '') + (sl.hour === selHour ? ' sel' : '');
      b.className = cls;
      var sub;
      if (sl.past) sub = 'فات';
      else if (sl.status === 'available') sub = S.money(sl.price);
      else if (sl.status === 'booked') sub = 'محجوزة';
      else if (sl.status === 'conflict') sub = 'مقفولة مؤقتًا';
      else sub = sl.reason || 'مغلق للصيانة';
      b.innerHTML = '<span class="t">' + sl.label + '</span><span class="p">' + sub + '</span>';
      if (sl.status === 'available' && !sl.past) {
        b.addEventListener('click', function () { selHour = sl.hour; renderSlots(); renderForm(); });
      } else {
        b.disabled = true;
      }
      grid.appendChild(b);
    });
    $('freshLine').textContent = 'آخر تحديث للمواعيد: ' + tfTime.format(new Date()) + ' — تخزين محلي تجريبي على الجهاز ده';
  }

  /* ---------- فورم الحجز ---------- */
  function hideForm() { $('bookingForm').classList.add('hidden'); $('doneBox').classList.add('hidden'); }

  function renderForm() {
    if (selHour === null) return;
    var price = S.priceFor(selHour);
    $('summaryBox').innerHTML =
      '<div class="row"><span>اليوم</span><b>' + S.fmtDate(selDate) + '</b></div>' +
      '<div class="row"><span>الفترة</span><b>' + S.slotLabel(selHour, state.settings.slotMinutes) + '</b></div>' +
      '<div class="row"><span>سعر الساعة</span><b>' + S.money(price) + '</b></div>' +
      '<div class="row"><span>العربون المطلوب دلوقتي</span><b>' + S.money(state.settings.deposit) + '</b></div>' +
      '<div class="row total"><span>الباقي عند الحضور</span><b>' + S.money(price - state.settings.deposit) + '</b></div>';
    $('bookingForm').classList.remove('hidden');
    $('doneBox').classList.add('hidden');
    setStep(3);
    $('bookingForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('confirmBtn').addEventListener('click', function () {
    if (!state.online) return;
    var name = $('bkName').value.trim();
    var phone = $('bkPhone').value.trim();
    if (name.length < 2) { toast('اكتب الاسم الأول'); return; }
    if (!/^01[0-9]{9}$/.test(phone)) { toast('اكتب رقم موبايل مصري صح (١١ رقم يبدأ بـ 01)'); return; }
    var weekly = $('weeklyChk').checked;
    var dayOff = Math.round((new Date(selDate + 'T12:00:00') - new Date(S.dISO(0) + 'T12:00:00')) / 86400000);
    var offs = weekly ? [0, 7, 14, 21] : [0];
    var created = [], skipped = 0;
    offs.forEach(function (off) {
      var iso = S.dISO(dayOff + off);
      var sl = S.slotsFor(iso).filter(function (s) { return s.hour === selHour; })[0];
      if (sl && sl.status === 'available' && !sl.past) {
        created.push(S.addBooking({ date: iso, hour: selHour, name: name, phone: phone, method: 'instapay', origin: 'online' }));
      } else { skipped++; }
    });
    if (!created.length) { toast('الفترة دي مش متاحة — اختار فترة تانية'); renderSlots(); return; }
    state = S.state;
    $('weeklyChk').checked = false;
    showDone(created, skipped);
  });

  function showDone(created, skipped) {
    $('bookingForm').classList.add('hidden');
    setStep(1);
    var box = $('doneBox');
    box.classList.remove('hidden');
    var bk = created[0];
    var multi = created.length > 1;
    var waText = 'أهلًا، أنا ' + bk.name + ' — حجزت ' +
      (multi ? 'ماتش ثابت أسبوعي (' + S.nf.format(created.length) + ' مواعيد) أولها ' : '') +
      S.fmtDate(bk.date) + ' ' + S.slotLabel(bk.hour) +
      ' (رقم الحجز ' + bk.ref + ') وده إثبات تحويل العربون:';
    var datesRows = created.map(function (b) {
      return '<div class="row"><span>' + S.fmtDate(b.date, false) + ' · <b class="ltr" style="white-space:nowrap">' + b.ref + '</b></span><b style="white-space:nowrap">' + S.slotLabel(b.hour) + '</b></div>';
    }).join('');
    box.innerHTML =
      '<div class="summary" style="margin-top:14px">' +
        '<div style="text-align:center;font-size:44px;line-height:1.4">⏳</div>' +
        '<div style="text-align:center;font-weight:800;font-size:16px">' +
          (multi ? 'اتسجلت ' + S.nf.format(created.length) + ' مواعيد' : 'حجزك اتسجل') +
          ' — <span style="color:var(--gold)">في انتظار العربون</span></div>' +
        (multi ? '' : '<div style="text-align:center;color:var(--muted);font-size:12.5px;margin-bottom:8px">رقم الحجز: <b class="ltr">' + bk.ref + '</b></div>') +
        datesRows +
        '<div class="row"><span>حوّل عربون' + (multi ? ' (' + S.nf.format(created.length) + ' مواعيد × ' + S.money(bk.deposit) + ')' : '') + '</span><b>' + S.money(bk.deposit * created.length) + '</b></div>' +
        '<div class="row"><span>على حساب إنستا باي (تجريبي — لا ترسل أموال)</span><b class="ltr" style="font-size:12px">' + state.settings.instapay + '</b></div>' +
      '</div>' +
      (skipped ? '<div class="note">فيه ' + S.nf.format(skipped) + ' ميعاد أسبوعي اتخطى لأنه مش متاح — الفترات المتاحة بس هي اللي اتحجزت.</div>' : '') +
      '<button class="btn gold big mt" id="waProofBtn">📤 ابعت صورة التحويل على واتساب الملعب</button>' +
      '<div class="note">صورة التحويل <b>مش إثبات استلام</b>. صاحب الملعب بيراجع تطبيق إنستا باي عنده ويأكد يدويًا، وساعتها حجزك يبقى «مؤكد». لو العربون ماتأكدش في المدة المتفق عليها، الفترة بترجع متاحة تلقائيًا.</div>';
    box.querySelector('#waProofBtn').addEventListener('click', function () {
      demoPreview('في النسخة الحقيقية: يفتح واتساب الملعب بالرسالة دي', waText + '\n[هنا يتم إرفاق صورة التحويل]');
    });
    renderSlots();
    renderNearest();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- حجوزاتي (OTP ديمو) ---------- */
  $('otpSendBtn').addEventListener('click', function () {
    var phone = $('otpPhone').value.trim();
    if (!/^01[0-9]{9}$/.test(phone)) { toast('اكتب رقم موبايل صح الأول'); return; }
    var code = S.requestOtp(phone);
    $('otpCodeShown').textContent = code;
    $('otpStep2').classList.remove('hidden');
  });

  $('otpVerifyBtn').addEventListener('click', function () {
    var phone = $('otpPhone').value.trim();
    var code = $('otpInput').value.trim();
    if (!S.verifyOtp(phone, code)) { toast('الرمز مش صح — اتأكد واكتبه تاني'); return; }
    renderMyList(phone);
  });

  function renderMyList(phone) {
    var list = S.bookingsForPhone(phone);
    var box = $('myList');
    if (!list.length) {
      box.innerHTML = '<div class="empty">مفيش حجوزات قادمة على الرقم ده.</div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'bk-row';
      row.innerHTML =
        '<div class="top"><div class="who"><b>' + esc(b.name) + '</b><span>' + b.ref + '</span></div>' +
        pillFor(b.status) + '</div>' +
        '<div class="meta"><b>' + S.fmtDate(b.date) + '</b> — ' + S.slotLabel(b.hour) + ' · ' + S.money(b.price) + '</div>';
      var acts = document.createElement('div');
      acts.className = 'acts';
      var cancel = document.createElement('button');
      cancel.className = 'btn danger small';
      cancel.textContent = 'إلغاء الحجز';
      cancel.addEventListener('click', function () {
        S.cancelBooking(b.id); state = S.state;
        toast('اتلغى الحجز ' + b.ref + ' — لو كنت دافع عربون راجع الملعب على استرجاعه');
        renderMyList(phone); renderSlots(); renderNearest();
      });
      acts.appendChild(cancel);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  function pillFor(st) {
    var map = {
      confirmed: ['مؤكد', 'confirmed'],
      awaiting_deposit: ['في انتظار العربون', 'awaiting_deposit'],
      offline_pending: ['معلّق — بانتظار المزامنة', 'offline_pending'],
      conflict: ['متضارب', 'conflict'],
      cancelled: ['ملغي', 'cancelled'],
      expired: ['انتهت — العربون ماتأكدش', 'cancelled']
    };
    var m = map[st] || [st, 'cancelled'];
    return '<span class="pill ' + m[1] + '">' + m[0] + '</span>';
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 3200);
  }

  /* ---------- تشغيل ---------- */
  renderNet(); renderDates(); renderSlots(); renderNearest();
})();

}
