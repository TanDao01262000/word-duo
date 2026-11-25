#!/usr/bin/env python3
"""Resize, compress, and encrypt Chúng mình photos.

Reads WORD_DUO_PASSCODE from the environment. Never prints or writes the value.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from PIL import Image, ImageOps
import pillow_heif

pillow_heif.register_heif_opener()

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path("/workspace/word-duo-private")
SRC = PRIVATE / "photos"
PROCESSED = PRIVATE / "processed"
OUT = ROOT / "data" / "us"
ITERATIONS = 210_000
CANARY = b"word-duo-us-ok"
MAX_EDGE = 800
TARGET_BYTES = 100_000

# id -> source filename under the private photos folder
PHOTOS = {
    "proposal-smile": "cau-hon-5625.jpg",
    "ring": "cau-hon-5628.jpg",
    "proposal-kiss": "cau-hon-5640.heic",
    "ceremony-hall": "dam-ngo-001.jpg",
    "ceremony-flowers": "dam-ngo-005.jpg",
    "tea": "dam-ngo-010.jpg",
    "ao-dai": "dam-ngo-060.jpg",
    "parents": "dam-ngo-200.jpg",
    "village": "ket-hon-03.heic",
    "marriage": "ket-hon-14.heic",
    "couple-close": "mui-dien-01.heic",
    "coast": "mui-dien-40.heic",
    "hands": "mui-dien-70.heic",
    "sunset": "mui-dien-77.jpg",
    "wave": "mui-dien-79.jpg",
    "restaurant": "nha-trang-01.heic",
    "hotel": "doc-let-01.heic",
    "mother": "doc-let-10.heic",
    "temple-evening": "hoi-an-22.heic",
    "hue": "hue-04.heic",
    "wife-portrait": "tuy-hoa-01.heic",
    "birthday": "tuy-hoa-04.heic",
    "hometown-view": "tuy-hoa-0222-01.heic",
    "home": "family-01.jpg",
    "countryside": "family-28-03.heic",
    "family-outing": "family-28-20.heic",
    "waterfall": "bmt-4386.jpg",
    "wedding": "cousin-wedding-01.jpg",
}

WORDS = [
    {"id": "us-husband", "lemma": "husband", "pos": "noun", "level": "A1", "photo": "proposal-smile",
     "ipa": "/ˈhʌzbənd/", "gloss": "a man that a woman is married to",
     "example": "She smiled at her husband after they signed the papers.",
     "vi": "chồng", "viNote": "Người đàn ông mình đã kết hôn."},
    {"id": "us-wife", "lemma": "wife", "pos": "noun", "level": "A1", "photo": "wife-portrait",
     "ipa": "/waɪf/", "gloss": "a woman that a man is married to",
     "example": "He took a photo of his wife at the café.",
     "vi": "vợ", "viNote": "Người phụ nữ mình đã kết hôn."},
    {"id": "us-home", "lemma": "home", "pos": "noun", "level": "A1", "photo": "home",
     "ipa": "/hoʊm/", "gloss": "the place where you live with the people you love",
     "example": "After the trip, they were happy to be home.",
     "vi": "nhà, tổ ấm", "viNote": "Nơi mình về và cảm thấy bình yên."},
    {"id": "us-family", "lemma": "family", "pos": "noun", "level": "A1", "photo": "family-outing",
     "ipa": "/ˈfæməli/", "gloss": "a group of people who are related, such as parents, children, and sisters",
     "example": "The whole family went out to the countryside together.",
     "vi": "gia đình", "viNote": "Bố mẹ, anh chị em, và người mình yêu."},
    {"id": "us-mother", "lemma": "mother", "pos": "noun", "level": "A1", "photo": "mother",
     "ipa": "/ˈmʌðər/", "gloss": "a woman who has a child",
     "example": "Her mother laughed as they sat on the swings.",
     "vi": "mẹ", "viNote": "Người mẹ trong gia đình."},
    {"id": "us-hotel", "lemma": "hotel", "pos": "noun", "level": "A1", "photo": "hotel",
     "ipa": "/hoʊˈtɛl/", "gloss": "a place you pay to stay when you are travelling",
     "example": "They took a mirror selfie in their hotel room.",
     "vi": "khách sạn", "viNote": "Nơi nghỉ khi đi chơi hoặc đi công việc."},
    {"id": "us-city", "lemma": "city", "pos": "noun", "level": "A1", "photo": "hometown-view",
     "ipa": "/ˈsɪti/", "gloss": "a large and important town",
     "example": "From the rooftop they could see the whole city.",
     "vi": "thành phố", "viNote": "Ở đây là Tuy Hòa, quê nhà."},
    {"id": "us-birthday", "lemma": "birthday", "pos": "noun", "level": "A1", "photo": "birthday",
     "ipa": "/ˈbɝθdeɪ/", "gloss": "the day each year that is the same as the day you were born",
     "example": "They shared a colourful cake on his birthday.",
     "vi": "sinh nhật", "viNote": "Ngày kỷ niệm mình chào đời."},
    {"id": "us-wedding", "lemma": "wedding", "pos": "noun", "level": "A2", "photo": "wedding",
     "ipa": "/ˈwɛdɪŋ/", "gloss": "a ceremony at which two people get married",
     "example": "They dressed up and smiled at a cousin's wedding.",
     "vi": "đám cưới", "viNote": "Lễ cưới, như đám cưới em họ ở Đắk Lắk."},
    {"id": "us-ring", "lemma": "ring", "pos": "noun", "level": "A2", "photo": "ring",
     "ipa": "/rɪŋ/", "gloss": "a circle of metal worn on a finger, often when two people will marry or are married",
     "example": "She held up her hand to show the ring.",
     "vi": "nhẫn", "viNote": "Nhẫn cầu hôn hoặc nhẫn cưới."},
    {"id": "us-parents", "lemma": "parents", "pos": "noun", "level": "A2", "photo": "parents",
     "ipa": "/ˈpɛrənts/", "gloss": "your mother and father",
     "example": "Her parents stood with the family at the engagement ceremony.",
     "vi": "bố mẹ, cha mẹ", "viNote": "Bố mẹ mình; ở quê, bố mẹ làm nông."},
    {"id": "us-village", "lemma": "village", "pos": "noun", "level": "A2", "photo": "village",
     "ipa": "/ˈvɪlɪdʒ/", "gloss": "a small place in the countryside, smaller than a town",
     "example": "They registered their marriage at the office in her village.",
     "vi": "làng, xã", "viNote": "Xã Phú Hòa, tỉnh Phú Yên — quê của vợ."},
    {"id": "us-restaurant", "lemma": "restaurant", "pos": "noun", "level": "A2", "photo": "restaurant",
     "ipa": "/ˈrɛstərənt/", "gloss": "a place where you pay to sit down and eat a meal",
     "example": "They made peace signs over lunch in a restaurant.",
     "vi": "nhà hàng", "viNote": "Nơi ngồi ăn và được phục vụ món."},
    {"id": "us-beach", "lemma": "beach", "pos": "noun", "level": "A2", "photo": "coast",
     "ipa": "/bitʃ/", "gloss": "a sandy or pebbly place by the sea",
     "example": "They stood on the road above the beach at the cape.",
     "vi": "bãi biển", "viNote": "Bãi biển ở Mũi Điện, Phú Yên."},
    {"id": "us-travel", "lemma": "travel", "pos": "verb", "level": "A2", "photo": "temple-evening",
     "ipa": "/ˈtrævəl/", "gloss": "to go from one place to another, especially far from home",
     "example": "They love to travel to old towns and temples together.",
     "vi": "đi du lịch, đi lại", "viNote": "Đi chơi xa, như Hội An, Huế, hay Nha Trang."},
    {"id": "us-farmer", "lemma": "farmer", "pos": "noun", "level": "A2", "photo": "countryside",
     "ipa": "/ˈfɑrmər/", "gloss": "a person who grows crops or keeps animals on the land",
     "example": "Her parents are farmers in their hometown in Phú Yên.",
     "vi": "nông dân", "viNote": "Người làm ruộng, làm vườn; bố mẹ cô ấy là nông dân."},
    {"id": "us-sunset", "lemma": "sunset", "pos": "noun", "level": "A2", "photo": "sunset",
     "ipa": "/ˈsʌnˌsɛt/", "gloss": "the time in the evening when the sun goes down and the sky changes colour",
     "example": "They walked hand in hand at sunset.",
     "vi": "hoàng hôn", "viNote": "Lúc mặt trời lặn, trời vàng và cam."},
    {"id": "us-hometown", "lemma": "hometown", "pos": "noun", "level": "B1", "photo": "hometown-view",
     "ipa": "/ˈhoʊmˌtaʊn/", "gloss": "the town or village where you were born or grew up",
     "example": "Tuy Hòa is her hometown in Phú Yên.",
     "vi": "quê hương, quê nhà", "viNote": "Nơi mình sinh ra và lớn lên — Tuy Hòa, Phú Yên."},
    {"id": "us-marriage", "lemma": "marriage", "pos": "noun", "level": "B1", "photo": "marriage",
     "ipa": "/ˈmærɪdʒ/", "gloss": "the legal relationship of two people as husband and wife",
     "example": "They held up the papers after their marriage was registered.",
     "vi": "hôn nhân, việc kết hôn", "viNote": "Quan hệ vợ chồng đã được đăng ký."},
    {"id": "us-engagement", "lemma": "engagement", "pos": "noun", "level": "B1", "photo": "ceremony-hall",
     "ipa": "/ɪnˈɡeɪdʒmənt/", "gloss": "an agreement to get married; in Vietnam this may include a family ceremony called dạm ngõ",
     "example": "Pink flowers filled the hall at their engagement ceremony.",
     "vi": "lễ dạm ngõ, đính hôn", "viNote": "Lễ hai gia đình chính thức hứa hôn."},
    {"id": "us-proposal", "lemma": "proposal", "pos": "noun", "level": "B1", "photo": "proposal-kiss",
     "ipa": "/prəˈpoʊzəl/", "gloss": "the moment when one person asks another person to marry them",
     "example": "He brought flowers and cake for the proposal.",
     "vi": "lời cầu hôn", "viNote": "Khi một người ngỏ lời xin cưới người kia."},
    {"id": "us-waterfall", "lemma": "waterfall", "pos": "noun", "level": "B1", "photo": "waterfall",
     "ipa": "/ˈwɔtərˌfɔl/", "gloss": "a place where a river falls from a high point over rocks",
     "example": "The family stood together in front of a wide waterfall.",
     "vi": "thác nước", "viNote": "Nước đổ từ trên cao, như thác ở Đắk Lắk."},
    {"id": "us-countryside", "lemma": "countryside", "pos": "noun", "level": "B1", "photo": "countryside",
     "ipa": "/ˈkʌntriˌsaɪd/", "gloss": "land outside towns and cities, with fields, hills, and farms",
     "example": "Green hills stretched out behind them in the countryside.",
     "vi": "vùng quê, miền quê", "viNote": "Nơi có đồng, đồi, và ít nhà cao tầng."},
    {"id": "us-engineer", "lemma": "engineer", "pos": "noun", "level": "B1", "photo": "couple-close",
     "ipa": "/ˌɛndʒəˈnɪr/", "gloss": "a person who designs, builds, or looks after machines, buildings, or software",
     "example": "Her husband works as a software engineer.",
     "vi": "kỹ sư", "viNote": "Người thiết kế hoặc xây dựng máy, nhà, hoặc phần mềm — anh ấy là kỹ sư phần mềm."},
    {"id": "us-reservation", "lemma": "reservation", "pos": "noun", "level": "B1", "photo": "temple-evening",
     "ipa": "/ˌrɛzərˈveɪʃən/", "gloss": "an arrangement to keep a room, table, seat, or trip for someone",
     "example": "She makes hotel and tour reservations for travellers from home.",
     "vi": "đặt chỗ, đặt phòng", "viNote": "Việc giữ phòng, bàn, hoặc tour trước. Cô ấy làm đặt chỗ du lịch tại nhà."},
    {"id": "us-cape", "lemma": "cape", "pos": "noun", "level": "B1", "photo": "coast",
     "ipa": "/keɪp/", "gloss": "a piece of land that sticks out into the sea",
     "example": "They visited the cape at Mũi Điện, which is also known for paragliding.",
     "vi": "mũi đất", "viNote": "Mũi Điện ở Phú Yên, nơi đất nhô ra biển; ở đây còn nổi tiếng với dù lượn (paragliding)."},
    {"id": "us-temple", "lemma": "temple", "pos": "noun", "level": "B1", "photo": "hue",
     "ipa": "/ˈtɛmpəl/", "gloss": "a religious building, often old, where people go to pray or visit",
     "example": "They stood under an umbrella in the rain outside a temple in Huế.",
     "vi": "chùa, đền", "viNote": "Nơi thờ cúng hoặc công trình tâm linh, như ở Huế."},
    {"id": "us-ceremony", "lemma": "ceremony", "pos": "noun", "level": "B2", "photo": "ceremony-flowers",
     "ipa": "/ˈsɛrəˌmoʊni/", "gloss": "a formal event with special traditions, such as a wedding or engagement",
     "example": "The ceremony hall was decorated with pink flowers and soft lights.",
     "vi": "nghi lễ, buổi lễ", "viNote": "Buổi lễ trang trọng, có phong tục riêng."},
    {"id": "us-bouquet", "lemma": "bouquet", "pos": "noun", "level": "B2", "photo": "proposal-smile",
     "ipa": "/buˈkeɪ/", "gloss": "a bunch of flowers, often given on a special day",
     "example": "She held a pink bouquet after he proposed.",
     "vi": "bó hoa", "viNote": "Một bó hoa được tặng trong dịp đặc biệt."},
    {"id": "us-ao-dai", "lemma": "ao dai", "pos": "noun", "level": "B1", "photo": "ao-dai",
     "ipa": "/ˈaʊ zaɪ/", "gloss": "a traditional Vietnamese long dress, often worn at ceremonies",
     "example": "She wore a pink ao dai at the engagement ceremony.",
     "vi": "áo dài", "viNote": "Trang phục truyền thống Việt Nam, thường mặc trong lễ."},
]

# Photos used on the home hero, level badges, and celebrations (may overlap words).
HOME_HERO = "sunset"
HOME_PORTRAIT = "couple-close"
US_BADGE = "proposal-smile"
LEVEL_BADGES = {
    "A1": "couple-close",
    "A2": "coast",
    "B1": "hue",
    "B2": "proposal-smile",
    "C1": "waterfall",
    "C2": "sunset",
}
CELEBRATE = ["proposal-kiss", "hands", "wave", "ring", "wedding", "couple-close", "sunset", "proposal-smile"]


def require_passcode() -> str:
    if "WORD_DUO_PASSCODE" not in os.environ or not os.environ["WORD_DUO_PASSCODE"]:
        sys.exit("WORD_DUO_PASSCODE is not set; refusing to encrypt.")
    return os.environ["WORD_DUO_PASSCODE"]


def derive_key(passcode: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(passcode.encode("utf-8"))


def encrypt(key: bytes, plaintext: bytes) -> bytes:
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, plaintext, None)


def compress_photo(src: Path, dest: Path) -> tuple[int, int, int]:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((MAX_EDGE, MAX_EDGE))
    quality = 82
    dest.parent.mkdir(parents=True, exist_ok=True)
    while quality >= 50:
        im.save(dest, "WEBP", quality=quality, method=6)
        size = dest.stat().st_size
        if size <= TARGET_BYTES or quality <= 50:
            return im.size[0], im.size[1], size
        quality -= 6
    return im.size[0], im.size[1], dest.stat().st_size


def main() -> None:
    passcode = require_passcode()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "photos").mkdir(parents=True, exist_ok=True)

    salt = os.urandom(16)
    key = derive_key(passcode, salt)
    # Drop the passcode from this scope as soon as the key exists.
    del passcode

    photo_meta = []
    for photo_id, filename in PHOTOS.items():
        src = SRC / filename
        if not src.exists():
            sys.exit(f"missing source photo: {filename}")
        webp = PROCESSED / f"{photo_id}.webp"
        w, h, size = compress_photo(src, webp)
        blob = encrypt(key, webp.read_bytes())
        rel = f"photos/{photo_id}.bin"
        (OUT / rel).write_bytes(blob)
        photo_meta.append({
            "id": photo_id,
            "file": rel,
            "mime": "image/webp",
            "width": w,
            "height": h,
            "bytes": size,
        })
        print(f"encrypted {photo_id} ({w}x{h}, {size}B webp, {len(blob)}B blob)")

    words_blob = encrypt(key, json.dumps({"words": WORDS}, ensure_ascii=False, indent=2).encode("utf-8"))
    (OUT / "words.bin").write_bytes(words_blob)

    canary = encrypt(key, CANARY)
    manifest = {
        "version": 1,
        "kdf": "PBKDF2-SHA256",
        "iterations": ITERATIONS,
        "salt": __import__("base64").b64encode(salt).decode("ascii"),
        "canary": __import__("base64").b64encode(canary).decode("ascii"),
        "words": "words.bin",
        "photos": photo_meta,
        "homeHero": HOME_HERO,
        "homePortrait": HOME_PORTRAIT,
        "usBadge": US_BADGE,
        "levelBadges": LEVEL_BADGES,
        "celebrate": CELEBRATE,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(photo_meta)} photos and {len(WORDS)} words")


if __name__ == "__main__":
    main()
