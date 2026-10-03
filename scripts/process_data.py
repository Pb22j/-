"""
بصير — معالج بيانات السوق السعودي (تاسي)
=========================================
يقرأ ملفات Excel الحقيقية (11 ملف: 10 أسهم + مؤشر تاسي) من مجلد TasiStocks
ويحوّلها إلى JSON واحد خفيف + غني بالبيانات الوصفية، يعمل Offline بالكامل.

المخرجات:
    frontend/public/data/market_data.json

الاستخدام:
    python scripts/process_data.py
"""
import os
import glob
import json
import pandas as pd

# --------------------------------------------------------------------------
# بيانات وصفية لكل سهم: الاسم بالعربي، القطاع، والرمز
# sectors are used by the portfolio-diversification coach (R1/R4 rules)
# and by the intermediate-mode sector-shock stage.
# --------------------------------------------------------------------------
COMPANIES = {
    "AlRajhi_Bank": {
        "ar": "بنك الراجحي", "en": "Al Rajhi Bank", "sector": "بنوك", "sectorKey": "banks",
    },
    "Alinma_Bank": {
        "ar": "بنك الإنماء", "en": "Alinma Bank", "sector": "بنوك", "sectorKey": "banks",
    },
    "Mobily": {
        "ar": "موبليلي", "en": "Mobily", "sector": "اتصالات", "sectorKey": "telecom",
    },
    "Zain_KSA": {
        "ar": "زين السعودية", "en": "Zain KSA", "sector": "اتصالات", "sectorKey": "telecom",
    },
    "SABIC": {
        "ar": "سابك", "en": "SABIC", "sector": "مواد وبتروكيماويات", "sectorKey": "materials",
    },
    "Saudi_Electricity_Company": {
        "ar": "الشركة السعودية للكهرباء", "en": "Saudi Electricity", "sector": "خدمات", "sectorKey": "utilities",
    },
    "Dar_AlArkan": {
        "ar": "دار العقارات", "en": "Dar Al Arkan", "sector": "عقارات", "sectorKey": "realestate",
    },
    "Anaam_Holding": {
        "ar": "أنعام القابضة", "en": "Anaam Holding", "sector": "قابضة", "sectorKey": "holding",
    },
    "Shams": {
        "ar": "شمس", "en": "Shams", "sector": "تأمين", "sectorKey": "insurance",
    },
    "Thimar": {
        "ar": "ثمّار", "en": "Thimar", "sector": "سلع استهلاكية", "sectorKey": "consumer",
    },
}

INDEX_FILE = "TASI"


def clean_price(val) -> float:
    """تقريب السعر لرقمين عشريين + تفريغ القيم الفارغة."""
    if pd.isna(val):
        return 0.0
    return round(float(val), 2)


def load_company(path: str):
    """يقرأ ملف Excel واحد ويرجّع (symbol, records)."""
    df = pd.read_excel(path)
    df.columns = [str(c).lower().strip() for c in df.columns]

    date_col = next((c for c in df.columns if "date" in c or "time" in c), None)
    if not date_col:
        return None, None

    col_map = {"open": "open", "high": "high", "low": "low",
               "close": "close", "volume": "volume", "vol": "volume"}
    out = pd.DataFrame()
    out["time"] = pd.to_datetime(df[date_col])
    for old, new in col_map.items():
        actual = next((c for c in df.columns if old in c), None)
        out[new] = df[actual] if actual else 0.0

    sym_col = next((c for c in df.columns if "symbol" in c or "ticker" in c), None)
    symbol = str(df[sym_col].iloc[0]).replace("TADAWUL:", "") if sym_col else ""

    out = out.sort_values("time").reset_index(drop=True).fillna(0)
    # Saudi Exchange closed Fri + Sat — drop those rows so the cursor
    # always lands on a real trading day.
    weekday = out["time"].dt.dayofweek  # Mon=0, Fri=4, Sat=5, Sun=6
    out = out[(weekday != 4) & (weekday != 5)].reset_index(drop=True)
    out["time"] = out["time"].dt.strftime("%Y-%m-%d")

    for c in ("open", "high", "low", "close"):
        out[c] = out[c].map(clean_price)
    if "volume" in out.columns:
        out["volume"] = out["volume"].map(lambda x: 0.0 if pd.isna(x) else round(float(x)))

    return symbol, out.to_dict(orient="records")


def stats(records):
    """ملخص رقمي لكل سهم — يستخدمه محرك المراقبة والتقارير."""
    closes = [r["close"] for r in records if r["close"] > 0]
    first, last = closes[0], closes[-1]
    lo, hi = min(closes), max(closes)
    return {
        "first": first, "last": last,
        "low": lo, "high": hi,
        "changePct": round(((last - first) / first) * 100, 2),
        "rangePct": round(((hi - lo) / lo) * 100, 2),
    }


def process_market_data(input_dir: str, output_file: str) -> None:
    excel_files = sorted(glob.glob(os.path.join(input_dir, "*.xlsx")))
    if not excel_files:
        print("[!] لم يتم العثور على ملفات Excel في:", input_dir)
        return

    symbols, series, meta = {}, {}, {}

    for path in excel_files:
        # "AlRajhi_Bank_2010_2012.xlsx" -> "AlRajhi_Bank" · "TASI_2010_2012.xlsx" -> "TASI"
        name = os.path.basename(path).replace(".xlsx", "")
        parts = name.split("_")
        key = "_".join(parts[:-2]) if len(parts) > 2 and parts[-2].isdigit() else name

        try:
            symbol, records = load_company(path)
        except Exception as exc:  # noqa: BLE001
            print(f"[x] {name}: فشل القراءة ({exc})")
            continue

        if not records:
            print(f"[x] {name}: لا توجد بيانات صالحة")
            continue

        is_index = key == INDEX_FILE
        info = COMPANIES.get(key, {"ar": key, "en": key, "sector": "مؤشر", "sectorKey": "index"})
        if is_index:
            info = {"ar": "مؤشر تاسي", "en": "TASI Index", "sector": "مؤشر السوق", "sectorKey": "index"}

        symbols[key] = symbol
        series[key] = records
        meta[key] = {**info, "id": key, "symbol": symbol, "isIndex": is_index, **stats(records)}
        print(f"[ok] {info['ar']:<28} {symbol:<6} {len(records)} يوم")

    if not series:
        print("[!] لا توجد بيانات صالحة للحفظ.")
        return

    payload = {
        "meta": meta,
        "order": list(series.keys()),
        "range": {"from": series[list(series)[0]][0]["time"],
                  "to": series[list(series)[0]][-1]["time"]},
        "data": series,
    }

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    kb = os.path.getsize(output_file) / 1024
    print(f"\n[done] {output_file}")
    print(f"       {kb:,.0f} KB · {len(series)} رمز · "
          f"{payload['range']['from']} → {payload['range']['to']}")


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    process_market_data(
        os.path.join(root, "TasiStocks"),
        os.path.join(root, "frontend", "public", "data", "market_data.json"),
    )
