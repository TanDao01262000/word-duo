// Vietnamese pronunciation tips. Phonetics follow General American.

export const PITFALL_TIPS = {
  th: {
    title: "Âm th",
    body:
      "/θ/ (think) và /ð/ (they): đặt đầu lưỡi nhẹ giữa hai hàm răng, rồi thổi hơi ra. /θ/ là hơi không rung cổ họng; /ð/ là cùng vị trí nhưng có rung. Đừng chạm lưỡi vào chân răng như âm t/đ, và đừng rít như s.",
  },
  "s-sh": {
    title: "s và sh",
    body:
      "/s/ (see): lưỡi gần chân răng trên, môi bẹt, hơi thoát ra hẹp. /ʃ/ (she): lùi lưỡi về sau một chút và chu môi tròn ra trước, giống khi ra hiệu \"suỵt\". Tiếng Việt miền Bắc dễ đọc cả hai thành s.",
  },
  cluster: {
    title: "Phụ âm ghép",
    body:
      "Đọc liền hai phụ âm, không chèn nguyên âm và không bỏ âm nào: fl-ight, không phải \"phờ-lai\" hay \"phai\"; str-eet đọc liền s-t-r. Bật nhanh qua phụ âm đầu rồi trượt ngay vào âm sau.",
  },
  ending: {
    title: "Đuôi -s và -ed",
    body:
      "-ed: sau âm vô thanh như k, p, s đọc /t/ (booked /bʊkt/); sau âm hữu thanh đọc /d/ (reserved /rɪˈzɝvd/); sau t hoặc d mới thêm âm tiết /ɪd/ (wanted). -s: thường /s/ hoặc /z/; thêm /ɪz/ sau s, sh, ch (watches). Luôn đọc rõ âm cuối.",
  },
  final: {
    title: "Âm cuối",
    body:
      "Tiếng Việt hay bỏ hoặc nuốt âm cuối. Giữ rõ phụ âm cuối: rice kết thúc bằng /s/ không rung, rise bằng /z/ có rung; life có /f/, live có /v/. Kéo dài nhẹ nguyên âm trước âm hữu thanh như /z/ và /v/.",
  },
  vowel: {
    title: "Nguyên âm dài và ngắn",
    body:
      "/iː/ (sheep, seat) dài và căng, môi bẹt như khi cười. /ɪ/ (ship, sit) ngắn và lỏng hơn. /uː/ (pool) dài, môi tròn; /ʊ/ (pull) ngắn. /æ/ (bad, hat) mở miệng rộng hơn /ɛ/ (bed). Ở tiếng Mỹ, /ɑ/ (hot) là âm a mở rộng.",
  },
};

export function sayTipsFor(word) {
  const ipa = (word && word.ipa) || "";
  const lemma = ((word && word.lemma) || "").toLowerCase();
  const tips = [];
  if (/θ/.test(ipa)) tips.push(PITFALL_TIPS.th.body.split(". ")[0] + ". Âm /θ/ không rung cổ họng.");
  if (/ð/.test(ipa)) tips.push("Âm /ð/: lưỡi giữa hai răng như /θ/, nhưng có rung cổ họng. Không đọc thành d hoặc z.");
  if (/ʃ/.test(ipa)) tips.push("Âm /ʃ/: chu môi tròn ra trước, lưỡi lùi nhẹ — khác /s/.");
  if (/tʃ/.test(ipa)) tips.push("Âm /tʃ/ (ch): bắt đầu bằng t rồi nhả ngay ra /ʃ/, môi hơi chu.");
  if (/dʒ/.test(ipa)) tips.push("Âm /dʒ/ (j): giống ch nhưng có rung cổ họng.");
  if (/(?:ed)$/.test(lemma) && /[td]\/$/.test(ipa)) {
    tips.push(
      /ɪd\/$/.test(ipa)
        ? "Đuôi -ed ở đây là /ɪd/, có thêm một âm tiết, vì gốc từ kết thúc bằng t hoặc d."
        : "Đuôi -ed ở đây chỉ là /t/ hoặc /d/ — không thêm âm tiết."
    );
  }
  if (/(?:s|es)$/.test(lemma) && /[sz]\/$/.test(ipa) && !/ss$/.test(lemma)) {
    tips.push("Giữ rõ âm cuối /s/ hoặc /z/ của số nhiều hoặc ngôi thứ ba.");
  }
  if (/(?:^|\/|ˈ|ˌ)(?:[ptkbdgfθsʃ]|tʃ)[rl]/.test(ipa) || /(?:^|\/|ˈ|ˌ)s[ptk]/.test(ipa)) {
    tips.push("Phụ âm ghép ở đầu: đọc liền, không chèn nguyên âm vào giữa.");
  }
  const end = ipa.replace(/\/$/, "");
  if (/[ptkbdgfvsztʃdʒθðʃʒmnŋl]$/.test(end) && !/ɝ$|ər$/.test(end)) {
    tips.push("Đừng bỏ âm cuối — nói rõ phụ âm cuối của từ.");
  }
  if (/ˈ/.test(ipa) && (word.syllables || []).length >= 2) {
    const idx = Number.isInteger(word.stressIndex) ? word.stressIndex : 0;
    const syl = (word.syllables || [])[idx];
    if (syl) tips.push(`Nhấn mạnh âm tiết “${syl}” (dấu ˈ trong IPA đứng trước âm được nhấn).`);
  }
  if (!tips.length) tips.push("Nghe mẫu, rồi nói chậm và rõ từng âm.");
  return tips.slice(0, 3);
}

export function twinsTipFor(pair) {
  const t = PITFALL_TIPS[pair && pair.pitfall];
  return t || { title: "Mẹo nghe", body: "Nghe kỹ nguyên âm và âm cuối của hai từ." };
}
