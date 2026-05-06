/**
 * 番茄小说去广告 — 合并版 v2
 * 新增：翻页插屏广告相关标志位清除
 */

const url = $request.url || "";

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
                'splash_ads','banner_ads','float_ads','ad_items',
                'insert_ad_config','page_ad_config','chapter_ad_config',
                'interstitial_ad','full_screen_ad','reward_ad_config'];
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

// 关闭所有广告开关（覆盖翻页插屏广告相关字段）
function disableAdFlags(o) {
  if (Array.isArray(o)) { o.forEach(disableAdFlags); return; }
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (
        // 精确匹配常见标志位
        /^(has_ad|show_ad|enable_ad|ad_enable|ad_switch|show_insert_ad|
           has_insert_ad|insert_ad_enable|insert_ad_switch|
           show_page_ad|has_page_ad|page_ad_enable|
           show_interstitial|has_interstitial|interstitial_enable|
           show_full_screen_ad|full_screen_ad_enable|
           show_reward_ad|reward_ad_enable|
           ad_open|ad_show|ad_display)$/ix.test(k) ||
        // 模糊匹配：以 _ad / _ads 结尾
        /[_-]ads?$/i.test(k) ||
        // 模糊匹配：ad_ 开头的开关类
        /^ad[_-]?(enable|show|switch|open|display|support|status|reward|insert|page|interstitial|freq|interval)/i.test(k)
      ) {
        o[k] = typeof o[k] === 'boolean' ? false : 0;
      } else if (/ad[_-]?(list|items|data|info|config|setting)/i.test(k)) {
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

let body = $response.body;
if (!body) { $done({}); }

try {
  let json = JSON.parse(body);

  if (/reader\/full/i.test(url)) {
    json = deepClean(json);
    disableAdFlags(json);

  } else if (/catalog/i.test(url)) {
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
    disableAdFlags(json);
  }

  $done({ body: JSON.stringify(json) });
} catch (e) {
  $done({});
}
