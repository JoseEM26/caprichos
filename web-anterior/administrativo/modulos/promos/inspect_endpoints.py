import json
import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/services_info.json") as f:
    services = json.load(f)

endpoints_info = {}

for s in services:
    if s["type"] == "service" and "Resource" in s["name"]:
        name = s["name"]
        code = s["code"]
        # Find urls inside
        urls = re.findall(r'["\'](/restaurant/api/[^"\']+|/api/[^"\']+|api/rest/[^"\']+|m/rest/[^"\']+)["\']', code)
        # Also find $resource config or Restangular
        res_matches = re.findall(r'\$resource\((.*?)\)', code, re.DOTALL)
        endpoints_info[name] = {
            "urls": list(set(urls)),
            "res_snippet": code[:1000]
        }

print("Resource Endpoints Found:")
for k, v in endpoints_info.items():
    print(f"=== {k} ===")
    print("URLs:", v["urls"])
    # print snippet
    for line in v["res_snippet"].split("\n")[:10]:
        print("  ", line)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/endpoints_extracted.json", "w", encoding="utf-8") as f:
    json.dump(endpoints_info, f, indent=2)
