#!/usr/bin/env python3
"""Export SGC 2026 utility bills from Apple Numbers into server/data JSON for ERP import."""

import json
import os
from datetime import datetime

from numbers_parser import Document

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEFAULT_NUMBERS = os.path.expanduser(
    '~/Library/Mobile Documents/com~apple~Numbers/Documents/'
    'Utility Bills details of SGC all offices - 2026.numbers'
)
OUT_PATH = os.path.join(REPO_ROOT, 'server', 'data', 'utility-bills-2026-centralized-store.json')


def fmt(v):
    if v is None:
        return ''
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, float):
        if abs(v) > 1e12:
            return str(int(v))
        if v == int(v):
            return str(int(v))
        return str(v)
    return str(v).strip()


def first_amount(cells, cols):
    for c in cols:
        if c < len(cells):
            v = cells[c]
            if isinstance(v, (int, float)) and v > 0:
                return int(v) if v == int(v) else round(v, 2)
    return 0


def map_account(ac):
    ac = fmt(ac).strip()
    if not ac or ac.upper() == 'ACCOUNT':
        return ''
    mapping = {
        'PP': 'President Personal',
        'SGC': 'SGC',
        'H/O': 'Head Office',
        'Boly.Pk': 'Boly.pk',
        'Jagha': 'Jagha',
        'Hamza': 'Hamza',
    }
    return mapping.get(ac, ac)


def unique_name(base, suffix):
    name = base[:180]
    if suffix:
        extra = f' ({suffix})'
        if len(name) + len(extra) <= 200:
            name += extra
    return name


def export(numbers_path):
    doc = Document(numbers_path)
    out = {}

    table = doc.sheets[0].tables[0]
    items, last_ac, seen = [], '', {}
    for r in range(4, table.num_rows):
        loc = table.cell(r, 1).value
        if not loc:
            continue
        loc = str(loc).strip()
        if loc.lower() == 'grand total':
            continue
        ref, meter = fmt(table.cell(r, 2).value), fmt(table.cell(r, 3).value)
        if not ref and not meter:
            continue
        ac_raw = fmt(table.cell(r, 11).value)
        if ac_raw:
            last_ac = ac_raw
        cells = [table.cell(r, c).value for c in range(26)]
        name = unique_name(loc, meter or ref)
        key = name.lower()
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            name = unique_name(loc, f'{meter or ref} #{seen[key]}')
        items.append({
            'name': name[:200],
            'location': loc,
            'reference': ref,
            'meterNumber': meter,
            'issueDate': fmt(table.cell(r, 4).value),
            'dueDate': fmt(table.cell(r, 5).value),
            'account': map_account(ac_raw or last_ac),
            'defaultAmount': first_amount(cells, [7, 8, 9, 10, 12, 13, 14, 15]),
            'utilityType': 'Electricity',
        })
    out['IESCO'] = items

    table = doc.sheets[1].tables[0]
    items, seen = [], {}
    for r in range(3, table.num_rows):
        loc = table.cell(r, 1).value
        if not loc:
            continue
        loc = str(loc).strip()
        if loc.lower() == 'grand total' or loc == ' ':
            continue
        ref, meter = fmt(table.cell(r, 2).value), fmt(table.cell(r, 3).value)
        if not ref and not meter:
            continue
        cells = [table.cell(r, c).value for c in range(19)]
        name = unique_name(loc, meter or ref)
        key = name.lower()
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            name = unique_name(loc, f'{meter or ref} #{seen[key]}')
        items.append({
            'name': name[:200],
            'location': loc,
            'reference': ref,
            'meterNumber': meter,
            'issueDate': fmt(table.cell(r, 4).value),
            'dueDate': fmt(table.cell(r, 5).value),
            'account': map_account(table.cell(r, 6).value),
            'defaultAmount': first_amount(cells, [7, 8, 9, 10, 11, 12]),
            'utilityType': 'Gas',
        })
    out['SNGPL'] = items

    table = doc.sheets[2].tables[0]
    items, seen, in_nayatel = [], {}, False
    for r in range(4, table.num_rows):
        desc = table.cell(r, 1).value
        if desc:
            ds = str(desc).strip()
            if ds.upper() == 'NAYATEL':
                in_nayatel = True
                continue
            if 'PTCL TOTAL' in ds.upper() or ds.upper() == 'GRAND TOTAL':
                continue
        if not desc:
            continue
        desc = str(desc).strip()
        if not desc or desc == ' ':
            continue
        if in_nayatel and r >= 38:
            ref, user_id = fmt(table.cell(r, 2).value), fmt(table.cell(r, 3).value)
            ac = map_account(table.cell(r, 6).value)
            cells = [table.cell(r, c).value for c in range(15)]
            amt, tel, acct_id, issue, due = first_amount(cells, [7, 8, 9, 10, 11, 12]), ref, user_id, '', ''
            provider, utility_type = 'Nayatel', 'Internet'
        else:
            tel = fmt(table.cell(r, 2).value).replace('.0', '')
            acct_id = fmt(table.cell(r, 3).value).replace('.0', '')
            issue, due = fmt(table.cell(r, 6).value), fmt(table.cell(r, 7).value)
            ac = map_account(table.cell(r, 8).value)
            cells = [table.cell(r, c).value for c in range(30)]
            amt = first_amount(cells, [9, 10, 11, 12, 13, 14, 15])
            if not amt:
                v4 = table.cell(r, 4).value
                if isinstance(v4, (int, float)) and v4 > 0:
                    amt = int(v4) if v4 == int(v4) else round(v4, 2)
            ref, provider = tel, 'PTCL'
            utility_type = 'Phone' if tel and not str(tel).upper().startswith('SMEN') else 'Internet'
        name = unique_name(desc, tel or acct_id)
        key = f'{provider}:{name.lower()}'
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            name = unique_name(desc, f'{tel or acct_id} #{seen[key]}')
        items.append({
            'name': name[:200],
            'location': desc,
            'reference': ref,
            'telephone': tel,
            'accountId': acct_id,
            'issueDate': issue,
            'dueDate': due,
            'account': ac,
            'defaultAmount': amt,
            'provider': provider,
            'utilityType': utility_type,
        })
    out['PTCL-Nayatel'] = items

    table = doc.sheets[3].tables[0]
    items, seen = [], {}
    for r in range(3, table.num_rows):
        loc = table.cell(r, 0).value
        if not loc:
            continue
        loc = str(loc).strip()
        if loc.lower() == 'grand total':
            continue
        consumer = fmt(table.cell(r, 1).value).replace('.0', '')
        cells = [table.cell(r, c).value for c in range(24)]
        name = unique_name(loc, consumer)
        key = name.lower()
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            name = unique_name(loc, f'{consumer} #{seen[key]}')
        items.append({
            'name': name[:200],
            'location': loc,
            'consumerNumber': consumer,
            'issueDate': fmt(table.cell(r, 2).value),
            'dueDate': fmt(table.cell(r, 3).value),
            'account': map_account(table.cell(r, 4).value),
            'defaultAmount': first_amount(cells, [5, 6, 7, 8]),
            'utilityType': 'Water',
        })
    out['CDA Water'] = items

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    for k, v in out.items():
        print(f'{k}: {len(v)} items')
    print(f'Wrote {OUT_PATH}')


if __name__ == '__main__':
    import sys
    numbers_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_NUMBERS
    if not os.path.exists(numbers_path):
        raise SystemExit(f'Numbers file not found: {numbers_path}')
    export(numbers_path)
