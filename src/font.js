/**
 * 将 EOT (.fntdata / .eot) 格式转换为 TTF 格式
 * EOT 文件结构：
 * - 0x00-0x03: EOT 头大小
 * - 0x04-0x07: 字体数据大小
 * - 0x08-0x0B: 版本号
 * - 0x0C-0x53: 字体元数据（Panose、字符集等）
 * - 0x54-...: 字体名称字符串
 * - ...: 可选的 RootString、签名等
 * - 最后部分：嵌入的 TTF/OTF 数据
 *
 * @param {ArrayBuffer} eotBuffer - EOT 文件数据
 * @returns {Uint8Array|null} TTF 数据，如果解析失败返回 null
 */
function convertEOTtoTTF(eotBuffer) {
  const data = new DataView(eotBuffer);
  const bytes = new Uint8Array(eotBuffer);

  try {
    // 读取 EOT 头信息
    const eotSize = data.getUint32(0, true); // little-endian
    const fontDataSize = data.getUint32(4, true);
    const version = data.getUint32(8, true);
    const magicNumber = data.getUint16(34, true);

    // 验证 EOT 格式
    if (magicNumber !== 0x504c) {
      return null;
    }

    // 验证版本（支持 1.0, 2.1, 2.2）
    if (
      version !== 0x00010000 &&
      version !== 0x00020001 &&
      version !== 0x00020002
    ) {
      return null;
    }

    // 计算 TTF 数据的起始位置
    // TTF 数据位于 EOT 文件的末尾，大小为 fontDataSize
    const ttfOffset = eotSize - fontDataSize;

    if (ttfOffset < 0 || ttfOffset >= eotSize) {
      return null;
    }

    // 提取 TTF 数据
    const ttfBytes = bytes.slice(ttfOffset, eotSize);

    // 验证 TTF 魔数
    if (ttfBytes.length >= 4) {
      const ttfMagic =
        (ttfBytes[0] << 24) |
        (ttfBytes[1] << 16) |
        (ttfBytes[2] << 8) |
        ttfBytes[3];
      if (ttfMagic !== 0x00010000 && ttfMagic !== 0x4f54544f) {
        return null;
      }
    }

    return ttfBytes;
  } catch (e) {
    return null;
  }
}

/**
 * 从 JSZip 中读取字体文件，返回 Blob URL
 * 支持的格式：
 * - .fntdata / .eot - EOT 格式（PowerPoint 嵌入字体），会转换为 TTF
 * - 其他格式不处理
 */
export async function getFontData(zip, fontPath) {
  const fontFilename = fontPath.split("/").pop();

  try {
    const fontFile = zip.file(fontPath);
    if (!fontFile) return "";

    // 只处理 .fntdata 和 .eot 格式
    if (
      !fontFilename.toLowerCase().endsWith(".fntdata") &&
      !fontFilename.toLowerCase().endsWith(".eot")
    ) {
      return "";
    }

    const buffer = await fontFile.async("arraybuffer");

    // 将 EOT 转换为 TTF
    const ttfBytes = convertEOTtoTTF(buffer);
    if (!ttfBytes) {
      console.warn("Failed to convert EOT to TTF:", fontFilename);
      return "";
    }

    const mimeType = "font/ttf";
    const blobObj = new Blob([ttfBytes], { type: mimeType });
    return URL.createObjectURL(blobObj);
  } catch (e) {
    console.error("Error loading font:", fontPath, e);
    return "";
  }
}

