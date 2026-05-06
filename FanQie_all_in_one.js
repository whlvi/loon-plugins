/**
 * 番茄小说去广告 — 合并版
 * 通过请求 URL 自动判断场景，一个脚本处理所有接口
 */

const url = $request.url || "";

// ── 广告判断工具 ────────────────────────────────────────
const AD_TYPES = new Set([5, 6, 9, 10, 100]);
const AD_KEYS  = ['ad_id', 'ad_info', 'adData', 'ad_source', 'advert'];

function isAdItem(i) {
  if (!i || typeof i !== 'object') return false;
  if (i.type !== undefined && AD_TYPES.has(Number(i.type))) return true;
  for (const k of AD_KEYS) if (i[k] !== undefined) return true;
  if (i.insert_ad || i.ad_insert) return true;
  return false;
}

function deepClean(o) {
  const DROP = ['ad_config','ad_list','ad_info','ad_insert_list','insert_ads',
                'splash_ads','banner_ads','float_ads','ad_items'];
  if (Array.isArray(o)) return o.filter(i => !isAdItem(i)).map(deepClean);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (DROP.includes(k)) continue;
      r[k] = deepClean(v);
    }
    return r;
  }
  return o;
}

function disableAdFlags(o) {
  if (Array.isArray(o)) { o.forEach(disableAdFlags); return; }
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (/^(has_ad|show_ad|enable_ad|ad_enable|ad_switch)$/i.test(k)) {
        o[k] = 0;
      } else if (
        /ad[_-]?(enable|show|switch|open|display|support|status|reward)/i.test(k) ||
        /show[_-]?ad/i.test(k) || /enable[_-]?ad/i.test(k) ||
        /[_-]ad$/i.test(k)  || /[_-]ads$/i.test(k)
      ) {
        o[k] = typeof o[k] === 'boolean' ? false : 0;
      } else if (/ad[_-]?(list|items|data|info|config)/i.test(k)) {
        o[k] = Array.isArray(o[k]) ? [] : {};
      } else {
        disableAdFlags(o[k]);
      }
    }
  }
}

function isCatalogAd(i) {
  if (!i || typeof i !== 'object') return false;
  if (i.chapter_id || i.chapterId || i.chapter_index !== undefined) return false;
  for (const k of AD_KEYS) if (i[k] !== undefined) return true;
  if (i.item_type !== undefined && [1, 2, 99].includes(Number(i.item_type))) return true;
  return false;
}

function isFeedAd(i) {
  if (!i || typeof i !== 'object') return false;
  for (const k of [...AD_KEYS, 'ad_data']) if (i[k] !== undefined) return true;
  if (i.content_type !== undefined && [0, 999, 1000].includes(Number(i.content_type))) return true;
  if (i.cell_type !== undefined && Number(i.cell_type) >= 900) return true;
  return false;
}

// ── 主逻辑 ──────────────────────────────────────────────
let body = $response.body;
if (!body) { $done({}); }

try {
  let json = JSON.parse(body);

  if (/reader\/full/i.test(url)) {
    // 章节内容：深度清理 + 关闭广告标志位
    json = deepClean(json);
    disableAdFlags(json);

  } else if (/catalog/i.test(url)) {
    // 章节目录：过滤广告占位条目
    function cleanCatalog(o) {
      if (Array.isArray(o)) return o.filter(i => !isCatalogAd(i)).map(cleanCatalog);
      if (o && typeof o === 'object') {
        const r = {};
        for (const [k, v] of Object.entries(o)) {
          if (['ad_list','ad_items','insert_ads'].includes(k)) continue;
          r[k] = cleanCatalog(v);
        }
        return r;
      }
      return o;
    }
    json = cleanCatalog(json);

  } else if (/feed/i.test(url)) {
    // 首页 Feed 流
    function cleanFeed(o) {
      if (Array.isArray(o)) return o.filter(i => !isFeedAd(i)).map(cleanFeed);
      if (o && typeof o === 'object') {
        const r = {};
        for (const [k, v] of Object.entries(o)) {
          if (['ad_list','splash_ads','banner_ads','float_ads'].includes(k)) continue;
          r[k] = cleanFeed(v);
        }
        return r;
      }
      return o;
    }
    json = cleanFeed(json);

  } else if (/config/i.test(url)) {
    // 阅读器配置：关闭所有广告开关
    disableAdFlags(json);
  }

  $done({ body: JSON.stringify(json) });
} catch (e) {
  $done({});
}
