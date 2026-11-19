export function mountAdmin() {
/* ملعب الالتراس — لوحة صاحب الملعب (ديمو) */
(function () {
  'use strict';
  var S = window.Store;
  var state = S.load();
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 3400);
  }

  var STATUS_TXT = {
    confirmed: ['مؤكد', 'confirmed'],
    awaiting_deposit: ['في انتظار العربون', 'awaiting_deposit'],
    offline_pending: ['معلّق — لم يتزامن', 'offline_pending'],
    conflict: ['متضارب', 'conflict'],
    cancelled: ['ملغي', 'cancelled'],
    expired: ['انتهت — العربون ماتأكدش', 'cancelled']
  };
  function pill(st) {
    var m = STATUS_TXT[st] || [st, 'cancelled'];
    return '<span class="pill ' + m[1] + '">' + m[0] + '</span>';
  }
  var ORIGIN_TXT = { online: 'أونلاين', phone: 'تليفون', walkin: 'حضور' };

  /* ---------- محاكاة النت ---------- */
  function renderNet() {
    $('netToggle').classList.toggle('off', !state.online);
    $('netLabel').textContent = state.online ? 'النت شغال' : 'مقطوع';
    renderSyncBar();
  }
  $('netToggle').addEventListener('click', function () {
    S.setOnline(!state.online); state = S.state;
    renderNet();
    toast(state.online ? 'النت رجع — زامِن العناصر المعلقة' : 'محاكاة انقطاع — التسجيل هيفضل محلي على الجهاز');
  });

  function renderSyncBar() {
    var n = S.pendingSyncCount();
    $('syncBar').classList.toggle('hidden', !(state.online && n > 0));
    $('syncTxt').textContent = 'فيه ' + S.nf.format(n) + ' عنصر متسجل أوفلاين ومستني المزامنة';
  }
  $('syncBtn').addEventListener('click', function () {
    var r = S.syncNow(); state = S.state;
    renderAll();
    if (r.conflicts.length) {
      toast('المزامنة كشفت ' + S.nf.format(r.conflicts.length) + ' تضارب — الفترات اتقفلت ومستنياك تحسمها');
    } else {
      toast('اتزامن ' + S.nf.format(r.synced) + ' عنصر بنجاح — مفيش تضارب');
    }
  });

  /* ---------- التضارب ---------- */
  function renderConflicts() {
    var area = $('conflictArea');
    var groups = S.conflicts();
    area.innerHTML = '';
    groups.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'card';
      card.style.borderColor = 'rgba(240,86,79,.55)';
      var h = '<div class="section-title" style="color:var(--red)"><span class="ic">⚠️</span>تضارب — بانتظار قرارك</div>' +
        '<div class="section-sub">نفس الفترة اتحجزت مرتين (غالبًا واحدة أونلاين وواحدة أوفلاين). الفترة <b>مقفولة</b> قدام أي حجز جديد لحد ما تحسم. اختر مين يفضل والتاني هيتلغي:</div>';
      g.forEach(function (b) {
        h += '<div class="bk-row"><div class="top"><div class="who"><b>' + esc(b.name) + '</b><span>' + b.ref + ' · ' + (ORIGIN_TXT[b.origin] || b.origin) + '</span></div>' + pill('conflict') + '</div>' +
          '<div class="meta"><b>' + S.fmtDate(b.date) + '</b> — ' + S.slotLabel(b.hour) + ' · موبايل <span class="ltr">' + esc(b.phone) + '</span></div>' +
          '<div class="acts"><button class="btn small" data-keep="' + b.id + '">خلي حجز ' + esc(b.name.split(' ')[0]) + '</button></div></div>';
      });
      card.innerHTML = h;
      area.appendChild(card);
    });
    area.querySelectorAll('[data-keep]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.resolveConflict(btn.getAttribute('data-keep')); state = S.state;
        toast('اتحسم التضارب — الفترة رجعت محجوزة بشكل سليم');
        renderAll();
      });
    });
  }

  /* ---------- طابور «محتاج تدخلك» ---------- */
  function renderActionQueue() {
    var box = $('actionQueue');
    var pending = state.bookings.filter(function (b) { return b.status === 'awaiting_deposit' && !S.isPast(b.date, b.hour); }).length;
    var confs = S.conflicts().length;
    var unsynced = S.pendingSyncCount();
    if (!pending && !confs && !unsynced) {
      box.innerHTML = '<div class="aq ok">✅ مفيش حاجة مستنياك — الحجوزات والحسابات واضحة.</div>';
      return;
    }
    var h = '<div class="aq"><div class="aq-title">محتاج تدخلك دلوقتي</div>';
    if (confs) h += '<button class="aq-item red" data-aq="conflict">⚠️ ' + S.nf.format(confs) + ' تضارب بانتظار حسمك<span>اضغط للمراجعة ←</span></button>';
    if (pending) h += '<button class="aq-item" data-aq="bookings">💰 ' + S.nf.format(pending) + ' حجز مستني تأكيد عربون (كل الأيام القادمة)<span>راجعها في الحجوزات ←</span></button>';
    if (unsynced) h += '<button class="aq-item slate" data-aq="sync">📡 ' + S.nf.format(unsynced) + ' عنصر متسجل أوفلاين مستني المزامنة<span>' + (state.online ? 'زامِن دلوقتي ←' : 'هيتزامن لما النت يرجع') + '</span></button>';
    box.innerHTML = h + '</div>';
    box.querySelectorAll('[data-aq]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-aq');
        if (k === 'bookings') { document.querySelector('.tab[data-tab="bookings"]').click(); }
        else if (k === 'conflict') { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (k === 'sync') {
          if (state.online) { $('syncBtn').click(); }
          else { toast('النت مقطوع — المزامنة هتتعمل لما يرجع'); }
        }
      });
    });
  }

  /* ---------- تبويبات ---------- */
  var tabIds = ['today', 'add', 'bookings', 'expenses', 'maintenance', 'settings'];
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('sel', t === b); });
    tabIds.forEach(function (id) { $('tab-' + id).classList.toggle('hidden', id !== b.dataset.tab); });
  });

  /* ---------- اليوم ---------- */
  function renderToday() {
    var iso = S.dISO(0);
    var todays = state.bookings.filter(function (b) { return b.date === iso && b.status !== 'cancelled'; });
    var pending = todays.filter(function (b) { return b.status === 'awaiting_deposit'; }).length;
    var income = todays.filter(function (b) { return b.status === 'confirmed'; }).reduce(function (t, b) { return t + b.price; }, 0);
    $('todayStats').innerHTML =
      '<div class="stat"><b>' + S.nf.format(todays.length) + '</b><span>حجز النهارده</span></div>' +
      '<div class="stat gold"><b>' + S.nf.format(pending) + '</b><span>مستني تأكيد عربون (النهارده بس)</span></div>' +
      '<div class="stat green"><b>' + S.money(income) + '</b><span>دخل مؤكد النهارده</span></div>';

    var list = $('todayList');
    if (!todays.length) { list.innerHTML = '<div class="empty">مفيش حجوزات النهارده لسه.</div>'; return; }
    list.innerHTML = '';
    todays.sort(function (a, b) { return a.hour - b.hour; }).forEach(function (b) {
      list.appendChild(bookingRow(b, true));
    });

    var m = S.monthSummary();
    $('monthBox').innerHTML =
      '<div class="summary" style="margin-top:0">' +
      '<div class="row"><span>إجمالي الحجوزات المؤكدة الشهر ده</span><b>' + S.money(m.income) + '</b></div>' +
      '<div class="row"><span>إجمالي المصاريف الشهر ده</span><b style="color:var(--red)">' + S.money(m.expenses) + '</b></div>' +
      '<div class="row total"><span>الصافي التقديري</span><b>' + S.money(m.net) + '</b></div></div>';
  }

  function bookingRow(b, withActions) {
    var row = document.createElement('div');
    row.className = 'bk-row' + (b.synced === false ? ' offline' : '');
    row.innerHTML =
      '<div class="top"><div class="who"><b>' + esc(b.name) + '</b><span>' + b.ref + ' · ' + (ORIGIN_TXT[b.origin] || b.origin) + (b.synced === false ? ' · محلي' : '') + '</span></div>' + pill(b.status) + '</div>' +
      '<div class="meta"><b>' + S.fmtDate(b.date) + '</b> — ' + S.slotLabel(b.hour) + ' · ' + S.money(b.price) + ' · موبايل <span class="ltr">' + esc(b.phone) + '</span></div>';
    if (withActions) {
      var acts = document.createElement('div');
      acts.className = 'acts';
      if (b.status === 'awaiting_deposit') {
        var ok = document.createElement('button');
        ok.className = 'btn small'; ok.textContent = '✓ تأكيد استلام العربون';
        ok.addEventListener('click', function () {
          S.confirmDeposit(b.id); state = S.state; renderAll(); toast('اتأكد الحجز ' + b.ref);
        });
        var no = document.createElement('button');
        no.className = 'btn danger small'; no.textContent = 'ماتوصلش — إلغاء';
        no.addEventListener('click', function () {
          S.rejectDeposit(b.id); state = S.state; renderAll(); toast('اتلغى الحجز ' + b.ref + ' والفترة رجعت متاحة');
        });
        acts.appendChild(ok); acts.appendChild(no);
      } else if (b.status === 'confirmed') {
        var cx = document.createElement('button');
        cx.className = 'btn danger small'; cx.textContent = 'إلغاء الحجز';
        cx.addEventListener('click', function () {
          S.cancelBooking(b.id); state = S.state; renderAll(); toast('اتلغى الحجز ' + b.ref);
        });
        acts.appendChild(cx);
      }
      if (acts.children.length) row.appendChild(acts);
    }
    return row;
  }

  /* ---------- تسجيل حجز ---------- */
  function renderAddForm() {
    var dsel = $('addDate');
    dsel.innerHTML = '';
    for (var d = 0; d < 14; d++) {
      var iso = S.dISO(d);
      var o = document.createElement('option');
      o.value = iso;
      o.textContent = (d === 0 ? 'النهارده — ' : d === 1 ? 'بكرة — ' : '') + S.fmtDate(iso);
      dsel.appendChild(o);
    }
    renderAddHours();
  }
  $('addDate').addEventListener('change', renderAddHours);
  function renderAddHours() {
    var iso = $('addDate').value || S.dISO(0);
    var hsel = $('addHour');
    hsel.innerHTML = '';
    var any = false;
    S.slotsFor(iso).forEach(function (sl) {
      if (sl.status === 'available' && !sl.past) {
        any = true;
        var o = document.createElement('option');
        o.value = sl.hour;
        o.textContent = sl.label + ' — ' + S.money(sl.price);
        hsel.appendChild(o);
      }
    });
    if (!any) { var o = document.createElement('option'); o.textContent = 'مفيش فترات فاضية في اليوم ده'; hsel.appendChild(o); }
  }

  $('addBtn').addEventListener('click', function () {
    var iso = $('addDate').value;
    var hour = Number($('addHour').value);
    var name = $('addName').value.trim();
    var phone = $('addPhone').value.trim();
    if (isNaN(hour)) { toast('اختار فترة متاحة الأول'); return; }
    if (name.length < 2) { toast('اكتب اسم العميل'); return; }
    if (!/^01[0-9]{9}$/.test(phone)) { toast('اكتب رقم موبايل صح'); return; }
    var bk = S.addBooking({ date: iso, hour: hour, name: name, phone: phone, method: $('addMethod').value, origin: 'phone' });
    state = S.state;
    renderAll();
    toast(bk.status === 'offline_pending'
      ? 'اتسجل محليًا بحالة «معلّق» — هيتزامن لما النت يرجع'
      : bk.status === 'confirmed' ? 'اتسجل واتأكد (كاش)' : 'اتسجل — في انتظار العربون');
    $('addName').value = ''; $('addPhone').value = '';
  });

  /* ---------- كل الحجوزات ---------- */
  function renderAllBookings() {
    var list = $('allList');
    var upcoming = state.bookings.filter(function (b) {
      return b.status !== 'cancelled' && b.status !== 'expired' && !S.isPast(b.date, b.hour);
    }).sort(function (a, b) { return (a.date + ':' + a.hour) < (b.date + ':' + b.hour) ? -1 : 1; });
    if (!upcoming.length) { list.innerHTML = '<div class="empty">مفيش حجوزات قادمة.</div>'; return; }
    list.innerHTML = '';
    upcoming.forEach(function (b) { list.appendChild(bookingRow(b, true)); });
  }

  /* ---------- المصاريف ---------- */
  function renderExpenses() {
    $('expDate').value = S.dISO(0);
    var list = $('expList');
    if (!state.expenses.length) { list.innerHTML = '<div class="empty">مفيش مصاريف مسجلة.</div>'; return; }
    list.innerHTML = '';
    state.expenses.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (x) {
      var row = document.createElement('div');
      row.className = 'mini-row';
      row.innerHTML = '<div class="w"><b>' + esc(x.category) + '</b><span>' + S.fmtDate(x.date, false) + (x.note ? ' — ' + esc(x.note) : '') + (x.synced === false ? ' · محلي لم يتزامن' : '') + '</span></div>' +
        '<div class="amt" style="color:var(--red)">- ' + S.money(x.amount) + '</div>';
      list.appendChild(row);
    });
  }
  $('expAddBtn').addEventListener('click', function () {
    var amount = Number($('expAmount').value);
    if (!amount || amount <= 0) { toast('اكتب مبلغ صح'); return; }
    S.addExpense({ date: $('expDate').value || S.dISO(0), category: $('expCat').value, amount: amount, note: $('expNote').value.trim() });
    state = S.state;
    renderAll();
    toast(state.online ? 'اتسجل المصروف' : 'اتسجل محليًا — هيتزامن لما النت يرجع');
    $('expAmount').value = ''; $('expNote').value = '';
  });

  /* ---------- الصيانة ---------- */
  var ISSUE_TXT = { open: ['مفتوح', 'open'], fixing: ['قيد الإصلاح', 'fixing'], done: ['تم', 'done'] };
  function renderMaintenance() {
    var list = $('mntList');
    if (!state.issues.length) { list.innerHTML = '<div class="empty">مفيش بلاغات.</div>'; return; }
    list.innerHTML = '';
    state.issues.forEach(function (m) {
      var t = ISSUE_TXT[m.status];
      var row = document.createElement('div');
      row.className = 'mini-row';
      row.innerHTML = '<div class="w"><b>' + esc(m.title) + '</b><span>' + esc(m.category) + ' — ' + S.fmtDate(m.date, false) + (m.note ? ' — ' + esc(m.note) : '') + '</span></div>';
      var btn = document.createElement('button');
      btn.className = 'btn ghost small';
      btn.innerHTML = '<span class="pill ' + t[1] + '">' + t[0] + '</span>';
      btn.title = 'دوس لتغيير الحالة';
      btn.addEventListener('click', function () { S.cycleIssue(m.id); state = S.state; renderMaintenance(); });
      row.appendChild(btn);
      list.appendChild(row);
    });
  }
  $('mntAddBtn').addEventListener('click', function () {
    var title = $('mntTitle').value.trim();
    if (title.length < 3) { toast('اكتب وصف البلاغ'); return; }
    S.addIssue({ title: title, category: $('mntCat').value });
    state = S.state;
    renderMaintenance();
    toast('اتسجل البلاغ بحالة «مفتوح»');
    $('mntTitle').value = '';
  });

  function renderClosures() {
    var dsel = $('closeDate');
    dsel.innerHTML = '';
    for (var d = 0; d < 14; d++) {
      var iso = S.dISO(d);
      var o = document.createElement('option');
      o.value = iso; o.textContent = S.fmtDate(iso);
      dsel.appendChild(o);
    }
    var from = $('closeFrom'), to = $('closeTo');
    from.innerHTML = ''; to.innerHTML = '';
    for (var h = state.settings.openHour; h < state.settings.closeHour; h++) {
      var o1 = document.createElement('option'); o1.value = h; o1.textContent = S.hourLabel(h); from.appendChild(o1);
      var o2 = document.createElement('option'); o2.value = h + 1; o2.textContent = S.hourLabel(h + 1); to.appendChild(o2);
    }
    to.value = String(state.settings.openHour + 1);

    var list = $('closeList');
    var act = state.closures.filter(function (c) { return c.active; });
    if (!act.length) { list.innerHTML = '<div class="empty">مفيش فترات مقفولة دلوقتي.</div>'; return; }
    list.innerHTML = '';
    act.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'mini-row';
      row.innerHTML = '<div class="w"><b>' + esc(c.reason) + '</b><span>' + S.fmtDate(c.date, false) + ' — من ' + S.hourLabel(c.fromHour) + ' لـ ' + S.hourLabel(c.toHour) + '</span></div>';
      var btn = document.createElement('button');
      btn.className = 'btn danger small'; btn.textContent = 'افتح تاني';
      btn.addEventListener('click', function () { S.removeClosure(c.id); state = S.state; renderClosures(); toast('الفترات رجعت متاحة'); });
      row.appendChild(btn);
      list.appendChild(row);
      // الحجوزات القائمة في الفترة المقفولة: محفوظة حتى يحسمها صاحب الملعب بنفسه
      var affected = S.closureAffected(c);
      if (affected.length) {
        var warn = document.createElement('div');
        warn.style.cssText = 'border:1px solid rgba(245,166,35,.45);background:rgba(245,166,35,.07);border-radius:12px;padding:10px 12px;margin-top:6px;font-size:12.5px';
        warn.innerHTML = '<b style="color:var(--amber)">⚠️ ' + S.nf.format(affected.length) + ' حجز قائم في الفترة دي — محفوظين ومش هيتقفلوا لوحدهم.</b> راجع كل واحد: سيبه أو الغِه وتواصل مع العميل بنفسك.';
        affected.forEach(function (bk) {
          var br = document.createElement('div');
          br.className = 'mini-row';
          br.innerHTML = '<div class="w"><b>' + esc(bk.name) + '</b><span>' + bk.ref + ' — ' + S.slotLabel(bk.hour) + ' · <span class="ltr">' + esc(bk.phone) + '</span></span></div>';
          var cxl = document.createElement('button');
          cxl.className = 'btn danger small'; cxl.textContent = 'إلغاء الحجز';
          cxl.addEventListener('click', function () {
            S.cancelBooking(bk.id); state = S.state; renderClosures(); renderToday(); renderAllBookings();
            toast('اتلغى ' + bk.ref + ' — تواصل مع العميل بنفسك، مفيش رسالة اتبعتت (ديمو)');
          });
          br.appendChild(cxl);
          warn.appendChild(br);
        });
        list.appendChild(warn);
      }
    });
  }
  $('closeAddBtn').addEventListener('click', function () {
    var fromH = Number($('closeFrom').value), toH = Number($('closeTo').value);
    if (toH <= fromH) { toast('وقت النهاية لازم يبقى بعد البداية'); return; }
    var res = S.addClosure({ date: $('closeDate').value, fromHour: fromH, toHour: toH, reason: $('closeReason').value.trim() || 'صيانة' });
    state = S.state;
    renderClosures();
    if (res.affected.length) {
      toast('اتقفلت الفترات الفاضية بس — فيه ' + S.nf.format(res.affected.length) + ' حجز قائم محفوظ ومحتاج قرارك تحت');
    } else {
      toast('اتقفلت الفترات — هتختفي من واجهة الحجز');
    }
    $('closeReason').value = '';
  });

  /* ---------- الإعدادات ---------- */
  function renderSettings() {
    $('setPriceDay').value = state.settings.priceDay;
    $('setPriceNight').value = state.settings.priceNight;
    $('setDeposit').value = state.settings.deposit;
    $('setInstapay').value = state.settings.instapay;
  }
  $('setSaveBtn').addEventListener('click', function () {
    state.settings.priceDay = Number($('setPriceDay').value) || state.settings.priceDay;
    state.settings.priceNight = Number($('setPriceNight').value) || state.settings.priceNight;
    state.settings.deposit = Number($('setDeposit').value) || state.settings.deposit;
    state.settings.instapay = $('setInstapay').value.trim() || state.settings.instapay;
    S.save();
    toast('اتحفظت الإعدادات (تجريبية)');
  });
  /* confirm() مش متاح في كل البيئات (المعاينة المستضافة) → تأكيد بضغطتين */
  var resetArmed = null;
  $('resetBtn').addEventListener('click', function () {
    if (!resetArmed) {
      var btn = this;
      btn.textContent = 'متأكد؟ دوس تاني خلال ٣ ثواني للمسح';
      resetArmed = setTimeout(function () { resetArmed = null; btn.textContent = 'إعادة ضبط البيانات التجريبية من الأول'; }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    this.textContent = 'إعادة ضبط البيانات التجريبية من الأول';
    state = S.reset();
    renderAll();
    toast('اتعملت إعادة ضبط — بيانات تجريبية جديدة');
  });

  function renderAll() {
    renderNet(); renderSyncBar(); renderConflicts(); renderActionQueue();
    renderToday(); renderAddForm(); renderAllBookings();
    renderExpenses(); renderMaintenance(); renderClosures(); renderSettings();
  }
  renderAll();
})();

}