const SYSTEM_FONT_FALLBACK_MAP = {
  // ========== 中文字体 ==========
  // 微软字体
  微软雅黑: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif",
  "Microsoft YaHei":
    "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif",
  "Microsoft YaHei UI":
    "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, sans-serif",
  "微软雅黑 UI": "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, sans-serif",
  宋体: "SimSun, STSong, serif",
  SimSun: "SimSun, STSong, serif",
  新宋体: "NSimSun, SimSun, STSong, serif",
  NSimSun: "NSimSun, SimSun, serif",
  黑体: "SimHei, STHeiti, Heiti SC, sans-serif",
  SimHei: "SimHei, STHeiti, sans-serif",
  仿宋: "FangSong, STFangSong, serif",
  FangSong: "FangSong, STFangSong, serif",
  楷体: "KaiTi, STKaiti, serif",
  KaiTi: "KaiTi, STKaiti, serif",
  仿宋_GB2312: "FangSong_GB2312, FangSong, serif",
  楷体_GB2312: "KaiTi_GB2312, KaiTi, serif",
  方正舒体: "FZShuTi, STSong, serif",
  方正姚体: "FZYaoti, STSong, serif",
  华文细黑: "STXihei, Microsoft YaHei, sans-serif",
  华文楷体: "STKaiti, KaiTi, serif",
  华文宋体: "STSong, SimSun, serif",
  STSong: "STSong, SimSun, serif",
  华文中宋: "STZhongsong, SimSun, serif",
  华文仿宋: "STFangSong, FangSong, serif",
  华文彩云: "STCaiyun, STSong, serif",
  华文琥珀: "STHupo, STSong, serif",
  华文隶书: "STLiti, serif",
  华文行楷: "STXingkai, serif",
  华文新魏: "STXinwei, serif",
  STHeiti: "STHeiti, SimHei, sans-serif",
  苹方: "PingFang SC, Helvetica Neue, sans-serif",
  "PingFang SC": "PingFang SC, Helvetica Neue, sans-serif",
  "PingFang TC": "PingFang TC, PingFang SC, sans-serif",
  "PingFang HK": "PingFang HK, PingFang SC, sans-serif",
  冬青黑体: "Hiragino Sans GB, Microsoft YaHei, sans-serif",
  "Hiragino Sans GB": "Hiragino Sans GB, Microsoft YaHei, sans-serif",
  幼圆: "YouYuan, SimSun, sans-serif",
  YouYuan: "YouYuan, SimSun, sans-serif",
  隶书: "LiSu, STLiti, serif",
  LiSu: "LiSu, STLiti, serif",
  // 思源字体
  "Noto Sans CJK SC": "Noto Sans CJK SC, Microsoft YaHei, sans-serif",
  "Noto Serif CJK SC": "Noto Serif CJK SC, SimSun, serif",
  "Source Han Sans CN": "Source Han Sans CN, Microsoft YaHei, sans-serif",
  "Source Han Serif CN": "Source Han Serif CN, SimSun, serif",

  // ========== 日韩字体 ==========
  Meiryo: "Meiryo, Microsoft YaHei, sans-serif",
  "Meiryo UI": "Meiryo UI, Meiryo, sans-serif",
  "MS Gothic": "MS Gothic, monospace",
  "MS PGothic": "MS PGothic, sans-serif",
  "MS Mincho": "MS Mincho, serif",
  "Yu Gothic": "Yu Gothic, Meiryo, sans-serif",
  "Yu Mincho": "Yu Mincho, serif",
  "Malgun Gothic": "Malgun Gothic, Apple SD Gothic Neo, sans-serif",
  Batang: "Batang, serif",
  Gulim: "Gulim, sans-serif",
  Dotum: "Dotum, sans-serif",

  // ========== Office / Windows 内置英文字体 ==========
  Calibri: "Calibri, Carlito, Helvetica Neue, Arial, sans-serif",
  Cambria: "Cambria, Georgia, serif",
  "Cambria Math": "Cambria Math, Cambria, Georgia, serif",
  Candara: "Candara, Optima, sans-serif",
  Consolas: "Consolas, Menlo, monospace",
  Constantia: "Constantia, Palatino, serif",
  Corbel: "Corbel, Skia, sans-serif",
  "Franklin Gothic Medium": "Franklin Gothic Medium, Arial Narrow, sans-serif",
  "Gill Sans MT": "Gill Sans MT, Gill Sans, sans-serif",
  "Gill Sans": "Gill Sans, Optima, sans-serif",
  Verdana: "Verdana, Geneva, Tahoma, sans-serif",
  Tahoma: "Tahoma, Verdana, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Arial Black": "Arial Black, Gadget, sans-serif",
  "Arial Narrow": "Arial Narrow, Arial, sans-serif",
  "Arial Unicode MS": "Arial Unicode MS, Arial, sans-serif",
  "Times New Roman": "Times New Roman, Times, serif",
  "Courier New": "Courier New, Courier, monospace",
  Georgia: "Georgia, Times New Roman, serif",
  "Palatino Linotype": "Palatino Linotype, Palatino, Book Antiqua, serif",
  "Book Antiqua": "Book Antiqua, Palatino, serif",
  Garamond: "Garamond, Hoefler Text, serif",
  Century: "Century, Times New Roman, serif",
  "Century Gothic": "Century Gothic, Futura, sans-serif",
  "Comic Sans MS": "Comic Sans MS, Chalkboard, cursive",
  Impact: "Impact, Charcoal, sans-serif",
  "Lucida Console": "Lucida Console, Monaco, monospace",
  "Lucida Sans Unicode": "Lucida Sans Unicode, Lucida Grande, sans-serif",
  Symbol: "Symbol, serif",
  Wingdings: "Wingdings, Zapf Dingbats, sans-serif",
  "Wingdings 2": "Wingdings 2, sans-serif",
  "Wingdings 3": "Wingdings 3, sans-serif",
  Webdings: "Webdings, sans-serif",
  "Segoe UI": "Segoe UI, Helvetica Neue, Arial, sans-serif",
  "Segoe UI Light": "Segoe UI Light, Segoe UI, sans-serif",
  "Segoe UI Semibold": "Segoe UI Semibold, Segoe UI, sans-serif",
  "Segoe UI Black": "Segoe UI Black, Segoe UI, sans-serif",
  "Segoe Print": "Segoe Print, Comic Sans MS, cursive",
  "Segoe Script": "Segoe Script, Comic Sans MS, cursive",
  "Trebuchet MS": "Trebuchet MS, Helvetica, sans-serif",
  Palatino: "Palatino, Palatino Linotype, serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  "Helvetica Neue": "Helvetica Neue, Helvetica, Arial, sans-serif",
  Futura: "Futura, Century Gothic, sans-serif",
  Optima: "Optima, Segoe UI, sans-serif",
  Monaco: "Monaco, Consolas, monospace",
  Menlo: "Menlo, Consolas, monospace",
  Roboto: "Roboto, Helvetica Neue, Arial, sans-serif",
  "Open Sans": "Open Sans, Helvetica Neue, Arial, sans-serif",
  Lato: "Lato, Helvetica Neue, Arial, sans-serif",
  Oswald: "Oswald, Impact, sans-serif",
  Raleway: "Raleway, Helvetica Neue, Arial, sans-serif",
  Nunito: "Nunito, Helvetica Neue, Arial, sans-serif",

  // ========== macOS 专有字体 ==========
  "Hiragino Mincho Pro": "Hiragino Mincho Pro, STSong, serif",
  "Hiragino Kaku Gothic Pro":
    "Hiragino Kaku Gothic Pro, Microsoft YaHei, sans-serif",
  "Hiragino Kaku Gothic ProN": "Hiragino Kaku Gothic ProN, sans-serif",
  "Apple LiGothic": "Apple LiGothic, Microsoft YaHei, sans-serif",
  "Apple LiSung": "Apple LiSung, STSong, serif",
  "LiHei Pro": "LiHei Pro, Microsoft YaHei, sans-serif",
  "LiSong Pro": "LiSong Pro, STSong, serif",
};

