#!/usr/bin/env python3
"""
Importador auditavel para a planilha "Relatorio de todos os processos trabalhistas".

Fluxo seguro:
  1. Sem --commit: gera previa CSV/JSON e nao grava nada.
  2. Com --commit: insere apenas processos novos, pulando numeros ja existentes.
  3. Todos os registros gravados recebem um marcador [IMPORT_JURISBPO_TRABALHISTA:<batch_id>].
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pandas as pd


PRIMARY_SHEETS = [
    "Processos_Henneberg P L",
    "Processos_Rubens",
    "Nelson Wilians",
    "Magela e Noronha",
]

IGNORED_SHEETS = {
    "RJ": "subconjunto/copia da aba Processos_Henneberg P L",
    "Plan2": "subconjunto de processos ja presentes nas abas principais",
    "PMSP": "resumo quantitativo, nao detalhe processual",
    "CEF": "resumo quantitativo, nao detalhe processual",
    "Brasilcap": "resumo quantitativo, nao detalhe processual",
    "Defensoria": "resumo quantitativo, nao detalhe processual",
    "Prodesp": "resumo quantitativo, nao detalhe processual",
    "Folha1": "lista auxiliar sem cabecalho completo de importacao",
}

PROCESS_MARKER_PREFIX = "[IMPORT_JURISBPO_TRABALHISTA:"
DEFAULT_INPUT = Path(".codex-spreadsheet/relatorio_processos_trabalhistas.xlsx")
DEFAULT_OUTPUT_DIR = Path("imports/processos_trabalhistas")


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    text = str(value).strip()
    return not text or text.lower() == "nan"


def clean_text(value: Any) -> str:
    if is_blank(value):
        return ""
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def norm_key(value: Any) -> str:
    text = clean_text(value).lower().replace("\n", " ")
    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    result: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = raw_line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        result[key] = value
    return result


def parse_money(value: Any) -> float | None:
    if is_blank(value):
        return None
    if isinstance(value, (int, float)) and not (isinstance(value, float) and math.isnan(value)):
        return round(float(value), 2)
    text = clean_text(value)
    text = re.sub(r"[^\d,.\-]", "", text)
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def parse_date(value: Any) -> tuple[str | None, str | None]:
    if is_blank(value):
        return None, None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat(), None
    if isinstance(value, dt.datetime):
        return value.date().isoformat(), None
    if isinstance(value, dt.date):
        return value.isoformat(), None
    text = clean_text(value)
    if not text:
        return None, None
    text = text.split(" ")[0]
    patterns = [
        ("%d/%m/%Y", text),
        ("%d.%m.%Y", text),
        ("%d-%m-%Y", text),
        ("%Y-%m-%d", text),
    ]
    for fmt, candidate in patterns:
        try:
            return dt.datetime.strptime(candidate, fmt).date().isoformat(), None
        except ValueError:
            pass
    return None, f"data invalida: {clean_text(value)}"


def parse_hearing(value: Any) -> tuple[str | None, str | None, str | None]:
    text = clean_text(value)
    if not text:
        return None, None, None
    date_match = re.search(r"(\d{1,2}[\/.\-]\d{1,3}[\/.\-]\d{2,4})", text)
    time_match = re.search(r"(\d{1,2}):(\d{2})", text)
    date_iso = None
    warn = None
    if date_match:
        date_iso, warn = parse_date(date_match.group(1))
    if not date_iso:
        return None, None, warn or f"audiencia sem data valida: {text}"
    hour = None
    if time_match:
        h = int(time_match.group(1))
        m = int(time_match.group(2))
        if 0 <= h <= 23 and 0 <= m <= 59:
            hour = f"{h:02d}:{m:02d}"
    return date_iso, hour, None


def format_cnj(value: Any) -> str | None:
    digits = re.sub(r"\D", "", clean_text(value))
    if not digits:
        return None
    if len(digits) <= 20:
        digits = digits.zfill(20)
    if len(digits) == 20:
        return f"{digits[:7]}-{digits[7:9]}.{digits[9:13]}.{digits[13]}.{digits[14:16]}.{digits[16:]}"
    return digits


def process_numbers(value: Any) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    found: list[str] = []
    for raw in re.findall(r"\d{7,}", text):
        number = format_cnj(raw)
        if number and number not in found:
            found.append(number)
    return found


def infer_status_phase(last_update: str, decision: str) -> tuple[str, str]:
    text = norm_key(f"{last_update} {decision}")
    last = norm_key(last_update)
    if "arquivad" in last:
        return "encerrado", "arquivo_definitivo"
    if "execucao" in text or "execu" in text or "sentenca" in text:
        return "ativo", "execucao_sentenca"
    if any(token in text for token in [" trt", " tst", " stf", "recurso", " airr", " rr", " ro "]):
        return "ativo", "recurso"
    return "ativo", "conhecimento"


def result_date_from_text(text: str) -> str | None:
    match = re.search(r"(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})", text or "")
    if not match:
        return None
    parsed, _ = parse_date(match.group(1))
    return parsed


def find_header_row(input_path: Path, sheet_name: str) -> int:
    sample = pd.read_excel(input_path, sheet_name=sheet_name, header=None, nrows=30, engine="openpyxl")
    if sample.empty:
        return 0
    return int(max(range(len(sample)), key=lambda idx: int(sample.iloc[idx].notna().sum())))


def col_lookup(df: pd.DataFrame) -> dict[str, Any]:
    return {norm_key(col): col for col in df.columns}


def get_value(row: pd.Series, columns: dict[str, Any], aliases: list[str]) -> Any:
    for alias in aliases:
        column = columns.get(alias)
        if column is not None:
            return row.get(column)
    return None


def build_summary_text(values: dict[str, str]) -> str:
    sections = [
        ("Pedidos iniciais", values.get("pedidos", "")),
        ("Sentenca", values.get("sentenca", "")),
        ("Recurso ordinario", values.get("recurso", "")),
        ("Acordao", values.get("acordao", "")),
        ("Laudo tecnico", values.get("laudo", "")),
        ("Pericia medica", values.get("pericia_medica", "")),
        ("Perito judicial", values.get("perito", "")),
    ]
    parts = [f"{label}:\n{text}" for label, text in sections if text]
    return "\n\n".join(parts)


def build_observations(batch_id: str, values: dict[str, str], duplicate_notes: list[str]) -> str:
    lines = [
        f"{PROCESS_MARKER_PREFIX}{batch_id}]",
        f"Origem: {values['source_sheet']} linha {values['source_row']}",
        f"Numero(s) na planilha: {values.get('original_numbers', '')}",
    ]
    optional_pairs = [
        ("SITE/cliente de origem", values.get("site", "")),
        ("UF", values.get("uf", "")),
        ("Ultimo andamento", values.get("ultimo", "")),
        ("Audiencia informada", values.get("audiencia_original", "")),
        ("Data do arquivamento e relacao", values.get("arquivamento", "")),
        ("Advogado", values.get("advogado", "")),
        ("Notas extras", values.get("notas_extras", "")),
    ]
    for label, text in optional_pairs:
        if text:
            lines.append(f"{label}: {text}")
    if values.get("related_numbers"):
        lines.append(f"Numeros relacionados: {values['related_numbers']}")
    if duplicate_notes:
        lines.append("Duplicidades consolidadas:")
        lines.extend(f"- {note}" for note in duplicate_notes)
    return "\n".join(lines).strip()


def record_completeness(record: dict[str, Any]) -> int:
    score = 0
    for field in ["data_ajuizamento", "valor_acao", "resultado", "resumo_processo", "observacoes"]:
        value = record.get(field)
        if value not in (None, ""):
            score += len(str(value)) if isinstance(value, str) else 10
    return score


def load_records(input_path: Path, batch_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    workbook = pd.ExcelFile(input_path, engine="openpyxl")
    warnings: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []
    sheet_stats: list[dict[str, Any]] = []

    for sheet_name in workbook.sheet_names:
        if sheet_name not in PRIMARY_SHEETS:
            continue
        header_row = find_header_row(input_path, sheet_name)
        df = pd.read_excel(input_path, sheet_name=sheet_name, header=header_row, engine="openpyxl")
        df = df.dropna(how="all")
        columns = col_lookup(df)
        sheet_rows = 0
        sheet_skipped = 0

        for offset, row in df.iterrows():
            excel_row = int(offset) + header_row + 2
            sheet_rows += 1
            number_cell = get_value(row, columns, ["numero processo", "no processo", "n processo"])
            numbers = process_numbers(number_cell)
            if not numbers:
                sheet_skipped += 1
                warnings.append(
                    {
                        "severity": "error",
                        "sheet": sheet_name,
                        "row": excel_row,
                        "numero": "",
                        "message": "linha sem numero de processo reconhecivel",
                    }
                )
                continue

            title = clean_text(get_value(row, columns, ["polo ativo principal", "nome reclamante"]))
            if not title:
                title = f"Processo {numbers[0]}"
                warnings.append(
                    {
                        "severity": "warning",
                        "sheet": sheet_name,
                        "row": excel_row,
                        "numero": numbers[0],
                        "message": "titulo ausente; usado fallback com numero do processo",
                    }
                )

            date_value = get_value(row, columns, ["data distribuicao"])
            filing_date, date_warning = parse_date(date_value)
            if date_warning:
                warnings.append(
                    {
                        "severity": "warning",
                        "sheet": sheet_name,
                        "row": excel_row,
                        "numero": numbers[0],
                        "message": date_warning,
                    }
                )

            hearing_original = clean_text(
                get_value(row, columns, ["audiencia para", "data audiencia"])
            )
            hearing_date, hearing_time, hearing_warning = parse_hearing(hearing_original)
            if hearing_warning:
                warnings.append(
                    {
                        "severity": "warning",
                        "sheet": sheet_name,
                        "row": excel_row,
                        "numero": numbers[0],
                        "message": hearing_warning,
                    }
                )

            values = {
                "source_sheet": sheet_name,
                "source_row": str(excel_row),
                "original_numbers": clean_text(number_cell),
                "related_numbers": ", ".join(numbers[1:]),
                "site": clean_text(get_value(row, columns, ["site"])),
                "uf": clean_text(get_value(row, columns, ["uf"])),
                "vara": clean_text(get_value(row, columns, ["descricao vara", "vara"])),
                "pedidos": clean_text(get_value(row, columns, ["pedidos iniciais", "pedidos"])),
                "audiencia_original": hearing_original,
                "decisao": clean_text(get_value(row, columns, ["decisao"])),
                "sentenca": clean_text(get_value(row, columns, ["sentenca"])),
                "recurso": clean_text(get_value(row, columns, ["recurso ordinario"])),
                "acordao": clean_text(get_value(row, columns, ["acordao"])),
                "ultimo": clean_text(get_value(row, columns, ["ultimo andamento"])),
                "laudo": clean_text(get_value(row, columns, ["laudo tecnico"])),
                "perito": clean_text(get_value(row, columns, ["perito judicial"])),
                "pericia_medica": clean_text(get_value(row, columns, ["pericia medica"])),
                "arquivamento": clean_text(
                    get_value(row, columns, ["data do arquivamento e relacao"])
                ),
                "advogado": clean_text(get_value(row, columns, ["advogado"])),
                "notas_extras": clean_text(get_value(row, columns, ["unnamed 18", "unnamed 11"])),
            }
            status, phase = infer_status_phase(values["ultimo"], values["decisao"])
            value_claim = parse_money(get_value(row, columns, ["valor causa"]))
            result_date = result_date_from_text(values["arquivamento"] or values["sentenca"])

            raw_records.append(
                {
                    "numero": numbers[0],
                    "all_numbers": numbers,
                    "titulo": title,
                    "tribunal": values["vara"],
                    "orgao": values["site"],
                    "categoria": "trabalhista",
                    "data_ajuizamento": filing_date,
                    "valor_acao": value_claim,
                    "status": status,
                    "fase": phase,
                    "resultado": values["decisao"] or None,
                    "data_resultado": result_date,
                    "transito_julgado": status == "encerrado",
                    "resumo_processo": build_summary_text(values),
                    "observacoes_values": values,
                    "hearing": {
                        "original": hearing_original,
                        "date": hearing_date,
                        "time": hearing_time,
                    }
                    if hearing_date
                    else None,
                    "source_sheet": sheet_name,
                    "source_row": excel_row,
                }
            )

        sheet_stats.append(
            {
                "sheet": sheet_name,
                "rows": sheet_rows,
                "skipped": sheet_skipped,
                "importable_rows": sheet_rows - sheet_skipped,
            }
        )

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in raw_records:
        grouped[record["numero"]].append(record)

    consolidated: list[dict[str, Any]] = []
    for numero, records in grouped.items():
        records = sorted(records, key=record_completeness, reverse=True)
        main = dict(records[0])
        duplicate_notes = []
        for dup in records[1:]:
            duplicate_notes.append(
                f"{dup['source_sheet']} linha {dup['source_row']} ({dup.get('titulo') or 'sem titulo'})"
            )
            if dup.get("hearing") and not main.get("hearing"):
                main["hearing"] = dup["hearing"]
        if len(records) > 1:
            warnings.append(
                {
                    "severity": "info",
                    "sheet": main["source_sheet"],
                    "row": main["source_row"],
                    "numero": numero,
                    "message": f"{len(records)} linhas consolidadas no mesmo numero CNJ",
                }
            )
        main["observacoes"] = build_observations(
            batch_id, main.pop("observacoes_values"), duplicate_notes
        )
        consolidated.append(main)

    consolidated.sort(key=lambda item: (item["source_sheet"], item["source_row"], item["numero"]))
    summary = {
        "input": str(input_path),
        "batch_id": batch_id,
        "primary_sheets": PRIMARY_SHEETS,
        "ignored_sheets": IGNORED_SHEETS,
        "sheet_stats": sheet_stats,
        "raw_importable_rows": len(raw_records),
        "unique_processes": len(consolidated),
        "duplicate_numbers_in_file": sum(1 for records in grouped.values() if len(records) > 1),
        "multi_number_rows": sum(1 for record in raw_records if len(record["all_numbers"]) > 1),
        "warnings_total": len(warnings),
        "warnings_by_severity": dict(Counter(w["severity"] for w in warnings)),
    }
    return consolidated, warnings, summary


class SupabaseRest:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def request(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(f"{self.url}/rest/v1/{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                text = response.read().decode("utf-8")
                if not text:
                    return None
                return json.loads(text)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase HTTP {exc.code} em {method} {path}: {detail}") from exc

    def select(self, table: str, select: str, filters: dict[str, str] | None = None, limit: int | None = None) -> Any:
        params = {"select": select}
        if limit is not None:
            params["limit"] = str(limit)
        query = urllib.parse.urlencode(params)
        extra = ""
        if filters:
            extra = "&" + "&".join(
                f"{urllib.parse.quote(k)}={urllib.parse.quote(v, safe='().,*')}"
                for k, v in filters.items()
            )
        return self.request("GET", f"{table}?{query}{extra}")

    def insert(self, table: str, rows: list[dict[str, Any]]) -> Any:
        return self.request(
            "POST",
            table,
            rows,
            {"Prefer": "return=representation"},
        )


def make_supabase(args: argparse.Namespace) -> SupabaseRest | None:
    if args.no_supabase:
        return None
    env = {}
    env.update(load_env(Path(".env")))
    env.update(load_env(Path(".env.local")))
    url = args.supabase_url or env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        args.supabase_key
        or env.get("SUPABASE_SERVICE_ROLE_KEY")
        or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        raise SystemExit("Supabase URL/chave ausente. Use --no-supabase para apenas gerar previa local.")
    return SupabaseRest(url, key)


def derive_context(
    supabase: SupabaseRest | None,
    escritorio_id: str | None,
    created_by: str | None,
    default_party_name: str,
) -> dict[str, Any]:
    context = {
        "escritorio_id": escritorio_id,
        "created_by": created_by,
        "parte_contraria": default_party_name,
        "parte_contraria_id": None,
        "existing_numbers": {},
    }
    if supabase is None:
        return context

    if not context["escritorio_id"] or not context["created_by"]:
        existing = supabase.select("processos", "id,numero,escritorio_id,created_by", limit=1)
        if existing:
            context["escritorio_id"] = context["escritorio_id"] or existing[0].get("escritorio_id")
            context["created_by"] = context["created_by"] or existing[0].get("created_by")

    if not context["escritorio_id"]:
        links = supabase.select(
            "usuarios_escritorios",
            "usuario_id,escritorio_id,papel,ativo",
            {"ativo": "eq.true"},
            limit=1,
        )
        if links:
            context["escritorio_id"] = links[0].get("escritorio_id")
            context["created_by"] = context["created_by"] or links[0].get("usuario_id")

    if context["escritorio_id"]:
        existing = supabase.select(
            "processos",
            "id,numero",
            {"escritorio_id": f"eq.{context['escritorio_id']}"},
            limit=10000,
        )
        context["existing_numbers"] = {
            row.get("numero"): row.get("id") for row in existing or [] if row.get("numero")
        }
        parts = supabase.select(
            "partes_crm",
            "id,nome,tipo,status",
            {"escritorio_id": f"eq.{context['escritorio_id']}", "status": "eq.ativo"},
            limit=1000,
        )
        normalized_target = norm_key(default_party_name)
        best = None
        for part in parts or []:
            name_norm = norm_key(part.get("nome"))
            if name_norm == normalized_target or ("brbpo tecnologia" in name_norm):
                best = part
                break
        if best:
            context["parte_contraria"] = best.get("nome") or default_party_name
            context["parte_contraria_id"] = best.get("id")

    if not context["escritorio_id"] or not context["created_by"]:
        raise SystemExit(
            "Nao consegui inferir escritorio_id/created_by. Passe --escritorio-id e --created-by."
        )
    return context


def enrich_records(
    records: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    context: dict[str, Any],
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    existing_numbers = context.get("existing_numbers") or {}
    for record in records:
        action = "insert"
        if record["numero"] in existing_numbers:
            action = "skip_existing"
            warnings.append(
                {
                    "severity": "info",
                    "sheet": record["source_sheet"],
                    "row": record["source_row"],
                    "numero": record["numero"],
                    "message": f"ja existe no banco: {existing_numbers[record['numero']]}",
                }
            )
        payload = {
            "escritorio_id": context["escritorio_id"],
            "created_by": context["created_by"],
            "numero": record["numero"],
            "titulo": record["titulo"],
            "parte_contraria": context["parte_contraria"],
            "parte_contraria_id": context.get("parte_contraria_id"),
            "tribunal": record.get("tribunal") or None,
            "orgao": record.get("orgao") or None,
            "categoria": "trabalhista",
            "data_ajuizamento": record.get("data_ajuizamento"),
            "valor_acao": record.get("valor_acao"),
            "status": record.get("status") or "ativo",
            "fase": record.get("fase") or "conhecimento",
            "responsavel_id": context["created_by"],
            "resultado": record.get("resultado"),
            "data_resultado": record.get("data_resultado"),
            "transito_julgado": bool(record.get("transito_julgado")),
            "resumo_processo": record.get("resumo_processo") or None,
            "observacoes": record.get("observacoes") or None,
            "valor_gasto": 0,
            "valor_economizado": 0,
        }
        if payload["status"] == "encerrado":
            payload["fase"] = "arquivo_definitivo"
        enriched.append(
            {
                "action": action,
                "payload": payload,
                "hearing": record.get("hearing"),
                "source_sheet": record["source_sheet"],
                "source_row": record["source_row"],
                "all_numbers": record["all_numbers"],
            }
        )
    return enriched


def preview_row(item: dict[str, Any]) -> dict[str, Any]:
    payload = item["payload"]
    hearing = item.get("hearing") or {}
    return {
        "acao": item["action"],
        "numero": payload["numero"],
        "titulo": payload["titulo"],
        "parte_contraria": payload["parte_contraria"],
        "tribunal": payload.get("tribunal") or "",
        "orgao": payload.get("orgao") or "",
        "data_ajuizamento": payload.get("data_ajuizamento") or "",
        "valor_acao": payload.get("valor_acao") if payload.get("valor_acao") is not None else "",
        "status": payload["status"],
        "fase": payload["fase"],
        "resultado": payload.get("resultado") or "",
        "audiencia_data": hearing.get("date") or "",
        "audiencia_hora": hearing.get("time") or "",
        "origem_aba": item["source_sheet"],
        "origem_linha": item["source_row"],
        "numeros_relacionados": ", ".join(item["all_numbers"][1:]),
    }


def write_outputs(
    output_dir: Path,
    enriched: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    summary: dict[str, Any],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    preview_rows = [preview_row(item) for item in enriched]
    csv_path = output_dir / "preview_processos.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(preview_rows[0].keys()) if preview_rows else [])
        if preview_rows:
            writer.writeheader()
            writer.writerows(preview_rows)
    (output_dir / "preview_processos.json").write_text(
        json.dumps(enriched, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    (output_dir / "warnings.json").write_text(
        json.dumps(warnings, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


def commit_import(
    supabase: SupabaseRest,
    output_dir: Path,
    enriched: list[dict[str, Any]],
    batch_id: str,
) -> dict[str, Any]:
    to_insert = [item for item in enriched if item["action"] == "insert"]
    inserted: list[dict[str, Any]] = []
    for start in range(0, len(to_insert), 100):
        batch = to_insert[start : start + 100]
        rows = [item["payload"] for item in batch]
        inserted.extend(supabase.insert("processos", rows) or [])

    id_by_number = {row.get("numero"): row.get("id") for row in inserted if row.get("numero")}
    activities: list[dict[str, Any]] = []
    for item in to_insert:
        hearing = item.get("hearing")
        process_id = id_by_number.get(item["payload"]["numero"])
        if not hearing or not process_id:
            continue
        activities.append(
            {
                "escritorio_id": item["payload"]["escritorio_id"],
                "tipo": "audiencia",
                "titulo": f"Audiencia - {item['payload']['titulo']}",
                "descricao": f"Audiencia importada da planilha. Origem: {item['source_sheet']} linha {item['source_row']}. Texto original: {hearing.get('original')}",
                "status": "a_fazer",
                "prioridade": "media",
                "processo_id": process_id,
                "responsavel_id": item["payload"]["responsavel_id"],
                "criado_por": item["payload"]["created_by"],
                "prazo": hearing.get("date"),
                "horario": hearing.get("time"),
                "local": "",
                "audiencia_modalidade": "presencial",
                "audiencia_tipo": "inicial",
            }
        )
    inserted_activities: list[dict[str, Any]] = []
    for start in range(0, len(activities), 100):
        inserted_activities.extend(supabase.insert("atividades", activities[start : start + 100]) or [])

    result = {
        "batch_id": batch_id,
        "inserted_processes": len(inserted),
        "inserted_activities": len(inserted_activities),
        "skipped_existing": sum(1 for item in enriched if item["action"] == "skip_existing"),
        "process_ids": [{"id": row.get("id"), "numero": row.get("numero")} for row in inserted],
        "activity_ids": [{"id": row.get("id"), "processo_id": row.get("processo_id")} for row in inserted_activities],
    }
    (output_dir / f"commit_result_{batch_id}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa processos trabalhistas para o JurisBPO.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Arquivo .xlsx convertido da planilha original.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Pasta para previews e logs.")
    parser.add_argument("--batch-id", default=dt.datetime.now().strftime("%Y%m%d%H%M%S"))
    parser.add_argument("--commit", action="store_true", help="Grava no Supabase. Sem isso, roda apenas dry-run.")
    parser.add_argument("--no-supabase", action="store_true", help="Nao consulta Supabase; gera previa local.")
    parser.add_argument("--supabase-url")
    parser.add_argument("--supabase-key")
    parser.add_argument("--escritorio-id")
    parser.add_argument("--created-by")
    parser.add_argument(
        "--default-party",
        default="BRBPO TECNOLOGIA E SERVICOS S.A",
        help="Parte contraria padrao quando encontrada ou usada no CRM.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    if not input_path.exists():
        raise SystemExit(f"Arquivo de entrada nao encontrado: {input_path}")
    if input_path.suffix.lower() != ".xlsx":
        raise SystemExit("Este importador espera .xlsx. Converta uma copia do .xls antes de rodar.")

    records, warnings, summary = load_records(input_path, args.batch_id)
    supabase = make_supabase(args)
    context = derive_context(supabase, args.escritorio_id, args.created_by, args.default_party)
    enriched = enrich_records(records, warnings, context)

    summary.update(
        {
            "mode": "commit" if args.commit else "dry-run",
            "escritorio_id": context.get("escritorio_id"),
            "created_by": context.get("created_by"),
            "parte_contraria": context.get("parte_contraria"),
            "parte_contraria_id": context.get("parte_contraria_id"),
            "existing_in_database": sum(1 for item in enriched if item["action"] == "skip_existing"),
            "to_insert": sum(1 for item in enriched if item["action"] == "insert"),
            "hearings_to_create": sum(1 for item in enriched if item["action"] == "insert" and item.get("hearing")),
            "warnings_total_after_db_check": len(warnings),
            "warnings_by_severity_after_db_check": dict(Counter(w["severity"] for w in warnings)),
        }
    )
    write_outputs(output_dir, enriched, warnings, summary)

    result = None
    if args.commit:
        if supabase is None:
            raise SystemExit("--commit exige conexao com Supabase.")
        result = commit_import(supabase, output_dir, enriched, args.batch_id)

    print(json.dumps({"summary": summary, "commit_result": result}, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
