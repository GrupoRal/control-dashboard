import os
import requests
import csv
import json
from io import StringIO

BASE_URL = "https://api.agritecsoft.com"
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
    resp = requests.get(BASE_URL + ENDPOINT, headers=headers, timeout=60)
    resp.raise_for_status()

    tsv_text = resp.text

    # 2) Parsear TSV
    f = StringIO(tsv_text)
    reader = csv.DictReader(f, delimiter="\t")

    registros = list(reader)

    if not registros:
        print("⚠ No se recibieron registros desde FactBreeding.")
        # Igual guardamos lista vacía
        datos_filtrados = []
    else:
        # Debug: mostrar columnas disponibles y una fila de ejemplo en el log
        print("Columnas disponibles en FactBreeding:")
        print(list(registros[0].keys()))
        print("Ejemplo de fila:")
        print(registros[0])

        datos_filtrados = []
        for fila in registros:
            # Intentar encontrar campo de fecha/semana
            fecha = (
                fila.get("DATE")
                or fila.get("WEEKDATE")
                or fila.get("WEEKENDDATE")
                or fila.get("WEEK")
            )

            # Extraer campos clave (si no existen, usar 0)
            services = int(fila.get("SERVICES", 0) or 0)
            birthings = int(fila.get("BIRTHINGS", 0) or 0)
            nweaned = int(fila.get("NWEANED", 0) or 0)

            # Si las 3 son 0 y no hay fecha, casi no aporta nada (podemos saltarlo)
            if fecha is None and services == 0 and birthings == 0 and nweaned == 0:
                continue

            datos_filtrados.append({
                "date": fecha,
                "services": services,
                "birthings": birthings,
                "nweaned": nweaned
            })

    # 3) Guardar en JSON dentro de sitio1/data/
    salida_path = os.path.join("sitio1", "data", "factbreeding_sitio1.json")
    os.makedirs(os.path.dirname(salida_path), exist_ok=True)

    with open(salida_path, "w", encoding="utf-8") as fjson:
        json.dump(datos_filtrados, fjson, ensure_ascii=False, indent=2)

    print(f"✅ Guardado {len(datos_filtrados)} registros en {salida_path}")


if __name__ == "__main__":
    main()