/**
 * 根据字体名称获取浏览器可用的回退字体栈
 * @param {string} fontName - 原始字体名
 * @returns {string} 完整的 font-family 回退字符串
 */
export function getFontFallback(fontName) {
  if (!fontName) return "";

  // 精确匹配
  if (SYSTEM_FONT_FALLBACK_MAP[fontName]) {
    return SYSTEM_FONT_FALLBACK_MAP[fontName];
  }

  // 大小写不敏感匹配
  const lowerName = fontName.toLowerCase();
  for (const [key, value] of Object.entries(SYSTEM_FONT_FALLBACK_MAP)) {
    if (key.toLowerCase() === lowerName) return value;
  }

  // 部分匹配（如 "Calibri Light" → Calibri 回退）
  for (const [key, value] of Object.entries(SYSTEM_FONT_FALLBACK_MAP)) {
    if (lowerName.startsWith(key.toLowerCase())) {
      // 在回退栈前面插入原始字体名
      return `${fontName}, ${value}`;
    }
  }

  // 无法匹配时，根据字体名猜测类型
  return guessGenericFamily(fontName);
}

/**
 * 根据字体名猜测通用字体族作为最终回退
 */
function guessGenericFamily(fontName) {
  const name = fontName.toLowerCase();

  // 等宽/代码字体
  if (
    name.includes("mono") ||
    name.includes("code") ||
    name.includes("console") ||
    name.includes("courier") ||
    name.includes("terminal") ||
    name.includes("fixed")
  ) {
    return `${fontName}, monospace`;
  }

  // 衬线字体
  if (
    name.includes("serif") ||
    name.includes("roman") ||
    name.includes("mincho") ||
    name.includes("song") ||
    name.includes("sung") ||
    name.includes("ming") ||
    name.includes("times") ||
    name.includes("georgia")
  ) {
    return `${fontName}, serif`;
  }

  // 手写/草书
  if (
    name.includes("script") ||
    name.includes("cursive") ||
    name.includes("hand") ||
    name.includes("writing") ||
    name.includes("kai") ||
    name.includes("shu")
  ) {
    return `${fontName}, cursive`;
  }

  // 默认 sans-serif
  return `${fontName}, sans-serif`;
}
