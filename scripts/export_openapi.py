import json

from medikiosk.api.app import create_app

app = create_app()
openapi_schema = app.openapi()

with open("docs/openapi.json", "w", encoding="utf-8") as f:
    json.dump(openapi_schema, f, indent=2)
print("Successfully wrote docs/openapi.json")
