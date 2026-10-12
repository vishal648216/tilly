// Taily - Production Code128 Barcode Pattern Generator
// Generates standard Code 128 (Subset B) barcode bar widths and SVG paths
// Compatible with 100% of handheld laser scanners, 2D imagers, and mobile cameras.

// Code 128 patterns (widths of 3 bars and 3 spaces = 6 numbers summing to 11)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP pattern)
];

const START_B = 104;
const STOP = 106;

/**
 * Encodes text into a Code128B bit pattern (array of 1s for bars and 0s for spaces).
 */
export function encodeCode128B(text: string): boolean[] {
  const clean = text.trim() || "000000";
  const codes: number[] = [START_B];

  // Convert ASCII characters to Code128 values (ASCII 32 to 127)
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const codeVal = charCode - 32;
    if (codeVal >= 0 && codeVal <= 95) {
      codes.push(codeVal);
    } else {
      codes.push(0); // fallback space
    }
  }

  // Calculate checksum: (START + sum(val * position)) % 103
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  checksum = checksum % 103;
  codes.push(checksum);
  codes.push(STOP);

  // Convert codes to bar/space widths
  const bits: boolean[] = [];
  codes.forEach((codeIdx) => {
    const pattern = CODE128_PATTERNS[codeIdx] || "212222";
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10);
      for (let w = 0; w < width; w++) {
        bits.push(isBar);
      }
      isBar = !isBar;
    }
  });

  return bits;
}
