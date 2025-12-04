import os
import requests
import csv
import json
from io import StringIO

# ========== CONFIGURACIÓN ==========
# Código de granja (UFL) que me diste:
UFL = "F14CCB3B7"

# Rango de fechas que quieres consultar (ajústalo a tu temporada)
START_DATE = "2025-01-01"
END_DATE   = "2025-12-31"

BASE_URL = "https://api.agritecsoft.com"
ENDPOINT = f"/farms/{UFL}/dailymonitor"

# PAT guardado como secreto en GitHub Actions (AGRITEC_PAT)
PAT = os.environ.get("AGRITEC_PAT")

if not PAT:
    raise RuntimeError("No se encontró la variable de entorno AGRITEC_PAT (tu PAT de Agritec).")

headers = {
    "Authorization": f"Bearer {PAT}"
}

params = {
    "startdate": START_DATE,
    "enddate": END_DATE
}

def main():
    # 1) Llamar a la API
    resp = requests.get(BASE_URL + ENDPOINT, headers=headers, params=params, timeout=60)
    resp.raise_for_status()

    tsv_text = resp.text

    # 2) Parsear TSV recibido
    f = StringIO(tsv_text)
    reader = csv.DictReader(f, delimiter="\t")

    registros = list(reader)

    # 3) Reducir solo a lo que te interesa:
    #    DATE, SERVICES (inseminaciones), BIRTHINGS (partos), NWEANED (destetes)
    datos_simplificados = []
    for fila in registros:
        datos_simplificados.append({
            "date": fila.get("DATE"),
            "services": int(fila.get("SERVICES", 0) or 0),
            "birthings": int(fila.get("BIRTHINGS", 0) or 0),
            "nweaned": int(fila.get("NWEANED", 0) or 0)
        })

    # 4) Guardar en JSON dentro de sitio1/data/
    salida_path = os.path.join("sitio1", "data", "dailymonitor_sitio1.json")
    os.makedirs(os.path.dirname(salida_path), exist_ok=True)

    with open(salida_path, "w", encoding="utf-8") as fjson:
        json.dump(datos_simplificados, fjson, ensure_ascii=False, indent=2)

    print(f"Guardado {len(datos_simplificados)} registros en {salida_path}")


if __name__ == "__main__":
    main()

