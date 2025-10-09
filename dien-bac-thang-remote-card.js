/**
 * DienBacThangRemoteCard (no-flicker)
 * Author: Trần Bách
 * Version: 1.0.2
 * Last updated: 2025-10-09
 */
class DienBacThangRemoteCard extends HTMLElement {
  constructor() {
    super();
    this._fetched = false;
    this._built = false;
    this._last = {};
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Cần cấu hình 'entity'.");
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._fetched) {
      this._fetchAndThenBuild();
      this._fetched = true;
      return;
    }
    if (this._built) this._update();
  }

  async _fetchAndThenBuild() {
    const baseUrl = import.meta.url.replace(/\/[^\/]+$/, '');
    const jsonUrl = `${baseUrl}/evn.json`;
    try {
      if (!window._evnGiaDien) {
        const res = await fetch(jsonUrl, { cache: "no-store" });
        if (!res.ok) throw new Error();
        window._evnGiaDien = await res.json();
      }
    } catch {
      this.innerHTML = `<ha-card><div style="padding:16px;color:red;">❌ Không thể tải giá điện.</div></ha-card>`;
      return;
    }
    this._buildOnce();
    this._update();
  }

  _buildOnce() {
    if (this._built) return;

    const title = this._config.name || 'Tiền điện';
    // Wrapper chỉ tạo 1 lần
    this._card = document.createElement('ha-card');
    this._card.setAttribute('header', title);

    const style = document.createElement('style');
    style.textContent = `
      :host, ha-card {
        background: var(--ha-card-background, var(--card-background-color, transparent)) !important;
      }
      .wrap {
        padding: 16px;
        text-align: center;
        contain: content;
        will-change: contents;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      .total {
        font-size: 26px;
        font-weight: bold;
      }
      table {
        width:100%;
        margin-top:12px;
        font-size:14px;
        border-collapse:collapse;
      }
      thead tr { border-bottom:1px solid var(--divider-color, #ccc); }
      td, th { padding: 4px 0; }
      .right { text-align:right; }
      .center { text-align:center; }
      .left { text-align:left; }
      .muted { font-style: italic; padding-top: 6px; opacity: .9; }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    // Tổng tiền (động)
    this._totalEl = document.createElement('div');
    this._totalEl.className = 'total';
    this._totalEl.style.color = 'inherit';

    // Khối detail hoặc short (động, nhưng khung giữ nguyên)
    this._detailBox = document.createElement('div');

    // Lắp DOM
    wrap.appendChild(this._totalEl);
    wrap.appendChild(this._detailBox);
    this._card.appendChild(style);
    this._card.appendChild(wrap);

    // Gắn vào host (không replace mỗi tick)
    this.innerHTML = '';
    this.appendChild(this._card);

    this._built = true;
  }

  _compute() {
    const entity = this._config.entity;
    const data = window._evnGiaDien;
    if (!data) return null;

    const shortFormat = this._config.short || false;
    const showDetail = this._config.detail || false;
    const mode = parseInt(this._config.mode) === 1 ? 1 : 2;

    const number = parseFloat(this._hass.states[entity]?.state) || 0;
    const soBac = parseInt(data.so_bac) || 1;
    const rates = [];
    const tiers = [];

    for (let i = 1; i <= soBac; i++) {
      const bac = data[`b${i}`];
      if (!bac || typeof bac.gia !== 'number') continue;
      rates.push(bac.gia);
      if (i < soBac && typeof bac.kw === 'number') tiers.push(bac.kw);
    }

    let total = 0, remaining = number;
    const breakdown = [];

    for (let i = 0; i < tiers.length && remaining > 0; i++) {
      const used = Math.min(remaining, tiers[i]);
      const money = +(used * rates[i]).toFixed(1);
      total += money;
      breakdown.push({ bac: i + 1, used: +used.toFixed(1), rate: rates[i], money });
      remaining -= used;
    }

    if (remaining > 0) {
      const lastRate = rates[soBac - 1];
      const money = +(remaining * lastRate).toFixed(1);
      total += money;
      breakdown.push({ bac: soBac, used: +remaining.toFixed(1), rate: lastRate, money });
    }

    const vat = +(total * 0.08).toFixed(1);
    const totalVat = Math.round(total + vat);

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const avgPerDay = Math.round(totalVat / (mode === 1 ? dayOfMonth : daysInMonth));

    const display = shortFormat ? this._shortNumber(totalVat) : totalVat.toLocaleString('vi-VN');
    const color = totalVat < 500000 ? 'green' : totalVat < 1000000 ? 'orange' : 'red';
    const avgLabel = mode === 1
      ? `Trung bình mỗi ngày bạn sử dụng ${avgPerDay.toLocaleString('vi-VN')} ₫ tiền điện`
      : `Tháng này trung bình mỗi ngày ${avgPerDay.toLocaleString('vi-VN')} ₫ tiền điện`;

    return { number, breakdown, total, vat, totalVat, display, color, avgLabel, showDetail };
  }

  _update() {
    const calc = this._compute();
    if (!calc) return;

    // Debounce: nếu không đổi gì => không viết lại DOM
    const sig = JSON.stringify({
      n: +calc.number.toFixed(1),
      t: calc.totalVat,
      d: !!calc.showDetail,
      c: calc.color,
      s: !!(this._config.short || false),
      m: parseInt(this._config.mode) === 1 ? 1 : 2,
    });
    if (this._last.sig === sig) return;
    this._last.sig = sig;

    // Cập nhật số tổng
    this._totalEl.textContent = `${calc.display} ₫`;
    this._totalEl.style.color = calc.color;

    // Cập nhật khối chi tiết/tóm tắt
    if (calc.showDetail) {
      // Dựng nội dung bảng nhưng chỉ cập nhật vùng con, không đụng wrapper
      const tbodyRows = calc.breakdown.map(row => `
        <tr>
          <td class="left">B${row.bac}</td>
          <td class="center">${row.used.toFixed(1)}</td>
          <td class="center">${row.rate.toLocaleString('vi-VN')}</td>
          <td class="right">${Math.round(row.money).toLocaleString('vi-VN')}</td>
        </tr>`).join('');
      this._detailBox.innerHTML = `
        <table>
          <thead>
            <tr>
              <th class="left">Bậc</th>
              <th class="center">Số kWh</th>
              <th class="center">Đơn giá</th>
              <th class="right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${tbodyRows}
            <tr><td colspan="3" class="right" style="font-weight:600;">Tổng chưa VAT</td>
                <td class="right">${Math.round(calc.total).toLocaleString('vi-VN')}</td></tr>
            <tr><td colspan="3" class="right" style="font-weight:600;">VAT 8%</td>
                <td class="right">${Math.round(calc.vat).toLocaleString('vi-VN')}</td></tr>
            <tr><td colspan="3" class="right" style="font-weight:700;">Tổng tiền điện</td>
                <td class="right" style="font-weight:700;">${calc.totalVat.toLocaleString('vi-VN')}</td></tr>
            <tr><td colspan="4" class="center muted">${calc.avgLabel}</td></tr>
          </tbody>
        </table>
      `;
    } else {
      this._detailBox.innerHTML = `
        <div style="margin-top:12px;font-size:14px;text-align:left;line-height:1.8;">
          <div><strong>Tổng điện năng:</strong> ${(+calc.number).toFixed(1)} kWh</div>
          <div><strong>Tổng tiền điện:</strong> ${calc.totalVat.toLocaleString('vi-VN')} ₫</div>
          <div><em>${calc.avgLabel}</em></div>
        </div>
      `;
    }
  }

  _shortNumber(n) {
    return n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
         : n >= 1_000     ? (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
         : n.toString();
  }

  getCardSize() { return 2; }
}

customElements.define('dien-bac-thang-remote-card', DienBacThangRemoteCard);
