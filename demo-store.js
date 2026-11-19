/* ملعب الالتراس — الزقازيق — نسخة تجريبية (ديمو)
   طبقة البيانات: تخزين محلي localStorage + محاكاة أوفلاين/مزامنة.
   كل البيانات (أسعار، حجوزات، أسماء، مصاريف) وهمية لأغراض العرض فقط. */
(function () {
  'use strict';

  var LS_KEY = 'ultras_demo_v1';

  var DEFAULT_SETTINGS = {
    openHour: 10,          // 10 صباحًا
    closeHour: 26,         // 2 بعد منتصف الليل (26 = الساعة 2 صباح اليوم التالي)
    slotMinutes: 60,
    nightFrom: 17,         // من 5 مساءً = فترات بالكشافات
    priceDay: 250,         // سعر تجريبي غير مؤكد
    priceNight: 350,       // سعر تجريبي غير مؤكد
    deposit: 150,          // عربون تجريبي غير مؤكد
    cancelHours: 6,        // سياسة إلغاء تجريبية
    depositExpiryHours: 12, // مهلة تأكيد العربون التجريبية — بعدها الفترة ترجع متاحة
    instapay: 'demo-notreal@invalid', // حساب تجريبي غير قابل للدفع إطلاقًا — ليس حساب الملعب الحقيقي
    venuePhone: '01064332009', // منشور على صفحة فيسبوك الرسمية للملعب
    venueAddress: 'شارع طلبة عويضة بعد مستشفى صلاح سالم — الزقازيق'
  };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dISO(offset) { var d = new Date(); d.setDate(d.getDate() + offset); return toISO(d); }
  function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 9); }

  /* ---------- تنسيق عربي ---------- */
  var nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
  var dfLong = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  var dfShort = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'numeric' });

  function money(n) { return nf.format(n) + ' ج'; }
  function fmtDate(iso, long) {
    var d = new Date(iso + 'T12:00:00');
    return (long === false ? dfShort : dfLong).format(d);
  }
  function hourLabel(h) {
    // 13 → "١:٠٠ م" ; 24 → "١٢:٠٠ ص"
    var hh = h % 24;
    var suffix = hh >= 12 ? 'م' : 'ص';
    var h12 = hh % 12; if (h12 === 0) h12 = 12;
    return nf.format(h12) + ':٠٠ ' + suffix;
  }
  function slotLabel(h, mins) {
    mins = mins || 60;
    var endH = h + mins / 60;
    var crosses = endH >= 24;
    // النطاق الزمني معزول LTR عشان ميلتفش في النص العربي، والفترات اللي بتعدي نص الليل متعلّمة صراحة
    return '\u2066' + hourLabel(h) + ' – ' + hourLabel(endH) + '\u2069' + (crosses ? ' (اليوم التالي)' : '');
  }

  /* ---------- الحالة ---------- */
  var state = null;

  function seed() {
    var s = {
      v: 1,
      seededAt: new Date().toISOString(),
      online: true,
      refSeq: 1040,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      bookings: [
        { id: uid('b'), ref: 'ULT-1031', date: dISO(0), hour: 18, name: 'كابتن مصطفى', phone: '01000000001',
          price: 350, deposit: 150, payment: 'cash_full', status: 'confirmed', origin: 'phone', synced: true,
          createdAt: new Date().toISOString(), prevStatus: null },
        { id: uid('b'), ref: 'ULT-1032', date: dISO(0), hour: 20, name: 'يوسف محمد', phone: '01000000002',
          price: 350, deposit: 150, payment: 'instapay', status: 'awaiting_deposit', origin: 'online', synced: true,
          createdAt: new Date().toISOString(), prevStatus: null },
        { id: uid('b'), ref: 'ULT-1033', date: dISO(1), hour: 19, name: 'عمرو طارق', phone: '01000000003',
          price: 350, deposit: 150, payment: 'instapay', status: 'confirmed', origin: 'online', synced: true,
          createdAt: new Date().toISOString(), prevStatus: null },
        { id: uid('b'), ref: 'ULT-1034', date: dISO(1), hour: 21, name: 'حسن علي', phone: '01000000004',
          price: 350, deposit: 150, payment: 'instapay', status: 'awaiting_deposit', origin: 'online', synced: true,
          createdAt: new Date().toISOString(), prevStatus: null },
        { id: uid('b'), ref: 'ULT-1035', date: dISO(2), hour: 22, name: 'أحمد سمير', phone: '01000000005',
          price: 350, deposit: 150, payment: 'cash_full', status: 'confirmed', origin: 'walkin', synced: true,
          createdAt: new Date().toISOString(), prevStatus: null }
      ],
      expenses: [
        { id: uid('x'), date: dISO(-3), category: 'كشافات', amount: 450, note: 'تغيير كشاف ليد بايظ جهة اليمين', origin: 'admin', synced: true },
        { id: uid('x'), date: dISO(-6), category: 'نجيلة', amount: 300, note: 'تسوية وتنظيف النجيلة', origin: 'admin', synced: true },
        { id: uid('x'), date: dISO(-8), category: 'كهربا', amount: 600, note: 'فاتورة كهربا الشهر', origin: 'admin', synced: true }
      ],
      issues: [
        { id: uid('m'), title: 'كشاف جهة اليمين نوره ضعيف', category: 'كشافات', status: 'fixing',
          date: dISO(-2), note: 'المتعهد قال يخلصه الأسبوع الجاي (تجريبي)' }
      ],
      closures: [],
      otps: {},
      syncLog: []
    };
    return s;
  }

  function sweepExpiry() {
    var ms = (state.settings.depositExpiryHours || 12) * 3600 * 1000;
    var changed = false;
    state.bookings.forEach(function (b) {
      if (b.status === 'awaiting_deposit' && Date.now() - new Date(b.createdAt).getTime() > ms) {
        b.status = 'expired'; changed = true;
      }
    });
    if (changed) save();
  }
  /* نسخة احتياطية في الذاكرة لما التخزين المحلي يكون محظور (زي المعاينة المستضافة) —
     التجربة تفضل شغالة لكن البيانات بتتمسح مع إعادة تحميل الصفحة */
  var memStore = null;
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = memStore; }
    if (raw) {
      try { state = JSON.parse(raw); sweepExpiry(); return state; } catch (e2) { /* تخزين تالف → بذرة جديدة */ }
    }
    state = seed();
    save();
    return state;
  }
  function save() {
    var s = JSON.stringify(state);
    try { localStorage.setItem(LS_KEY, s); } catch (e) { memStore = s; }
  }
  function reset() { state = seed(); save(); return state; }

  function nextRef() { state.refSeq += 1; return 'ULT-' + state.refSeq; }

  /* ---------- الفترات ---------- */
  function slotStart(dateISO, hour) {
    var d = new Date(dateISO + 'T00:00:00');
    d.setHours(hour); // hour ممكن 24 أو 25 → يعدّي لبعد منتصف الليل تلقائيًا
    return d;
  }
  function isPast(dateISO, hour) { return slotStart(dateISO, hour).getTime() <= Date.now(); }

  function priceFor(hour) {
    return hour >= state.settings.nightFrom ? state.settings.priceNight : state.settings.priceDay;
  }

  var ACTIVE_STATUSES = ['awaiting_deposit', 'confirmed', 'offline_pending', 'conflict'];

  function bookingAt(dateISO, hour) {
    return state.bookings.find(function (b) {
      return b.date === dateISO && b.hour === hour && ACTIVE_STATUSES.indexOf(b.status) !== -1;
    }) || null;
  }

  function closureAt(dateISO, hour) {
    return state.closures.find(function (c) {
      return c.active && c.date === dateISO && hour >= c.fromHour && hour < c.toHour;
    }) || null;
  }

  /* حالة كل فترة في يوم معين لواجهة الحجز */
  function slotsFor(dateISO) {
    var out = [];
    var s = state.settings;
    for (var h = s.openHour; h < s.closeHour; h++) {
      var bk = bookingAt(dateISO, h);
      var closed = closureAt(dateISO, h);
      var st = 'available';
      if (bk) st = bk.status === 'conflict' ? 'conflict' : 'booked';
      else if (closed) st = 'closed';
      out.push({
        hour: h,
        label: slotLabel(h, s.slotMinutes),
        price: priceFor(h),
        status: st,
        past: isPast(dateISO, h),
        reason: closed ? closed.reason : null
      });
    }
    return out;
  }

  function nextAvailable() {
    for (var d = 0; d < 14; d++) {
      var iso = dISO(d);
      var slots = slotsFor(iso);
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].status === 'available' && !slots[i].past) {
          return { date: iso, hour: slots[i].hour, label: fmtDate(iso) + ' — ' + slotLabel(slots[i].hour) };
        }
      }
    }
    return null;
  }

  /* ---------- الحجوزات ---------- */
  /* method: 'instapay' (عربون بتحويل) | 'cash_full' (كاش كامل) */
  function addBooking(o) {
    var bk = {
      id: uid('b'),
      ref: nextRef(),
      date: o.date, hour: o.hour,
      name: o.name, phone: o.phone,
      price: priceFor(o.hour),
      deposit: state.settings.deposit,
      payment: o.method || 'instapay',
      origin: o.origin || 'online',
      createdAt: new Date().toISOString(),
      prevStatus: null
    };
    if (!state.online) {
      bk.status = 'offline_pending';
      bk.synced = false;
    } else {
      bk.status = o.method === 'cash_full' ? 'confirmed' : 'awaiting_deposit';
      bk.synced = true;
    }
    state.bookings.push(bk);
    save();
    return bk;
  }

  function cancelBooking(id) {
    var b = byId(id); if (!b) return;
    b.status = 'cancelled'; save();
  }
  function confirmDeposit(id) {
    var b = byId(id); if (!b) return;
    b.status = 'confirmed'; save();
  }
  function rejectDeposit(id) {
    var b = byId(id); if (!b) return;
    b.status = 'cancelled'; save();
  }
  function byId(id) { return state.bookings.find(function (b) { return b.id === id; }) || null; }

  /* ---------- المصاريف ---------- */
  function addExpense(o) {
    var x = {
      id: uid('x'), date: o.date, category: o.category, amount: Number(o.amount) || 0,
      note: o.note || '', origin: 'admin', synced: state.online
    };
    state.expenses.push(x); save(); return x;
  }

  /* ---------- الصيانة ---------- */
  function addIssue(o) {
    var m = { id: uid('m'), title: o.title, category: o.category, status: 'open',
      date: o.date || dISO(0), note: o.note || '' };
    state.issues.push(m); save(); return m;
  }
  function cycleIssue(id) {
    var m = state.issues.find(function (i) { return i.id === id; }); if (!m) return;
    m.status = m.status === 'open' ? 'fixing' : m.status === 'fixing' ? 'done' : 'open';
    save();
  }
  /* القفل لا يمس الحجوزات القائمة: الفترات الفاضية بس هي اللي تتقفل،
     والحجوزات المتأثرة ترجع في affected عشان صاحب الملعب يحسمها بنفسه */
  function addClosure(o) {
    var c = { id: uid('c'), date: o.date, fromHour: o.fromHour, toHour: o.toHour,
      reason: o.reason || 'صيانة', active: true };
    state.closures.push(c);
    var affected = state.bookings.filter(function (b) {
      return ACTIVE_STATUSES.indexOf(b.status) !== -1 &&
             b.date === c.date && b.hour >= c.fromHour && b.hour < c.toHour;
    });
    save();
    return { closure: c, affected: affected };
  }
  function closureAffected(c) {
    return state.bookings.filter(function (b) {
      return ACTIVE_STATUSES.indexOf(b.status) !== -1 &&
             b.date === c.date && b.hour >= c.fromHour && b.hour < c.toHour;
    });
  }
  function removeClosure(id) {
    state.closures = state.closures.filter(function (c) { return c.id !== id; }); save();
  }

  /* ---------- الأوفلاين والمزامنة ---------- */
  function setOnline(b) { state.online = !!b; save(); }

  function pendingSyncCount() {
    return state.bookings.filter(function (b) { return b.synced === false; }).length +
           state.expenses.filter(function (x) { return x.synced === false; }).length;
  }

  /* لما النت يرجع: فحص الحجوزات المتسجلة أوفلاين.
     أي حجز بيضرب مع حجز تاني على نفس الفترة → الاتنين «متضارب» والفترة تتقفل. */
  function syncNow() {
    var result = { synced: 0, conflicts: [] };
    var offs = state.bookings.filter(function (b) { return b.synced === false; });
    offs.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
    offs.forEach(function (b) {
      var other = state.bookings.find(function (a) {
        return a.id !== b.id && a.date === b.date && a.hour === b.hour &&
               ACTIVE_STATUSES.indexOf(a.status) !== -1;
      });
      if (other) {
        other.prevStatus = other.prevStatus || other.status;
        other.status = 'conflict';
        b.prevStatus = b.payment === 'cash_full' ? 'confirmed' : 'awaiting_deposit';
        b.status = 'conflict';
        b.synced = true;
        result.conflicts.push([other.id, b.id]);
      } else {
        b.status = b.payment === 'cash_full' ? 'confirmed' : 'awaiting_deposit';
        b.synced = true;
        result.synced++;
      }
    });
    state.expenses.forEach(function (x) { if (x.synced === false) { x.synced = true; result.synced++; } });
    state.syncLog.push({ at: new Date().toISOString(), synced: result.synced, conflicts: result.conflicts.length });
    save();
    return result;
  }

  function conflicts() {
    var map = {};
    state.bookings.forEach(function (b) {
      if (b.status === 'conflict') {
        var k = b.date + '|' + b.hour;
        (map[k] = map[k] || []).push(b);
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  /* صاحب الملعب يحسم التضارب: keepId يفضل، الباقي يتلغي */
  function resolveConflict(keepId) {
    var keep = byId(keepId); if (!keep || keep.status !== 'conflict') return;
    var group = state.bookings.filter(function (b) {
      return b.status === 'conflict' && b.date === keep.date && b.hour === keep.hour;
    });
    group.forEach(function (b) {
      if (b.id === keepId) { b.status = b.prevStatus || (b.payment === 'cash_full' ? 'confirmed' : 'awaiting_deposit'); }
      else { b.status = 'cancelled'; }
      b.prevStatus = null;
    });
    save();
  }

  /* ---------- حجوزاتي (رقم الموبايل = معرّف بحث مش كلمة سر) ---------- */
  function requestOtp(phone) {
    var code = String(Math.floor(1000 + Math.random() * 9000));
    state.otps[phone] = { code: code, at: Date.now() };
    save();
    return code; // ديمو: الكود بيظهر على الشاشة بدل ما يتبعت SMS
  }
  function verifyOtp(phone, code) {
    var o = state.otps[phone];
    return !!(o && o.code === String(code).trim() && Date.now() - o.at < 10 * 60 * 1000);
  }
  function bookingsForPhone(phone) {
    return state.bookings.filter(function (b) {
      return b.phone === phone && ACTIVE_STATUSES.indexOf(b.status) !== -1;
    }).sort(function (a, b) { return (a.date + a.hour) < (b.date + b.hour) ? -1 : 1; });
  }

  /* ---------- ملخص مالي تقديري ---------- */
  function monthSummary() {
    var now = new Date();
    var ym = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
    var income = state.bookings.filter(function (b) {
      return b.status === 'confirmed' && b.date.slice(0, 7) === ym;
    }).reduce(function (t, b) { return t + b.price; }, 0);
    var expenses = state.expenses.filter(function (x) {
      return x.date.slice(0, 7) === ym;
    }).reduce(function (t, x) { return t + x.amount; }, 0);
    return { income: income, expenses: expenses, net: income - expenses, month: ym };
  }

  /* ---------- تصدير ---------- */
  window.Store = {
    load: load, save: save, reset: reset,
    get state() { return state; },
    dISO: dISO, toISO: toISO,
    money: money, fmtDate: fmtDate, hourLabel: hourLabel, slotLabel: slotLabel, nf: nf,
    slotsFor: slotsFor, nextAvailable: nextAvailable, isPast: isPast, priceFor: priceFor,
    addBooking: addBooking, cancelBooking: cancelBooking, confirmDeposit: confirmDeposit,
    rejectDeposit: rejectDeposit, byId: byId,
    addExpense: addExpense, addIssue: addIssue, cycleIssue: cycleIssue,
    addClosure: addClosure, removeClosure: removeClosure, closureAffected: closureAffected,
    setOnline: setOnline, pendingSyncCount: pendingSyncCount, syncNow: syncNow,
    conflicts: conflicts, resolveConflict: resolveConflict,
    requestOtp: requestOtp, verifyOtp: verifyOtp, bookingsForPhone: bookingsForPhone,
    monthSummary: monthSummary,
    slotStart: slotStart
  };
})();
