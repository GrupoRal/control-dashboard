import os
import requests
import csv
import json
from io import StringIO

# ========== CONFIGURACIÓN ==========
# Código de granja (UFL):
UFL = "F14CCB3B7"

BASE_URL = "https://api.agritecsoft.com"
# Usamos Datamart FactBreeding (resumen semanal de reproducción)
ENDPOINT = "/extern/datamart/FactBreeding"

# PAT guardado como secreto en GitHub Actions (AGRITEC_PAT)
PAT = os.environ.get("AGRITEC_PAT")

if not PAT:
    raise RuntimeError("No se encontró la variable de entorno AGRITEC_PAT (tu PAT de Agritec).")

headers = {
    "Authorization": f"Bearer {PAT}"
}

def main():
    # 1) Llamar a la API de Datamart FactBreeding (TSV)
    #    Si el API acepta farms como parámetro, lo usamos; si no, lo ignorará.
    params = {
        "farms": UFL
    }

    resp = requests.get(BASE_URL + ENDPOINT, headers=headers, params=params, timeout=60)
    resp.raise_for_status()

    tsv_text = resp.text

    # 2) Parsear TSV
    f = StringIO(tsv_text)
    reader = csv.DictReader(f, delimiter="\t")

    registros = list(reader)

    if not registros:
        print("No se recibieron registros desde FactBreeding.")
        return

    # Debug: mostrar columnas disponibles en el log de Actions (una sola vez)
    print("Columnas disponibles en FactBreeding:")
    print(list(registros[0].keys()))

    # 3) Filtrar solo la granja que nos interesa, si hay columna FARMUFL/UFL/FARMID
    datos_filtrados = []
    for fila in registros:
        farm_ufl = fila.get("FARMUFL") or fila.get("UFL") or fila.get("FARMID")
        if farm_ufl and farm_ufl != UFL:
            continue  # descartamos otras granjas

        # Intentar encontrar campo de fecha/semana
        fecha = (
            fila.get("DATE")
            or fila.get("WEEKDATE")
            or fila.get("WEEKENDDATE")
            or fila.get("WEEK")
        )

        services = int(fila.get("SERVICES", 0) or 0)
        birthings = int(fila.get("BIRTHINGS", 0) or 0)
        nweaned = int(fila.get("NWEANED", 0) or 0)

        datos_filtrados.append({
            "date": fecha,
            "services": services,
            "birthings": birthings,
            "nweaned": nweaned
        })

    # 4) Guardar en JSON dentro de sitio1/data/
    salida_path = os.path.join("sitio1", "data", "factbreeding_sitio1.json")
    os.makedirs(os.path.dirname(salida_path), exist_ok=True)

    with open(salida_path, "w", encoding="utf-8") as fjson:
        json.dump(datos_filtrados, fjson, ensure_ascii=False, indent=2)

    print(f"Guardado {len(datos_filtrados)} registros en {salida_path}")


if __name__ == "__main__":
    main()


